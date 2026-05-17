import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  analyzeCoach,
  apiWsUrl,
  cancelMultiplayerQueue,
  createProfile,
  equipInventoryItem,
  getCampaignProgress,
  getBootstrap,
  getConnectionHealth,
  getDemoUserId,
  getFriends,
  getInventory,
  getLiveLeaderboard,
  getMatchHistory,
  getMultiplayerQueueStatus,
  getMultiplayerRoom,
  getPublicProfile,
  getProfile,
  getVaultItems,
  grantInventoryItem,
  getAccessToken,
  isDemoMode,
  joinMultiplayerQueue,
  onCommanderSessionChange,
  persistAuthSession,
  purchaseVaultItem,
  recordMatch,
  refreshCommanderSession,
  requestProInterest,
  respondFriendRequest,
  restoreAuthSession,
  saveCampaignProgress,
  saveProfile,
  saveProfileAvatar,
  searchPlayers,
  sendFriendRequest,
  signInCommander,
  signOutCommander,
  signUpCommander,
} from "./api/client.js";
import {
  applyMove,
  chooseAiMove,
  cloneBoard,
  countPieces,
  createBoardFromCoordinates,
  createInitialBoard,
  getDashMoves,
  getLegalMoves,
  getPhaseShiftMoves,
  getSunLanceMoves,
  getWinner,
  coordToSquare,
  isDarkSquare,
  isSameSquare,
  PLAYERS,
  squareName,
} from "./game/checkers.js";
import { MENU_MUSIC_TRACKS, audioSettingsDefaults, configureAudio, playSound, speakLine } from "./services/audio.js";
import { abilityArtFor } from "./abilityArt.js";
import { factionArtFor } from "./factionArt.js";
import { cosmeticArtFor } from "./cosmeticArt.js";
import { aiPortraitFor } from "./aiPortraits.js";
import { achievementArtFor } from "./achievementArt.js";
import { campaignArtFor } from "./campaignArt.js";
import { proArtFor } from "./proArt.js";
import { PremiumPieceSkin, PremiumPieceSkinPreview, isPremium2DPieceSkin } from "./premiumPieceSkins.jsx";

const SHOW_ADMIN_DEMO = import.meta.env.DEV || String(import.meta.env.VITE_SHOW_ADMIN_DEMO || "").toLowerCase() === "true";
const DEMO_GUIDE_KEY = "dama-demo-guide-step";
const DEMO_GUIDE_STEPS = ["nexus", "campaign", "match", "report", "vault"];
const DEFAULT_LOADOUT = { factionId: "nomads", passiveId: "open_roads", ultimateId: "dash" };
const ONBOARDING_TUTORIAL_STEPS = [
  {
    label: "Board",
    title: "Move, Capture, Crown",
    copy: "Dama uses dark diagonals. Pick an Azure piece, move to a highlighted square, and take captures whenever the board offers them.",
    points: ["Captures are mandatory", "Multi-captures continue with the same piece", "Reach the far row to become a king"],
  },
  {
    label: "Powers",
    title: "Passives and Ultimates",
    copy: "Every faction changes the rules. Passives are always on, while ultimates spend Momentum after enough turns, captures, or passive triggers.",
    points: ["Passives explain why some pieces can retreat or survive", "Ultimates show legal targets after you arm them", "The action log confirms what changed"],
  },
  {
    label: "Online",
    title: "Rooms, Chat, and Emotes",
    copy: "For PvP, one player hosts a room, the other joins with the code, both press Ready, then the live board opens with chat and emotes.",
    points: ["Chat appears inside multiplayer matches", "Emotes use your owned cosmetics", "Leaving a live PvP board counts as giving up"],
  },
];
const BOOTCAMP_MATCH_PROMPTS = [
  "Bootcamp 1/5: Select an Azure piece. Playable pieces glow, and every legal landing square lights up.",
  "Bootcamp 2/5: Move to one highlighted square. If a capture appears, Dama forces you to take it and continue the chain.",
  "Bootcamp 3/5: Your passive is already active. Build Momentum, then press the Ultimate card when it reaches full charge.",
  "Bootcamp 4/5: After arming the ultimate, choose one highlighted target and watch the action log confirm the ability.",
  "Bootcamp 5/5: Free play. In multiplayer, the chat and emote panel appears on the right after both players enter the match.",
];
const DEFAULT_QUESTS = [
  { quest_id: "daily_capture_5", title: "Capture Chain", progress_count: 0, target_count: 5, reward_shards: 20, is_completed: false },
  { quest_id: "daily_ai_win", title: "Beat Sparring AI", progress_count: 0, target_count: 1, reward_shards: 35, is_completed: false },
  { quest_id: "daily_campaign_clear", title: "Trail Lesson", progress_count: 0, target_count: 1, reward_shards: 30, is_completed: false },
  { quest_id: "daily_puzzle_solve", title: "Solve Daily Tactic", progress_count: 0, target_count: 1, reward_shards: 30, is_completed: false },
];
const DEFAULT_SETTINGS = audioSettingsDefaults();
const DEFAULT_PROFILE = {
  name: "Player",
  username: "Player",
  email: "",
  city: "Almaty",
  profile_picture_url: "",
  bio: "New commander in the Nexus ladder.",
  current_exp: 0,
  level: 1,
  essence: 0,
  shards: 0,
  is_admin: false,
  is_pro: false,
  unlocked_factions: ["nomads"],
  unlocked_abilities: ["open_roads", "dash"],
  owned_cosmetics: [],
  earned_badges: [],
  achievements_claimed: [],
  active_quests: [],
  settings: DEFAULT_SETTINGS,
  streaks: { loginDays: 0, dailyPuzzle: 0, dailyWin: 0, lastLoginDate: null },
  equipped_piece_skin: "",
  equipped_board_skin: "",
  equipped_badge: "",
};
const PIECE_COLOR_PALETTE = [
  { id: "azure", label: "Azure", hex: "#27D8EF" },
  { id: "amber", label: "Amber", hex: "#D88927" },
  { id: "crimson", label: "Crimson", hex: "#E43F5A" },
  { id: "emerald", label: "Emerald", hex: "#26D07C" },
  { id: "gold", label: "Gold", hex: "#FFB400" },
  { id: "amethyst", label: "Amethyst", hex: "#A855F7" },
  { id: "obsidian", label: "Obsidian", hex: "#111827" },
  { id: "pearl", label: "Pearl", hex: "#F4F1DE" },
];
const DEFAULT_PIECE_COLORS = { white: "#27D8EF", black: "#D88927" };
const STANDARD_AMBER_PIECE_COLORS = { ...DEFAULT_PIECE_COLORS, black: "#D88927" };
const DEFAULT_BOARD_PREFERENCES = { viewMode: "3d", pieceColors: DEFAULT_PIECE_COLORS };
const TEXTURE_SEED_CACHE = new Map();
const DEFAULT_MATCH_REPORT = {
  isVictory: true,
  result: "win",
  opponent: "Sparring AI",
  aiProfileId: "tactician",
  difficulty: "Smart",
  gameMode: "power",
  captured: 0,
  lost: 0,
  turns: 0,
  shards: 0,
  essence: 0,
  exp: 0,
  elo: 0,
  review: [],
  replay: [],
  replayFrames: [],
  finalBoard: [],
  equippedPieceSkin: "",
  equippedBoardSkin: "",
  opponentPieceSkin: "",
  opponentBoardSkin: "",
  campaignLevelId: "",
  campaignLevelName: "",
  campaignObjective: "",
  campaignStars: 0,
  campaignNextLevelId: "",
  campaignNextLevelName: "",
  retryMoment: null,
  bestMove: "",
  mistake: "",
  abilityImpact: "",
  nextActions: [],
  factionLevel: 1,
  factionExp: 0,
  nextExp: 200,
  nextUnlock: "Iron Guard",
};
const EMPTY_FRIENDS_DATA = { friends: [], incoming: [], outgoing: [] };
const CHECKERS_COACH_SYSTEM_PROMPT = [
  "You are an expert Checkers coach for Aether-Tactics.",
  "Use only the supplied board state, replay, recent moves, result, mode, and loadout.",
  "Give tactical advice about forced captures, multi-jumps, center control, promotion lanes, king activity, piece safety, and faction abilities.",
  "Do not invent unavailable moves. Reference concrete squares when they are present.",
  "For Retry Moments, give encouraging tactical guidance that helps the player find a better checkers move.",
].join(" ");
const DEFAULT_CAMPAIGN_PROGRESS = {
  completed_levels: [],
  current_level_id: "road_behind",
  stars_earned: 0,
  best_clear_turns: {},
};
const MODE_LABELS = { local: "Local", ai: "vs AI", campaign: "Trail", puzzle: "Puzzle", multiplayer: "Multiplayer" };
const AI_LABELS = { beginner: "Beginner", smart: "Smart", coach: "Coach" };
const AI_PROFILE_BY_LEVEL = { beginner: "recruit", smart: "tactician", coach: "nexus_prime" };
const NEXUS_ROUTES = [
  {
    id: "single",
    label: "Single Player",
    subtext: "Conquer the Void",
    icon: "gamepad",
    children: [
      { id: "skirmish", label: "Skirmish VS AI", subtext: "Practice your tactics", icon: "blade" },
      { id: "campaign", label: "Epic Campaign", subtext: "Follow the Echoes", icon: "map" },
      { id: "daily-puzzle", label: "Daily Challenge", subtext: "Puzzles & streaks", icon: "target" },
    ],
  },
  { id: "multiplayer", label: "Multiplayer", subtext: "Ranked & Casual", icon: "users" },
  { id: "progression", label: "Progression", subtext: "Rewards & Achievements", icon: "trophy" },
  { id: "battle-pass", label: "Battle Pass", subtext: "Season Missions & Skins", icon: "pass" },
  { id: "vault", label: "The Vault", subtext: "Rare Skins & Packs", icon: "vault" },
  { id: "inventory", label: "Inventory", subtext: "Boards, Disks & Badges", icon: "inventory" },
  { id: "codex", label: "Abilities Codex", subtext: "Lore & Mastery", icon: "book" },
];
const AUTH_REQUIRED_ROUTES = new Set(["campaign", "daily-puzzle", "multiplayer", "progression", "battle-pass", "vault", "inventory", "codex", "settings", "loadout", "factions"]);
const AUTH_REQUIRED_VIEWS = new Set(["campaign-select", "campaign-map", "daily-puzzle", "multiplayer", "progression", "battle-pass", "vault", "inventory", "loadout", "factions", "settings", "versus-intro"]);
const NEXUS_FRIENDS = [
  { user_id: "demo-kaelen", username: "Kaelen_Void", name: "Kaelen_Void", faction: "Void Order", favorite_faction: "void_order", avatar: "KV", bio: "Reads tempo like telemetry.", city: "Almaty", level: 9, pvp_stats: { wins: 18, losses: 8, current_win_streak: 4, mmr_elo_rating: 1320 }, threat: "Tactical", presence: "online" },
  { user_id: "demo-suns", username: "Suns_Herald", name: "Suns_Herald", faction: "Sun Court", favorite_faction: "sun_court", avatar: "SH", bio: "Promotion lanes first, captures second.", city: "Astana", level: 7, pvp_stats: { wins: 12, losses: 11, current_win_streak: 1, mmr_elo_rating: 1085 }, threat: "Defensive", presence: "in_menu" },
  { user_id: "demo-nomad", username: "Nomad_Rider", name: "Nomad_Rider", faction: "Nomads", favorite_faction: "nomads", avatar: "NR", bio: "Fast flanks and messy comeback traps.", city: "Shymkent", level: 11, pvp_stats: { wins: 22, losses: 10, current_win_streak: 3, mmr_elo_rating: 1410 }, threat: "Aggressive", presence: "in_match" },
];
const RECENT_MATCHES = [
  { opponent: "Iron_Fist", result: "WIN" },
  { opponent: "Void_Caller", result: "LOSS" },
];
const FEATURE_VIEWS = {
  vault: {
    eyebrow: "Commerce bay",
    title: "The Vault",
    copy: "Premium board skins, faction crests, piece finishes, and seasonal packs will live here.",
    actions: ["Open packs", "Preview skins"],
  },
  codex: {
    eyebrow: "Knowledge archive",
    title: "Abilities Codex",
    copy: "Faction lore, passive mastery, ultimate counters, and campaign lessons will be indexed here.",
    actions: ["Browse factions", "Review abilities"],
  },
};
const MULTIPLAYER_FRIENDS = [
  { user_id: "demo-void-seeker", username: "Void_Seeker", name: "Void_Seeker", status: "In menu", avatar: "VS", accent: "purple", bio: "Void lanes and patient traps.", city: "Almaty", level: 8, pvp_stats: { wins: 16, losses: 7, current_win_streak: 2, mmr_elo_rating: 1275 }, threat: "Tactical", presence: "online" },
  { user_id: "demo-shadow", username: "Shadow_Blade", name: "Shadow_Blade", status: "Searching", avatar: "SB", accent: "amber", bio: "Capture-first duelist.", city: "Astana", level: 6, pvp_stats: { wins: 11, losses: 9, current_win_streak: 1, mmr_elo_rating: 1108 }, threat: "Aggressive", presence: "in_menu" },
  { user_id: "demo-cosmic", username: "Cosmic_Gale", name: "Cosmic_Gale", status: "In match", avatar: "CG", accent: "purple", bio: "Likes long conversion endgames.", city: "Shymkent", level: 12, pvp_stats: { wins: 25, losses: 16, current_win_streak: 0, mmr_elo_rating: 1392 }, threat: "Defensive", presence: "in_match" },
  { user_id: "demo-neon", username: "Neon_Ghost", name: "Neon_Ghost", status: "Online", avatar: "NG", accent: "amber", bio: "Unpredictable flank pressure.", city: "Aktobe", level: 5, pvp_stats: { wins: 8, losses: 8, current_win_streak: 2, mmr_elo_rating: 1015 }, threat: "Tactical", presence: "online" },
  { user_id: "demo-aether", username: "Aether_Pilot", name: "Aether_Pilot", status: "Offline", avatar: "AP", accent: "purple", bio: "Training for ranked sprints.", city: "Global", level: 4, pvp_stats: { wins: 4, losses: 6, current_win_streak: 0, mmr_elo_rating: 940 }, threat: "Unknown", presence: "offline" },
];
const MULTIPLAYER_LEADERS = [
  { rank: 1, name: "Void_Caller", city: "Almaty", elo: 2890 },
  { rank: 2, name: "Stellar_Nova", city: "Astana", elo: 2750 },
  { rank: 3, name: "Quantum_Leap", city: "Shymkent", elo: 2680 },
  { rank: 4, name: "Galactic_Drift", city: "Aktobe", elo: 2590 },
  { rank: 5, name: "Nebula_Echo", city: "Karaganda", elo: 2510 },
];
const SKIRMISH_VARIANTS = [
  { id: "classic", label: "Classic Checkers", subtext: "Standard Rules. No abilities.", icon: "C" },
  { id: "power", label: "Power Checkers", subtext: "Abilities Enabled. Harness the Aether.", icon: "P" },
];
const SKIRMISH_DIFFICULTIES = [
  { id: "recruit", label: "Recruit", stars: 1, engineLevel: "beginner", speed: "38%", aggression: "24%", intel: "Training-grade pattern reader with low capture pressure." },
  { id: "tactician", label: "Tactician", stars: 3, engineLevel: "smart", speed: "61%", aggression: "52%", intel: "Prioritizes captures and clean lane control." },
  { id: "veteran", label: "Veteran", stars: 5, engineLevel: "coach", speed: "78%", aggression: "71%", intel: "Punishes exposed pieces and protects promotion lanes." },
  { id: "nexus_prime", label: "Nexus Prime", stars: 6, engineLevel: "coach", speed: "96%", aggression: "89%", intel: "Elite profile. Reads capture chains and avoids obvious counters." },
];
const VIEW_PATHS = {
  nexus: "/menu",
  register: "/login",
  settings: "/settings",
  vault: "/vault",
  inventory: "/inventory",
  "battle-pass": "/battle-pass",
  loadout: "/loadout",
  factions: "/codex",
  progression: "/progression",
  "skirmish-config": "/skirmish",
  "campaign-select": "/campaign",
  "campaign-map": "/campaign/nomads",
  "daily-puzzle": "/daily",
  multiplayer: "/multiplayer",
  "versus-intro": "/multiplayer/versus",
  postmatch: "/match/summary",
  battlefield: "/battlefield",
  "admin-dashboard": "/admin",
};
const PATH_VIEWS = Object.entries(VIEW_PATHS).reduce((routes, [view, path]) => ({ ...routes, [path]: view }), {});
function modeRouteSegment(nextMode) {
  return ["campaign", "puzzle", "multiplayer"].includes(nextMode) ? nextMode : "ai";
}
function modeFromRouteSegment(segment) {
  return segment === "campaign" || segment === "puzzle" || segment === "multiplayer" ? segment : "ai";
}
function pathForView(nextView, nextMode = "ai", lobbyCode = "") {
  if (nextView === "game") {
    return `/play/${modeRouteSegment(nextMode)}`;
  }
  if (nextView === "lobby") {
    return lobbyCode ? `/lobby/${encodeURIComponent(lobbyCode)}` : "/lobby";
  }
  return VIEW_PATHS[nextView] || "/menu";
}
function routeFromPath(pathname = "/") {
  const cleanPath = pathname.replace(/\/+$/, "") || "/";
  if (cleanPath === "/") {
    return { view: "nexus", mode: null };
  }
  if (cleanPath.startsWith("/play/")) {
    return { view: "game", mode: modeFromRouteSegment(cleanPath.split("/")[2]) };
  }
  if (cleanPath === "/lobby") {
    return { view: "lobby", mode: null, lobbyCode: "" };
  }
  if (cleanPath.startsWith("/lobby/")) {
    return { view: "lobby", mode: null, lobbyCode: decodeURIComponent(cleanPath.split("/")[2] || "").toUpperCase() };
  }
  return { view: PATH_VIEWS[cleanPath] || "nexus", mode: null };
}
function currentRouteFromLocation() {
  return typeof window === "undefined" ? { view: "nexus", mode: null } : routeFromPath(window.location.pathname);
}
function syncBrowserRoute(nextView, nextMode = "ai", replace = false, lobbyCode = "") {
  if (typeof window === "undefined") {
    return;
  }
  const nextPath = pathForView(nextView, nextMode, lobbyCode);
  if (window.location.pathname === nextPath) {
    return;
  }
  const state = { view: nextView, mode: nextMode };
  window.history[replace ? "replaceState" : "pushState"](state, "", nextPath);
}
function AppGlobalBackButton({ onBack, label = "Back" }) {
  return (
    <button className="app-global-back" type="button" onClick={onBack} aria-label={label}>
      <span>{"<"}</span>
      <b>{label}</b>
    </button>
  );
}
const CAMPAIGN_NODE_POSITIONS = [
  { x: 15, y: 50 },
  { x: 34, y: 30 },
  { x: 48, y: 64 },
  { x: 66, y: 38 },
  { x: 84, y: 56 },
];
const CAMPAIGN_SHOWCASES = {
  road_behind: {
    abilityId: "open_roads",
    lessonTitle: "Escape Before The Net Closes",
    disadvantage: "Azure begins outnumbered and boxed near the lower lanes.",
    powerPromise: "Open Roads lets a normal piece retreat backward, something standard checkers cannot do.",
    rewardPreview: "+Campaign stars, Nomads mastery, and a clean first win route.",
    successText: "Open Roads escaped pressure and forced Amber to overextend.",
    recommendedNextAction: "Continue to Dash Raid",
  },
  salt_road_sprint: {
    abilityId: "dash",
    lessonTitle: "Dash Into A Capture Chain",
    disadvantage: "Azure has fewer attackers and cannot reach the center pocket normally.",
    powerPromise: "Dash jumps into the lane without capturing, baiting Amber into a forced multi-jump.",
    rewardPreview: "+Dash mastery, Momentum lesson, and capture-chain practice.",
    successText: "Dash created the pocket that made the double capture possible.",
    recommendedNextAction: "Open the Coach Report",
  },
  dust_trap: {
    abilityId: "dust_veil",
    lessonTitle: "Turn A Trap Into A Counterattack",
    disadvantage: "Amber already has a capture threat lined up on the center.",
    powerPromise: "Dust Veil blocks the first normal capture after a quiet bait move.",
    rewardPreview: "+Defensive mastery and a live cleanup board.",
    successText: "Dust Veil absorbed the threat and kept the bait piece alive.",
    recommendedNextAction: "Finish the remaining patrol",
  },
  storm_gate: {
    abilityId: "sandstorm_corridor",
    lessonTitle: "Close The Enemy's Landing Lanes",
    disadvantage: "The f6 guard controls the exits and can slow every normal attack.",
    powerPromise: "Sandstorm blocks two dark squares, freezing the enemy route before you capture.",
    rewardPreview: "+Board-control mastery and a lane-denial win condition.",
    successText: "Sandstorm denied movement and turned a blocked lane into an attack lane.",
    recommendedNextAction: "Claim the sector report",
  },
  nomad_free_duel: {
    abilityId: "dash",
    lessonTitle: "Use The Whole Nomad Kit",
    disadvantage: "Amber has more bodies, but the board is open enough for tempo tricks.",
    powerPromise: "This is a free match: combine Open Roads, Dash, and capture-chain discipline to win.",
    rewardPreview: "+Nomads campaign clear and mastery progress.",
    successText: "The final duel proved Nomads can win from a material deficit through tempo.",
    recommendedNextAction: "Open the Coach Report",
  },
  iron_shield_anchor: {
    abilityId: "shield_wall",
    lessonTitle: "Own The Center Safely",
    disadvantage: "The center is contested and one unsupported entry would normally be punished.",
    powerPromise: "Shield Wall guards the first allied center entry, turning a risky square into an anchor.",
    rewardPreview: "+Iron Guard passive mastery.",
    successText: "Shield Wall made the center entry safe enough to trade from strength.",
    recommendedNextAction: "Continue to Fortify",
  },
  iron_first_wall: {
    abilityId: "fortify",
    lessonTitle: "Break The Enemy Multi-Jump",
    disadvantage: "Amber threatens a capture string through the center guard.",
    powerPromise: "Fortify protects one allied piece so the enemy must abandon the chain.",
    rewardPreview: "+Iron Guard mastery and defensive faction clarity.",
    successText: "Fortify cancelled the multi-jump and stabilized the center.",
    recommendedNextAction: "Win the live rival duel",
  },
  iron_vengeance_turn: {
    abilityId: "vengeance_ledger",
    lessonTitle: "Turn Loss Into Tempo",
    disadvantage: "Amber wins an early trade, but Iron Guard records the debt.",
    powerPromise: "Vengeance Ledger rewards the next capture after losing a piece with Momentum.",
    rewardPreview: "+Comeback mastery and Fortify setup.",
    successText: "Vengeance Ledger converted a lost piece into the Momentum needed to stabilize.",
    recommendedNextAction: "Learn Barricade",
  },
  iron_barricade_gate: {
    abilityId: "barricade",
    lessonTitle: "Build A Temporary Wall",
    disadvantage: "Amber can enter both central landing squares unless the Guard seals the file.",
    powerPromise: "Barricade blocks two dark squares and forces the enemy to reroute.",
    rewardPreview: "+Board-control mastery.",
    successText: "Barricade turned the center into a fortress and forced Amber off the attack line.",
    recommendedNextAction: "Enter the Bastion Duel",
  },
  iron_bastion_duel: {
    abilityId: "fortify",
    lessonTitle: "Final Bastion Duel",
    disadvantage: "No script remains. Amber has enough threats to punish careless trades.",
    powerPromise: "Win a live match by combining guarded center entries, Fortify, and clean trades.",
    rewardPreview: "+Iron Guard campaign clear.",
    successText: "The Iron Guard final duel proved defense can become pressure.",
    recommendedNextAction: "Open the Coach Report",
  },
  sun_royal_lane: {
    abilityId: "royal_pressure",
    lessonTitle: "Pressure The Crown Lane",
    disadvantage: "Amber owns material, but one runner can enter the royal lane first.",
    powerPromise: "Royal Pressure grants Momentum when a normal piece reaches the enemy final three rows.",
    rewardPreview: "+Sun Court passive mastery.",
    successText: "Royal Pressure turned a forward lane into Momentum before promotion.",
    recommendedNextAction: "Crown a king instantly",
  },
  solar_crown_engine: {
    abilityId: "crown_surge",
    lessonTitle: "Create A King Before The Race Is Lost",
    disadvantage: "Amber's cluster is too tight for a normal piece to break through.",
    powerPromise: "Crown Surge instantly crowns a mid-board piece, opening flying-king diagonals.",
    rewardPreview: "+Sun Court mastery and promotion-pressure proof.",
    successText: "Crown Surge created a king and unlocked a long capture lane.",
    recommendedNextAction: "Use the king to finish",
  },
  sun_crown_tax: {
    abilityId: "crown_tax",
    lessonTitle: "Tax The Enemy Crown",
    disadvantage: "Amber is about to promote first, normally a losing race.",
    powerPromise: "Crown Tax turns the opponent's first king into Momentum for your response.",
    rewardPreview: "+Comeback promotion mastery.",
    successText: "Crown Tax made the enemy promotion fuel the Sun Court counterattack.",
    recommendedNextAction: "Learn Sun Lance",
  },
  sun_lance_return: {
    abilityId: "sun_lance",
    lessonTitle: "Strike Backward Once",
    disadvantage: "The key capture is behind a normal piece and standard checkers forbids it.",
    powerPromise: "Sun Lance lets one normal piece strike like a king for one diagonal capture.",
    rewardPreview: "+Backward-capture mastery.",
    successText: "Sun Lance broke the cluster with a long diagonal strike standard pieces cannot make.",
    recommendedNextAction: "Enter the Coronation Duel",
  },
  sun_coronation_duel: {
    abilityId: "crown_surge",
    lessonTitle: "Final Coronation Duel",
    disadvantage: "Amber has bodies in the promotion lane and will race if you hesitate.",
    powerPromise: "Win a live match by combining pressure, instant kings, and long diagonal strikes.",
    rewardPreview: "+Sun Court campaign clear.",
    successText: "The Sun Court final duel proved promotion pressure can overwhelm material.",
    recommendedNextAction: "Open the Coach Report",
  },
  void_pressure_field: {
    abilityId: "pressure_field",
    lessonTitle: "Read Danger As Fuel",
    disadvantage: "The safe move is too slow; the Void must survive a dangerous bait.",
    powerPromise: "Pressure Field converts the opponent's created threat into Momentum once per match.",
    rewardPreview: "+Void passive mastery.",
    successText: "Pressure Field turned danger into the energy needed for a Void reply.",
    recommendedNextAction: "Learn Echo Mark",
  },
  void_echo_mark: {
    abilityId: "echo_mark",
    lessonTitle: "Punish A Quiet Escape",
    disadvantage: "Amber can slide out of danger unless the move is marked.",
    powerPromise: "Echo Mark marks the first enemy quiet move; capturing it grants Momentum.",
    rewardPreview: "+Trap mastery.",
    successText: "Echo Mark transformed a quiet enemy move into a tactical target.",
    recommendedNextAction: "Open Phase Shift",
  },
  void_first_shift: {
    abilityId: "phase_shift",
    lessonTitle: "Rift Step Behind The Trap",
    disadvantage: "The archive trap cannot be solved by a normal quiet move.",
    powerPromise: "Phase Shift teleports up to three squares to any empty dark square, ignoring blockers.",
    rewardPreview: "+Void preview value and premium faction desire.",
    successText: "Phase Shift jumped through the trap geometry and created a capture angle standard checkers cannot reach.",
    recommendedNextAction: "Learn Collapse",
  },
  void_collapse_gate: {
    abilityId: "collapse",
    lessonTitle: "Erase A Landing Square",
    disadvantage: "Amber's best reply uses one exact dark-square landing.",
    powerPromise: "Collapse voids a dark square so no piece can land there for one turn.",
    rewardPreview: "+Lane-denial mastery.",
    successText: "Collapse removed the critical landing square and broke the enemy plan.",
    recommendedNextAction: "Enter the Archive Duel",
  },
  void_archive_duel: {
    abilityId: "phase_shift",
    lessonTitle: "Final Archive Duel",
    disadvantage: "No script remains. Amber will punish obvious movement and bad timing.",
    powerPromise: "Win a live match using Phase Shift, Collapse, and trap timing.",
    rewardPreview: "+Void campaign clear and premium mastery proof.",
    successText: "The Void final duel proved geometry control can beat material.",
    recommendedNextAction: "Preview Void Pro rewards",
  },
};
const FACTION_CAMPAIGNS = {
  nomads: {
    id: "nomads",
    name: "The Comeback Trail",
    factionId: "nomads",
    description: "Steppe Nomads survive bad positions through escape routes, Dash timing, Dust Veil bait, and Sandstorm lane denial.",
    levels: [
      { id: "road_behind", number: 1, factionId: "nomads", name: "Open Road Escape", hook: "A scout has a safe retreat lane. The lesson is simple: Nomads can step backward before the enemy net closes.", objective: "Use Open Roads to retreat, watch Amber overextend, then finish the live board.", hint: "Select c3 and move backward to d2. Amber follows with d6-c5, then the campaign opens into free play.", clearMessage: "Open Roads proved the Nomads can retreat, reset the angle, and keep tempo.", aiLevel: "beginner", aiPersonality: "nomads", loadout: { factionId: "nomads", passiveId: "open_roads", ultimateId: "dash" }, white: ["a1", "c3", "e1", "g1"], black: ["b6", "d6", "f6", "h6", "a7"] },
      { id: "salt_road_sprint", number: 2, factionId: "nomads", name: "Dash Raid", hook: "Amber left targets hanging around the center. A single rider can Dash into the pocket, bait a reply, and create a clean capture chain.", objective: "Use Dash to reach e3, let Amber step into the lane, then continue the capture chain before free play begins.", hint: "Press the ultimate, choose c1, Dash to e3, then capture e3xc5 and continue c5xa7.", clearMessage: "Dash inserted a rider behind the screen and opened a winning capture corridor.", aiLevel: "beginner", aiPersonality: "nomads", loadout: { factionId: "nomads", passiveId: "open_roads", ultimateId: "dash" }, white: ["a1", "c1", "g1", "h2"], black: ["b6", "c5", "g7", "h6"] },
      { id: "dust_trap", number: 3, factionId: "nomads", name: "Dust Veil Bait", hook: "Amber has a capture ready on the center lane. Dust Veil absorbs the strike, then the Nomads punish with a forced chain.", objective: "Trigger Dust Veil, wait for the blocked e5xc3 jump, remove the main threat, then finish live play.", hint: "Move c3 to d4. After Dust Veil blocks e5xc3 over d4, capture d4xf6 and continue f6xh8. A final patrol remains after the showcase.", clearMessage: "Dust Veil protected the bait piece long enough to counter-capture the main Amber threat.", aiLevel: "beginner", aiPersonality: "nomads", loadout: { factionId: "nomads", passiveId: "dust_veil", ultimateId: "dash" }, white: ["a1", "c3"], black: ["b6", "e5", "g7"] },
      { id: "storm_gate", number: 4, factionId: "nomads", name: "Sandstorm Gate", hook: "Amber's f6 guard controls both exits. Sandstorm closes e5 and g5, then the Nomads turn the frozen lane into a capture chain.", objective: "Use Sandstorm Corridor on e5 and g5, break the gate, then finish live play.", hint: "Arm Sandstorm, block e5 and g5, then capture c3xe5 over d4 and continue e5xg7 over f6. A final patrol remains after the showcase.", clearMessage: "Sandstorm froze the guard long enough for a clean Nomad breakthrough.", aiLevel: "beginner", aiPersonality: "nomads", loadout: { factionId: "nomads", passiveId: "open_roads", ultimateId: "sandstorm_corridor" }, white: ["a1", "c3"], black: ["b6", "d4", "f6"] },
      { id: "nomad_free_duel", number: 5, factionId: "nomads", name: "Caravan Free Duel", hook: "The lessons are done. Amber has more pieces, but the Nomads have tempo, escape lanes, and a full power kit.", objective: "Win a live match using the Nomads toolkit.", hint: "Keep pieces paired, use Open Roads when no capture exists, and spend Dash only when it creates a capture chain.", clearMessage: "The Nomads campaign is clear. The final duel proved the faction can turn mobility into wins.", aiLevel: "smart", aiPersonality: "nomads", loadout: { factionId: "nomads", passiveId: "open_roads", ultimateId: "dash" }, white: ["a1", "c1", "e1", "g1", "b2"], black: ["b6", "d6", "f6", "h6", "c7", "e7"] },
    ],
  },
  iron_guard: {
    id: "iron_guard",
    name: "Iron Bastion Trials",
    factionId: "iron_guard",
    description: "Iron Guard missions teach protected center entries, Fortify denial, revenge tempo, and temporary walls.",
    levels: [
      { id: "iron_shield_anchor", number: 1, factionId: "iron_guard", name: "Shield Anchor", hook: "The first center entry would normally be punished. Shield Wall makes the anchor safe.", objective: "Move into a highlighted center square to trigger Shield Wall, then finish the live board.", hint: "Move b2 to c3. The highlighted center square becomes guarded.", clearMessage: "Shield Wall created a safe center anchor.", aiLevel: "beginner", aiPersonality: "iron_guard", loadout: { factionId: "iron_guard", passiveId: "shield_wall", ultimateId: "fortify" }, white: ["b2", "d2", "f2", "h2"], black: ["a5", "c5", "e5", "g5"] },
      { id: "iron_first_wall", number: 2, factionId: "iron_guard", name: "Fortify Break", hook: "Amber threatens a multi-jump through the center guard. Fortify cancels the string.", objective: "Use Fortify on d4, force Amber to reroute, then win from the stabilized shape.", hint: "Arm Fortify and choose d4. The enemy capture chain disappears.", clearMessage: "Fortify cancelled the multi-jump and stabilized the center.", aiLevel: "beginner", aiPersonality: "iron_guard", loadout: { factionId: "iron_guard", passiveId: "shield_wall", ultimateId: "fortify" }, white: ["b2", "d4", "f2", "h2"], black: ["a7", "c5", "g5", "h6"] },
      { id: "iron_vengeance_turn", number: 3, factionId: "iron_guard", name: "Vengeance Turn", hook: "Amber wins the first trade, but the ledger makes the next capture worth Momentum.", objective: "Recover from a material loss and use the Momentum swing to stabilize.", hint: "Trade calmly. Your next capture after losing a piece fuels the comeback.", clearMessage: "Vengeance Ledger turned a loss into a tactical resource.", aiLevel: "beginner", aiPersonality: "iron_guard", loadout: { factionId: "iron_guard", passiveId: "vengeance_ledger", ultimateId: "fortify" }, white: ["b2", "d2", "f2", "h2"], black: ["c5", "e5", "g5", "a7", "c7"] },
      { id: "iron_barricade_gate", number: 4, factionId: "iron_guard", name: "Barricade Gate", hook: "Amber's attack depends on two landing squares. Barricade turns the lane into a wall.", objective: "Place two blockers, deny the attack route, then win the live board.", hint: "Arm Barricade and block e5 and g5.", clearMessage: "Barricade created a temporary fortress.", aiLevel: "beginner", aiPersonality: "iron_guard", loadout: { factionId: "iron_guard", passiveId: "shield_wall", ultimateId: "barricade" }, white: ["b2", "d2", "f2", "h2"], black: ["c5", "e7", "g7", "a7"] },
      { id: "iron_bastion_duel", number: 5, factionId: "iron_guard", name: "Bastion Free Duel", hook: "No more rails. The rival bot has enough material to punish overextension.", objective: "Win a live match using Shield Wall, Fortify, and defensive trades.", hint: "Hold center, guard the key defender, and trade only when the follow-up is safe.", clearMessage: "The Iron Guard campaign is clear. Defense became pressure.", aiLevel: "smart", aiPersonality: "iron_guard", loadout: { factionId: "iron_guard", passiveId: "shield_wall", ultimateId: "fortify" }, white: ["b2", "d2", "f2", "h2", "c3"], black: ["a5", "c5", "e5", "g5", "b6", "d6"] },
    ],
  },
  sun_court: {
    id: "sun_court",
    name: "Solar Crownline",
    factionId: "sun_court",
    description: "Sun Court missions teach promotion pressure, instant kings, Crown Tax comeback tempo, and long diagonal capture bursts.",
    levels: [
      { id: "sun_royal_lane", number: 1, factionId: "sun_court", name: "Royal Lane", hook: "One runner can reach the royal lane before Amber's material matters.", objective: "Push into the final three rows and convert Royal Pressure into Momentum.", hint: "Advance the runner and protect the promotion route.", clearMessage: "Royal Pressure made the crown lane matter before promotion.", aiLevel: "beginner", aiPersonality: "sun_court", loadout: { factionId: "sun_court", passiveId: "royal_pressure", ultimateId: "crown_surge" }, white: ["c3", "e3", "g1"], black: ["b6", "d6", "f6", "h6"] },
      { id: "solar_crown_engine", number: 2, factionId: "sun_court", name: "Solar Crown Engine", hook: "A royal courier already reached mid-board. Crown Surge turns the piece into an immediate king threat.", objective: "Use Crown Surge on d4, open a long diagonal, then finish live play.", hint: "Arm Crown Surge, choose d4, then use the crowned king to capture across the board.", clearMessage: "Crown Surge made an instant king and flipped the race.", aiLevel: "beginner", aiPersonality: "sun_court", loadout: { factionId: "sun_court", passiveId: "royal_pressure", ultimateId: "crown_surge" }, white: ["b2", "d4", "f2", "h2"], black: ["b6", "e7", "f6", "g7"] },
      { id: "sun_crown_tax", number: 3, factionId: "sun_court", name: "Crown Tax", hook: "Amber promotes first, but the Sun Court taxes the crown and gets the Momentum response.", objective: "Survive the enemy promotion and turn Crown Tax into a counterattack.", hint: "Let the race develop; the first enemy king funds your response.", clearMessage: "Crown Tax transformed enemy promotion into your comeback.", aiLevel: "beginner", aiPersonality: "sun_court", loadout: { factionId: "sun_court", passiveId: "crown_tax", ultimateId: "crown_surge" }, white: ["b2", "d2", "f2"], black: ["a7", "c7", "e7", "g7"] },
      { id: "sun_lance_return", number: 4, factionId: "sun_court", name: "Sun Lance Return", hook: "The winning capture sits beyond normal reach. Sun Lance breaks that distance rule for one turn.", objective: "Use Sun Lance to make the long diagonal capture, then win live play.", hint: "Arm Sun Lance on e5, then capture e5xb2 over d4.", clearMessage: "Sun Lance created a long diagonal strike standard movement forbids.", aiLevel: "beginner", aiPersonality: "sun_court", loadout: { factionId: "sun_court", passiveId: "royal_pressure", ultimateId: "sun_lance" }, white: ["a1", "e5", "g1"], black: ["d4", "b6", "h6"] },
      { id: "sun_coronation_duel", number: 5, factionId: "sun_court", name: "Coronation Free Duel", hook: "The rival bot will race for kings if you wait. Win by forcing promotion pressure first.", objective: "Win a live match using Sun Court promotion tools.", hint: "Create a runner, Crown Surge before the lane closes, and use Sun Lance to punish diagonal gaps.", clearMessage: "The Sun Court campaign is clear. Promotion pressure overwhelmed material.", aiLevel: "smart", aiPersonality: "sun_court", loadout: { factionId: "sun_court", passiveId: "royal_pressure", ultimateId: "crown_surge" }, white: ["b2", "d2", "f2", "h2", "c3"], black: ["a5", "c5", "e5", "g5", "b6", "d6"] },
    ],
  },
  void_order: {
    id: "void_order",
    name: "Void Order Archive",
    factionId: "void_order",
    description: "Void Order missions teach danger conversion, marked traps, range-3 Phase Shift teleports, and Collapse lane denial.",
    levels: [
      { id: "void_pressure_field", number: 1, factionId: "void_order", name: "Pressure Field", hook: "The only useful line creates danger. Void Order turns that danger into fuel.", objective: "Bait a threat, trigger Pressure Field, and use Momentum to survive.", hint: "Do not panic when Amber gains a threat; the field converts it into your resource.", clearMessage: "Pressure Field made danger profitable.", aiLevel: "beginner", aiPersonality: "void_order", loadout: { factionId: "void_order", passiveId: "pressure_field", ultimateId: "phase_shift" }, white: ["a1", "c3", "g1"], black: ["d4", "f6", "h6"] },
      { id: "void_echo_mark", number: 2, factionId: "void_order", name: "Echo Mark", hook: "Amber's quiet move looks safe until Echo Mark turns it into a debt.", objective: "Let Amber move quietly, hunt the marked piece, then win the live board.", hint: "Track the marked piece and capture it before it escapes.", clearMessage: "Echo Mark turned a quiet escape into a target.", aiLevel: "beginner", aiPersonality: "void_order", loadout: { factionId: "void_order", passiveId: "echo_mark", ultimateId: "phase_shift" }, white: ["a1", "c3", "g1"], black: ["b6", "d6", "f6", "h6"] },
      { id: "void_first_shift", number: 3, factionId: "void_order", name: "Rift Step", hook: "The archive corridor has one poisoned diagonal. Phase Shift teleports through the trap and opens the line.", objective: "Use range-3 Phase Shift from c3 to f6, wait for the displacement, then crown through f6xh8.", hint: "Arm Phase Shift, choose c3, land on f6, then capture f6xh8 over g7. This is a true rift jump, not a one-square sidestep.", clearMessage: "Phase Shift bent the geometry into a winning capture chain.", aiLevel: "beginner", aiPersonality: "void_order", loadout: { factionId: "void_order", passiveId: "pressure_field", ultimateId: "phase_shift" }, white: ["a1", "c3"], black: ["b6", "d4", "g7"] },
      { id: "void_collapse_gate", number: 4, factionId: "void_order", name: "Collapse Gate", hook: "Amber's plan requires one exact landing square. Collapse removes it from the board for a turn.", objective: "Use Collapse on e5, deny the reply, then win live play.", hint: "Arm Collapse and void e5 before Amber can use it.", clearMessage: "Collapse erased the enemy's landing square and broke the plan.", aiLevel: "beginner", aiPersonality: "void_order", loadout: { factionId: "void_order", passiveId: "echo_mark", ultimateId: "collapse" }, white: ["a1", "c3", "g1"], black: ["d4", "f6", "h6"] },
      { id: "void_archive_duel", number: 5, factionId: "void_order", name: "Archive Free Duel", hook: "No more script. Win by bending movement and deleting the opponent's best landing square.", objective: "Win a live match using Phase Shift, Collapse, and trap timing.", hint: "Phase Shift should create a tactic, not just move a piece. Collapse the landing square the enemy needs most.", clearMessage: "The Void campaign is clear. Geometry control beat material.", aiLevel: "smart", aiPersonality: "void_order", loadout: { factionId: "void_order", passiveId: "pressure_field", ultimateId: "phase_shift" }, white: ["a1", "c1", "e1", "g1", "b2"], black: ["b6", "d6", "f6", "h6", "c7", "e7"] },
    ],
  },
};
const DAILY_CHALLENGES = [
  {
    id: "capture_chain",
    type: "Capture Chain",
    title: "Fork at the Glass Dune",
    hook: "Azure is down material, but one forced capture opens a promotion lane before the AI can stabilize.",
    objective: "Find the forced capture, continue the chain, then convert the king lane.",
    reward: "+30 Shards, +1 Daily Puzzle streak",
    variant: "classic",
    aiLevel: "smart",
    white: ["c3", "e3", "g1"],
    black: ["d4", "f4", "b6", "h6", "c7", "e7"],
  },
  {
    id: "promotion_race",
    type: "Promotion Race",
    title: "Last Crown Before Dawn",
    hook: "Both sides are one tempo from promotion. You must make the safer king first.",
    objective: "Win the race to crown while denying the AI's next capture.",
    reward: "+30 Shards, promotion mastery XP",
    variant: "classic",
    aiLevel: "coach",
    white: ["b6", "d4", "h2"],
    black: ["a7", "c7", "f6", "h6"],
  },
  {
    id: "survival_net",
    type: "Survival Puzzle",
    title: "The Three-Side Net",
    hook: "Amber controls the lanes. Survive the first reply, then punish the overextension.",
    objective: "Avoid the immediate capture and force the AI into a weak diagonal.",
    reward: "+30 Shards, survival streak credit",
    variant: "power",
    aiLevel: "smart",
    loadout: { factionId: "iron_guard", passiveId: "shield_wall", ultimateId: "fortify" },
    white: ["b2", "d2", "f2"],
    black: ["a5", "c5", "e5", "g5", "b6", "h6"],
  },
  {
    id: "ability_only",
    type: "Ability Trial",
    title: "Phase Key",
    hook: "There is no normal move that solves the shape. The only clean answer is a power reposition.",
    objective: "Use Phase Shift to reopen the diagonal and survive the reply.",
    reward: "+30 Shards, Void mastery credit",
    variant: "power",
    aiLevel: "smart",
    loadout: { factionId: "void_order", passiveId: "pressure_field", ultimateId: "phase_shift" },
    white: ["c3", "g1", "a1"],
    black: ["d4", "f6", "h6", "b6", "a7", "c7"],
  },
];
const GUIDED_CAMPAIGN_TUTORIALS = {
  road_behind: {
    factionId: "nomads",
    id: "road_behind",
    title: "Open Roads Tutorial",
    intro: "Guided lesson: the scout is not trapped. Use Open Roads to retreat backward, watch Amber overextend, then finish the board yourself.",
    freePlayPrompt: "Open Roads lesson complete. Free-play phase engaged: the scout escaped the net and Dash is charged for the live finish.",
    rechargeReview: "Guided lesson complete: Open Roads created a backward escape route and Dash recharged for the live phase.",
    white: ["a1", "c3", "e1", "g1"],
    black: ["b6", "d6", "f6", "h6", "a7"],
    requiredMoves: [
      {
        actor: "player",
        kind: "move",
        from: "c3",
        to: "d2",
        label: "Retreat c3-d2",
        prompt: "Select c3 and move backward to d2. No capture exists, so Open Roads lets the Nomad scout step out of the net.",
      },
      {
        actor: "ai",
        kind: "move",
        from: "d6",
        to: "c5",
        label: "Amber overextends d6-c5",
        prompt: "Amber follows the retreat and overextends d6 to c5. The tutorial now releases you into a playable comeback board.",
      },
    ],
  },
  salt_road_sprint: {
    factionId: "nomads",
    id: "salt_road_sprint",
    title: "Dash Bait Tutorial",
    intro: "Guided lesson: follow the script to bait Amber, Dash into the pocket, then finish the forced multi-jump.",
    freePlayPrompt: "Tutorial complete. Free-play phase engaged: Dash has recharged. Beat the bot from this position to complete the sector.",
    rechargeReview: "Guided lesson complete: Dash recharged for the live bot phase.",
    white: ["a1", "c1", "g1", "h2"],
    black: ["b6", "c5", "g7", "h6"],
    requiredMoves: [
      {
        actor: "player",
        kind: "power",
        powerId: "dash",
        from: "c1",
        to: "e3",
        label: "Use Dash from c1 to e3",
        prompt: "Activate Dash, select the Azure piece on c1, then land on e3. This baits Amber into the capture lane.",
      },
      {
        actor: "ai",
        kind: "move",
        from: "c5",
        to: "d4",
        label: "Amber advances c5 to d4",
        prompt: "Amber takes the bait and slides c5 to d4. Watch how the e3 rider now has a forced jump.",
      },
      {
        actor: "player",
        kind: "capture",
        from: "e3",
        to: "c5",
        captured: "d4",
        label: "Capture e3xc5",
        prompt: "Capture from e3 to c5 over d4. This is the first link in the chain.",
      },
      {
        actor: "player",
        kind: "capture",
        from: "c5",
        to: "a7",
        captured: "b6",
        label: "Continue c5xa7",
        prompt: "Continue the mandatory multi-jump from c5 to a7 over b6. Do not switch pieces.",
      },
    ],
  },
  dust_trap: {
    factionId: "nomads",
    id: "dust_trap",
    title: "Dust Veil Capture Tutorial",
    intro: "Guided lesson: step into Amber's capture threat, let Dust Veil absorb the strike, then punish the exposed line with a forced capture chain.",
    freePlayPrompt: "Dust Veil lesson complete. The bait worked, the chain removed the main threat, and a final patrol remains for live play.",
    rechargeReview: "Dust Veil resolved: the bait piece survived long enough to begin a capture chain.",
    white: ["a1", "c3"],
    black: ["b6", "e5", "g7"],
    requiredMoves: [
      {
        actor: "player",
        kind: "move",
        from: "c3",
        to: "d4",
        label: "Bait with c3-d4",
        prompt: "Move c3 to d4. This quiet step deliberately enters Amber's capture line so Dust Veil can trigger.",
      },
      {
        actor: "system",
        kind: "wait",
        waitMs: 1100,
        setTurn: "white",
        clearProtectedSquares: true,
        label: "Dust Veil absorbs e5xc3",
        prompt: "Dust Veil is active. Amber's e5xc3 jump over d4 is blocked; wait for the shield pulse to resolve before counterattacking.",
      },
      {
        actor: "player",
        kind: "capture",
        from: "d4",
        to: "f6",
        captured: "e5",
        label: "Counter d4xf6",
        prompt: "Now counter-capture from d4 to f6 over e5. The protected bait becomes the attacker.",
      },
      {
        actor: "player",
        kind: "capture",
        from: "f6",
        to: "h8",
        captured: "g7",
        label: "Finish f6xh8",
        prompt: "Finish the mandatory chain from f6 to h8 over g7. This proves Dust Veil turned defense into a counterattack; one patrol remains for free play.",
      },
    ],
  },
  storm_gate: {
    factionId: "nomads",
    id: "storm_gate",
    title: "Sandstorm Gate Tutorial",
    intro: "Guided lesson: Amber's f6 guard controls both forward exits. Sandstorm closes those landings, freezes the guard, and lets the Nomads strike first.",
    freePlayPrompt: "Sandstorm lesson complete. The blocked lane became a winning capture route; finish the last patrol in live play.",
    rechargeReview: "Sandstorm resolved: the enemy guard lost its landing squares before the capture chain began.",
    white: ["a1", "c3"],
    black: ["b6", "d4", "f6"],
    requiredMoves: [
      {
        actor: "player",
        kind: "power_board",
        powerId: "sandstorm_corridor",
        targets: ["e5", "g5"],
        label: "Sandstorm e5 and g5",
        prompt: "Activate Sandstorm Corridor, then block e5 and g5. Those are the f6 guard's only quiet landing squares.",
      },
      {
        actor: "system",
        kind: "wait",
        waitMs: 1100,
        setTurn: "white",
        clearBlockedSquares: true,
        label: "Sandstorm freezes f6",
        prompt: "Sandstorm is active. Amber's f6 guard cannot step into e5 or g5; wait for the lane denial pulse to resolve.",
      },
      {
        actor: "player",
        kind: "capture",
        from: "c3",
        to: "e5",
        captured: "d4",
        label: "Break through c3xe5",
        prompt: "Now capture from c3 to e5 over d4. The blocked square becomes your attack lane once the storm clears.",
      },
      {
        actor: "player",
        kind: "capture",
        from: "e5",
        to: "g7",
        captured: "f6",
        label: "Finish e5xg7",
        prompt: "Continue from e5 to g7 over f6. This clears the gate guard and leaves a small live-play cleanup.",
      },
    ],
  },
  iron_shield_anchor: {
    factionId: "iron_guard",
    id: "iron_shield_anchor",
    title: "Shield Wall Tutorial",
    intro: "Guided lesson: the Iron Guard wants the center, but only Shield Wall makes the first entry safe.",
    freePlayPrompt: "Shield Wall lesson complete. Free-play phase engaged: use the protected anchor to trade safely.",
    rechargeReview: "Shield Wall triggered on the center entry and created a defensive anchor.",
    white: ["b2", "d2", "f2", "h2"],
    black: ["a5", "c5", "e5", "g5"],
    requiredMoves: [
      {
        actor: "player",
        kind: "move",
        from: "b2",
        to: "c3",
        label: "Anchor b2-c3",
        prompt: "Move the Iron Guard from b2 to the highlighted c3 center square. That triggers Shield Wall protection.",
      },
      {
        actor: "ai",
        kind: "move",
        from: "e5",
        to: "d4",
        label: "Amber probes e5-d4",
        prompt: "Amber probes the center, but the guarded c3 anchor keeps your shape stable. Finish the live board.",
      },
    ],
  },
  iron_first_wall: {
    factionId: "iron_guard",
    id: "iron_first_wall",
    title: "Phalanx Block Tutorial",
    intro: "Guided lesson: Amber is threatening c5xd4xg1. Fortify the center guard to collapse the capture string.",
    freePlayPrompt: "Fortify lesson complete. Free-play phase engaged: Fortify has recharged. Win the rival-faction bot duel from this stabilized Iron Guard shape.",
    rechargeReview: "Guided lesson complete: Fortify recharged for the live rival-faction phase.",
    white: ["b2", "d4", "f2", "h2"],
    black: ["a7", "c5", "g5", "h6"],
    requiredMoves: [
      {
        actor: "player",
        kind: "power",
        powerId: "fortify",
        from: "d4",
        to: "d4",
        label: "Fortify d4",
        prompt: "Activate Fortify, then choose the Iron Guard on d4. Without Fortify, Amber threatens c5xd4xg1.",
      },
      {
        actor: "ai",
        kind: "move",
        from: "c5",
        to: "b4",
        label: "Amber reroutes c5 to b4",
        prompt: "Fortify blocks the capture chain. Amber cannot take d4, so the scripted rival is forced to reroute c5 to b4.",
      },
    ],
  },
  iron_barricade_gate: {
    factionId: "iron_guard",
    id: "iron_barricade_gate",
    title: "Barricade Tutorial",
    intro: "Guided lesson: Amber's attack needs two central landing squares. Barricade turns those squares into a temporary wall.",
    freePlayPrompt: "Barricade lesson complete. Free-play phase engaged: the center is sealed and your fortress can advance.",
    rechargeReview: "Barricade removed two landing squares and forced Amber away from the attack lane.",
    white: ["b2", "d2", "f2", "h2"],
    black: ["c5", "e7", "g7", "a7"],
    requiredMoves: [
      {
        actor: "player",
        kind: "power_board",
        powerId: "barricade",
        targets: ["e5", "g5"],
        label: "Barricade e5 and g5",
        prompt: "Activate Barricade, then block e5 and g5. Amber cannot use those landing squares this turn.",
      },
      {
        actor: "ai",
        kind: "move",
        from: "c5",
        to: "b4",
        label: "Amber reroutes c5-b4",
        prompt: "Barricade closed the direct gate. Amber must reroute, and the live phase is now yours to win.",
      },
    ],
  },
  solar_crown_engine: {
    factionId: "sun_court",
    id: "solar_crown_engine",
    title: "Solar Leap Tutorial",
    intro: "Guided lesson: Amber's pieces are clustered so a normal piece cannot jump through. Crown Surge turns d4 into a king and creates the Solar Leap angle.",
    freePlayPrompt: "Solar Leap complete. Free-play phase engaged: Crown Surge has recharged. Defeat the rival bot with Sun Court king pressure.",
    rechargeReview: "Guided lesson complete: Crown Surge recharged for the live rival-faction phase.",
    white: ["b2", "d4", "f2", "h2"],
    black: ["b6", "e7", "f6", "g7"],
    requiredMoves: [
      {
        actor: "player",
        kind: "power",
        powerId: "crown_surge",
        from: "d4",
        to: "d4",
        label: "Crown Surge d4",
        prompt: "Activate Crown Surge, then choose the Sun Court piece on d4. The clustered Amber wall cannot be jumped by a normal piece.",
      },
      {
        actor: "ai",
        kind: "move",
        from: "g7",
        to: "h6",
        label: "Amber opens g7",
        prompt: "Amber shifts g7 to h6. That one opening gives the new king a long Solar Leap capture lane.",
      },
      {
        actor: "player",
        kind: "capture",
        from: "d4",
        to: "h8",
        captured: "f6",
        label: "Solar Leap d4xh8",
        prompt: "Use the crowned king to capture from d4 to h8 over f6. This long diagonal was impossible before Crown Surge.",
      },
    ],
  },
  sun_lance_return: {
    factionId: "sun_court",
    id: "sun_lance_return",
    title: "Sun Lance Tutorial",
    intro: "Guided lesson: the winning capture sits beyond normal reach. Sun Lance lets one normal piece strike along a long diagonal.",
    freePlayPrompt: "Sun Lance lesson complete. Free-play phase engaged: the long strike opened the lane.",
    rechargeReview: "Sun Lance armed a normal piece for one long diagonal capture.",
    white: ["a1", "e5", "g1"],
    black: ["d4", "b6", "h6"],
    requiredMoves: [
      {
        actor: "player",
        kind: "power",
        powerId: "sun_lance",
        from: "e5",
        to: "e5",
        label: "Arm Sun Lance on e5",
        prompt: "Activate Sun Lance and choose e5. This normal piece can lance down the diagonal like a king.",
      },
      {
        actor: "player",
        kind: "capture",
        from: "e5",
        to: "b2",
        captured: "d4",
        label: "Solar lance e5xb2",
        prompt: "Capture from e5 to b2 over d4. Sun Lance lets the normal piece land beyond the first empty square.",
      },
    ],
  },
  void_first_shift: {
    factionId: "void_order",
    id: "void_first_shift",
    title: "Phase Shift Tutorial",
    intro: "Guided lesson: a normal move cannot cross the archive pocket. Phase Shift teleports through the geometry, opening a capture chain through the marked line.",
    freePlayPrompt: "Phase Shift lesson complete. The rift jump crowned a piece through a lane standard checkers cannot enter; finish the remaining patrol in live play.",
    rechargeReview: "Phase Shift resolved: the range-3 teleport created a crown capture a normal piece could not reach.",
    white: ["a1", "c3"],
    black: ["b6", "d4", "g7"],
    requiredMoves: [
      {
        actor: "player",
        kind: "power",
        powerId: "phase_shift",
        from: "c3",
        to: "f6",
        label: "Phase Shift c3 to f6",
        prompt: "Activate Phase Shift, select c3, then land on f6. The upgraded Void ultimate can teleport up to 3 dark squares through blockers.",
      },
      {
        actor: "system",
        kind: "wait",
        waitMs: 900,
        setTurn: "white",
        label: "Void displacement resolves",
        prompt: "Phase Shift has resolved. The piece jumped through the archive line and can crown through g7.",
      },
      {
        actor: "player",
        kind: "capture",
        from: "f6",
        to: "h8",
        captured: "g7",
        label: "Crown through f6xh8",
        prompt: "Capture from f6 to h8 over g7. Phase Shift created a three-square rift into a crown lane.",
      },
    ],
  },
  void_collapse_gate: {
    factionId: "void_order",
    id: "void_collapse_gate",
    title: "Collapse Tutorial",
    intro: "Guided lesson: Amber's best reply needs e5. Collapse removes that landing square from the board for one turn.",
    freePlayPrompt: "Collapse lesson complete. Free-play phase engaged: Amber's best landing square is gone.",
    rechargeReview: "Collapse voided the critical landing square and broke the enemy line.",
    white: ["a1", "c3", "g1"],
    black: ["d4", "f6", "h6"],
    requiredMoves: [
      {
        actor: "player",
        kind: "power_board",
        powerId: "collapse",
        targets: ["e5"],
        label: "Collapse e5",
        prompt: "Activate Collapse and void e5. That exact landing square is the enemy's tactical route.",
      },
      {
        actor: "ai",
        kind: "move",
        from: "h6",
        to: "g5",
        label: "Amber reroutes h6-g5",
        prompt: "Collapse denied the clean landing. Amber has to take a slower route, and the live phase is yours.",
      },
    ],
  },
};
const AI_PERSONALITY_LABELS = {
  nomads: "Nomad Raider AI - mobility and escape lanes",
  iron_guard: "Iron Guard AI - center defense and clean trades",
  sun_court: "Sun Court AI - promotion rush profile",
  void_order: "Void Order AI - traps and lane denial",
};
const FACTION_SHOWCASE = [
  {
    id: "nomads",
    name: "Nomad Raiders",
    subtitle: "Storm-born tacticians",
    tone: "nomad",
    level: 12,
    xp: 68,
    lore: "Nomad Raiders cross dead sectors by reading pressure in the dust. Their commanders win by refusing fixed fronts, baiting captures, and turning broken lanes into sudden promotion routes.",
    stats: { control: 82, mobility: 94, defense: 61 },
    abilities: [
      { icon: "WW", title: "Wind-Walker", tag: "Always Active", text: "Normal pieces may pressure backward lanes after a quiet turn." },
      { icon: "DS", title: "Dust Storm", tag: "100 Mana", text: "Obscures two dark squares to deny enemy landing routes." },
      { icon: "CR", title: "Caravan Rush", tag: "Tempo Burst", text: "Repositions allied pieces to convert edge traps into attacks." },
    ],
  },
  {
    id: "cyber",
    name: "Cyber Enforcers",
    subtitle: "Protocol assault division",
    tone: "cyber",
    level: 9,
    xp: 46,
    lore: "Cyber Enforcers treat the board as a target grid. Every exchange updates their predictive lattice, allowing them to punish loose formations with mechanical precision.",
    stats: { control: 88, mobility: 58, defense: 84 },
    abilities: [
      { icon: "GL", title: "Grid Lock", tag: "Always Active", text: "Captured lanes become marked for tactical retaliation." },
      { icon: "OR", title: "Orbital Ruling", tag: "120 Mana", text: "Projects a denial zone around the enemy's strongest cluster." },
      { icon: "PK", title: "Pulse Kick", tag: "Counter", text: "Rewards defensive waits with a stronger next capture threat." },
    ],
  },
  {
    id: "void",
    name: "Void Monks",
    subtitle: "Gravity and silence",
    tone: "void",
    level: 15,
    xp: 81,
    lore: "Void Monks are patient architects of collapse. They give ground until the opponent's pieces align, then bend position, tempo, and threat into one decisive sequence.",
    stats: { control: 91, mobility: 63, defense: 79 },
    abilities: [
      { icon: "PS", title: "Phase Step", tag: "Always Active", text: "Creates escape geometry when a piece is boxed by pressure." },
      { icon: "VC", title: "Void Collapse", tag: "140 Mana", text: "Compresses a contested lane and forces the opponent to reroute." },
      { icon: "OE", title: "Orbit Eye", tag: "Vision", text: "Highlights capture chains before the final trade is committed." },
    ],
  },
  {
    id: "solar",
    name: "Solar Court",
    subtitle: "Radiant crown seekers",
    tone: "solar",
    level: 7,
    xp: 33,
    lore: "The Solar Court plays for ascension. Their doctrine protects promotion lanes, turns kings into anchors, and converts late-game pressure into bright, unavoidable wins.",
    stats: { control: 74, mobility: 70, defense: 92 },
    abilities: [
      { icon: "SC", title: "Sun Crown", tag: "Always Active", text: "Kings gain bonus protection when holding central diagonals." },
      { icon: "HF", title: "Halo Flare", tag: "90 Mana", text: "Prevents a key enemy piece from joining a capture chain." },
      { icon: "DA", title: "Dawn Advance", tag: "Promotion", text: "Strengthens safe forward movement near the enemy baseline." },
    ],
  },
];
const BATTLEFIELD_LOG = [
  "[12:45] White piece to B4",
  "[12:47] White capture at D6",
  "[12:50] Commander V reinforced C5",
  "[12:53] Aether Guard absorbed lane pressure",
  "[12:56] Phase Shift charge stabilized at 80%",
];
const TACTICAL_ABILITIES = [
  {
    id: "aether_shield",
    type: "passive",
    name: "Aether Shield",
    tag: "Passive Core",
    icon: "AS",
    accent: "cobalt",
    costLabel: "Recharge: passive",
    lore: "A defensive lattice built from captured comet dust. It rewards players who hold tempo, protect lanes, and force the opponent to spend extra captures.",
    specs: ["Blocks the first incoming capture threat after a non-capture move.", "Guarded pieces cannot be chained through during the same enemy turn.", "Best used with slow center-control openings."],
  },
  {
    id: "kinetic_rebound",
    type: "passive",
    name: "Kinetic Rebound",
    tag: "Passive Core",
    icon: "KR",
    accent: "amber",
    costLabel: "Recharge: 2 turns",
    lore: "Nomad engineers learned to store impact inside the board itself. Every failed enemy push becomes fuel for a sharper counterattack.",
    specs: ["After losing a piece, your next legal capture grants +1 momentum.", "Momentum can be spent to trigger ultimate charges earlier.", "Fails if the next player move is a quiet move."],
  },
  {
    id: "orbital_strike",
    type: "ultimate",
    name: "Orbital Strike",
    tag: "Ultimate Charge",
    icon: "OS",
    accent: "purple",
    costLabel: "Mana: 80 / Cooldown: 5 turns",
    lore: "A one-shot satellite lance marks the darkest square in the enemy formation and turns a stalled position into a tactical breach.",
    specs: ["Target one empty dark square within three diagonal steps of an allied piece.", "Enemy pieces cannot land on the marked square for one full turn.", "Creates forced reroutes without directly removing pieces."],
  },
  {
    id: "void_singularity",
    type: "ultimate",
    name: "Void Singularity",
    tag: "Ultimate Charge",
    icon: "VS",
    accent: "void",
    costLabel: "Mana: 100 / Cooldown: 6 turns",
    lore: "A collapsing point of gravity bends the board for a single turn, letting disciplined players pull danger away from their promotion lane.",
    specs: ["Swap one allied normal piece with another allied piece up to four squares away.", "The swap must end on legal dark squares and cannot capture by itself.", "Strongest when it prevents a double capture or opens a king path."],
  },
];
const DEFAULT_VAULT_ITEMS = [
  { cosmetic_id: "pieces_cosmos", kind: "piece_skin", name: "Cosmos Relic Pieces", rarity: "legendary", price_shards: 520, target_faction_id: null, preview_url: "/assets/cosmetics/pieces_cosmos_preview.png", model_url: "/assets/models/ice.glb", is_premium: true },
  { cosmetic_id: "pieces_ice", kind: "piece_skin", name: "Cryo Prism Pieces", rarity: "epic", price_shards: 380, target_faction_id: null, preview_url: "/assets/cosmetics/pieces_ice_preview.png", model_url: "/assets/models/azure_normal_disk.glb", is_premium: true },
  { cosmetic_id: "pieces_molten", kind: "piece_skin", name: "Molten Core Pieces", rarity: "epic", price_shards: 420, target_faction_id: null, preview_url: "/assets/cosmetics/pieces_molten_preview.png", model_url: "/assets/models/molten.glb", is_premium: true },
  { cosmetic_id: "pieces_elemental_2d", kind: "piece_skin", name: "Elemental Rift 2D Pieces", rarity: "legendary", price_shards: 360, target_faction_id: null, preview_url: "/assets/cosmetics/pieces_elemental_2d.png", is_premium: true },
  { cosmetic_id: "pieces_cyber_grid_2d", kind: "piece_skin", name: "Cyber Grid 2D Pieces", rarity: "epic", price_shards: 300, target_faction_id: null, preview_url: "/assets/cosmetics/pieces_cyber_grid_2d.png", is_premium: true },
  { cosmetic_id: "pieces_zen_garden_2d", kind: "piece_skin", name: "Zen Garden 2D Pieces", rarity: "rare", price_shards: 220, target_faction_id: null, preview_url: "/assets/cosmetics/pieces_zen_garden_2d.png", is_premium: false },
  { cosmetic_id: "board_steppe_sunset", kind: "board_skin", name: "Steppe Sunset Board", rarity: "rare", price_shards: 180, target_faction_id: "nomads", preview_url: "/assets/cosmetics/board_steppe_sunset.png", is_premium: false },
  { cosmetic_id: "board_iron_bastion", kind: "board_skin", name: "Iron Bastion Board", rarity: "rare", price_shards: 210, target_faction_id: "iron_guard", preview_url: "/assets/cosmetics/board_iron_bastion.png", is_premium: false },
  { cosmetic_id: "board_void_grid", kind: "board_skin", name: "Void Grid Board", rarity: "legendary", price_shards: 420, target_faction_id: "void_order", preview_url: "/assets/cosmetics/board_void_grid.png", is_premium: true },
  { cosmetic_id: "emote_good_tempo", kind: "emote", name: "Good Tempo", rarity: "common", price_shards: 60, target_faction_id: null, preview_url: "/assets/cosmetics/emote_good_tempo.png", is_premium: false },
  { cosmetic_id: "emote_well_played", kind: "emote", name: "Well Played", rarity: "common", price_shards: 80, target_faction_id: null, preview_url: "/assets/cosmetics/emote_well_played.png", is_premium: false },
  { cosmetic_id: "emote_close_call", kind: "emote", name: "Close Call", rarity: "common", price_shards: 80, target_faction_id: null, preview_url: "/assets/cosmetics/emote_close_call.png", is_premium: false },
  { cosmetic_id: "emote_brilliant_jump", kind: "emote", name: "Brilliant Jump", rarity: "rare", price_shards: 100, target_faction_id: null, preview_url: "/assets/cosmetics/emote_brilliant_jump.png", is_premium: false },
  { cosmetic_id: "emote_crown_rush", kind: "emote", name: "Crown Rush", rarity: "rare", price_shards: 110, target_faction_id: "sun_court", preview_url: "/assets/cosmetics/emote_crown_rush.png", is_premium: false },
  { cosmetic_id: "emote_fortified", kind: "emote", name: "Fortified", rarity: "rare", price_shards: 100, target_faction_id: "iron_guard", preview_url: "/assets/cosmetics/emote_fortified.png", is_premium: false },
  { cosmetic_id: "emote_void_glitch", kind: "emote", name: "Void Glitch", rarity: "epic", price_shards: 130, target_faction_id: "void_order", preview_url: "/assets/cosmetics/emote_void_glitch.png", is_premium: true },
  { cosmetic_id: "sticker_laugh_burst", kind: "emote", name: "Laugh Burst Sticker", rarity: "common", price_shards: 70, target_faction_id: null, preview_url: "/assets/cosmetics/sticker_laugh_burst.png", is_premium: false },
  { cosmetic_id: "sticker_thumbs_up", kind: "emote", name: "Thumbs Up Sticker", rarity: "common", price_shards: 70, target_faction_id: null, preview_url: "/assets/cosmetics/sticker_thumbs_up.png", is_premium: false },
  { cosmetic_id: "sticker_oops_trap", kind: "emote", name: "Oops Trap Sticker", rarity: "rare", price_shards: 95, target_faction_id: null, preview_url: "/assets/cosmetics/sticker_oops_trap.png", is_premium: false },
  { cosmetic_id: "sticker_hype_flame", kind: "emote", name: "Hype Flame Sticker", rarity: "rare", price_shards: 105, target_faction_id: null, preview_url: "/assets/cosmetics/sticker_hype_flame.png", is_premium: false },
  { cosmetic_id: "void_order_campaign_pass", kind: "badge", name: "Void Order Campaign Pass", rarity: "legendary", price_shards: 900, target_faction_id: null, preview_url: "/assets/cosmetics/vault_pro_bundle.png", is_premium: true },
];
const DEFAULT_MATCH_EMOTES = [
  { id: "emote_tactical_ping", cosmetic_id: "emote_tactical_ping", label: "Tactical Ping", symbol: "TP", tone: "cyan", text: "Tactical ping." },
];
const DEFAULT_BADGE_ITEMS = [
  { cosmetic_id: "badge_global_champion", kind: "badge", name: "Global Champion Badge", rarity: "legendary", price_shards: 0, preview_url: "/assets/cosmetics/badge_global_champion.png", is_premium: true },
  { cosmetic_id: "badge_almaty_champion", kind: "badge", name: "Almaty Champion Badge", rarity: "epic", price_shards: 0, preview_url: "/assets/cosmetics/badge_almaty_champion.png", is_premium: true },
  { cosmetic_id: "badge_astana_champion", kind: "badge", name: "Astana Champion Badge", rarity: "epic", price_shards: 0, preview_url: "/assets/cosmetics/badge_astana_champion.png", is_premium: true },
  { cosmetic_id: "badge_shymkent_champion", kind: "badge", name: "Shymkent Champion Badge", rarity: "epic", price_shards: 0, preview_url: "/assets/cosmetics/badge_shymkent_champion.png", is_premium: true },
  { cosmetic_id: "badge_aktobe_champion", kind: "badge", name: "Aktobe Champion Badge", rarity: "epic", price_shards: 0, preview_url: "/assets/cosmetics/badge_aktobe_champion.png", is_premium: true },
  { cosmetic_id: "badge_karaganda_champion", kind: "badge", name: "Karaganda Champion Badge", rarity: "epic", price_shards: 0, preview_url: "/assets/cosmetics/badge_karaganda_champion.png", is_premium: true },
];
const PIECE_MODEL_ASSETS = {
  default_azure: "/assets/models/azure.glb",
  default_amber: "/assets/models/amber.glb",
  pieces_cosmos: "/assets/models/ice.glb",
  pieces_ice: "/assets/models/azure_normal_disk.glb",
  pieces_molten: "/assets/models/molten.glb",
};
const BASIC_PIECE_COSMETIC = {
  cosmetic_id: "basic_piece_skin",
  kind: "piece_skin",
  name: "Basic Recolorable Disks",
  rarity: "starter",
  price_shards: 0,
  target_faction_id: null,
  preview_url: "",
  is_premium: false,
  is_basic: true,
};
const BOARD_SKINS = {
  nexus_neon: {
    id: "nexus_neon",
    name: "Nexus Neon",
    textureStyle: "neon",
    textureRefs: {
      base: "procedural://boards/nexus-neon/base",
      rail: "procedural://boards/nexus-neon/rail",
      light: "procedural://boards/nexus-neon/light",
      dark: "procedural://boards/nexus-neon/dark",
    },
    accent: { cyan: 0x00e5ff, purple: 0x9d4edd, amber: 0xffb400, fog: 0x020712 },
    lighting: { exposure: 0.74, fogDensity: 0.018, hemisphere: 0.54, ambient: 0.18, key: 0.86, purple: 0.62, cyan: 0.68, rim: 0.54, underglow: 0.055 },
    materials: {
      base: { color: 0x060910, metalness: 0.24, roughness: 0.62, clearcoat: 0.28, clearcoatRoughness: 0.52, emissive: 0x01040a, emissiveIntensity: 0.035, envMapIntensity: 0.42, bumpScale: 0.008 },
      rail: { color: 0x141b29, metalness: 0.28, roughness: 0.58, clearcoat: 0.32, clearcoatRoughness: 0.5, emissive: 0x020814, emissiveIntensity: 0.06, envMapIntensity: 0.42, bumpScale: 0.006 },
      light: { color: 0x4f646a, metalness: 0.08, roughness: 0.72, clearcoat: 0.16, clearcoatRoughness: 0.62, emissive: 0x020a0d, emissiveIntensity: 0.025, envMapIntensity: 0.36, bumpScale: 0.004 },
      dark: { color: 0x070813, metalness: 0.12, roughness: 0.68, clearcoat: 0.18, clearcoatRoughness: 0.58, emissive: 0x060211, emissiveIntensity: 0.05, envMapIntensity: 0.36, bumpScale: 0.006 },
    },
  },
  classic_mahogany: {
    id: "classic_mahogany",
    name: "Classic Mahogany",
    textureStyle: "wood",
    textureRefs: {
      base: "procedural://boards/classic-mahogany/base",
      rail: "procedural://boards/classic-mahogany/brass-rail",
      light: "procedural://boards/classic-mahogany/light-wood",
      dark: "procedural://boards/classic-mahogany/dark-wood",
    },
    accent: { cyan: 0x00e5ff, purple: 0x5b2e91, amber: 0xffb400, fog: 0x150c08 },
    materials: {
      base: { color: 0x2b140b, metalness: 0.14, roughness: 0.34, clearcoat: 0.65, clearcoatRoughness: 0.32, bumpScale: 0.035 },
      rail: { color: 0x7b5a32, metalness: 0.78, roughness: 0.2, clearcoat: 0.58, clearcoatRoughness: 0.24, emissive: 0x2b1605, emissiveIntensity: 0.1, bumpScale: 0.015 },
      light: { color: 0xb77a45, metalness: 0.08, roughness: 0.4, clearcoat: 0.46, clearcoatRoughness: 0.34, bumpScale: 0.026 },
      dark: { color: 0x44210f, metalness: 0.12, roughness: 0.38, clearcoat: 0.52, clearcoatRoughness: 0.31, emissive: 0x100503, emissiveIntensity: 0.06, bumpScale: 0.03 },
    },
  },
  obsidian_gold: {
    id: "obsidian_gold",
    name: "Obsidian & Gold",
    textureStyle: "carbon",
    textureRefs: {
      base: "procedural://boards/obsidian-gold/base",
      rail: "procedural://boards/obsidian-gold/gold-rail",
      light: "procedural://boards/obsidian-gold/brushed-steel",
      dark: "procedural://boards/obsidian-gold/obsidian-grid",
    },
    accent: { cyan: 0x00e5ff, purple: 0x9d4edd, amber: 0xffb400, fog: 0x020406 },
    materials: {
      base: { color: 0x080b10, metalness: 0.72, roughness: 0.24, clearcoat: 0.82, clearcoatRoughness: 0.18, bumpScale: 0.018 },
      rail: { color: 0xd7a845, metalness: 0.9, roughness: 0.16, clearcoat: 0.7, clearcoatRoughness: 0.18, emissive: 0x4a2a03, emissiveIntensity: 0.16, bumpScale: 0.01 },
      light: { color: 0x6f7f86, metalness: 0.58, roughness: 0.28, clearcoat: 0.42, clearcoatRoughness: 0.22, bumpScale: 0.014 },
      dark: { color: 0x080814, metalness: 0.66, roughness: 0.22, clearcoat: 0.72, clearcoatRoughness: 0.18, emissive: 0x0a0318, emissiveIntensity: 0.16, bumpScale: 0.018 },
    },
  },
  void_grid: {
    id: "void_grid",
    name: "Void Grid",
    textureStyle: "neon",
    textureRefs: {
      base: "procedural://boards/void-grid/base",
      rail: "procedural://boards/void-grid/rail",
      light: "procedural://boards/void-grid/rift-violet",
      dark: "procedural://boards/void-grid/deep-void",
    },
    accent: { cyan: 0x3be7ff, purple: 0x9d4edd, amber: 0xffb400, fog: 0x02020a },
    lighting: { exposure: 0.66, fogDensity: 0.028, hemisphere: 0.36, ambient: 0.1, key: 0.72, purple: 0.7, cyan: 0.48, rim: 0.42, underglow: 0.052 },
    materials: {
      base: { color: 0x05040d, metalness: 0.26, roughness: 0.7, clearcoat: 0.24, clearcoatRoughness: 0.6, emissive: 0x03000a, emissiveIntensity: 0.05, envMapIntensity: 0.26, bumpScale: 0.008 },
      rail: { color: 0x170b2b, metalness: 0.38, roughness: 0.56, clearcoat: 0.32, clearcoatRoughness: 0.5, emissive: 0x09001d, emissiveIntensity: 0.08, envMapIntensity: 0.28, bumpScale: 0.008 },
      light: { color: 0x211a3d, metalness: 0.1, roughness: 0.72, clearcoat: 0.18, clearcoatRoughness: 0.62, emissive: 0x09031f, emissiveIntensity: 0.06, envMapIntensity: 0.22, bumpScale: 0.006 },
      dark: { color: 0x030307, metalness: 0.12, roughness: 0.76, clearcoat: 0.14, clearcoatRoughness: 0.66, emissive: 0x080012, emissiveIntensity: 0.08, envMapIntensity: 0.2, bumpScale: 0.006 },
    },
  },
  celestial_marble: {
    id: "celestial_marble",
    name: "Celestial Marble",
    textureStyle: "marble",
    textureRefs: {
      base: "procedural://boards/celestial-marble/base",
      rail: "procedural://boards/celestial-marble/silver-rail",
      light: "procedural://boards/celestial-marble/lunar-marble",
      dark: "procedural://boards/celestial-marble/nebula-marble",
    },
    accent: { cyan: 0x8ff7ff, purple: 0xb88cff, amber: 0xffd36e, fog: 0x080817 },
    materials: {
      base: { color: 0x151527, metalness: 0.3, roughness: 0.26, clearcoat: 0.78, clearcoatRoughness: 0.2, bumpScale: 0.022 },
      rail: { color: 0xa8b7c9, metalness: 0.82, roughness: 0.18, clearcoat: 0.7, clearcoatRoughness: 0.18, emissive: 0x101a28, emissiveIntensity: 0.1, bumpScale: 0.012 },
      light: { color: 0xdfe8f2, metalness: 0.18, roughness: 0.22, clearcoat: 0.88, clearcoatRoughness: 0.16, bumpScale: 0.032 },
      dark: { color: 0x1b1635, metalness: 0.22, roughness: 0.24, clearcoat: 0.82, clearcoatRoughness: 0.18, emissive: 0x120829, emissiveIntensity: 0.14, bumpScale: 0.028 },
    },
  },
};
const LEVEL_REWARD_TRACK = [
  { level: 1, title: "Nomad License", type: "faction", factionId: "nomads", shards: 100, essence: 0, rewards: ["Steppe Nomads unlocked", "Daily Tactic access", "Starter Vault clearance"] },
  { level: 2, title: "Iron Guard Contract", type: "faction", factionId: "iron_guard", shards: 120, essence: 10, rewards: ["Iron Guard faction", "Shield Wall passive", "Fortify ultimate"] },
  { level: 3, title: "Vault Clearance I", type: "vault", shards: 150, essence: 20, rewards: ["Rare badge preview", "Featured Vault rotation", "City profile frame"] },
  { level: 4, title: "Sun Court Embassy", type: "faction", factionId: "sun_court", shards: 180, essence: 30, rewards: ["Sun Court faction", "Crown Surge ultimate", "Promotion-focused mastery"] },
  { level: 5, title: "Coach Lab Access", type: "coach", shards: 200, essence: 40, rewards: ["Advanced retry moments", "Coach review archive", "Shareable recap highlight"] },
  { level: 6, title: "Void Signal Located", type: "vault", shards: 240, essence: 50, rewards: ["Void Order pass appears in Vault", "Phase Shift preview", "Collapse lane-control preview"] },
  { level: 8, title: "Ranked Identity", type: "ranked", shards: 280, essence: 70, rewards: ["City League banner", "Ranked badge frame", "Versus intro accent"] },
  { level: 10, title: "Season Pass Preview", type: "pro", shards: 340, essence: 90, rewards: ["Premium skin preview", "Founder title preview", "Pro value showcase"] },
  { level: 12, title: "Nexus Prime Clearance", type: "prime", shards: 420, essence: 120, rewards: ["Nexus Prime sparring archive", "Legendary profile badge", "Endgame mastery node"] },
];
const ACHIEVEMENT_CATALOG = [
  { id: "first_victory", title: "First Tactical Victory", description: "Win any AI, campaign, puzzle, or PvP match.", target: 1, reward: { shards: 50, exp: 80 } },
  { id: "capture_artist", title: "Capture Artist", description: "Capture 25 pieces across saved match reports.", target: 25, reward: { shards: 90, exp: 120 } },
  { id: "trail_runner", title: "Trail Runner", description: "Complete 2 Nomads campaign sectors.", target: 2, reward: { shards: 120, essence: 25 } },
  { id: "city_banner", title: "City Banner", description: "Choose a city and represent it on the leaderboard.", target: 1, reward: { essence: 20, exp: 60 } },
  { id: "vault_collector", title: "Vault Collector", description: "Own 3 cosmetics from the Vault.", target: 3, reward: { shards: 150, exp: 120 } },
  { id: "daily_tactician", title: "Daily Tactician", description: "Build a 3-point Daily Tactic streak.", target: 3, reward: { shards: 100, essence: 35 } },
  { id: "coach_student", title: "Coach Student", description: "Finish a match with a coach review or retry moment.", target: 1, reward: { essence: 40, exp: 100 } },
  { id: "faction_recruiter", title: "Faction Recruiter", description: "Unlock 2 factions through level progression.", target: 2, reward: { shards: 180, exp: 160 } },
];
const BATTLE_PASS_SEASON = { id: "founder_s1", name: "Founder Season", tagline: "Unlock premium skins, shards, and tactical identity rewards." };
const BATTLE_PASS_MISSIONS = [
  { mission_id: "daily_win_3", cadence: "daily", title: "Win 3 Matches", description: "Win any AI, campaign, puzzle, or PvP match today.", metric: "wins", target_count: 3, battle_pass_xp: 120 },
  { mission_id: "daily_capture_10", cadence: "daily", title: "Capture 10 Pieces", description: "Capture enemy pieces across any mode today.", metric: "captures", target_count: 10, battle_pass_xp: 100 },
  { mission_id: "daily_power_match", cadence: "daily", title: "Power Calibration", description: "Play one Power Checkers match with a faction loadout.", metric: "powerMatches", target_count: 1, battle_pass_xp: 80, pro_reward: true },
  { mission_id: "daily_nomad_dash", cadence: "daily", title: "Win With Nomads Dash", description: "Win a Power match while running the Steppe Nomads Dash loadout.", metric: "nomadDashWins", target_count: 1, battle_pass_xp: 140 },
  { mission_id: "weekly_win_7", cadence: "weekly", title: "Weekly Dominance", description: "Win seven matches during the current weekly reset.", metric: "wins", target_count: 7, battle_pass_xp: 360 },
  { mission_id: "weekly_iron_fortify", cadence: "weekly", title: "Fortify The Line", description: "Win with Iron Guard Fortify equipped to prove defensive mastery.", metric: "ironFortifyWins", target_count: 1, battle_pass_xp: 260 },
  { mission_id: "weekly_sun_promotion", cadence: "weekly", title: "Promote With Sun Court", description: "Win a match with Sun Court pressure and crown-focused tactics.", metric: "sunCourtWins", target_count: 1, battle_pass_xp: 260 },
  { mission_id: "weekly_capture_40", cadence: "weekly", title: "Capture Artist Protocol", description: "Capture forty pieces before the weekly reset.", metric: "captures", target_count: 40, battle_pass_xp: 320, pro_reward: true },
  { mission_id: "weekly_campaign_3", cadence: "weekly", title: "Campaign Breakthrough", description: "Clear three campaign sectors or trials this week.", metric: "campaignWins", target_count: 3, battle_pass_xp: 280 },
  { mission_id: "weekly_city_challenge", cadence: "weekly", title: "City Challenge", description: "Win one PvP duel that counts toward your city leaderboard.", metric: "pvpWins", target_count: 1, battle_pass_xp: 300, pro_reward: true },
];
const BATTLE_PASS_TIERS = [
  { tier: 1, required_xp: 100, title: "Shard Cache", reward: { shards: 50 } },
  { tier: 2, required_xp: 240, title: "Essence Cell", reward: { essence: 25 } },
  { tier: 3, required_xp: 420, title: "Zen Garden Pieces", reward: { cosmetic_id: "pieces_zen_garden_2d" } },
  { tier: 4, required_xp: 650, title: "Vault Shipment", reward: { shards: 120 } },
  { tier: 5, required_xp: 920, title: "Cyber Grid Pieces", reward: { cosmetic_id: "pieces_cyber_grid_2d" } },
  { tier: 6, required_xp: 1230, title: "Essence Reserve", reward: { essence: 70 } },
  { tier: 7, required_xp: 1580, title: "Cryo Prism 3D", reward: { cosmetic_id: "pieces_ice" } },
  { tier: 8, required_xp: 1980, title: "Dual Currency Cache", reward: { shards: 240, essence: 40 } },
  { tier: 9, required_xp: 2450, title: "Elemental Rift 2D", reward: { cosmetic_id: "pieces_elemental_2d" } },
  { tier: 10, required_xp: 3000, title: "Cosmos Relic 3D", reward: { cosmetic_id: "pieces_cosmos", shards: 300 } },
];
const ADMIN_PROFILE_PATCH = {
  username: "ADMIN_CORE",
  name: "ADMIN_CORE",
  email: "admin@nexus.io",
  city: "Almaty",
  bio: "Internal admin commander for testing every faction, ability, reward, and Vault flow.",
  current_exp: 0,
  level: 30,
  essence: 999999,
  shards: 999999,
  is_admin: true,
  is_pro: true,
  streaks: { loginDays: 365, dailyPuzzle: 99, dailyWin: 99, lastLoginDate: null },
};

export function App() {
  const [data, setData] = useState(null);
  const [demoUserId] = useState(() => getDemoUserId());
  const [authSession, setAuthSession] = useState(() => restoreAuthSession());
  const [authError, setAuthError] = useState("");
  const [demoMode, setDemoMode] = useState(() => isDemoMode());
  const [profile, setProfile] = useState(() => hasPlayableSession(restoreAuthSession()) ? normalizeProfile(loadJson("dama-profile", DEFAULT_PROFILE)) : createGuestProfile());
  const [vaultItems, setVaultItems] = useState(() => mergeVaultCatalog(loadJson("dama-vault-items", DEFAULT_VAULT_ITEMS)));
  const [inventoryItems, setInventoryItems] = useState(() => loadJson("dama-inventory", []));
  const [economyMessage, setEconomyMessage] = useState("Vault systems ready.");
  const [notifications, setNotifications] = useState(() => loadJson("dama-notifications", [
    { id: "welcome", title: "Nexus online", body: "Profile, Vault, Campaign, and Multiplayer systems are connected.", tone: "info" },
  ]));
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [proModalOpen, setProModalOpen] = useState(false);
  const [proInterestBusy, setProInterestBusy] = useState(false);
  const [proInterestMessage, setProInterestMessage] = useState("");
  const [connectionHealth, setConnectionHealth] = useState({ api: "checking", database: "checking", supabase: "checking", apiUrl: "" });
  const [onboardingOpen, setOnboardingOpen] = useState(() => {
    const session = restoreAuthSession();
    const stored = normalizeProfile(loadJson("dama-profile", DEFAULT_PROFILE));
    return hasPlayableSession(session) && !normalizeSettings(stored.settings).onboardingCompleted && !localStorage.getItem("dama-onboarding-complete");
  });
  const [leaderboardCity, setLeaderboardCity] = useState(() => localStorage.getItem("dama-leaderboard-city") || "Global");
  const [friendsData, setFriendsData] = useState(() => hasPlayableSession(restoreAuthSession()) ? loadJson("dama-friends", EMPTY_FRIENDS_DATA) : EMPTY_FRIENDS_DATA);
  const [playerSearchResults, setPlayerSearchResults] = useState([]);
  const [publicProfile, setPublicProfile] = useState(null);
  const [incomingChallenge, setIncomingChallenge] = useState(null);
  const [outgoingChallenge, setOutgoingChallenge] = useState(null);
  const [challengeStatus, setChallengeStatus] = useState("");
  const [versusMatchup, setVersusMatchup] = useState(null);
  const [matchHistory, setMatchHistory] = useState(() => loadJson("dama-match-history", []));
  const [campaignProgress, setCampaignProgressState] = useState(() => loadJson("dama-campaign-progress", DEFAULT_CAMPAIGN_PROGRESS));
  const [battlePass, setBattlePass] = useState(() => createBattlePassState());
  const initialRouteRef = useRef(null);
  if (!initialRouteRef.current) {
    initialRouteRef.current = currentRouteFromLocation();
  }
  const initialRoute = initialRouteRef.current;
  const [mode, setMode] = useState(initialRoute.mode || "local");
  const [aiLevel, setAiLevel] = useState("smart");
  const [aiProfileId, setAiProfileId] = useState("tactician");
  const [gameVariant, setGameVariant] = useState(() => hasPlayableSession(restoreAuthSession()) ? "power" : "classic");
  const [boardPreferences, setBoardPreferences] = useState(() => normalizeBoardPreferences(loadJson("dama-board-preferences", defaultBoardPreferencesForDevice())));
  const [campaignFactionId, setCampaignFactionId] = useState("nomads");
  const [campaignLevelId, setCampaignLevelId] = useState("road_behind");
  const [campaignFocusLevelId, setCampaignFocusLevelId] = useState("");
  const [campaignTutorial, setCampaignTutorial] = useState(null);
  const [bootcampTutorial, setBootcampTutorial] = useState(null);
  const campaignProgressFactionRef = useRef("nomads");
  const [loadout, setLoadout] = useState(DEFAULT_LOADOUT);
  const [pendingMatchSetup, setPendingMatchSetup] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [vaultBusyId, setVaultBusyId] = useState("");
  const [inventoryBusyId, setInventoryBusyId] = useState("");
  const [achievementBusyId, setAchievementBusyId] = useState("");
  const [board, setBoard] = useState(() => createInitialBoard());
  const [turn, setTurn] = useState("white");
  const [selected, setSelected] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [moveLog, setMoveLog] = useState([]);
  const [moveReplay, setMoveReplay] = useState([]);
  const [message, setMessage] = useState("Azure opens the match.");
  const [captureChain, setCaptureChain] = useState(null);
  const [multiplayerRoom, setMultiplayerRoom] = useState(null);
  const [multiplayerRole, setMultiplayerRole] = useState("host");
  const [multiplayerStatus, setMultiplayerStatus] = useState("Offline");
  const [remoteSkinIds, setRemoteSkinIds] = useState(() => normalizeSkinIds(null));
  const [matchChatMessages, setMatchChatMessages] = useState([]);
  const [activeMatchEmotes, setActiveMatchEmotes] = useState([]);
  const [lobbyCode, setLobbyCode] = useState(initialRoute.lobbyCode || "");
  const [lobbyRole, setLobbyRole] = useState(initialRoute.view === "lobby" ? "guest" : "host");
  const [lobbyState, setLobbyState] = useState(() => initialRoute.lobbyCode ? readLobbyState(initialRoute.lobbyCode) : null);
  const [lobbyMessage, setLobbyMessage] = useState("");
  const multiplayerSocketRef = useRef(null);
  const challengeSocketRef = useRef(null);
  const lobbySocketRef = useRef(null);
  const matchForfeitHandledRef = useRef(false);
  const [momentum, setMomentum] = useState(2);
  const [ultimateUsed, setUltimateUsed] = useState(false);
  const [powerMode, setPowerMode] = useState(null);
  const [powerSelection, setPowerSelection] = useState([]);
  const [blockedSquares, setBlockedSquares] = useState([]);
  const [protectedSquares, setProtectedSquares] = useState([]);
  const [markedPiece, setMarkedPiece] = useState(null);
  const [sunLancePieceId, setSunLancePieceId] = useState(null);
  const [abilityFlags, setAbilityFlags] = useState(() => createAbilityFlags());
  const [review, setReview] = useState([]);
  const [winner, setWinner] = useState(null);
  const [resultLabel, setResultLabel] = useState(null);
  const [view, setViewState] = useState(initialRoute.view || "nexus");
  const [demoGuideStep, setDemoGuideStep] = useState(() => localStorage.getItem(DEMO_GUIDE_KEY) || "nexus");
  const [abilityFeedback, setAbilityFeedback] = useState(null);
  const [postMatchVictory, setPostMatchVictory] = useState(true);
  const [matchReport, setMatchReport] = useState(() => loadJson("dama-last-match-report", DEFAULT_MATCH_REPORT));
  const [matchStartCounts, setMatchStartCounts] = useState(() => countPieces(createInitialBoard()));
  const activeUserId = authSession?.user?.id || demoUserId;
  const isAuthenticated = hasPlayableSession(authSession);
  const isLocalSession = Boolean(authSession?.offline || authSession?.admin);
  const streakAppliedRef = useRef(false);
  const routeModeRef = useRef(initialRoute.mode || "ai");
  const routeLobbyCodeRef = useRef(initialRoute.lobbyCode || "");
  const lobbyStartedRef = useRef(false);
  const battlePassStorageRef = useRef("");
  const boardViewMode = boardPreferences.viewMode;
  const pieceColors = boardPreferences.pieceColors;

  function applyBoardPreferences(nextPreferences) {
    const normalized = normalizeBoardPreferences(nextPreferences);
    setBoardPreferences(normalized);
    setProfile((current) => normalizeProfile({
      ...current,
      settings: normalizeSettings({ ...current.settings, boardPreferences: normalized }),
    }));
    return normalized;
  }

  function setBoardViewMode(nextMode) {
    applyBoardPreferences({ ...boardPreferences, viewMode: nextMode });
  }

  function setPieceColor(player, value) {
    applyBoardPreferences({
      ...boardPreferences,
      pieceColors: { ...boardPreferences.pieceColors, [player]: value },
    });
  }

  function saveBoardPreferences(nextPreferences = boardPreferences) {
    if (!isAuthenticated) {
      requireAuth("Match look customization");
      return;
    }
    const normalized = applyBoardPreferences(nextPreferences);
    setEconomyMessage("Match look saved.");
    if (isLocalSession) {
      return;
    }
    saveProfile(activeUserId, {
      settings: normalizeSettings({ ...profile.settings, boardPreferences: normalized }),
    }).catch((error) => showError("Customization save failed", error, "Match look saved locally, but Supabase did not save it."));
  }

  function setView(nextView, options = {}) {
    setViewState((current) => {
      const resolved = typeof nextView === "function" ? nextView(current) : nextView;
      const lobbyChanged = options.lobbyCode !== undefined && options.lobbyCode !== routeLobbyCodeRef.current;
      if (options.lobbyCode !== undefined) {
        routeLobbyCodeRef.current = options.lobbyCode || "";
      }
      if (resolved && (resolved !== current || lobbyChanged || options.replace)) {
        syncBrowserRoute(resolved, routeModeRef.current, Boolean(options.replace), routeLobbyCodeRef.current);
      }
      return resolved || current;
    });
  }

  function goBackFromCurrentView() {
    const fallbackTargets = {
      settings: "nexus",
      vault: "nexus",
      inventory: "nexus",
      "battle-pass": "nexus",
      progression: "nexus",
      factions: "nexus",
      "skirmish-config": "nexus",
      "campaign-select": "nexus",
      "campaign-map": "campaign-select",
      "daily-puzzle": "nexus",
      multiplayer: "nexus",
      lobby: "multiplayer",
      "admin-dashboard": "nexus",
      battlefield: "nexus",
      postmatch: "nexus",
    };
    if (view === "loadout") {
      setView(pendingMatchSetup ? "skirmish-config" : "nexus");
      return;
    }
    if (view === "lobby") {
      leaveCurrentLobby("left");
      return;
    }
    if (view === "game") {
      if (mode === "multiplayer" && !winner) {
        forfeitMultiplayerMatch();
      }
      setView(mode === "multiplayer" ? "multiplayer" : mode === "campaign" ? "campaign-map" : mode === "puzzle" ? "daily-puzzle" : "skirmish-config");
      return;
    }
    setView(fallbackTargets[view] || "nexus");
  }

  function withBackNavigation(content, options = {}) {
    const hiddenViews = new Set(["nexus", "register"]);
    if (options.hideBack || hiddenViews.has(view)) {
      return content;
    }
    return (
      <>
        <AppGlobalBackButton onBack={goBackFromCurrentView} label={options.label || "Back"} />
        {content}
      </>
    );
  }

  useEffect(() => {
    syncBrowserRoute(view, routeModeRef.current, true, routeLobbyCodeRef.current);
    const handleRouteChange = () => {
      const route = currentRouteFromLocation();
      if (route.mode) {
        routeModeRef.current = route.mode;
        setMode(route.mode);
      }
      if (route.view === "lobby") {
        const code = route.lobbyCode || "";
        routeLobbyCodeRef.current = code;
        setLobbyCode(code);
        setLobbyRole((current) => current || "guest");
        setLobbyState(code ? readLobbyState(code) : null);
        lobbyStartedRef.current = false;
      }
      setViewState(route.view || "nexus");
    };
    window.addEventListener("popstate", handleRouteChange);
    return () => window.removeEventListener("popstate", handleRouteChange);
  }, []);

  useEffect(() => {
    routeModeRef.current = mode || routeModeRef.current;
    if (view === "game") {
      syncBrowserRoute("game", routeModeRef.current, true);
    }
  }, [mode, view]);

  useEffect(() => {
    if (view !== "lobby" || !lobbyCode) {
      return undefined;
    }
    const syncLobby = () => {
      const stored = readLobbyState(lobbyCode);
      if (stored) {
        setLobbyState((current) => mergeLobbyState(current, stored));
      }
    };
    const handleStorage = (event) => {
      if (event.key === lobbyStorageKey(lobbyCode)) {
        syncLobby();
      }
    };
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(`aether-lobby-${lobbyCode}`) : null;
    if (channel) {
      channel.onmessage = syncLobby;
    }
    window.addEventListener("storage", handleStorage);
    syncLobby();
    return () => {
      window.removeEventListener("storage", handleStorage);
      channel?.close();
    };
  }, [view, lobbyCode]);

  useEffect(() => {
    if (view !== "lobby" || !lobbyState?.host?.ready || !lobbyState?.guest?.ready || lobbyStartedRef.current) {
      return;
    }
    if (!isLocalSession && lobbyState.status !== "starting") {
      return;
    }
    lobbyStartedRef.current = true;
    const player = lobbyState[lobbyRole] || lobbyState.host;
    const opponent = lobbyRole === "host" ? lobbyState.guest : lobbyState.host;
    const nextState = { ...lobbyState, status: "starting", updatedAt: new Date().toISOString() };
    publishLobbyState(nextState);
    setLobbyState(nextState);
    setLoadout(player.loadout || loadout);
    setLobbyMessage("Both commanders ready. Initializing board.");
    window.setTimeout(() => {
      startMultiplayerRoom({
        room_code: lobbyState.code || lobbyCode,
        mode: "private",
        opponent_profile: opponent,
        loadout: player.loadout || loadout,
      }, lobbyRole || "host", { directToGame: true });
    }, 550);
  }, [view, lobbyState, lobbyRole, lobbyCode, loadout, isLocalSession]);

  useEffect(() => {
    refreshCommanderSession()
      .then((session) => {
        if (hasPlayableSession(session)) {
          setAuthSession(session);
          setView((current) => current === "register" ? "nexus" : current);
        } else {
          if (session) {
            signOutCommander(session).catch(() => undefined);
          }
          setAuthSession(null);
          setProfile(createGuestProfile());
          setInventoryItems([]);
          setMatchHistory([]);
          setCampaignProgressState(DEFAULT_CAMPAIGN_PROGRESS);
          setBattlePass(createBattlePassState());
          setFriendsData(EMPTY_FRIENDS_DATA);
          setPlayerSearchResults([]);
          setPendingMatchSetup(null);
          setIncomingChallenge(null);
          setOutgoingChallenge(null);
          setChallengeStatus("");
          challengeSocketRef.current?.close();
          challengeSocketRef.current = null;
        }
        setDemoMode(isDemoMode());
      })
      .catch(() => setDemoMode(isDemoMode()));
    return onCommanderSessionChange((session) => {
      setAuthSession(hasPlayableSession(session) ? session : null);
      setDemoMode(isDemoMode());
      if (!hasPlayableSession(session)) {
        setProfile(createGuestProfile());
        setInventoryItems([]);
        setMatchHistory([]);
        setCampaignProgressState(DEFAULT_CAMPAIGN_PROGRESS);
        setBattlePass(createBattlePassState());
        setFriendsData(EMPTY_FRIENDS_DATA);
        setPlayerSearchResults([]);
        setPendingMatchSetup(null);
        setIncomingChallenge(null);
        setOutgoingChallenge(null);
        setChallengeStatus("");
        challengeSocketRef.current?.close();
        challengeSocketRef.current = null;
        setView((current) => AUTH_REQUIRED_VIEWS.has(current) ? "nexus" : current);
      }
    });
  }, []);

  useEffect(() => {
    getBootstrap(profile.city).then((payload) => {
      setData(payload);
      const firstLevel = payload.campaign?.levels?.[0]?.id;
      if (firstLevel) {
        setCampaignLevelId(firstLevel);
      }
    });
  }, [profile.city]);

  useEffect(() => {
    saveJson("dama-profile", profile);
  }, [profile]);

  useEffect(() => {
    saveJson("dama-inventory", inventoryItems);
  }, [inventoryItems]);

  useEffect(() => {
    saveJson("dama-vault-items", vaultItems);
  }, [vaultItems]);

  useEffect(() => {
    saveJson("dama-notifications", notifications);
  }, [notifications]);

  useEffect(() => {
    const step = DEMO_GUIDE_STEPS.includes(demoGuideStep) ? demoGuideStep : "nexus";
    localStorage.setItem(DEMO_GUIDE_KEY, step);
  }, [demoGuideStep]);

  useEffect(() => {
    saveJson("dama-board-preferences", boardPreferences);
  }, [boardPreferences]);

  useEffect(() => {
    if (!isAuthenticated) {
      localStorage.removeItem("dama-friends");
      return;
    }
    saveJson("dama-friends", friendsData);
  }, [friendsData, isAuthenticated]);

  useEffect(() => {
    configureAudio(profile.settings);
    const nextSettings = normalizeSettings(profile.settings);
    document.documentElement.dataset.reducedMotion = nextSettings.reducedMotion ? "true" : "false";
    document.documentElement.dataset.theme = nextSettings.theme;
  }, [profile.settings]);

  useEffect(() => {
    const savedPreferences = profile.settings?.boardPreferences;
    if (!savedPreferences) {
      return;
    }
    const normalized = normalizeBoardPreferences(savedPreferences);
    setBoardPreferences((current) => boardPreferencesEqual(current, normalized) ? current : normalized);
  }, [activeUserId, profile.settings?.boardPreferences?.viewMode, profile.settings?.boardPreferences?.pieceColors?.white, profile.settings?.boardPreferences?.pieceColors?.black]);

  useEffect(() => {
    localStorage.setItem("dama-leaderboard-city", leaderboardCity);
  }, [leaderboardCity]);

  useEffect(() => {
    if (streakAppliedRef.current) {
      return;
    }
    if (!isAuthenticated || isLocalSession) {
      return;
    }
    streakAppliedRef.current = true;
    const today = currentDateKey();
    const streaks = normalizeStreaks(profile.streaks);
    if (streaks.lastLoginDate !== today) {
      const yesterday = previousDateKey();
      const nextStreaks = {
        ...streaks,
        loginDays: streaks.lastLoginDate === yesterday ? streaks.loginDays + 1 : 1,
        lastLoginDate: today,
      };
      setProfile((current) => normalizeProfile({ ...current, streaks: nextStreaks }));
      saveProfile(activeUserId, { streaks: nextStreaks })
        .catch((error) => setScreenMessage("Streak sync", getReadableError(error, "Unable to save login streak.")));
    }
  }, [activeUserId, isAuthenticated, isLocalSession, profile.streaks]);

  useEffect(() => {
    saveJson("dama-match-history", matchHistory);
  }, [matchHistory]);

  useEffect(() => {
    if (campaignProgressFactionRef.current !== campaignFactionId) {
      campaignProgressFactionRef.current = campaignFactionId;
      return;
    }
    saveJson(`dama-campaign-progress-${campaignFactionId}`, campaignProgress);
    if (campaignFactionId === "nomads") {
      saveJson("dama-campaign-progress", campaignProgress);
    }
  }, [campaignProgress, campaignFactionId]);

  useEffect(() => {
    setCampaignProgressState(loadCampaignProgressForFaction(campaignFactionId));
  }, [campaignFactionId]);

  useEffect(() => {
    const key = battlePassStorageKey(isAuthenticated ? activeUserId : "guest");
    battlePassStorageRef.current = key;
    setBattlePass(normalizeBattlePassState(loadJson(key, createBattlePassState())));
  }, [activeUserId, isAuthenticated]);

  useEffect(() => {
    const key = battlePassStorageKey(isAuthenticated ? activeUserId : "guest");
    if (battlePassStorageRef.current === key) {
      saveJson(key, battlePass);
    }
  }, [battlePass, activeUserId, isAuthenticated]);

  useEffect(() => {
    saveJson("dama-last-match-report", matchReport);
  }, [matchReport]);

  useEffect(() => {
    if (!isAuthenticated) {
      setProfile(createGuestProfile());
      setInventoryItems([]);
      setMatchHistory([]);
      setCampaignProgressState(DEFAULT_CAMPAIGN_PROGRESS);
      setBattlePass(createBattlePassState());
      setFriendsData(EMPTY_FRIENDS_DATA);
      setPlayerSearchResults([]);
      setPendingMatchSetup(null);
      setIncomingChallenge(null);
      setOutgoingChallenge(null);
      setChallengeStatus("");
      challengeSocketRef.current?.close();
      challengeSocketRef.current = null;
      return;
    }
    if (isLocalSession) {
      setDemoMode(true);
      return;
    }
    getProfile(activeUserId)
      .then((payload) => setProfile((current) => profileFromApiPayload(payload, current)))
      .catch((error) => setScreenMessage("Profile sync", getReadableError(error, "Unable to refresh profile from Supabase.")));
    getVaultItems(activeUserId)
      .then((payload) => setVaultItems(mergeVaultCatalog(payload.items || DEFAULT_VAULT_ITEMS)))
      .catch((error) => setScreenMessage("Vault sync", getReadableError(error, "Unable to refresh Vault items.")));
    getInventory(activeUserId)
      .then((payload) => setInventoryItems((payload.items || []).map(normalizeInventoryItem)))
      .catch((error) => setScreenMessage("Inventory sync", getReadableError(error, "Unable to refresh Inventory.")));
    getMatchHistory(activeUserId)
      .then((payload) => setMatchHistory(payload.matches || []))
      .catch((error) => setScreenMessage("Match history sync", getReadableError(error, "Unable to refresh match history.")));
    getCampaignProgress(activeUserId, campaignFactionId)
      .then((payload) => setCampaignProgressState(normalizeCampaignProgress(payload.progress)))
      .catch((error) => setScreenMessage("Campaign sync", getReadableError(error, "Unable to refresh campaign progress.")));
    getFriends(activeUserId)
      .then((payload) => setFriendsData(normalizeFriendsData(payload)))
      .catch((error) => {
        setScreenMessage("Friends sync", getReadableError(error, "Unable to refresh friends."));
        setFriendsData(EMPTY_FRIENDS_DATA);
      });
  }, [activeUserId, isAuthenticated, isLocalSession, campaignFactionId]);

  useEffect(() => {
    getLiveLeaderboard(leaderboardCity, 10)
      .then((payload) => {
        if (payload.rows?.length) {
          setData((current) => current ? { ...current, leaderboard: payload.rows.map(normalizeLeaderboardRow) } : current);
        }
      })
      .catch((error) => setScreenMessage("Leaderboard sync", getReadableError(error, "Unable to refresh leaderboard.")));
  }, [leaderboardCity, activeUserId]);

  useEffect(() => {
    let active = true;
    getConnectionHealth()
      .then((health) => {
        if (active) {
          setConnectionHealth({ ...health, websocket: multiplayerStatus === "Offline" ? "idle" : multiplayerStatus });
          setDemoMode(health.supabase === "demo" || health.api !== "online");
        }
      })
      .catch(() => {
        if (active) {
          setConnectionHealth((current) => ({ ...current, api: "offline", database: "offline", websocket: "idle" }));
          setDemoMode(true);
        }
      });
    return () => {
      active = false;
    };
  }, [activeUserId, multiplayerStatus]);

  const factions = data?.factions || [];
  const campaign = useMemo(() => withFactionCampaign(data?.campaigns || data?.campaign, campaignFactionId), [data?.campaign, data?.campaigns, campaignFactionId]);
  const leaderboard = data?.leaderboard || [];
  const faction = factions.find((item) => item.id === loadout.factionId) || factions[0];
  const passive = faction?.passives.find((item) => item.id === loadout.passiveId) || faction?.passives[0];
  const ultimate = faction?.ultimates.find((item) => item.id === loadout.ultimateId) || faction?.ultimates[0];
  const campaignLevel = campaign?.levels.find((item) => item.id === campaignLevelId) || campaign?.levels[0];
  const counts = countPieces(board);
  const equippedCosmetics = useMemo(() => getEquippedCosmetics(inventoryItems, profile, vaultItems), [inventoryItems, profile, vaultItems]);
  const equippedSkinIds = useMemo(() => skinIdsFromCosmetics(equippedCosmetics, boardViewMode), [equippedCosmetics, boardViewMode]);
  const matchCosmetics = useMemo(() => buildMatchCosmetics({
    localCosmetics: equippedCosmetics,
    remoteSkinIds,
    mode,
    multiplayerRole,
    catalog: vaultItems,
    viewMode: boardViewMode,
  }), [equippedCosmetics, remoteSkinIds, mode, multiplayerRole, vaultItems, boardViewMode]);
  const powerTargets = useMemo(() => getPowerTargets(), [powerMode, selected, legalMoves, powerSelection, board]);
  const passiveTargets = useMemo(() => getPassiveTargets(), [gameVariant, mode, turn, winner, powerMode, multiplayerRole, loadout.passiveId, abilityFlags.shieldWall, board, blockedSquares, protectedSquares, captureChain]);
  const resultText = getResultText(winner, resultLabel);
  const tacticalHint = getTacticalHint({ board, turn, legalMoves, captureChain, selected, winner, mode, campaignLevel, options: getMoveOptions(turn) });
  const campaignTutorialPrompt = getCampaignTutorialPrompt(campaignTutorial);
  const bootcampTutorialPrompt = getBootcampTutorialPrompt(bootcampTutorial);
  const campaignTutorialTargets = useMemo(() => getCampaignTutorialTargets(campaignTutorial), [campaignTutorial]);
  const activeTutorialPrompt = mode === "campaign" ? campaignTutorialPrompt : bootcampTutorialPrompt;

  useEffect(() => {
    if (!bootcampTutorial || mode !== "ai") {
      return;
    }
    setBootcampTutorial((current) => {
      if (!current) {
        return current;
      }
      let nextStep = current.stepIndex || 0;
      if (winner) {
        nextStep = Math.max(nextStep, 4);
      } else if (ultimateUsed) {
        nextStep = Math.max(nextStep, 4);
      } else if (powerMode) {
        nextStep = Math.max(nextStep, 3);
      } else if (moveLog.length >= 1) {
        nextStep = Math.max(nextStep, 2);
      } else if (selected) {
        nextStep = Math.max(nextStep, 1);
      }
      return nextStep === current.stepIndex ? current : { ...current, stepIndex: nextStep };
    });
  }, [bootcampTutorial, mode, selected, moveLog.length, powerMode, ultimateUsed, winner]);

  useEffect(() => {
    if (!["ai", "campaign", "puzzle"].includes(mode) || turn !== "black" || winner) {
      return;
    }
    if (isGuidedCampaignTutorialActive(campaignTutorial)) {
      return;
    }
    const timeout = window.setTimeout(() => {
      const move = chooseAiMove(board, aiLevel, {
        ...getMoveOptions("black"),
        aiPersonality: getCurrentAiPersonality(mode, aiLevel, campaignLevel),
      });
      if (!move) {
        finish("white", "because Amber has no moves");
        return;
      }
      commitMove(move, "AI");
    }, aiLevel === "coach" ? 650 : 420);
    return () => window.clearTimeout(timeout);
  }, [mode, turn, winner, board, aiLevel, blockedSquares, protectedSquares, campaignLevel, campaignTutorial]);

  useEffect(() => {
    const step = getCampaignTutorialStep(campaignTutorial);
    if (mode !== "campaign" || !isGuidedCampaignTutorialActive(campaignTutorial) || turn !== "black" || winner || step?.actor !== "ai") {
      return;
    }
    setMessage(step.prompt);
    const timeout = window.setTimeout(() => {
      const scriptedMove = moveFromTutorialStep(board, step);
      if (!scriptedMove) {
        setMessage(`Tutorial script needs ${step.label}. Restart this campaign sector.`);
        return;
      }
      commitMove(scriptedMove, "AI");
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [mode, campaignTutorial, turn, winner, board]);

  useEffect(() => {
    const step = getCampaignTutorialStep(campaignTutorial);
    if (mode !== "campaign" || !isGuidedCampaignTutorialActive(campaignTutorial) || winner || step?.actor !== "system") {
      return;
    }
    setMessage(step.prompt);
    const timeout = window.setTimeout(() => {
      if (step.clearProtectedSquares) {
        setProtectedSquares([]);
      }
      if (step.clearBlockedSquares) {
        setBlockedSquares([]);
      }
      if (step.setTurn) {
        setTurn(step.setTurn);
      }
      const tutorialAdvance = advanceCampaignTutorialAfterMove(board);
      setSelected(null);
      setLegalMoves([]);
      setPowerMode(null);
      setPowerSelection([]);
      setMessage(tutorialAdvance?.message || step.afterPrompt || "Dust Veil resolved. Counterattack now.");
      setReview((items) => [...items, `${step.label}: ability effect resolved after ${step.waitMs || 900}ms.`].slice(-6));
    }, step.waitMs || 900);
    return () => window.clearTimeout(timeout);
  }, [mode, campaignTutorial, winner, board]);

  useEffect(() => {
    if (mode !== "multiplayer" || !multiplayerRoom?.room_code) {
      multiplayerSocketRef.current?.close();
      multiplayerSocketRef.current = null;
      return;
    }
    let socket;
    let cancelled = false;
    getAccessToken()
      .then((token) => {
        if (cancelled) {
          return;
        }
        const params = new URLSearchParams({ user_id: activeUserId, role: multiplayerRole, phase: "match" });
        params.set("piece_skin", equippedSkinIds.piece || "");
        params.set("board_skin", equippedSkinIds.board || "");
        if (token) {
          params.set("token", token);
        }
        socket = new WebSocket(apiWsUrl(`/api/ws/rooms/${encodeURIComponent(multiplayerRoom.room_code)}`, params));
        multiplayerSocketRef.current = socket;
        socket.onopen = () => {
          setMultiplayerStatus(`${multiplayerRole === "host" ? "Hosting" : "Joined"} room ${multiplayerRoom.room_code}`);
          sendMultiplayerState("sync_request");
          window.setTimeout(() => sendMultiplayerState("presence"), 40);
        };
        socket.onmessage = (event) => {
          const messageData = JSON.parse(event.data);
          const payload = messageData.payload || messageData;
          if (payload.type === "board_state" && payload.from_user_id !== activeUserId) {
            applyRemoteBoardState(payload.state);
          }
          if (payload.type === "chat_message" && payload.from_user_id !== activeUserId) {
            receiveMatchChat(payload, "opponent");
          }
          if (payload.type === "match_emote" && payload.from_user_id !== activeUserId) {
            receiveMatchEmote(payload, "opponent");
          }
          if (messageData.type === "match_forfeit" || payload.type === "match_forfeit") {
            handleMultiplayerForfeit(messageData.type === "match_forfeit" ? messageData : payload);
          }
          if (messageData.type === "player_left") {
            setMultiplayerStatus(messageData.message || "Opponent left the room.");
          }
          if (messageData.type === "room_state") {
            const roomSkinIds = skinIdsForRemotePlayer(messageData.room?.player_skin_ids, activeUserId);
            if (roomSkinIds) {
              setRemoteSkinIds(roomSkinIds);
            }
            if (messageData.room?.forfeit) {
              handleMultiplayerForfeit(messageData.room.forfeit);
              return;
            }
            const connectedStatus = ["ready", "starting", "configuring", "in_match"].includes(messageData.room?.status) && messageData.room?.guest_user_id;
            setMultiplayerStatus(connectedStatus ? "Opponent connected" : "Waiting for opponent");
            if (connectedStatus) {
              playSound("joined");
              speakLine("Opponent joined.");
            }
          }
          if (messageData.type === "move_rejected") {
            setMultiplayerStatus(messageData.reason || "Move rejected");
          }
        };
        socket.onclose = () => setMultiplayerStatus("Disconnected");
        socket.onerror = () => setMultiplayerStatus("Socket unavailable. Start backend on port 8000.");
      })
      .catch(() => setMultiplayerStatus("Socket auth unavailable."));
    return () => {
      cancelled = true;
      socket?.close();
    };
  }, [mode, multiplayerRoom?.room_code, multiplayerRole, activeUserId, equippedSkinIds.piece, equippedSkinIds.board]);

  useEffect(() => {
    if (!isAuthenticated || isLocalSession) {
      challengeSocketRef.current?.close();
      challengeSocketRef.current = null;
      return undefined;
    }
    let socket;
    let cancelled = false;
    getAccessToken()
      .then((token) => {
        if (cancelled) {
          return;
        }
        const params = new URLSearchParams({ user_id: activeUserId });
        if (token) {
          params.set("token", token);
        }
        socket = new WebSocket(apiWsUrl("/api/ws/challenges", params));
        challengeSocketRef.current = socket;
        socket.onopen = () => setChallengeStatus((current) => current || "Duel channel online.");
        socket.onmessage = (event) => {
          try {
            handleChallengeEvent(JSON.parse(event.data));
          } catch {
            setChallengeStatus("Duel channel received unreadable data.");
          }
        };
        socket.onclose = () => {
          if (challengeSocketRef.current === socket) {
            challengeSocketRef.current = null;
          }
          setChallengeStatus((current) => outgoingChallenge ? current || "Duel channel disconnected." : "");
        };
        socket.onerror = () => setChallengeStatus("Duel channel unavailable. Start the backend on port 8000.");
      })
      .catch((error) => setChallengeStatus(getReadableError(error, "Duel channel auth unavailable.")));
    return () => {
      cancelled = true;
      socket?.close();
    };
  }, [activeUserId, isAuthenticated, isLocalSession]);

  useEffect(() => {
    if (view !== "lobby" || !lobbyCode || !isAuthenticated || isLocalSession) {
      lobbySocketRef.current?.close();
      lobbySocketRef.current = null;
      return undefined;
    }
    let socket;
    let cancelled = false;
    getAccessToken()
      .then((token) => {
        if (cancelled) {
          return;
        }
        const params = new URLSearchParams({ user_id: activeUserId, role: lobbyRole || "guest", phase: "lobby" });
        params.set("piece_skin", equippedSkinIds.piece || "");
        params.set("board_skin", equippedSkinIds.board || "");
        if (token) {
          params.set("token", token);
        }
        socket = new WebSocket(apiWsUrl(`/api/ws/rooms/${encodeURIComponent(lobbyCode)}`, params));
        lobbySocketRef.current = socket;
        socket.onopen = () => {
          sendLobbyPresence(socket);
        };
        socket.onmessage = (event) => {
          try {
            const messageData = JSON.parse(event.data);
            const payload = messageData.payload || messageData;
            if (messageData.type === "room_updated") {
              setLobbyState((current) => {
                const nextState = lobbyStateFromRoomUpdate(messageData, current, lobbyCode, factions);
                writeLobbyState(nextState);
                const bothConnected = Boolean(nextState.host && nextState.guest && nextState.host.connected !== false && nextState.guest.connected !== false);
                const disconnectedOpponent = [nextState.host, nextState.guest].find((item) => item && item.user_id !== activeUserId && item.connected === false);
                setLobbyMessage(disconnectedOpponent ? `${disconnectedOpponent.username || "Opponent"} left the room.` : bothConnected ? "Two commanders connected. Select loadouts and press Ready." : "Waiting for opponent to join by code.");
                return nextState;
              });
            }
            if (messageData.type === "player_left") {
              setLobbyState((current) => {
                const nextState = lobbyStateFromRoomUpdate(messageData, current, lobbyCode, factions);
                writeLobbyState(nextState);
                return nextState;
              });
              setLobbyMessage(messageData.message || "Commander left the room.");
              addNotification("Lobby update", messageData.message || "Commander left the room.", "warning");
            }
            if (messageData.type === "match_start") {
              setLobbyState((current) => {
                const nextState = lobbyStateFromRoomUpdate(messageData, current, lobbyCode, factions);
                writeLobbyState(nextState);
                setLobbyMessage("Server confirmed both commanders are ready. Initializing board.");
                return nextState;
              });
            }
            if (payload.type === "lobby_state" && payload.from_user_id !== activeUserId) {
              setLobbyState((current) => {
                const merged = mergeLobbyState(current, payload.state);
                writeLobbyState(merged);
                return merged;
              });
              setLobbyMessage("Remote commander updated lobby readiness.");
            }
            if (messageData.type === "room_state" && messageData.room?.status === "ready") {
              setLobbyMessage("Duel room is ready. Configure loadouts and press Ready.");
            }
          } catch {
            setLobbyMessage("Lobby socket received unreadable data.");
          }
        };
        socket.onerror = () => setLobbyMessage("Lobby realtime sync unavailable. Start backend on port 8000.");
      })
      .catch((error) => setLobbyMessage(getReadableError(error, "Lobby realtime auth unavailable.")));
    return () => {
      cancelled = true;
      socket?.close();
    };
  }, [view, lobbyCode, lobbyRole, activeUserId, isAuthenticated, isLocalSession, equippedSkinIds.piece, equippedSkinIds.board]);

  function startMatch(nextMode = mode, level = campaignLevel, options = {}) {
    if (!isAuthenticated && nextMode !== "ai") {
      requireAuth("Campaigns, puzzles, local progression, and multiplayer");
      return;
    }
    const requestedVariant = options.variant || (nextMode === "ai" ? gameVariant : "power");
    if (!isAuthenticated && requestedVariant === "power") {
      requireAuth("Power Checkers");
    }
    const nextVariant = !isAuthenticated ? "classic" : requestedVariant;
    const tutorial = nextMode === "campaign" ? createCampaignTutorial(level) : null;
    const nextLoadout = options.loadout || (nextMode === "campaign" && level ? level.loadout : loadout);
    const nextBoard = options.board || tutorial?.snapshot || (nextMode === "campaign" && level ? createBoardFromCoordinates(level.white, level.black) : createInitialBoard());
    if (options.aiLevel) {
      setAiLevel(options.aiLevel);
      setAiProfileId(options.aiProfileId || AI_PROFILE_BY_LEVEL[options.aiLevel] || "tactician");
    } else if (options.aiProfileId) {
      setAiProfileId(options.aiProfileId);
    } else if (nextMode === "campaign") {
      setAiLevel(level?.aiLevel || "beginner");
      setAiProfileId(level?.aiPersonality === "void_order" ? "nexus_prime" : level?.aiPersonality === "iron_guard" ? "veteran" : level?.aiPersonality === "sun_court" ? "tactician" : "recruit");
    } else if (nextMode === "puzzle") {
      setAiProfileId("tactician");
    }
    if (nextMode !== "multiplayer") {
      setMultiplayerRoom(null);
      setMultiplayerStatus("Offline");
      setRemoteSkinIds(normalizeSkinIds(null));
    } else if (options.remoteSkinIds) {
      setRemoteSkinIds(normalizeSkinIds(options.remoteSkinIds));
    }
    setPendingMatchSetup(null);
    matchForfeitHandledRef.current = false;
    setCampaignTutorial(tutorial);
    setBootcampTutorial(options.bootcampTutorial ? { stepIndex: 0 } : null);
    routeModeRef.current = nextMode;
    setMode(nextMode);
    setGameVariant(nextVariant);
    setLoadout(nextLoadout);
    setBoard(nextBoard);
    setMatchStartCounts(countPieces(nextBoard));
    setTurn("white");
    setSelected(null);
    setLegalMoves([]);
    setMoveLog([]);
    setMoveReplay([]);
    setMessage(options.message || tutorial?.intro || (nextMode === "campaign" && level ? `${level.name}: ${level.objective}` : "Azure opens the match."));
    setCaptureChain(null);
    setMomentum(nextVariant === "classic" ? 0 : 2);
    setUltimateUsed(nextVariant === "classic");
    setPowerMode(null);
    setPowerSelection([]);
    setBlockedSquares([]);
    setProtectedSquares([]);
    setMarkedPiece(null);
    setSunLancePieceId(null);
    setAbilityFlags(createAbilityFlags());
    setReview(options.review || (tutorial ? [tutorial.intro, getCampaignTutorialPrompt(tutorial)] : options.bootcampTutorial ? ["Bootcamp started: try a move, charge Momentum, then test the ultimate."] : []));
    setWinner(null);
    setResultLabel(null);
  }

  function startDemoJourney() {
    if (!isAuthenticated) {
      setAuthError("Create or login to a commander account, then the guided demo will unlock campaign rewards.");
      setDemoGuideStep("nexus");
      setView("register");
      return;
    }
    const demoCampaign = withFactionCampaign(data?.campaigns || data?.campaign, "nomads");
    const levels = demoCampaign?.levels || [];
    const completed = new Set(campaignProgress.completed_levels || []);
    const firstPlayable = levels.find((level) => !completed.has(level.id)) || levels[0] || campaignLevel;
    const nomadLoadout = {
      factionId: "nomads",
      passiveId: firstPlayable?.loadout?.passiveId || DEFAULT_LOADOUT.passiveId,
      ultimateId: firstPlayable?.loadout?.ultimateId || DEFAULT_LOADOUT.ultimateId,
    };
    setCampaignFactionId("nomads");
    setLoadout(nomadLoadout);
    setGameVariant("power");
    setCampaignLevelId(firstPlayable?.id || "road_behind");
    setCampaignFocusLevelId(firstPlayable?.id || "road_behind");
    setDemoGuideStep("campaign");
    setEconomyMessage("Demo path armed: start the highlighted Nomads campaign sector, then open the coach report and Vault.");
    addNotification("Guided demo started", "Follow the highlighted campaign node to see faction powers, rewards, and monetization in two minutes.", "success");
    setView("campaign-map");
  }

  function openCampaignPath(factionId = "nomads") {
    const nextCampaign = withFactionCampaign(data?.campaigns || data?.campaign, factionId);
    const nextProgress = loadCampaignProgressForFaction(factionId);
    const completed = new Set(nextProgress.completed_levels || []);
    const firstPlayable = nextCampaign.levels.find((level) => !completed.has(level.id)) || nextCampaign.levels[0];
    setCampaignFactionId(factionId);
    setCampaignProgressState(nextProgress);
    setCampaignLevelId(firstPlayable?.id || `${factionId}_duel`);
    setCampaignFocusLevelId(firstPlayable?.id || "");
    if (firstPlayable?.loadout) {
      setLoadout(firstPlayable.loadout);
      setGameVariant("power");
    }
    setEconomyMessage(`${nextCampaign.name} selected. Start the highlighted mission to learn this faction's powers.`);
    setView("campaign-map");
  }

  function showAbilityFeedback(powerId, extra = "") {
    const label = abilityImpactText(powerId, loadout, campaignLevel);
    setAbilityFeedback({
      id: `${Date.now()}-${powerId || "ability"}`,
      title: abilityLabel(powerId || loadout.ultimateId || loadout.passiveId),
      body: extra || label,
    });
    window.clearTimeout(showAbilityFeedback.timer);
    showAbilityFeedback.timer = window.setTimeout(() => setAbilityFeedback(null), 2100);
  }

  function routeFromNexus(routeId) {
    if (!isAuthenticated && AUTH_REQUIRED_ROUTES.has(routeId)) {
      requireAuth(routeId === "multiplayer" ? "Multiplayer" : routeId === "vault" ? "The Vault" : routeId === "daily-puzzle" ? "Daily Challenges" : routeId === "campaign" ? "Campaign" : "that Nexus module");
      return;
    }
    if (routeId === "single") {
      startMatch("ai", campaignLevel, { variant: "classic", aiLevel: "beginner", aiProfileId: "recruit" });
      setView("game");
      return;
    }
    if (routeId === "skirmish") {
      setView("skirmish-config");
      return;
    }
    if (routeId === "campaign") {
      setView("campaign-select");
      return;
    }
    if (routeId === "daily-puzzle") {
      setView("daily-puzzle");
      return;
    }
    if (routeId === "multiplayer") {
      setView("multiplayer");
      return;
    }
    if (routeId === "battle-pass") {
      setView("battle-pass");
      return;
    }
    if (routeId === "codex") {
      setView("factions");
      return;
    }
    setView(routeId);
  }

  function requireAuth(feature = "This feature") {
    addNotification("Login required", `${feature} is locked for guests. Create a commander or log in to unlock it.`, "warning");
    setEconomyMessage(`${feature} requires a commander account.`);
  }

  function startMultiplayerRoom(room, role = "host", options = {}) {
    const roomCode = room?.room_code || room?.roomCode || room;
    if (!roomCode) {
      addNotification("Room error", "No room code was generated.", "warning");
      return;
    }
    const opponentSkinIds = normalizeSkinIds(typeof room === "object" ? room.opponent_profile?.skinIds || room.opponent_profile?.skin_ids || room.opponent_skin_ids : null);
    setMultiplayerRoom({ ...(typeof room === "object" ? room : {}), room_code: roomCode });
    setMultiplayerRole(role);
    setMatchChatMessages([]);
    setActiveMatchEmotes([]);
    startMatch("multiplayer", campaignLevel, { variant: "power", loadout: room?.loadout || loadout, remoteSkinIds: opponentSkinIds });
    setVersusMatchup(createVersusMatchup(profile, typeof room === "object" ? room.opponent_profile : null, role, roomCode, loadout, factions));
    playSound("joined");
    speakLine(role === "host" ? "Private lobby ready." : "Opponent joined.");
    setMessage(`${role === "host" ? "Hosting" : "Joined"} private room ${roomCode}.`);
    setView(options.directToGame ? "game" : "versus-intro");
  }

  function publishLobbyState(nextState) {
    if (!nextState?.code) {
      return;
    }
    writeLobbyState(nextState);
    const socket = lobbySocketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      const player = nextState[lobbyRole] || createLobbyPlayer(profile, activeUserId, loadout, factions, equippedSkinIds);
      socket.send(JSON.stringify({
        type: "lobby_update",
        from_user_id: activeUserId,
        role: lobbyRole,
        profile: player,
        loadout: player.loadout || loadout,
        skinIds: player.skinIds || equippedSkinIds,
        ready: Boolean(player.ready),
      }));
    }
  }

  function sendLobbyPresence(socket = lobbySocketRef.current, stateOverride = null) {
    if (!socket || socket.readyState !== WebSocket.OPEN || !lobbyCode) {
      return;
    }
    const player = stateOverride?.[lobbyRole] || lobbyState?.[lobbyRole] || createLobbyPlayer(profile, activeUserId, loadout, factions, equippedSkinIds);
    socket.send(JSON.stringify({
      type: "join_room",
      from_user_id: activeUserId,
      role: lobbyRole || "guest",
      profile: player,
      loadout: player.loadout || loadout,
      skinIds: player.skinIds || equippedSkinIds,
      ready: Boolean(player.ready),
    }));
  }

  function openHostedLobby() {
    if (!isAuthenticated) {
      requireAuth("Custom Multiplayer Lobby");
      return;
    }
    const code = generateJoinCode();
    const state = createLobbyState(code, "host", createLobbyPlayer(profile, activeUserId, loadout, factions, equippedSkinIds));
    routeLobbyCodeRef.current = code;
    lobbyStartedRef.current = false;
    setLobbyCode(code);
    setLobbyRole("host");
    setLobbyState(state);
    setLobbyMessage(`Lobby ${code} created. Share the code with a friend.`);
    publishLobbyState(state);
    addNotification("Lobby hosted", `Share code ${code} with another commander.`, "success");
    setView("lobby", { lobbyCode: code });
  }

  function openJoinLobby(code) {
    if (!isAuthenticated) {
      requireAuth("Custom Multiplayer Lobby");
      return;
    }
    const cleanCode = sanitizeLobbyCode(code);
    if (!cleanCode) {
      addNotification("Lobby join", "Enter a valid 6-character lobby code.", "warning");
      return;
    }
    routeLobbyCodeRef.current = cleanCode;
    lobbyStartedRef.current = false;
    setLobbyCode(cleanCode);
    setLobbyRole("guest");
    setLobbyState(readLobbyState(cleanCode));
    setLobbyMessage(`Lobby ${cleanCode} loaded. Join when ready.`);
    setView("lobby", { lobbyCode: cleanCode });
  }

  function joinCurrentLobby() {
    const code = sanitizeLobbyCode(lobbyCode);
    if (!code) {
      setLobbyMessage("Enter a lobby code first.");
      return;
    }
    const currentState = readLobbyState(code) || createLobbyState(code, "guest", null);
    const nextState = {
      ...currentState,
      code,
      guest: createLobbyPlayer(profile, activeUserId, loadout, factions, equippedSkinIds),
      status: "configuring",
      updatedAt: new Date().toISOString(),
    };
    routeLobbyCodeRef.current = code;
    setLobbyCode(code);
    setLobbyRole("guest");
    setLobbyState(nextState);
    setLobbyMessage("Joined lobby. Select your faction and press Ready.");
    publishLobbyState(nextState);
    sendLobbyPresence(lobbySocketRef.current, nextState);
    addNotification("Lobby joined", `Connected to lobby ${code}.`, "success");
    setView("lobby", { lobbyCode: code, replace: true });
  }

  function leaveCurrentLobby(reason = "left") {
    const code = sanitizeLobbyCode(lobbyCode);
    const socket = lobbySocketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "leave_room",
        from_user_id: activeUserId,
        role: lobbyRole,
        reason,
      }));
    }
    if (code) {
      setLobbyState((current) => {
        if (!current) {
          return current;
        }
        const currentPlayer = current[lobbyRole];
        const nextState = {
          ...current,
          status: lobbyRole === "host" ? "abandoned" : "waiting",
          [lobbyRole]: currentPlayer ? {
            ...currentPlayer,
            connected: false,
            ready: false,
            updatedAt: new Date().toISOString(),
          } : currentPlayer,
          updatedAt: new Date().toISOString(),
        };
        writeLobbyState(nextState);
        return nextState;
      });
    }
    setLobbyMessage("You left the lobby.");
    setView("multiplayer");
  }

  function updateLobbyPlayerLoadout(nextLoadout) {
    const code = sanitizeLobbyCode(lobbyCode);
    if (!code || !lobbyRole) {
      return;
    }
    const currentState = readLobbyState(code) || createLobbyState(code, lobbyRole, null);
    const currentPlayer = currentState[lobbyRole] || createLobbyPlayer(profile, activeUserId, loadout, factions, equippedSkinIds);
    const nextState = {
      ...currentState,
      code,
      [lobbyRole]: {
        ...currentPlayer,
        loadout: nextLoadout,
        skinIds: equippedSkinIds,
        ready: false,
        updatedAt: new Date().toISOString(),
      },
      status: "configuring",
      updatedAt: new Date().toISOString(),
    };
    setLoadout(nextLoadout);
    setLobbyState(nextState);
    publishLobbyState(nextState);
  }

  function setLobbyReady(ready) {
    const code = sanitizeLobbyCode(lobbyCode);
    if (!code || !lobbyRole) {
      return;
    }
    const currentState = readLobbyState(code) || createLobbyState(code, lobbyRole, null);
    const currentPlayer = currentState[lobbyRole] || createLobbyPlayer(profile, activeUserId, loadout, factions, equippedSkinIds);
    const nextState = {
      ...currentState,
      code,
      [lobbyRole]: {
        ...currentPlayer,
        loadout,
        skinIds: equippedSkinIds,
        ready,
        updatedAt: new Date().toISOString(),
      },
      status: ready ? "ready_check" : "configuring",
      updatedAt: new Date().toISOString(),
    };
    setLobbyState(nextState);
    writeLobbyState(nextState);
    const socket = lobbySocketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      const player = nextState[lobbyRole];
      socket.send(JSON.stringify({
        type: "player_ready",
        from_user_id: activeUserId,
        role: lobbyRole,
        ready,
        profile: player,
        loadout: player.loadout || loadout,
        skinIds: player.skinIds || equippedSkinIds,
      }));
    } else {
      publishLobbyState(nextState);
    }
    setLobbyMessage(ready ? "Ready locked. Waiting for the other commander." : "Ready cancelled. Adjust your loadout.");
  }

  function sendMultiplayerState(type = "board_state", override = {}) {
    const socket = multiplayerSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    if (type === "sync_request") {
      socket.send(JSON.stringify({
        type: "sync_request",
        from_user_id: activeUserId,
        skinIds: equippedSkinIds,
        playerColor: multiplayerRole === "guest" ? "black" : "white",
      }));
      return;
    }
    const actionType = inferNetworkActionType(type, override, moveReplay);
    const abilityAction = override.abilityAction || null;
    socket.send(JSON.stringify({
      type: "board_state",
      from_user_id: activeUserId,
      reason: type,
      actionType,
      action: abilityAction,
      state: {
        board,
        turn,
        moveLog,
        moveReplay,
        blockedSquares,
        protectedSquares,
        winner,
        resultLabel,
        loadout,
        gameVariant,
        message,
        actionType,
        abilityAction,
        skinIds: equippedSkinIds,
        playerColor: multiplayerRole === "guest" ? "black" : "white",
        ...override,
      },
    }));
  }

  function receiveMatchChat(payload, side = "opponent") {
    const text = String(payload.text || payload.message || "").trim();
    if (!text) {
      return;
    }
    const nextMessage = {
      id: payload.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      side,
      sender: payload.sender || (side === "local" ? profile.username : versusMatchup?.opponent?.username || "Opponent"),
      text,
      createdAt: payload.createdAt || new Date().toISOString(),
    };
    setMatchChatMessages((items) => [...items, nextMessage].slice(-40));
  }

  function receiveMatchEmote(payload, side = "opponent") {
    const emote = normalizeMatchEmote(payload.emote || payload);
    const activeId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setActiveMatchEmotes((items) => [...items, { id: activeId, side, emote }]);
    setMatchChatMessages((items) => [
      ...items,
      {
        id: payload.id ? `${payload.id}-chat` : `${activeId}-chat`,
        side,
        sender: payload.sender || (side === "local" ? profile.username : versusMatchup?.opponent?.username || "Opponent"),
        text: emote.text || emote.label,
        emote,
        messageType: "emote",
        createdAt: payload.createdAt || new Date().toISOString(),
      },
    ].slice(-40));
    window.setTimeout(() => {
      setActiveMatchEmotes((items) => items.filter((item) => item.id !== activeId));
    }, 3000);
  }

  function sendMatchChat(text) {
    const cleanText = String(text || "").trim().slice(0, 180);
    if (!cleanText || mode !== "multiplayer") {
      return;
    }
    const payload = {
      type: "chat_message",
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      from_user_id: activeUserId,
      sender: profile.username || "Commander",
      text: cleanText,
      createdAt: new Date().toISOString(),
    };
    receiveMatchChat(payload, "local");
    const socket = multiplayerSocketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    } else {
      addNotification("Chat offline", "Message saved locally, but the multiplayer socket is disconnected.", "warning");
    }
  }

  function sendMatchEmote(emote) {
    if (mode !== "multiplayer") {
      return;
    }
    const normalized = normalizeMatchEmote(emote);
    const payload = {
      type: "match_emote",
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      from_user_id: activeUserId,
      sender: profile.username || "Commander",
      emote: normalized,
      createdAt: new Date().toISOString(),
    };
    receiveMatchEmote(payload, "local");
    const socket = multiplayerSocketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    } else {
      addNotification("Emote offline", "Emote shown locally, but the multiplayer socket is disconnected.", "warning");
    }
  }

  function applyRemoteBoardState(state) {
    if (!state?.board) {
      return;
    }
    if (state.winner && state.winner !== winner) {
      playMatchEndAudio(state.winner);
    }
    if (state.skinIds) {
      setRemoteSkinIds(normalizeSkinIds(state.skinIds));
    }
    setBoard(state.board);
    setTurn(state.turn || "white");
    setMoveLog(state.moveLog || []);
    setMoveReplay(state.moveReplay || []);
    setBlockedSquares(state.blockedSquares || []);
    setProtectedSquares(state.protectedSquares || []);
    setWinner(state.winner || null);
    setResultLabel(state.resultLabel || null);
    setLoadout(state.loadout || loadout);
    setGameVariant(state.gameVariant || gameVariant);
    setMessage(state.message || "Remote move synchronized.");
    setSelected(null);
    setLegalMoves([]);
    setCaptureChain(null);
  }

  function handleMultiplayerForfeit(event = {}) {
    const forfeit = event.forfeit || event;
    const finalState = event.state || forfeit.state || {};
    const winnerColor = event.winner_color || forfeit.winner_color || finalState.winner;
    if (!winnerColor) {
      return;
    }
    if (matchForfeitHandledRef.current) {
      return;
    }
    matchForfeitHandledRef.current = true;
    const localWon = isLocalWinner(winnerColor);
    const messageText = event.message || forfeit.message || (localWon ? "Opponent left the room. You win by forfeit." : "You resigned. Opponent wins by forfeit.");
    setMultiplayerStatus(messageText);
    addNotification(localWon ? "Victory by forfeit" : "Match forfeited", messageText, localWon ? "success" : "warning");
    if (winner) {
      return;
    }
    finish(winnerColor, "by forfeit", finalState.board || board, finalState.moveReplay || moveReplay, finalState.moveLog || [...moveLog, messageText]);
  }

  function forfeitMultiplayerMatch() {
    if (mode !== "multiplayer" || winner) {
      return;
    }
    const localColor = getLocalPlayerColor(mode, multiplayerRole);
    const winnerColor = localColor === "white" ? "black" : "white";
    const messageText = "You gave up. Opponent wins by forfeit.";
    const socket = multiplayerSocketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "forfeit",
        from_user_id: activeUserId,
        reason: "forfeit",
        playerColor: localColor,
      }));
    }
    handleMultiplayerForfeit({
      reason: "forfeit",
      loser_user_id: activeUserId,
      winner_color: winnerColor,
      loser_color: localColor,
      message: messageText,
      state: {
        board,
        turn,
        moveLog: [...moveLog, messageText],
        moveReplay,
        blockedSquares,
        protectedSquares,
        winner: winnerColor,
        resultLabel: "Forfeit",
        loadout,
        gameVariant,
        skinIds: equippedSkinIds,
      },
    });
  }

  function openPostMatch(isVictory) {
    setPostMatchVictory(isVictory);
    setDemoGuideStep("report");
    setView("postmatch");
  }

  function goToNextCampaignLevel() {
    const stats = normalizeMatchReport(matchReport, DEFAULT_MATCH_REPORT);
    const levels = campaign?.levels || [];
    const clearedLevel = levels.find((level) => level.id === stats.campaignLevelId) || campaignLevel;
    const nextLevel = levels.find((level) => level.id === stats.campaignNextLevelId) || getNextCampaignLevel(clearedLevel?.id, levels) || clearedLevel;
    if (!clearedLevel) {
      setView("campaign-map");
      return;
    }
    const stars = stats.campaignStars || calculateCampaignStars(clearedLevel, stats.turns || 1, matchStartCounts.white, matchStartCounts.white);
    const nextProgress = mergeCampaignProgress(campaignProgress, clearedLevel.id, levels, stats.turns || 1, stars);
    setCampaignProgressState(nextProgress);
    if (nextLevel?.id) {
      setCampaignLevelId(nextLevel.id);
      setCampaignFocusLevelId(nextLevel.id);
    }
    setDemoGuideStep(nextLevel?.id && nextLevel.id !== clearedLevel.id ? "campaign" : "vault");
    setEconomyMessage(nextLevel?.id && nextLevel.id !== clearedLevel.id ? `${clearedLevel.name} cleared. ${nextLevel.name} is now selected on the campaign map.` : `${clearedLevel.name} cleared. Campaign map updated.`);
    if (!isLocalSession) {
      saveCampaignProgress(activeUserId, campaignLevel?.factionId || campaignFactionId, nextProgress)
        .catch((error) => showError("Campaign save failed", error, "Campaign progress changed locally, but was not saved."));
    }
    setView("campaign-map");
  }

  function isLocalWinner(nextWinner) {
    const playerColor = mode === "multiplayer" && multiplayerRole === "guest" ? "black" : "white";
    return nextWinner === playerColor || nextWinner === "campaign";
  }

  function playMatchEndAudio(nextWinner) {
    if (!nextWinner) {
      return;
    }
    const won = isLocalWinner(nextWinner);
    playSound(won ? "victory" : "defeat");
    speakLine(won ? "Tactical victory." : "Tactical defeat.");
  }

  function addNotification(title, body, tone = "info", withSound = true) {
    if (withSound) {
      playSound(tone === "warning" ? "defeat" : tone === "success" ? "invite" : "click");
    }
    setNotifications((items) => [
      { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, title, body, tone },
      ...items,
    ].slice(0, 8));
  }

  function getReadableError(error, fallback = "Something went wrong.") {
    if (!error) {
      return fallback;
    }
    const message = error.message || (typeof error === "string" ? error : fallback);
    if (error.status === 401) {
      return `${message} Please login again.`;
    }
    if (error.status === 403) {
      return `${message} Access denied for this commander.`;
    }
    return message || fallback;
  }

  function setScreenMessage(title, body = "") {
    const text = body ? `${title}: ${body}` : title;
    setEconomyMessage(text);
    return text;
  }

  function showError(title, error, fallback) {
    const body = getReadableError(error, fallback);
    setScreenMessage(title, body);
    addNotification(title, body, "warning");
    return body;
  }

  function handleProInterest(source = "pro_modal", selectedOffer = "aether_pro") {
    const entry = {
      user_id: isAuthenticated ? activeUserId : null,
      source,
      selected_offer: selectedOffer,
      created_at: new Date().toISOString(),
    };
    const localQueue = loadJson("dama-pro-interest", []);
    saveJson("dama-pro-interest", [...localQueue, entry].slice(-25));
    setProInterestBusy(true);
    setProInterestMessage("Saving your early access request...");
    const request = isAuthenticated && !isLocalSession
      ? requestProInterest({ userId: activeUserId, source, selectedOffer })
      : Promise.resolve({ ok: true, stored: false });
    request
      .then((payload) => {
        const body = payload.stored ? "Your Aether Pro interest was saved to Supabase." : "Your Aether Pro interest was saved locally for the demo.";
        setProInterestMessage(body);
        addNotification("Pro waitlist joined", body, "success");
      })
      .catch((error) => {
        const body = showError("Pro waitlist sync failed", error, "Saved locally, but the backend did not record it.");
        setProInterestMessage(body);
      })
      .finally(() => setProInterestBusy(false));
  }

  function factionUnlockMessage(faction) {
    if (!faction) {
      return "Choose an unlocked faction first.";
    }
    const requirement = faction.unlock_requirement || {};
    if (faction.id === "void_order" || requirement.type === "vault" || String(faction.unlock || "").toLowerCase().includes("vault")) {
      return `${faction.name} is an Aether Pro faction. Upgrade to preview the Void Order archive, Phase Shift loadouts, and premium campaign path.`;
    }
    const level = requirement.level || faction.required_level_to_unlock || 2;
    return `${faction.name} unlocks at Level ${level}.`;
  }

  function handleLockedFaction(faction) {
    const text = factionUnlockMessage(faction);
    setScreenMessage("Faction locked", text);
    addNotification("Faction locked", text, "warning");
    if (faction?.id === "void_order" || String(faction?.unlock || "").toLowerCase().includes("vault") || faction?.unlock_requirement?.type === "vault") {
      setProModalOpen(true);
    }
  }

  function openPublicProfile(target) {
    const fallback = normalizePublicProfile(target);
    setPublicProfile(fallback);
    if (target?.user_id && !String(target.user_id).startsWith("demo-")) {
      getPublicProfile(target.user_id)
        .then((payload) => setPublicProfile(normalizePublicProfile(payload.profile || fallback)))
        .catch((error) => showError("Public profile unavailable", error, "Unable to load this commander profile."));
    }
  }

  function searchCommanders(query) {
    const term = query.trim();
    if (!isAuthenticated) {
      setPlayerSearchResults([]);
      setScreenMessage("Friends locked", "Login to search commanders and add friends.");
      return;
    }
    if (term.length < 2) {
      setPlayerSearchResults([]);
      return;
    }
    searchPlayers(term)
      .then((payload) => setPlayerSearchResults((payload.players || [])
        .map(normalizePublicProfile)
        .filter((player) => player.user_id !== activeUserId)))
      .catch((error) => {
        setPlayerSearchResults([]);
        setScreenMessage("Player search", getReadableError(error, "Backend search unavailable."));
      });
  }

  function requestFriend(target) {
    const profileTarget = normalizePublicProfile(target);
    if (!isAuthenticated) {
      addNotification("Login required", "Create a commander or log in to add friends.", "warning");
      return;
    }
    if (profileTarget.user_id === activeUserId) {
      addNotification("Friend request blocked", "You cannot add yourself.", "warning");
      return;
    }
    if (!profileTarget.user_id || String(profileTarget.user_id).startsWith("demo-")) {
      addNotification("Friend request blocked", "Demo commanders cannot be added as real friends.", "warning");
      return;
    }
    sendFriendRequest(activeUserId, profileTarget.user_id)
      .then(() => {
        addNotification("Friend request sent", `${profileTarget.username} will see your request in Nexus Feed.`, "success");
        return getFriends(activeUserId);
      })
      .then((payload) => setFriendsData(normalizeFriendsData(payload)))
      .catch((error) => showError("Friend request failed", error, "Unable to send request."));
  }

  function respondToFriendRequest(request, action) {
    if (!isAuthenticated) {
      addNotification("Login required", "Login to manage friend requests.", "warning");
      return;
    }
    respondFriendRequest(activeUserId, request.request_id, action)
      .then(() => getFriends(activeUserId))
      .then((payload) => setFriendsData(normalizeFriendsData(payload)))
      .catch((error) => {
        showError("Friend request update failed", error, "Using local fallback for this request.");
        setFriendsData((current) => normalizeFriendsData({
          ...current,
          incoming: current.incoming.filter((item) => item.request_id !== request.request_id),
          friends: action === "accept" ? [...current.friends, request.profile] : current.friends,
        }));
      });
  }

  function handleChallengeEvent(event) {
    if (!event?.type) {
      return;
    }
    if (event.type === "challenge_connected") {
      setChallengeStatus("Duel channel online.");
      return;
    }
    const challenge = normalizeChallenge(event.challenge || event);
    if (event.type === "challenge_received") {
      setIncomingChallenge(challenge);
      setChallengeStatus(`${challenge.from_profile.username} has challenged you to a duel.`);
      addNotification("Duel challenge", `${challenge.from_profile.username} has challenged you to a duel!`, "info");
      playSound("invite");
      speakLine("Duel challenge received.");
      return;
    }
    if (event.type === "challenge_waiting") {
      setOutgoingChallenge(challenge);
      setChallengeStatus(`Waiting for ${challenge.target_profile.username} to respond...`);
      return;
    }
    if (event.type === "challenge_unavailable") {
      setOutgoingChallenge(null);
      setChallengeStatus("");
      addNotification("Challenge unavailable", event.reason || "Commander is not available for a duel.", "warning");
      return;
    }
    if (event.type === "challenge_declined") {
      setOutgoingChallenge(null);
      setChallengeStatus("");
      addNotification("Challenge declined", `${challenge.target_profile.username} declined the duel.`, "warning");
      return;
    }
    if (event.type === "challenge_cleared") {
      setIncomingChallenge((current) => current?.challenge_id === challenge.challenge_id ? null : current);
      setOutgoingChallenge((current) => current?.challenge_id === challenge.challenge_id ? null : current);
      setChallengeStatus(event.reason || "");
      return;
    }
    if (event.type === "challenge_start") {
      enterChallengeLobby(event);
    }
  }

  function sendChallengePayload(payload) {
    const socket = challengeSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      addNotification("Duel channel offline", "Realtime duel challenges are unavailable. Start the backend and try again.", "warning");
      return false;
    }
    socket.send(JSON.stringify(payload));
    return true;
  }

  function sendChallengeToFriend(friend) {
    if (!isAuthenticated) {
      addNotification("Login required", "Login to challenge friends to direct duels.", "warning");
      return Promise.resolve("");
    }
    const target = normalizePublicProfile(friend);
    if (!target.user_id || String(target.user_id).startsWith("demo-")) {
      addNotification("Challenge blocked", "Demo commanders cannot receive realtime duel challenges.", "warning");
      return Promise.resolve("");
    }
    if (target.user_id === activeUserId) {
      addNotification("Challenge blocked", "You cannot challenge yourself.", "warning");
      return Promise.resolve("");
    }
    const challenge = normalizeChallenge({
      from_user_id: activeUserId,
      target_user_id: target.user_id,
      from_profile: normalizePublicProfile({ ...profile, user_id: activeUserId }),
      target_profile: target,
      loadout,
      skinIds: equippedSkinIds,
    });
    setOutgoingChallenge(challenge);
    setChallengeStatus(`Waiting for ${target.username} to respond...`);
    const sent = sendChallengePayload({
      type: "challenge_send",
      target_user_id: target.user_id,
      target_profile: target,
      from_profile: normalizePublicProfile({ ...profile, user_id: activeUserId }),
      loadout,
      skinIds: equippedSkinIds,
    });
    if (sent) {
      playSound("invite");
      addNotification("Duel challenge sent", `Waiting for ${target.username} to respond.`, "success");
    } else {
      setOutgoingChallenge(null);
      setChallengeStatus("");
    }
    return Promise.resolve("");
  }

  function declineChallenge(challenge = incomingChallenge || outgoingChallenge) {
    if (!challenge?.challenge_id) {
      setIncomingChallenge(null);
      setOutgoingChallenge(null);
      setChallengeStatus("");
      return;
    }
    sendChallengePayload({ type: "challenge_decline", challenge_id: challenge.challenge_id });
    setIncomingChallenge((current) => current?.challenge_id === challenge.challenge_id ? null : current);
    setOutgoingChallenge((current) => current?.challenge_id === challenge.challenge_id ? null : current);
    setChallengeStatus("");
  }

  function acceptChallenge(challenge = incomingChallenge) {
    if (!challenge?.challenge_id) {
      return;
    }
    const accepted = sendChallengePayload({
      type: "challenge_accept",
      challenge_id: challenge.challenge_id,
      target_profile: normalizePublicProfile({ ...profile, user_id: activeUserId }),
      loadout,
      skinIds: equippedSkinIds,
    });
    if (accepted) {
      setChallengeStatus("Challenge accepted. Preparing shared lobby...");
      setIncomingChallenge(null);
      playSound("joined");
    }
  }

  function enterChallengeLobby(event) {
    const roomCode = sanitizeLobbyCode(event.room_code || event.room?.room_code || "");
    if (!roomCode) {
      addNotification("Challenge room error", "The server did not provide a lobby code.", "warning");
      return;
    }
    const challenge = normalizeChallenge(event.challenge || {});
    const role = event.role === "guest" ? "guest" : "host";
    const hostProfile = normalizePublicProfile({ ...challenge.from_profile, user_id: challenge.from_user_id });
    const guestProfile = normalizePublicProfile({ ...challenge.target_profile, user_id: challenge.target_user_id });
    const hostSkinIds = normalizeSkinIds(event.room?.player_skin_ids?.[challenge.from_user_id] || challenge.skinIds);
    const guestSkinIds = normalizeSkinIds(event.room?.player_skin_ids?.[challenge.target_user_id] || (role === "guest" ? equippedSkinIds : {}));
    const localPlayer = createLobbyPlayer(profile, activeUserId, loadout, factions, equippedSkinIds);
    const hostPlayer = role === "host"
      ? localPlayer
      : createLobbyPlayer(hostProfile, challenge.from_user_id, challenge.loadout, factions, hostSkinIds);
    const guestPlayer = role === "guest"
      ? localPlayer
      : createLobbyPlayer(guestProfile, challenge.target_user_id, DEFAULT_LOADOUT, factions, guestSkinIds);
    const nextState = {
      code: roomCode,
      status: "configuring",
      host: { ...hostPlayer, ready: false },
      guest: { ...guestPlayer, ready: false },
      createdAt: event.room?.created_at || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      challengeId: challenge.challenge_id,
    };
    routeLobbyCodeRef.current = roomCode;
    lobbyStartedRef.current = false;
    setLobbyCode(roomCode);
    setLobbyRole(role);
    setLobbyState(nextState);
    setLoadout((role === "host" ? hostPlayer : guestPlayer).loadout || loadout);
    setIncomingChallenge(null);
    setOutgoingChallenge(null);
    setChallengeStatus("");
    setLobbyMessage("Challenge accepted. Configure loadouts and press Ready.");
    publishLobbyState(nextState);
    addNotification("Duel accepted", `Shared lobby ${roomCode} is ready.`, "success");
    setView("lobby", { lobbyCode: roomCode });
  }

  function renderChallengeOverlay() {
    if (!isAuthenticated || isLocalSession) {
      return null;
    }
    return (
      <>
        {incomingChallenge && (
          <DuelChallengeModal
            challenge={incomingChallenge}
            onAccept={() => acceptChallenge(incomingChallenge)}
            onDecline={() => declineChallenge(incomingChallenge)}
          />
        )}
        {outgoingChallenge && (
          <DuelWaitingToast
            challenge={outgoingChallenge}
            status={challengeStatus}
            onCancel={() => declineChallenge(outgoingChallenge)}
          />
        )}
      </>
    );
  }

  function activateAdminCommander(sessionUserId = activeUserId, nextView = "admin-dashboard") {
    const adminProfile = createAdminProfile(profile, factions);
    const adminUserId = sessionUserId || getAdminUserId();
    const adminInventory = DEFAULT_VAULT_ITEMS.map((item) => normalizeInventoryItem({
      inventory_item_id: `admin-${item.cosmetic_id}`,
      user_id: adminUserId,
      cosmetic_id: item.cosmetic_id,
      is_equipped: item.cosmetic_id === "pieces_cosmos",
      purchased_at: new Date().toISOString(),
      cosmetics: item,
    }));
    const session = {
      access_token: "",
      refresh_token: "",
      user: {
        id: adminUserId,
        email: ADMIN_PROFILE_PATCH.email,
        user_metadata: { username: ADMIN_PROFILE_PATCH.username, role: "admin" },
      },
      offline: true,
      admin: true,
    };
    setAuthSession(session);
    setDemoMode(true);
    setProfile(adminProfile);
    setInventoryItems(adminInventory);
    setVaultItems(DEFAULT_VAULT_ITEMS);
    setBattlePass(createCompletedBattlePassState());
    setOnboardingOpen(false);
    setLoadout({
      factionId: adminProfile.saved_loadouts?.[0]?.faction_id || "nomads",
      passiveId: adminProfile.saved_loadouts?.[0]?.passive_id || "open_roads",
      ultimateId: adminProfile.saved_loadouts?.[0]?.ultimate_id || "dash",
    });
    persistAuthSession(session);
    saveJson("dama-profile", adminProfile);
    saveJson("dama-inventory", adminInventory);
    saveJson("dama-vault-items", DEFAULT_VAULT_ITEMS);
    saveJson(battlePassStorageKey(adminUserId), createCompletedBattlePassState());
    addNotification("Admin mode enabled", "All factions, abilities, currencies, and progression rewards unlocked.", "success");
    setView(nextView);
  }

  async function handleGatewayAuth({ mode: authMode, username, email, password }) {
    if (authBusy) {
      return;
    }
    setAuthError("");
    if (authMode === "admin") {
      activateAdminCommander(getAdminUserId(), "admin-dashboard");
      return;
    }
    const safeUsername = normalizeUsername(username || profile.username || "VALKYRIE_01");
    setAuthBusy(true);
    try {
      const session = authMode === "login"
        ? await signInCommander({ email, password })
        : await signUpCommander({ username: safeUsername, email, password });
      if (!hasPlayableSession(session)) {
        if (session) {
          signOutCommander(session).catch(() => undefined);
        }
        setAuthSession(null);
        const confirmationMessage = "Account created, but no active session was returned. Confirm the email or disable email confirmation in Supabase for local testing.";
        setAuthError(confirmationMessage);
        setScreenMessage("Email confirmation required", confirmationMessage);
        addNotification("Email confirmation required", confirmationMessage, "warning");
        return;
      }
      const starterProfile = createStarterProfile(safeUsername, session.user?.email || email, profile);
      let hydratedProfile = starterProfile;
      let profileSyncWarning = "";
      if (authMode === "login") {
        try {
          const payload = await getProfile(session.user.id);
          hydratedProfile = profileFromApiPayload(payload, starterProfile);
        } catch (error) {
          const missing = error.status === 404 || /not found/i.test(error.message || "");
          if (missing) {
            try {
              const created = await createProfile(toProfileUpsert(session.user.id, starterProfile));
              hydratedProfile = profileFromApiPayload(created, starterProfile);
            } catch (createError) {
              profileSyncWarning = getReadableError(createError, "Supabase Auth succeeded, but the player profile could not be created yet.");
            }
          } else {
            profileSyncWarning = getReadableError(error, "Supabase Auth succeeded, but the player profile could not be loaded yet.");
          }
        }
      } else {
        try {
          const created = await createProfile(toProfileUpsert(session.user.id, starterProfile));
          hydratedProfile = profileFromApiPayload(created, starterProfile);
        } catch (error) {
          profileSyncWarning = getReadableError(error, "Supabase Auth succeeded, but the player profile could not be created yet.");
        }
      }
      setProfile(hydratedProfile);
      setAuthSession(session);
      setInventoryItems([]);
      setMatchHistory([]);
      setCampaignProgressState(DEFAULT_CAMPAIGN_PROGRESS);
      setGameVariant("power");
      setOnboardingOpen(!normalizeSettings(hydratedProfile.settings).onboardingCompleted);
      addNotification(authMode === "login" ? "Session restored" : "Commander created", `${safeUsername} connected to Nexus Core.`, "success");
      if (profileSyncWarning) {
        setScreenMessage("Profile sync warning", profileSyncWarning);
        addNotification("Profile sync warning", profileSyncWarning, "warning");
      }
      setView("nexus");
    } catch (error) {
      const readable = showError(authMode === "login" ? "Login failed" : "Registration failed", error, "Authentication failed.");
      setAuthError(readable);
    } finally {
      setAuthBusy(false);
    }
  }

  function handleLogout() {
    signOutCommander(authSession).catch(() => undefined);
    setAuthSession(null);
    setProfile(createGuestProfile());
    setInventoryItems([]);
    setMatchHistory([]);
    setCampaignProgressState(DEFAULT_CAMPAIGN_PROGRESS);
    setBattlePass(createBattlePassState());
    setFriendsData(normalizeFriendsData({ friends: [], incoming: [], outgoing: [] }));
    setGameVariant("classic");
    setPendingMatchSetup(null);
    setOnboardingOpen(false);
    setView("nexus");
    addNotification("Signed out", "Local session cleared.", "info");
  }

  function saveProfilePatch(patch) {
    if (!isAuthenticated) {
      requireAuth("Profile settings");
      return;
    }
    const nextProfile = normalizeProfile({ ...profile, ...patch, name: patch.username || patch.name || profile.name });
    setProfile(nextProfile);
    setProfileBusy(true);
    setEconomyMessage("Saving profile...");
    if (isLocalSession) {
      setEconomyMessage("Profile saved locally for demo/admin mode.");
      setProfileBusy(false);
      return;
    }
    const requests = [saveProfile(activeUserId, {
      username: nextProfile.username,
      profile_picture_url: nextProfile.profile_picture_url || null,
      bio: nextProfile.bio,
      city: nextProfile.city,
      current_exp: nextProfile.current_exp,
      level: nextProfile.level,
      essence: nextProfile.essence,
      shards: nextProfile.shards,
      is_admin: nextProfile.is_admin,
      is_pro: nextProfile.is_pro,
      unlocked_factions: nextProfile.unlocked_factions,
      unlocked_abilities: nextProfile.unlocked_abilities,
      earned_badges: nextProfile.earned_badges,
      settings: nextProfile.settings,
      achievements_claimed: nextProfile.achievements_claimed,
      equipped_piece_skin: nextProfile.equipped_piece_skin || null,
      equipped_board_skin: nextProfile.equipped_board_skin || null,
      equipped_badge: nextProfile.equipped_badge || null,
    })];
    if ("profile_picture_url" in patch) {
      requests.push(saveProfileAvatar(activeUserId, patch.profile_picture_url || null));
    }
    Promise.all(requests)
      .then(() => setEconomyMessage("Profile synced to Supabase."))
      .catch((error) => showError("Profile save failed", error, "Profile changed locally, but Supabase did not save it."))
      .finally(() => setProfileBusy(false));
  }

  function purchaseCosmetic(item) {
    if (!isAuthenticated) {
      requireAuth("Vault purchases");
      return;
    }
    const normalized = normalizeVaultItem(item);
    if (inventoryItems.some((inventoryItem) => inventoryItem.cosmetic_id === normalized.cosmetic_id)) {
      if (normalized.cosmetic_id === "void_order_campaign_pass" && !profile.unlocked_factions?.includes("void_order")) {
        const nextProfile = normalizeProfile({ ...profile, unlocked_factions: [...new Set([...(profile.unlocked_factions || []), "void_order"])] });
        setProfile(nextProfile);
        saveProfilePatch(nextProfile);
        setEconomyMessage("Void Order restored from owned Campaign Pass.");
        return;
      }
      setScreenMessage("Vault", "Already owned.");
      addNotification("Already owned", `${normalized.name} is already in your Inventory.`, "info");
      return;
    }
    if (normalized.target_faction_id && !profile.unlocked_factions.includes(normalized.target_faction_id)) {
      const faction = factions.find((item) => item.id === normalized.target_faction_id);
      const text = faction ? factionUnlockMessage(faction) : "Faction locked. Level up to unlock this item.";
      setScreenMessage("Vault locked", text);
      addNotification("Vault locked", text, "warning");
      return;
    }
    if (normalized.is_premium && !hasAetherPro(profile)) {
      const text = `${normalized.name} is an Aether Pro identity item. Request early access to unlock premium skins, Void Order, and Pro rewards.`;
      setScreenMessage("Aether Pro", text);
      addNotification("Aether Pro preview", text, "info");
      setProModalOpen(true);
      return;
    }
    if (profile.shards < normalized.price_shards) {
      setScreenMessage("Not enough Shards", `${normalized.name} costs ${normalized.price_shards} Shards.`);
      addNotification("Not enough Shards", `${normalized.name} costs ${normalized.price_shards} Shards.`, "warning");
      return;
    }
    const previousProfile = profile;
    const previousInventory = inventoryItems;
    setVaultBusyId(normalized.cosmetic_id);
    const inventoryItem = {
      inventory_item_id: crypto.randomUUID ? crypto.randomUUID() : `${normalized.cosmetic_id}-${Date.now()}`,
      user_id: activeUserId,
      cosmetic_id: normalized.cosmetic_id,
      is_equipped: false,
      purchased_at: new Date().toISOString(),
      cosmetics: normalized,
    };
    setProfile((current) => normalizeProfile({
      ...current,
      shards: Math.max(0, current.shards - normalized.price_shards),
      unlocked_factions: normalized.cosmetic_id === "void_order_campaign_pass" ? [...new Set([...(current.unlocked_factions || []), "void_order"])] : current.unlocked_factions,
      owned_cosmetics: [...new Set([...(current.owned_cosmetics || []), normalized.cosmetic_id])],
    }));
    setInventoryItems((items) => [...items, inventoryItem]);
    setEconomyMessage(`${normalized.name} purchased.`);
    addNotification("Vault purchase", `${normalized.name} added to Inventory.`, "success");
    if (isLocalSession) {
      setVaultBusyId("");
      return;
    }
    purchaseVaultItem(activeUserId, normalized.cosmetic_id)
      .then((payload) => {
        if (payload.profile) {
          setProfile((current) => normalizeProfile({
            ...current,
            ...payload.profile,
            unlocked_factions: normalized.cosmetic_id === "void_order_campaign_pass" ? [...new Set([...(payload.profile.unlocked_factions || current.unlocked_factions || []), "void_order"])] : payload.profile.unlocked_factions || current.unlocked_factions,
          }));
        }
        if (payload.inventory_item) {
          setInventoryItems((items) => [
            ...items.filter((item) => item.cosmetic_id !== normalized.cosmetic_id),
            normalizeInventoryItem({ ...payload.inventory_item, cosmetics: normalized }),
          ]);
        }
      })
      .catch((error) => {
        setProfile(previousProfile);
        setInventoryItems(previousInventory);
        showError("Vault purchase failed", error, "Purchase could not be completed.");
      })
      .finally(() => setVaultBusyId(""));
  }

  function equipCosmetic(inventoryItemId) {
    if (!isAuthenticated) {
      requireAuth("Inventory");
      return;
    }
    const target = inventoryItems.find((item) => item.inventory_item_id === inventoryItemId);
    const cosmetic = target?.cosmetics || target;
    if (!target || !cosmetic) {
      return;
    }
    const previousInventory = inventoryItems;
    const previousProfile = profile;
    const skinPatch = profileSkinPatchForCosmetic(cosmetic);
    setInventoryBusyId(inventoryItemId);
    setInventoryItems((items) =>
      items.map((item) => {
        const itemCosmetic = item.cosmetics || item;
        const sameSlot = itemCosmetic.kind === cosmetic.kind;
        return sameSlot ? { ...item, is_equipped: item.inventory_item_id === inventoryItemId, equipped_at: item.inventory_item_id === inventoryItemId ? new Date().toISOString() : null } : item;
      }),
    );
    if (Object.keys(skinPatch).length) {
      setProfile((current) => normalizeProfile({ ...current, ...skinPatch }));
    }
    setEconomyMessage(`${cosmetic.name} equipped.`);
    if (isLocalSession) {
      setInventoryBusyId("");
      return;
    }
    equipInventoryItem(activeUserId, inventoryItemId)
      .then((payload) => {
        if (payload?.profile_skin_patch) {
          setProfile((current) => normalizeProfile({ ...current, ...payload.profile_skin_patch }));
        }
      })
      .catch((error) => {
        setInventoryItems(previousInventory);
        setProfile(previousProfile);
        showError("Inventory equip failed", error, "Item could not be equipped.");
      })
      .finally(() => setInventoryBusyId(""));
  }

  function equipBasicPieceSkin() {
    if (!isAuthenticated) {
      requireAuth("Inventory");
      return;
    }
    const previousInventory = inventoryItems;
    const previousProfile = profile;
    setInventoryBusyId("basic-piece-skin");
    setInventoryItems((items) => items.map((item) => {
      const cosmetic = item.cosmetics || item;
      return cosmetic.kind === "piece_skin" ? { ...item, is_equipped: false, equipped_at: null } : item;
    }));
    setProfile((current) => normalizeProfile({ ...current, equipped_piece_skin: "" }));
    setEconomyMessage("Basic recolorable disks equipped.");
    if (isLocalSession) {
      setInventoryBusyId("");
      return;
    }
    saveProfile(activeUserId, { equipped_piece_skin: null })
      .catch((error) => {
        setInventoryItems(previousInventory);
        setProfile(previousProfile);
        showError("Inventory equip failed", error, "Basic disks could not be equipped.");
      })
      .finally(() => setInventoryBusyId(""));
  }

  function claimAchievement(achievement) {
    if (!isAuthenticated) {
      requireAuth("Achievements");
      return;
    }
    if (!achievement || achievement.claimed || achievement.progress < achievement.target) {
      return;
    }
    const reward = achievement.reward || {};
    const rewardCosmetics = rewardCosmeticIds(reward);
    const claimed = [...new Set([...(profile.achievements_claimed || []), achievement.id])];
    const ownedCosmetics = [...new Set([...(profile.owned_cosmetics || []), ...rewardCosmetics])];
    const rewardedProfile = applyProgression({
      ...profile,
      achievements_claimed: claimed,
      owned_cosmetics: ownedCosmetics,
    }, {
      exp: Number(reward.exp || 0),
      shards: Number(reward.shards || 0),
      essence: Number(reward.essence || 0),
    }, factions);
    const previousProfile = profile;
    const previousInventory = inventoryItems;
    const existingCosmetics = new Set(inventoryItems.map((item) => item.cosmetic_id));
    const optimisticInventory = rewardCosmetics
      .filter((cosmeticId) => !existingCosmetics.has(cosmeticId))
      .map((cosmeticId) => createAchievementInventoryItem(cosmeticId, activeUserId, vaultItems));
    setAchievementBusyId(achievement.id);
    setProfile(rewardedProfile);
    if (optimisticInventory.length) {
      setInventoryItems((items) => [...items, ...optimisticInventory]);
    }
    addNotification("Achievement claimed", `${achievement.title}: ${formatReward(reward)} added.`, "success");
    const requests = [saveProfile(activeUserId, {
      achievements_claimed: rewardedProfile.achievements_claimed,
      current_exp: rewardedProfile.current_exp,
      level: rewardedProfile.level,
      essence: rewardedProfile.essence,
      shards: rewardedProfile.shards,
      unlocked_factions: rewardedProfile.unlocked_factions,
      owned_cosmetics: rewardedProfile.owned_cosmetics,
    })];
    rewardCosmetics.forEach((cosmeticId) => {
      requests.push(grantInventoryItem(activeUserId, cosmeticId, `achievement:${achievement.id}`));
    });
    Promise.all(requests)
      .then((responses) => {
        const grantedItems = responses.slice(1).map((response) => response?.inventory_item).filter(Boolean);
        if (grantedItems.length) {
          setInventoryItems((items) => {
            const grantedIds = new Set(grantedItems.map((item) => item.cosmetic_id));
            return [
              ...items.filter((item) => !grantedIds.has(item.cosmetic_id)),
              ...grantedItems.map(normalizeInventoryItem),
            ];
          });
        }
      })
      .catch((error) => {
        setProfile(previousProfile);
        setInventoryItems(previousInventory);
        showError("Achievement claim failed", error, "Reward could not be claimed.");
      })
      .finally(() => setAchievementBusyId(""));
  }

  function validateCampaignTutorialMove(move, actor) {
    if (!isGuidedCampaignTutorialActive(campaignTutorial)) {
      return true;
    }
    const step = getCampaignTutorialStep(campaignTutorial);
    if (!step) {
      return true;
    }
    const actorType = actor === "AI" ? "ai" : "player";
    if (step.actor !== actorType || !tutorialMoveMatches(step, move)) {
      rejectCampaignTutorialMove(step, actorType === "ai" ? "The scripted AI needs its exact setup move." : "That move breaks the tutorial sequence.");
      return false;
    }
    return true;
  }

  function rejectCampaignTutorialMove(step, reason = "") {
    if (campaignTutorial?.snapshot) {
      setBoard(cloneBoard(campaignTutorial.snapshot));
    }
    setSelected(null);
    setLegalMoves([]);
    setPowerMode(null);
    setPowerSelection([]);
    const exactInstruction = campaignTutorialInstruction(campaignTutorial, step);
    const text = `${reason ? `${reason} ` : ""}${exactInstruction ? `${exactInstruction} ` : ""}${step.prompt}`;
    setMessage(`Tutorial path: ${text}`);
    setReview((items) => [...items, `Correction: ${exactInstruction || step.label}. ${step.prompt}`].slice(-6));
  }

  function advanceCampaignTutorialAfterMove(nextBoard) {
    if (!isGuidedCampaignTutorialActive(campaignTutorial)) {
      return null;
    }
    const nextIndex = campaignTutorial.stepIndex + 1;
    const nextStep = campaignTutorial.requiredMoves[nextIndex];
    if (!nextStep) {
      const nextTutorial = {
        ...campaignTutorial,
        phase: "freeplay",
        stepIndex: nextIndex,
        snapshot: cloneBoard(nextBoard),
      };
      setCampaignTutorial(nextTutorial);
      setMomentum((value) => Math.max(value, 2));
      setUltimateUsed(false);
      setReview((items) => [...items, campaignTutorial.rechargeReview || "Guided lesson complete: ultimate recharged for the live bot phase."].slice(-6));
      return { phase: "freeplay", message: campaignTutorial.freePlayPrompt };
    }
    const nextTutorial = {
      ...campaignTutorial,
      stepIndex: nextIndex,
      snapshot: cloneBoard(nextBoard),
    };
    setCampaignTutorial(nextTutorial);
    setReview((items) => [...items, `Tutorial step ${nextIndex + 1}: ${nextStep.label}`].slice(-6));
    return { phase: "guided", message: nextStep.prompt };
  }

  function completeGuidedCampaignLevel(finalMoveLog, finalBoard) {
    const turns = Math.max(1, Math.floor(finalMoveLog.length / 2) + 1);
    const stars = calculateCampaignStars(campaignLevel, turns, countPieces(finalBoard).white, matchStartCounts.white);
    const nextProgress = mergeCampaignProgress(campaignProgress, campaignLevel.id, campaign?.levels || [], turns, stars);
    setCampaignProgressState(nextProgress);
    setCampaignTutorial((current) => current ? { ...current, phase: "complete" } : current);
    setResultLabel("Level clear");
    setMessage(campaignLevel.clearMessage || `${campaignLevel.name} complete. Live bot phase cleared.`);
    addNotification("Campaign sector cleared", `${campaignLevel.name}: ${stars} star${stars === 1 ? "" : "s"} earned after the live phase.`, "success", false);
    if (!isLocalSession) {
      saveCampaignProgress(activeUserId, campaignLevel?.factionId || campaignFactionId, nextProgress)
        .catch((error) => showError("Campaign save failed", error, "Campaign progress changed locally, but was not saved."));
    }
  }

  function handleSquare(row, col) {
    playSound("click");
    if (winner) {
      setMessage(`${resultText}. Start a new match.`);
      return;
    }

    if (mode === "multiplayer") {
      const allowedPlayer = multiplayerRole === "host" ? "white" : "black";
      if (turn !== allowedPlayer) {
        setMessage(`${multiplayerStatus}. Waiting for ${turn === "white" ? "Azure" : "Amber"} commander.`);
        return;
      }
    }

    if (powerMode) {
      handlePower(row, col);
      return;
    }

    const tutorialStep = getCampaignTutorialStep(campaignTutorial);
    if (isGuidedCampaignTutorialActive(campaignTutorial) && tutorialStep?.actor === "player" && turn === "white") {
      if (isPowerTutorialStep(tutorialStep)) {
        rejectCampaignTutorialMove(tutorialStep, `This lesson requires the ${abilityLabel(tutorialStep.powerId)} button first.`);
        return;
      }
      const clickedSquare = squareName({ row, col });
      const expectedSquare = selected ? tutorialStep.to : tutorialStep.from;
      if (clickedSquare !== expectedSquare) {
        rejectCampaignTutorialMove(tutorialStep, selected ? `Land on ${tutorialStep.to} for this step.` : `Select ${tutorialStep.from} for this step.`);
        return;
      }
    }

    if (["ai", "campaign", "puzzle"].includes(mode) && turn === "black") {
      setMessage(`${AI_LABELS[aiLevel]} AI is thinking.`);
      return;
    }

    const chosen = legalMoves.find((move) => move.to.row === row && move.to.col === col);
    if (chosen) {
      commitMove(chosen, "Player");
      return;
    }

    const piece = board[row][col];
    if (!piece || piece.player !== turn) {
      setSelected(null);
      setLegalMoves([]);
      setMessage(`${turn === "white" ? "Azure" : "Amber"} to move.`);
      return;
    }

    if (captureChain && !isSameSquare(captureChain, { row, col })) {
      setSelected(captureChain);
      setLegalMoves(getLegalMoves(board, turn, { ...getMoveOptions(turn), forcedFrom: captureChain }));
      setMessage("Mandatory multi-capture: continue with the same piece.");
      return;
    }

    const allMoves = getLegalMoves(board, turn, getMoveOptions(turn));
    const moves = allMoves.filter((move) => move.from.row === row && move.from.col === col);
    setSelected({ row, col });
    setLegalMoves(moves);
    setMessage(moves.length ? `${moves.length} legal option${moves.length === 1 ? "" : "s"}.` : "That piece has no legal move.");
  }

  function commitMove(move, actor) {
    if (!validateCampaignTutorialMove(move, actor)) {
      return;
    }
    const localPlayerColor = getLocalPlayerColor(mode, multiplayerRole);
    const localMove = mode === "multiplayer" ? turn === localPlayerColor : turn === "white";
    const enemyMove = mode === "multiplayer" ? turn !== localPlayerColor : turn === "black";
    playSound(move.captured ? "capture" : move.powerId ? "ultimate" : "move");
    const legalOptionsBefore = getLegalMoves(board, turn, getMoveOptions(turn));
    const result = applyMove(board, move);
    const nextTurn = turn === "white" ? "black" : "white";
    const unsafeReplyCaptures = getLegalMoves(result.board, nextTurn, getMoveOptions(nextTurn)).filter((candidate) => candidate.captured).length;
    const notation = `${actor}: ${squareName(move.from)}${move.captured ? "x" : "-"}${squareName(move.to)}${move.powerId && move.powerId !== "sun_lance" ? ` ${ultimate?.name}` : ""}${move.powerId === "sun_lance" ? " Sun Lance" : ""}${move.passiveId ? " Open Roads" : ""}`;
    const replayEntry = {
      actor,
      player: turn,
      from: squareName(move.from),
      to: squareName(move.to),
      captured: move.captured ? squareName(move.captured) : null,
      powerId: move.powerId || null,
      passiveId: move.passiveId || null,
      pieceWasKing: Boolean(board[move.from.row]?.[move.from.col]?.king),
      captureOptions: legalOptionsBefore.filter((candidate) => candidate.captured).length,
      legalMoveCount: legalOptionsBefore.length,
      unsafeReplyCaptures,
      promoted: result.promoted,
      chainOptions: 0,
      turnIndex: moveReplay.length + 1,
      beforeBoard: cloneBoard(board),
      afterBoard: cloneBoard(result.board),
    };
    const nextMoveLog = [notation, ...moveLog].slice(0, 20);
    const nextReplay = [...moveReplay, replayEntry];
    const nextReview = [...review];
    const nextAbilityFlags = { ...abilityFlags };
    let nextProtectedSquares = refreshProtectedSquaresAfterMove(protectedSquares, move, result);
    let nextMarkedPiece = markedPiece;
    let campaignCompleted = false;

    if (move.captured && localMove) {
      setMomentum((value) => Math.min(9, value + 1));
      nextReview.push("Momentum gained from a clean capture.");
      if (loadout.passiveId === "vengeance_ledger" && abilityFlags.vengeanceReady) {
        setMomentum((value) => Math.min(9, value + 1));
        nextAbilityFlags.vengeanceReady = false;
        nextReview.push("Vengeance Ledger paid out bonus Momentum.");
      }
      if (loadout.passiveId === "echo_mark" && result.capturedPiece?.id === markedPiece?.id) {
        setMomentum((value) => Math.min(9, value + 1));
        nextMarkedPiece = null;
        nextReview.push("Echo Mark claimed. Bonus Momentum gained.");
      }
    }

    if (move.captured && enemyMove && result.capturedPiece?.player === localPlayerColor && loadout.passiveId === "vengeance_ledger" && abilityFlags.vengeanceTriggers < 2) {
      nextAbilityFlags.vengeanceReady = true;
      nextAbilityFlags.vengeanceTriggers += 1;
      nextReview.push("Vengeance Ledger primed: your next capture gains Momentum.");
    }

    if (result.promoted) {
      nextReview.push(`${turn === "white" ? "Azure" : "Amber"} promoted a king.`);
      if (enemyMove && loadout.passiveId === "crown_tax" && !abilityFlags.crownTax) {
        setMomentum((value) => Math.min(9, value + 2));
        nextAbilityFlags.crownTax = true;
        nextReview.push("Crown Tax triggered: +2 Momentum after enemy promotion.");
      }
    }

    const reachedEnemyFinalRows = localPlayerColor === "white" ? move.to.row <= 2 : move.to.row >= 5;
    if (localMove && !result.piece.king && reachedEnemyFinalRows && loadout.passiveId === "royal_pressure" && !abilityFlags.royalPressure) {
      setMomentum((value) => Math.min(9, value + 1));
      nextAbilityFlags.royalPressure = true;
      nextReview.push("Royal Pressure gained Momentum in the enemy final rows.");
    }

    if (localMove && loadout.passiveId === "shield_wall" && !abilityFlags.shieldWall && !isCenterSquare(move.from) && isCenterSquare(move.to)) {
      nextAbilityFlags.shieldWall = true;
      nextProtectedSquares = addProtectedSquare(nextProtectedSquares, move.to, "Shield Wall", {
        pieceId: result.piece.id,
        owner: localPlayerColor,
        enemyTurnsRemaining: 1,
      });
      campaignCompleted = maybeCompleteCampaign("passive_trigger", "shield_wall", result.board, nextReplay, nextMoveLog) || campaignCompleted;
      nextReview.push(`Shield Wall guarded ${squareName(move.to)} in the center zone.`);
      showAbilityFeedback("shield_wall", `Shield Wall triggered on ${squareName(move.to)}. The center entry is protected for the enemy turn.`);
    }

    if (move.passiveId === "open_roads") {
      campaignCompleted = maybeCompleteCampaign("passive_move", "open_roads", result.board, nextReplay, nextMoveLog) || campaignCompleted;
      nextReview.push("Open Roads created a backward escape.");
      showAbilityFeedback("open_roads");
    }
    if (loadout.passiveId === "dust_veil" && localMove && !move.captured) {
      nextProtectedSquares = addProtectedSquare(nextProtectedSquares, move.to, "Dust Veil", {
        pieceId: result.piece.id,
        owner: localPlayerColor,
        enemyTurnsRemaining: 1,
      });
      campaignCompleted = maybeCompleteCampaign("passive_trigger", "dust_veil", result.board, nextReplay, nextMoveLog) || campaignCompleted;
      nextReview.push("Dust Veil guarded the moved piece.");
      showAbilityFeedback("dust_veil");
    }

    if (enemyMove && loadout.passiveId === "echo_mark" && !move.captured) {
      nextMarkedPiece = { id: result.piece.id, row: move.to.row, col: move.to.col };
      nextReview.push(`Echo Mark tagged ${squareName(move.to)}.`);
    }

    if (localMove && loadout.passiveId === "pressure_field" && !abilityFlags.pressureField) {
      const enemyColor = localPlayerColor === "white" ? "black" : "white";
      const enemyCaptures = getLegalMoves(result.board, enemyColor, { ...getMoveOptions(enemyColor), protectedSquares: nextProtectedSquares }).filter((candidate) => candidate.captured);
      if (enemyCaptures.length > 0) {
        setMomentum((value) => Math.min(9, value + 1));
        nextAbilityFlags.pressureField = true;
        nextReview.push("Pressure Field sensed danger and granted Momentum.");
      }
    }

    if (move.powerId && move.powerId !== "sun_lance") {
      setMomentum((value) => Math.max(0, value - (ultimate?.cost || 2)));
      setUltimateUsed(true);
      showAbilityFeedback(move.powerId);
      campaignCompleted = maybeCompleteCampaign("ultimate_move", move.powerId, result.board, nextReplay, nextMoveLog) || campaignCompleted;
      nextReview.push(`${ultimate?.name} changed the board tempo.`);
    }
    if (move.powerId === "sun_lance") {
      showAbilityFeedback("sun_lance");
      campaignCompleted = maybeCompleteCampaign("ultimate_move", "sun_lance", result.board, nextReplay, nextMoveLog) || campaignCompleted;
    }

    const chainProtectedSquares = nextProtectedSquares;
    const chainBlockedSquares = blockedSquares;

    setBoard(result.board);
    setSelected(null);
    setLegalMoves([]);
    setPowerMode(null);
    setPowerSelection([]);
    setProtectedSquares(chainProtectedSquares);
    setBlockedSquares(chainBlockedSquares);
    setMarkedPiece(nextMarkedPiece);
    setAbilityFlags(nextAbilityFlags);
    if (localMove) {
      setSunLancePieceId(null);
    }
    setMoveLog(nextMoveLog);
    setMoveReplay(nextReplay);
    const tutorialAdvance = advanceCampaignTutorialAfterMove(result.board);

    if (campaignCompleted) {
      setTurn("white");
      setCaptureChain(null);
      setReview([...nextReview, `Campaign lesson cleared: ${campaignLevel.objective}`].slice(-6));
      return;
    }

    if (move.captured) {
      const baseChainOptions = getMoveOptions(turn);
      const chainOptions = {
        ...baseChainOptions,
        forcedFrom: move.to,
        protectedSquares: chainProtectedSquares,
        blockedSquares: chainBlockedSquares,
        allowBackwardCapturePieceId: move.powerId === "sun_lance" ? null : baseChainOptions.allowBackwardCapturePieceId,
      };
      const chainMoves = getLegalMoves(result.board, turn, chainOptions).filter((candidate) => candidate.captured);
      if (chainMoves.length > 0) {
        const chainReplay = [...nextReplay.slice(0, -1), { ...replayEntry, chainOptions: chainMoves.length }];
        if (turn === "white") {
          speakLine("Capture chain available.");
        }
        setTurn(turn);
        setCaptureChain(move.to);
        setSelected(move.to);
        setLegalMoves(chainMoves);
        setMoveReplay(chainReplay);
        setReview([...nextReview, "Mandatory multi-capture available. Continue the chain."].slice(-6));
        const chainMessage = tutorialAdvance?.message || `${turn === "white" ? "Azure" : "Amber"} must continue the capture chain.`;
        setMessage(chainMessage);
        if (mode === "multiplayer") {
          sendMultiplayerState("move", { board: result.board, turn, moveLog: nextMoveLog, moveReplay: chainReplay, protectedSquares: chainProtectedSquares, blockedSquares: chainBlockedSquares, message: chainMessage });
        }
        return;
      }
    }

    const finalProtectedSquares = expireProtectedSquaresAfterTurn(nextProtectedSquares, turn);
    const expiresEnemyTurn = turn === "black";
    const finalBlockedSquares = expiresEnemyTurn ? [] : blockedSquares;
    setProtectedSquares(finalProtectedSquares);
    setBlockedSquares(finalBlockedSquares);
    setTurn(nextTurn);
    setCaptureChain(null);
    setReview(nextReview.slice(-6));

    const newWinner = getWinner(result.board, nextTurn, { ...getMoveOptions(nextTurn), protectedSquares: finalProtectedSquares, blockedSquares: finalBlockedSquares });
    if (newWinner) {
      finish(newWinner, "by controlling the board", result.board, nextReplay, nextMoveLog);
      if (mode === "multiplayer") {
        sendMultiplayerState("finish", { board: result.board, turn: nextTurn, moveLog: nextMoveLog, moveReplay: nextReplay, protectedSquares: finalProtectedSquares, blockedSquares: finalBlockedSquares, winner: newWinner, message: `${newWinner === "white" ? "Azure" : "Amber"} wins by controlling the board.` });
      }
      return;
    }
    const nextMessage = tutorialAdvance?.message || `${nextTurn === "white" ? "Azure" : "Amber"} to move.`;
    setMessage(nextMessage);
    if (mode === "multiplayer") {
      sendMultiplayerState("move", { board: result.board, turn: nextTurn, moveLog: nextMoveLog, moveReplay: nextReplay, protectedSquares: finalProtectedSquares, blockedSquares: finalBlockedSquares, message: nextMessage });
    }
  }

  function handlePower(row, col) {
    const localPlayerColor = getLocalPlayerColor(mode, multiplayerRole);
    const nextTurnAfterPower = localPlayerColor === "white" ? "black" : "white";
    const localPlayerName = PLAYERS[localPlayerColor]?.name || "Commander";
    const opponentName = PLAYERS[nextTurnAfterPower]?.name || "Opponent";
    if (powerMode === "dash" || powerMode === "phase_shift") {
      const tutorialStep = getCampaignTutorialStep(campaignTutorial);
      if (isGuidedCampaignTutorialActive(campaignTutorial) && tutorialStep?.actor === "player" && tutorialStep.kind === "power") {
        const clickedSquare = squareName({ row, col });
        const expectedSquare = selected ? tutorialStep.to : tutorialStep.from;
        if (clickedSquare !== expectedSquare) {
          rejectCampaignTutorialMove(tutorialStep, `Choose ${expectedSquare} for the guided ${abilityLabel(tutorialStep.powerId)} step.`);
          return;
        }
      }
      if (!selected) {
        const moves = powerMode === "dash" ? getDashMoves(board, row, col, localPlayerColor) : getPhaseShiftMoves(board, row, col, localPlayerColor);
        if (moves.length === 0) {
          setMessage(`Choose a normal ${localPlayerName} piece with a legal power move.`);
          return;
        }
        setSelected({ row, col });
        setLegalMoves(moves);
        setMessage(`${ultimate?.name} armed. Choose a landing square.`);
        return;
      }
      const move = legalMoves.find((candidate) => candidate.to.row === row && candidate.to.col === col);
      if (move) {
        commitMove(move, "Power");
      }
      return;
    }

    if (powerMode === "fortify" || powerMode === "crown_surge" || powerMode === "sun_lance") {
      const piece = board[row]?.[col];
      if (!piece || piece.player !== localPlayerColor) {
        setMessage(`Choose one ${localPlayerName} piece.`);
        return;
      }

      if (powerMode === "fortify") {
        const tutorialStep = getCampaignTutorialStep(campaignTutorial);
        if (isGuidedCampaignTutorialActive(campaignTutorial) && tutorialStep?.actor === "player") {
          const clickedSquare = squareName({ row, col });
          if (tutorialStep.kind !== "power" || tutorialStep.powerId !== "fortify" || clickedSquare !== tutorialStep.from) {
            rejectCampaignTutorialMove(tutorialStep, `Choose ${tutorialStep.from} for the guided Fortify step.`);
            return;
          }
        }
        const nextBoard = cloneBoard(board);
        const tutorialAdvance = advanceCampaignTutorialAfterMove(nextBoard);
        const nextProtectedSquares = addProtectedSquare(protectedSquares, { row, col }, "Fortify", {
          pieceId: piece.id,
          owner: localPlayerColor,
          enemyTurnsRemaining: 2,
        });
        const nextMessage = tutorialAdvance?.message || `Fortify active for two enemy turns. ${opponentName} must find another route.`;
        setProtectedSquares(nextProtectedSquares);
        setMomentum((value) => Math.max(0, value - (ultimate?.cost || 2)));
        setUltimateUsed(true);
        setPowerMode(null);
        setPowerSelection([]);
        setSelected(null);
        setLegalMoves([]);
        setTurn(nextTurnAfterPower);
        const nextLog = [`Power: Fortify on ${squareName({ row, col })}`, ...moveLog].slice(0, 20);
        const campaignCompleted = maybeCompleteCampaign("ultimate_piece", "fortify", nextBoard, moveReplay, nextLog);
        setReview((items) => [...items, "Fortify protected a key piece for two enemy turns and cancelled the enemy capture chain."].slice(-6));
        setMoveLog(nextLog);
        showAbilityFeedback("fortify", "Fortify protected that piece for two enemy turns and forced Amber to abandon the multi-jump.");
        setMessage(nextMessage);
        if (mode === "multiplayer") {
          sendMultiplayerState("move", {
            board: nextBoard,
            turn: nextTurnAfterPower,
            moveLog: nextLog,
            protectedSquares: nextProtectedSquares,
            message: nextMessage,
            actionType: "ability_cast",
            abilityAction: { abilityId: "fortify", target: squareName({ row, col }) },
          });
        }
        if (campaignCompleted) {
          return;
        }
        return;
      }

      if (piece.king) {
        setMessage(`${ultimate?.name} needs a normal ${localPlayerName} piece.`);
        return;
      }

      if (powerMode === "crown_surge") {
        const tutorialStep = getCampaignTutorialStep(campaignTutorial);
        if (isGuidedCampaignTutorialActive(campaignTutorial) && tutorialStep?.actor === "player") {
          const clickedSquare = squareName({ row, col });
          if (tutorialStep.kind !== "power" || tutorialStep.powerId !== "crown_surge" || clickedSquare !== tutorialStep.from) {
            rejectCampaignTutorialMove(tutorialStep, `Choose ${tutorialStep.from} for the guided Crown Surge step.`);
            return;
          }
        }
        if (row < 2 || row > 5) {
          setMessage("Crown Surge targets a normal piece in the middle four rows.");
          return;
        }
        const nextBoard = cloneBoard(board);
        nextBoard[row][col] = { ...piece, king: true };
        const tutorialAdvance = advanceCampaignTutorialAfterMove(nextBoard);
        const nextMessage = tutorialAdvance?.message || `Crown Surge crowned a piece. ${opponentName} to move.`;
        setBoard(nextBoard);
        setMomentum((value) => Math.max(0, value - (ultimate?.cost || 2)));
        setUltimateUsed(true);
        setPowerMode(null);
        setPowerSelection([]);
        setSelected(null);
        setLegalMoves([]);
        setTurn(nextTurnAfterPower);
        const nextLog = [`Power: Crown Surge crowned ${squareName({ row, col })}`, ...moveLog].slice(0, 20);
        const campaignCompleted = maybeCompleteCampaign("ultimate_piece", "crown_surge", nextBoard, moveReplay, nextLog);
        setReview((items) => [...items, "Crown Surge created an instant king and unlocked a long capture angle."].slice(-6));
        setMoveLog(nextLog);
        showAbilityFeedback("crown_surge", "Crown Surge created a king and unlocked a long diagonal capture lane.");
        setMessage(nextMessage);
        if (mode === "multiplayer") {
          sendMultiplayerState("move", {
            board: nextBoard,
            turn: nextTurnAfterPower,
            moveLog: nextLog,
            message: nextMessage,
            actionType: "ability_cast",
            abilityAction: { abilityId: "crown_surge", target: squareName({ row, col }) },
          });
        }
        if (campaignCompleted) {
          return;
        }
        return;
      }

      const lanceMoves = getSunLanceMoves(board, row, col, localPlayerColor, getMoveOptions(localPlayerColor));
      if (lanceMoves.length === 0) {
        setMessage("Sun Lance needs a normal piece with an enemy on a diagonal line.");
        return;
      }
      const tutorialAdvance = advanceCampaignTutorialAfterMove(board);
      setSunLancePieceId(piece.id);
      setMomentum((value) => Math.max(0, value - (ultimate?.cost || 2)));
      setUltimateUsed(true);
      setPowerMode(null);
      setPowerSelection([]);
      setSelected({ row, col });
      setLegalMoves(lanceMoves);
      setReview((items) => [...items, "Sun Lance armed a long diagonal capture line."].slice(-6));
      setMessage(tutorialAdvance?.message || "Sun Lance armed. Choose any highlighted lance capture.");
      showAbilityFeedback("sun_lance", "Sun Lance lets a normal piece strike like a king for this capture.");
      return;
    }

    if (powerMode === "sandstorm_corridor" || powerMode === "barricade" || powerMode === "collapse") {
      const tutorialStep = getCampaignTutorialStep(campaignTutorial);
      if (isGuidedCampaignTutorialActive(campaignTutorial) && tutorialStep?.actor === "player") {
        const clickedSquare = squareName({ row, col });
        const expectedSquare = tutorialStep.targets?.[powerSelection.length];
        if (tutorialStep.kind !== "power_board" || tutorialStep.powerId !== powerMode || clickedSquare !== expectedSquare) {
          rejectCampaignTutorialMove(tutorialStep, expectedSquare ? `Block ${expectedSquare} for this guided step.` : `Use ${abilityLabel(tutorialStep.powerId)} here.`);
          return;
        }
      }
      if (!isDarkSquare(row, col) || board[row][col]) {
        setMessage("Choose an empty dark square.");
        return;
      }
      const needed = powerMode === "collapse" ? 1 : 2;
      const nextSelection = [...powerSelection, { row, col }];
      setPowerSelection(nextSelection);
      if (nextSelection.length < needed) {
        setMessage(`${needed - nextSelection.length} more square needed.`);
        return;
      }
      const kind = powerMode === "sandstorm_corridor" ? "quiet" : "all";
      const nextBlockedSquares = nextSelection.map((square) => ({ ...square, kind }));
      setBlockedSquares(nextBlockedSquares);
      setMomentum((value) => Math.max(0, value - (ultimate?.cost || 2)));
      setUltimateUsed(true);
      const nextLog = [`Power: ${ultimate?.name || powerMode} blocked ${nextSelection.map(squareName).join(", ")}`, ...moveLog].slice(0, 20);
      const campaignCompleted = maybeCompleteCampaign("ultimate_board", powerMode, board, moveReplay, nextLog);
      const tutorialAdvance = advanceCampaignTutorialAfterMove(board);
      const nextMessage = tutorialAdvance?.message || `${ultimate?.name} blocked key lanes.`;
      showAbilityFeedback(powerMode);
      setPowerMode(null);
      setPowerSelection([]);
      if (campaignCompleted) {
        return;
      }
      setTurn(nextTurnAfterPower);
      setMoveLog(nextLog);
      setMessage(nextMessage);
      if (mode === "multiplayer") {
        sendMultiplayerState("move", {
          board,
          turn: nextTurnAfterPower,
          moveLog: nextLog,
          blockedSquares: nextBlockedSquares,
          message: nextMessage,
          actionType: "ability_cast",
          abilityAction: { abilityId: powerMode, targets: nextSelection.map(squareName) },
        });
      }
    }
  }

  function armPower() {
    playSound("click");
    const localPlayerColor = getLocalPlayerColor(mode, multiplayerRole);
    const tutorialStep = getCampaignTutorialStep(campaignTutorial);
    if (isGuidedCampaignTutorialActive(campaignTutorial) && tutorialStep?.actor === "player" && !isPowerTutorialStep(tutorialStep)) {
      rejectCampaignTutorialMove(tutorialStep, "Do not spend the ultimate here.");
      return;
    }
    if (captureChain) {
      setMessage("Finish the mandatory capture chain before using a power.");
      return;
    }
    if (powerMode) {
      setPowerMode(null);
      setSelected(null);
      setLegalMoves([]);
      setPowerSelection([]);
      return;
    }
    if (ultimateUsed || momentum < (ultimate?.cost || 2)) {
      setMessage(`${ultimate?.name} needs ${ultimate?.cost || 2} Momentum.`);
      return;
    }
    if (turn !== localPlayerColor) {
      setMessage(`Wait for your ${PLAYERS[localPlayerColor]?.name || "commander"} turn before using a power.`);
      return;
    }
    const capturesAvailable = getLegalMoves(board, localPlayerColor, getMoveOptions(localPlayerColor)).some((move) => move.captured);
    if ((loadout.ultimateId === "dash" || loadout.ultimateId === "phase_shift") && capturesAvailable) {
      setMessage(`${ultimate?.name} cannot be used during a mandatory capture.`);
      return;
    }
    setPowerMode(loadout.ultimateId);
    speakLine("Ultimate ready.");
    setMessage(`${ultimate?.name} armed.`);
  }

  function maybeCompleteCampaign(type, id, finalBoard = board, finalReplay = moveReplay, finalMoveLog = moveLog) {
    if (mode !== "campaign" || !campaignLevel) {
      return false;
    }
    if (isGuidedCampaignLevel(campaignLevel)) {
      return false;
    }
    if (campaignLevel.completion.type === type && campaignLevel.completion.id === id) {
      const turns = Math.max(1, Math.floor(finalMoveLog.length / 2) + 1);
      const stars = calculateCampaignStars(campaignLevel, turns, countPieces(finalBoard).white, matchStartCounts.white);
      const nextProgress = mergeCampaignProgress(campaignProgress, campaignLevel.id, campaign?.levels || [], turns, stars);
      setCampaignProgressState(nextProgress);
      if (!isLocalSession) {
        saveCampaignProgress(activeUserId, campaignLevel?.factionId || campaignFactionId, nextProgress)
          .catch((error) => showError("Campaign save failed", error, "Campaign progress changed locally, but was not saved."));
      }
      playMatchEndAudio("campaign");
      setWinner("campaign");
      setResultLabel("Level clear");
      setMessage(campaignLevel.clearMessage || `${campaignLevel.name} complete. Lesson cleared.`);
      addNotification("Campaign sector cleared", `${campaignLevel.name}: ${stars} star${stars === 1 ? "" : "s"} earned.`, "success", false);
      processMatchRewards("campaign", finalBoard, finalReplay, finalMoveLog);
      return true;
    }
    return false;
  }

  function finish(nextWinner, reason, finalBoard = board, finalReplay = moveReplay, finalMoveLog = moveLog) {
    if (winner) {
      return;
    }
    const won = isLocalWinner(nextWinner);
    playMatchEndAudio(nextWinner);
    setWinner(nextWinner);
    setResultLabel(null);
    setPostMatchVictory(won);
    setMessage(`${nextWinner === "white" ? "Azure" : "Amber"} wins ${reason}.`);
    if (mode === "campaign" && nextWinner === "white" && isGuidedCampaignLevel(campaignLevel)) {
      completeGuidedCampaignLevel(finalMoveLog, finalBoard);
    }
    processMatchRewards(nextWinner, finalBoard, finalReplay, finalMoveLog);
  }

  function processMatchRewards(nextWinner, finalBoard = board, finalReplay = moveReplay, finalMoveLog = moveLog) {
    if (!["ai", "campaign", "puzzle", "multiplayer"].includes(mode)) {
      return;
    }
    const playerColor = mode === "multiplayer" && multiplayerRole === "guest" ? "black" : "white";
    const result = nextWinner === playerColor || nextWinner === "campaign" ? "win" : "loss";
    const finalCounts = countPieces(finalBoard);
    const captured = Math.max(0, matchStartCounts.black - finalCounts.black);
    const lost = Math.max(0, matchStartCounts.white - finalCounts.white);
    const replayForReview = finalReplay.length ? finalReplay : moveReplay;
    const logForReview = finalMoveLog.length ? finalMoveLog : moveLog;
    const turns = Math.floor(logForReview.length / 2) + 1;
    const loopInsights = buildProductLoopInsights({
      result,
      mode,
      campaignLevel,
      replay: replayForReview,
      finalBoard,
      loadout,
      captured,
      lost,
      turns,
    });
    if (!isAuthenticated) {
      const report = {
        ...DEFAULT_MATCH_REPORT,
        isVictory: result === "win",
        result,
        opponent: `${AI_LABELS[aiLevel]} Sparring AI`,
        aiProfileId,
        difficulty: AI_LABELS[aiLevel],
        gameMode: "classic",
        captured,
        lost,
        turns,
        shards: 0,
        essence: 0,
        exp: 0,
        elo: 0,
        review: ["Guest trial complete. Log in to save rewards, quests, match history, Power mode, and multiplayer progress."],
        replay: replayForReview,
        replayFrames: buildReplayFrames(replayForReview, finalBoard),
        finalBoard,
        retryMoment: null,
        ...loopInsights,
        factionLevel: 1,
        factionExp: 0,
        nextUnlock: "Create a commander account",
        created_at: new Date().toISOString(),
      };
      setMatchReport(report);
      setPostMatchVictory(result === "win");
      setEconomyMessage("Guest matches do not grant shards, EXP, quests, achievements, or saved history.");
      addNotification("Guest trial finished", "Log in to earn rewards and unlock Power Checkers.", "info", false);
      return;
    }
    const aiDifficulty = aiDifficultyFromLevel(aiLevel);
    const reward = calculateMatchReward({ aiDifficulty, result, level: profile.level });
    const questPatch = updateQuestProgress(profile.active_quests, {
      captured,
      aiWin: mode === "ai" && result === "win",
      campaignClear: mode === "campaign" && result === "win",
      puzzleSolve: mode === "puzzle" && result === "win",
    });
    const battlePassPatch = progressBattlePassMissions(battlePass, createBattlePassMissionEvent({
      result,
      captured,
      mode,
      gameVariant,
      loadout,
      ultimateUsed,
    }), profile);
    const battlePassResult = applyBattlePassXp(battlePassPatch.state, battlePassPatch.xpGained);
    const battlePassReward = collectBattlePassRewards(battlePassResult.unlockedTiers, profile);
    const battlePassCosmetics = rewardCosmeticIds(battlePassReward);
    const campaignCompletion = mode === "campaign" && result === "win" && campaignLevel
      ? buildCampaignCompletion({ progress: campaignProgress, level: campaignLevel, levels: campaign?.levels || [], turns, finalBoard, startingPieces: matchStartCounts.white })
      : null;
    const currentStreaks = normalizeStreaks(profile.streaks);
    const nextStreaks = {
      ...currentStreaks,
      dailyWin: result === "win" ? currentStreaks.dailyWin + 1 : currentStreaks.dailyWin,
      dailyPuzzle: mode === "puzzle" && result === "win" ? currentStreaks.dailyPuzzle + 1 : currentStreaks.dailyPuzzle,
    };
    const totalReward = {
      ...reward,
      shards: reward.shards + questPatch.rewardShards + Number(battlePassReward.shards || 0),
      essence: Number(reward.essence || 0) + Number(battlePassReward.essence || 0),
      exp: Number(reward.exp || 0) + Number(battlePassReward.exp || 0),
    };
    const nextProfile = applyProgression({
      ...profile,
      active_quests: questPatch.quests,
      streaks: nextStreaks,
      owned_cosmetics: [...new Set([...(profile.owned_cosmetics || []), ...battlePassCosmetics])],
    }, totalReward, factions);
    const report = {
      isVictory: result === "win",
      result,
      opponent: mode === "campaign" ? "Nexus Campaign AI" : mode === "puzzle" ? "Daily Tactic AI" : mode === "multiplayer" ? "Remote Commander" : `${AI_LABELS[aiLevel]} Sparring AI`,
      aiProfileId: mode === "campaign" ? "campaign" : mode === "puzzle" ? "puzzle" : aiProfileId,
      difficulty: mode === "campaign" ? campaignLevel?.name || "Campaign" : mode === "puzzle" ? "Daily Puzzle" : AI_LABELS[aiLevel],
      gameMode: mode === "campaign" ? "campaign" : mode === "puzzle" ? "puzzle" : gameVariant,
      captured,
      lost,
      turns,
      shards: totalReward.shards,
      essence: totalReward.essence || 0,
      exp: totalReward.exp,
      elo: mode === "multiplayer" ? (result === "win" ? 18 : -14) : 0,
      review: review.length ? review : buildCoachReview({ result, captured, lost, turns, mode, campaignLevel, replay: replayForReview, finalBoard, loadout }),
      replay: replayForReview,
      replayFrames: buildReplayFrames(replayForReview, finalBoard),
      finalBoard,
      retryMoment: buildInteractiveRetryMoment({ replay: replayForReview, finalBoard, result, mode, campaignLevel, loadout }),
      equippedPieceSkin: equippedSkinIds.piece,
      equippedBoardSkin: equippedSkinIds.board,
      opponentPieceSkin: mode === "multiplayer" ? remoteSkinIds.piece : "",
      opponentBoardSkin: mode === "multiplayer" ? remoteSkinIds.board : "",
      campaignLevelId: campaignCompletion?.level.id || "",
      campaignLevelName: campaignCompletion?.level.name || "",
      campaignObjective: campaignCompletion?.level.objective || "",
      campaignStars: campaignCompletion?.stars || 0,
      campaignNextLevelId: campaignCompletion?.nextLevel?.id || "",
      campaignNextLevelName: campaignCompletion?.nextLevel?.name || "",
      ...loopInsights,
      factionLevel: nextProfile.level,
      factionExp: nextProfile.current_exp,
      nextExp: expRequiredForLevel(nextProfile.level),
      nextUnlock: getNextUnlock(nextProfile, factions),
      created_at: new Date().toISOString(),
    };
    setProfile(nextProfile);
    setBattlePass(battlePassResult.state);
    if (campaignCompletion) {
      setCampaignProgressState(campaignCompletion.progress);
      setCampaignFocusLevelId(campaignCompletion.nextLevel?.id || campaignCompletion.level.id);
    }
    setMatchReport(report);
    setPostMatchVictory(result === "win");
    setMatchHistory((items) => [report, ...items].slice(0, 12));
    if (battlePassCosmetics.length) {
      const existingCosmetics = new Set(inventoryItems.map((item) => item.cosmetic_id));
      const optimisticInventory = battlePassCosmetics
        .filter((cosmeticId) => !existingCosmetics.has(cosmeticId))
        .map((cosmeticId) => createAchievementInventoryItem(cosmeticId, activeUserId, vaultItems));
      if (optimisticInventory.length) {
        setInventoryItems((items) => [...items, ...optimisticInventory]);
      }
      battlePassCosmetics.forEach((cosmeticId) => {
        if (!isLocalSession) {
          grantInventoryItem(activeUserId, cosmeticId, `battle_pass:${BATTLE_PASS_SEASON.id}`).then((payload) => {
            if (payload?.inventory_item) {
              setInventoryItems((items) => [
                ...items.filter((item) => item.cosmetic_id !== cosmeticId),
                normalizeInventoryItem(payload.inventory_item),
              ]);
            }
          }).catch((error) => showError("Battle Pass skin grant failed", error, "The reward is unlocked locally, but Inventory sync failed."));
        }
      });
    }
    analyzeCoach(buildCoachPayload({ replay: replayForReview, finalBoard, moveLog: logForReview, mode, loadout, result, campaignLevel, aiLevel }))
      .then((analysis) => {
        const enhanced = {
          ...report,
          review: analysis.review?.length ? analysis.review : report.review,
          retryMoment: analysis.retry_moment || analysis.retryMoment || report.retryMoment || null,
        };
        setMatchReport(enhanced);
        setMatchHistory((items) => [enhanced, ...items.slice(1)].slice(0, 12));
      })
      .catch(() => undefined);
    setEconomyMessage(`${totalReward.exp} EXP and ${totalReward.shards} Shards earned.`);
    saveProfile(activeUserId, { active_quests: nextProfile.active_quests, streaks: nextProfile.streaks })
      .catch((error) => showError("Progress save failed", error, "Rewards changed locally, but profile progress was not saved."));
    if (campaignCompletion) {
      if (!isLocalSession) {
        saveCampaignProgress(activeUserId, campaignCompletion.level?.factionId || campaignFactionId, campaignCompletion.progress)
          .catch((error) => showError("Campaign save failed", error, "Campaign progress changed locally, but was not saved."));
      }
      window.setTimeout(() => setView("postmatch"), 250);
    }
    addNotification(result === "win" ? "Tactical victory" : "Tactical defeat", `${totalReward.exp} EXP and ${totalReward.shards} Shards earned.`, result === "win" ? "success" : "warning", false);
    questPatch.completed.forEach((quest) => addNotification("Daily mission complete", `${quest.title}: +${quest.reward_shards} Shards.`, "success", false));
    battlePassPatch.completedMissions.forEach((mission) => addNotification("Battle Pass mission complete", `${mission.title}: +${mission.battle_pass_xp} BP XP.`, "success", false));
    battlePassPatch.proLockedMissions.forEach((mission) => addNotification("Pro mission completed", `${mission.title} is complete. Upgrade to Aether Pro to claim ${mission.battle_pass_xp} BP XP.`, "warning", false));
    battlePassResult.unlockedTiers.forEach((tier) => {
      if (isBattlePassTierProReward(tier) && !hasAetherPro(profile)) {
        addNotification("Pro Battle Pass reward", `Tier ${tier.tier} reached. Upgrade to Aether Pro to obtain ${formatReward(tier.reward)}.`, "warning", false);
      } else {
        addNotification("Battle Pass tier unlocked", `Tier ${tier.tier}: ${formatReward(tier.reward)}.`, "success", false);
      }
    });
    recordMatch({
      user_id: activeUserId,
      opponent_type: mode === "multiplayer" ? "Player" : "AI",
      ai_difficulty: mode === "multiplayer" ? null : aiDifficulty,
      opponent_ai_level: mode === "multiplayer" ? null : aiLevel,
      game_mode: mode === "campaign" ? "campaign" : mode === "puzzle" ? "puzzle" : gameVariant,
      result,
      faction_id: loadout.factionId,
      passive_id: loadout.passiveId,
      ultimate_id: loadout.ultimateId,
      turns_count: turns,
      captures_made: captured,
      replay: replayForReview,
      review_summary: report.review,
      mmr_delta: report.elo,
      base_exp: 80,
      essence_reward: Number(battlePassReward.essence || 0),
      shards_reward: questPatch.rewardShards + Number(battlePassReward.shards || 0),
      equipped_piece_skin: equippedSkinIds.piece || null,
      equipped_board_skin: equippedSkinIds.board || null,
      opponent_piece_skin: mode === "multiplayer" ? remoteSkinIds.piece || null : null,
      opponent_board_skin: mode === "multiplayer" ? remoteSkinIds.board || null : null,
    })
      .then((payload) => {
        if (payload.profile) {
          setProfile((current) => normalizeProfile({
            ...current,
            ...payload.profile,
            active_quests: payload.profile.active_quests?.length ? payload.profile.active_quests : nextProfile.active_quests,
            owned_cosmetics: [...new Set([...(current.owned_cosmetics || []), ...(payload.profile.owned_cosmetics || []), ...battlePassCosmetics])],
          }));
        }
        if (payload.match) {
          setMatchHistory((items) => [normalizeMatchReport(payload.match, report), ...items.filter((item) => item.match_id !== payload.match.match_id)].slice(0, 12));
        }
      })
      .catch((error) => showError("Match history save failed", error, "Match report exists locally, but Supabase did not save it."));
  }

  function selectFaction(factionId) {
    const nextFaction = factions.find((item) => item.id === factionId);
    if (!nextFaction || mode === "campaign" || !profile.unlocked_factions?.includes(factionId)) {
      if (nextFaction && !profile.unlocked_factions?.includes(factionId)) {
        setMessage(`${nextFaction.name} unlocks at level ${nextFaction.required_level_to_unlock || 1}.`);
      }
      return;
    }
    setLoadout({
      factionId,
      passiveId: nextFaction.passives[0].id,
      ultimateId: nextFaction.ultimates[0].id,
    });
  }

  function getMoveOptions(player, overrides = {}) {
    const classicAi = gameVariant === "classic" && mode === "ai";
    const localPlayerColor = getLocalPlayerColor(mode, multiplayerRole);
    const playerUsesLoadout = mode === "multiplayer" ? player === localPlayerColor : player === "white";
    return {
      passiveId: !classicAi && playerUsesLoadout ? loadout.passiveId : null,
      blockedSquares,
      protectedSquares,
      allowBackwardCapturePieceId: playerUsesLoadout ? sunLancePieceId : null,
      forcedFrom: captureChain && player === turn ? captureChain : null,
      ...overrides,
    };
  }

  function getPowerTargets() {
    if (!powerMode) {
      return powerSelection;
    }
    const localPlayerColor = getLocalPlayerColor(mode, multiplayerRole);
    if (selected) {
      return legalMoves.map((move) => move.to);
    }
    if (powerMode === "dash" || powerMode === "phase_shift") {
      const targets = [];
      board.forEach((row, rowIndex) => {
        row.forEach((piece, colIndex) => {
          if (piece?.player === localPlayerColor && !piece.king) {
            targets.push({ row: rowIndex, col: colIndex });
          }
        });
      });
      return targets;
    }
    if (powerMode === "fortify" || powerMode === "crown_surge" || powerMode === "sun_lance") {
      return board.flatMap((row, rowIndex) =>
        row.map((piece, colIndex) => ({ piece, row: rowIndex, col: colIndex }))
          .filter(({ piece, row }) => {
            if (!piece || piece.player !== localPlayerColor) {
              return false;
            }
            if (powerMode === "fortify") {
              return true;
            }
            if (piece.king) {
              return false;
            }
            if (powerMode === "sun_lance") {
              return getSunLanceMoves(board, row, col, localPlayerColor, getMoveOptions(localPlayerColor)).length > 0;
            }
            return powerMode !== "crown_surge" || (row >= 2 && row <= 5);
          })
          .map(({ row, col }) => ({ row, col })),
      );
    }
    return board.flatMap((row, rowIndex) =>
      row.map((piece, colIndex) => ({ piece, row: rowIndex, col: colIndex }))
        .filter(({ piece, row, col }) => !piece && isDarkSquare(row, col))
      .map(({ row, col }) => ({ row, col })),
    );
  }

  function getPassiveTargets() {
    const classicAi = gameVariant === "classic" && mode === "ai";
    const localPlayerColor = getLocalPlayerColor(mode, multiplayerRole);
    if (classicAi || winner || powerMode || turn !== localPlayerColor || loadout.passiveId !== "shield_wall" || abilityFlags.shieldWall) {
      return [];
    }
    const targets = new Map();
    getLegalMoves(board, localPlayerColor, getMoveOptions(localPlayerColor))
      .filter((move) => !isCenterSquare(move.from) && isPlayableCenterSquare(move.to.row, move.to.col))
      .forEach((move) => targets.set(`${move.to.row}-${move.to.col}`, move.to));
    return [...targets.values()];
  }

  if (!data) {
    return <main className="loading">Preparing Dama Sprint...</main>;
  }

  if (view === "register") {
    return (
      <NexusGatewayRegistration
        profile={profile}
        error={authError}
        isBusy={authBusy}
        showAdminDemo={SHOW_ADMIN_DEMO}
        onBack={() => setView("nexus")}
        onSubmit={handleGatewayAuth}
        onAdminAccess={() => activateAdminCommander(getAdminUserId(), "admin-dashboard")}
      />
    );
  }

  if (view === "nexus") {
    return (
      <>
        <NexusCoreMenu
          demoMode={demoMode}
          isAuthenticated={isAuthenticated}
          profile={profile}
          factions={factions}
          loadout={loadout}
          campaignProgress={campaignProgress}
          connectionHealth={connectionHealth}
          notifications={notifications}
          notificationsOpen={notificationsOpen}
          recentMatches={matchHistory}
          friendsData={friendsData}
          playerSearchResults={playerSearchResults}
          onLogout={handleLogout}
          onNavigate={routeFromNexus}
          onStartDemo={startDemoJourney}
          demoGuideStep={demoGuideStep}
          onNotifications={() => setNotificationsOpen((open) => !open)}
          onPro={() => setProModalOpen(true)}
          onOpenProfile={openPublicProfile}
          onSearchPlayers={searchCommanders}
          onRequestFriend={requestFriend}
          onMatchSummary={(report) => {
            if (report) {
              setMatchReport(normalizeMatchReport(report, matchReport));
              openPostMatch((report.result || (report.isVictory ? "win" : "loss")) === "win");
            } else {
              openPostMatch(true);
            }
          }}
          onProfile={() => setView("settings")}
          onLogin={() => {
            setAuthError("");
            setView("register");
          }}
        />
        {proModalOpen && isAuthenticated && <ProUpgradeModal onClose={() => setProModalOpen(false)} onInterest={handleProInterest} isBusy={proInterestBusy} message={proInterestMessage} />}
        {onboardingOpen && isAuthenticated && (
          <OnboardingModal
            factions={factions}
            profile={profile}
            onPro={() => setProModalOpen(true)}
            onClose={() => {
              localStorage.setItem("dama-onboarding-complete", "true");
              saveProfilePatch({ settings: normalizeSettings({ ...profile.settings, onboardingCompleted: true }) });
              setOnboardingOpen(false);
            }}
            onStart={(patch, launchMode = "campaign") => {
              const nextPatch = { ...patch, settings: normalizeSettings({ ...profile.settings, ...(patch.settings || {}), onboardingCompleted: true }) };
              const nextProfile = normalizeProfile({ ...profile, ...nextPatch });
              setProfile(nextProfile);
              saveProfilePatch(nextPatch);
              localStorage.setItem("dama-onboarding-complete", "true");
              setOnboardingOpen(false);
              const starterRecord = nextPatch.saved_loadouts?.[0] || {};
              const starterFactionId = starterRecord.faction_id || "nomads";
              const starterLoadout = {
                factionId: starterFactionId,
                passiveId: starterRecord.passive_id || "open_roads",
                ultimateId: starterRecord.ultimate_id || "dash",
              };
              const starterCampaign = withFactionCampaign(data?.campaigns || data?.campaign, starterFactionId);
              const firstLevel = starterCampaign?.levels?.[0] || campaignLevel;
              setCampaignFactionId(starterFactionId);
              setCampaignLevelId(firstLevel?.id || "road_behind");
              setCampaignFocusLevelId(firstLevel?.id || "road_behind");
              setLoadout(starterLoadout);
              setGameVariant("power");
              if (launchMode === "training") {
                setEconomyMessage("Bootcamp training match launched. Follow the prompt over the board, then try chat in multiplayer.");
                startMatch("ai", firstLevel, {
                  variant: "power",
                  aiLevel: "beginner",
                  aiProfileId: "recruit",
                  loadout: starterLoadout,
                  bootcampTutorial: true,
                  message: "Bootcamp online. Select an Azure piece to see legal moves.",
                });
                setView("game");
                return;
              }
              setEconomyMessage(`${nextProfile.favorite_faction || starterFactionId} path saved. Start with the highlighted campaign sector.`);
              setView(starterFactionId === "nomads" ? "campaign-map" : "campaign-select");
            }}
          />
        )}
        {publicProfile && <PublicProfileModal profile={publicProfile} onClose={() => setPublicProfile(null)} onInvite={(target) => sendChallengeToFriend(target)} />}
        {renderChallengeOverlay()}
      </>
    );
  }

  if (view === "settings") {
    if (!isAuthenticated) {
      return withBackNavigation(<GuestLockedScreen feature="Profile settings" onHome={() => setView("nexus")} onLogin={() => setView("register")} />);
    }
    return withBackNavigation(<ProfileSettingsScreen profile={profile} factions={factions} message={economyMessage} connectionHealth={connectionHealth} isSaving={profileBusy} onSave={saveProfilePatch} onHome={() => setView("nexus")} onVault={() => setView("vault")} onTestSound={(name) => playSound(name)} onTestVoice={() => speakLine("Aether systems online.")} />);
  }

  if (view === "vault") {
    if (!isAuthenticated) {
      return withBackNavigation(<GuestLockedScreen feature="The Vault" onHome={() => setView("nexus")} onLogin={() => setView("register")} />);
    }
    return withBackNavigation(<VaultScreen profile={profile} factions={factions} items={vaultItems} inventoryItems={inventoryItems} message={economyMessage} busyItemId={vaultBusyId} onPurchase={purchaseCosmetic} onHome={() => setView("nexus")} onInventory={() => setView("inventory")} />);
  }

  if (view === "inventory") {
    if (!isAuthenticated) {
      return withBackNavigation(<GuestLockedScreen feature="Inventory" onHome={() => setView("nexus")} onLogin={() => setView("register")} />);
    }
    return withBackNavigation(<InventoryScreen items={inventoryItems} equippedCosmetics={equippedCosmetics} boardPreferences={boardPreferences} message={economyMessage} busyItemId={inventoryBusyId} onEquip={equipCosmetic} onEquipBasicPiece={equipBasicPieceSkin} onHome={() => setView("nexus")} onVault={() => setView("vault")} onViewMode={setBoardViewMode} onPieceColor={setPieceColor} onSavePreferences={saveBoardPreferences} onPlay={() => { startMatch("ai", campaignLevel, { variant: gameVariant, aiLevel, aiProfileId }); setView("game"); }} />);
  }

  if (view === "loadout") {
    if (!isAuthenticated) {
      return withBackNavigation(<GuestLockedScreen feature="Tactical Loadout" onHome={() => setView("nexus")} onLogin={() => setView("register")} />);
    }
    return withBackNavigation(
      <>
        <TacticalLoadout
          profile={profile}
          factions={factions}
          loadout={loadout}
          message={economyMessage}
          pendingSetup={pendingMatchSetup}
          onLoadout={setLoadout}
          onBack={() => setView(pendingMatchSetup ? "skirmish-config" : "nexus")}
          onLockedFaction={handleLockedFaction}
          onVault={() => setProModalOpen(true)}
          onProgression={() => setView("progression")}
          onInitialize={(nextLoadout, setup) => {
          const selectedSetup = setup || pendingMatchSetup || {
            variant: "power",
            aiLevel,
            aiProfileId,
            difficulty: SKIRMISH_DIFFICULTIES.find((item) => item.id === aiProfileId) || SKIRMISH_DIFFICULTIES[1],
          };
          if (!nextLoadout?.factionId || !nextLoadout?.passiveId || !nextLoadout?.ultimateId) {
            const text = "Choose one unlocked faction, one passive, and one ultimate before initializing Power Checkers.";
            setScreenMessage("Loadout incomplete", text);
            addNotification("Loadout incomplete", text, "warning");
            return;
          }
          const selectedFaction = factions.find((item) => item.id === nextLoadout.factionId);
          if (selectedFaction && !profile.unlocked_factions?.includes(selectedFaction.id)) {
            handleLockedFaction(selectedFaction);
            return;
          }
          setLoadout(nextLoadout);
          startMatch("ai", campaignLevel, {
            variant: "power",
            aiLevel: selectedSetup.aiLevel,
            aiProfileId: selectedSetup.aiProfileId,
            loadout: nextLoadout,
            message: `Power Checkers online. ${selectedSetup.difficulty?.label || AI_LABELS[selectedSetup.aiLevel] || "Smart"} AI is waiting.`,
          });
          setMessage(`Power Checkers online. ${selectedSetup.difficulty?.label || AI_LABELS[selectedSetup.aiLevel] || "Smart"} AI is waiting.`);
          setView("game");
          }}
        />
        {proModalOpen && <ProUpgradeModal onClose={() => setProModalOpen(false)} onInterest={handleProInterest} isBusy={proInterestBusy} message={proInterestMessage} />}
      </>
    );
  }

  if (view === "factions") {
    if (!isAuthenticated) {
      return withBackNavigation(<GuestLockedScreen feature="Abilities Codex" onHome={() => setView("nexus")} onLogin={() => setView("register")} />);
    }
    return withBackNavigation(<FactionAbilitiesShowcase profile={profile} factions={factions} onBack={() => setView("nexus")} onLoadout={() => setView("loadout")} onProfile={() => setView("settings")} onSettings={() => setView("settings")} onRewards={() => addNotification("Faction rewards", "Rewards unlock as you level and complete campaign sectors.", "info")} />);
  }

  if (view === "progression" || view === "battle-pass") {
    if (!isAuthenticated) {
      return withBackNavigation(<GuestLockedScreen feature={view === "battle-pass" ? "Battle Pass" : "Progression"} onHome={() => setView("nexus")} onLogin={() => setView("register")} />);
    }
    return withBackNavigation(
      <>
        <ProgressionScreen
          focus={view === "battle-pass" ? "battle-pass" : "progression"}
          profile={profile}
          factions={factions}
          campaignProgress={campaignProgress}
          matchHistory={matchHistory}
          inventoryItems={inventoryItems}
          battlePass={battlePass}
          busyAchievementId={achievementBusyId}
          onBack={() => setView("nexus")}
          onVault={() => setView("vault")}
          onClaim={claimAchievement}
          onPro={() => setProModalOpen(true)}
        />
        {proModalOpen && <ProUpgradeModal onClose={() => setProModalOpen(false)} onInterest={handleProInterest} isBusy={proInterestBusy} message={proInterestMessage} />}
      </>
    );
  }

  if (view === "admin-dashboard") {
    if (!isAuthenticated || !profile.is_admin) {
      return withBackNavigation(<GuestLockedScreen feature="Admin Dashboard" onHome={() => setView("nexus")} onLogin={() => setView("register")} />);
    }
    return withBackNavigation(
      <AdminDashboard
        profile={profile}
        factions={factions}
        inventoryItems={inventoryItems}
        vaultItems={vaultItems}
        matchHistory={matchHistory}
        onHome={() => setView("nexus")}
        onVault={() => setView("vault")}
        onLoadout={() => setView("loadout")}
        onCodex={() => setView("factions")}
        onProgression={() => setView("progression")}
        onPlayAi={() => {
          startMatch("ai", campaignLevel, { variant: "power", aiLevel: "coach", aiProfileId: "nexus_prime" });
          setView("game");
        }}
      />
    );
  }

  if (view === "battlefield") {
    return withBackNavigation(<BattlefieldShell onExit={() => setView("nexus")} />);
  }

  if (view === "skirmish-config") {
    return withBackNavigation(
      <SkirmishConfiguration
        profile={profile}
        isAuthenticated={isAuthenticated}
        onBack={() => setView("nexus")}
        onSettings={() => isAuthenticated ? setView("settings") : setView("register")}
        onLogin={() => setView("register")}
        onAuthRequired={requireAuth}
        onConfirm={({ variant, difficulty }) => {
          if (!isAuthenticated && variant === "power") {
            requireAuth("Power Checkers");
            return;
          }
          setAiLevel(difficulty.engineLevel);
          setAiProfileId(difficulty.id);
          if (variant === "power") {
            const setup = {
              variant: "power",
              difficulty,
              aiLevel: difficulty.engineLevel,
              aiProfileId: difficulty.id,
            };
            setPendingMatchSetup(setup);
            setGameVariant("power");
            setScreenMessage("Power setup ready", `Choose a faction loadout before fighting ${difficulty.label}.`);
            setView("loadout");
            return;
          }
          setPendingMatchSetup(null);
          startMatch("ai", campaignLevel, { variant, aiLevel: difficulty.engineLevel, aiProfileId: difficulty.id });
          setMessage(`${variant === "classic" ? "Classic" : "Power"} skirmish online. ${difficulty.label} AI is waiting.`);
          setView("game");
        }}
      />
    );
  }

  if (view === "campaign-select") {
    if (!isAuthenticated) {
      return withBackNavigation(<GuestLockedScreen feature="Campaign" onHome={() => setView("nexus")} onLogin={() => setView("register")} />);
    }
    return withBackNavigation(
      <>
        <CampaignFactionSelect
          profile={profile}
          factions={factions}
          progress={campaignProgress}
          onBack={() => setView("nexus")}
          onNomads={() => openCampaignPath("nomads")}
          onIron={() => openCampaignPath("iron_guard")}
          onSun={() => openCampaignPath("sun_court")}
          onVoid={() => openCampaignPath("void_order")}
          onProgression={() => setView("progression")}
          onVault={() => {
            setEconomyMessage(profile.unlocked_factions?.includes("void_order") ? "Void Order is already unlocked." : "Void Order is positioned as an Aether Pro campaign path.");
            setProModalOpen(true);
          }}
        />
        {proModalOpen && <ProUpgradeModal onClose={() => setProModalOpen(false)} onInterest={handleProInterest} isBusy={proInterestBusy} message={proInterestMessage} />}
      </>
    );
  }

  if (view === "campaign-map") {
    if (!isAuthenticated) {
      return withBackNavigation(<GuestLockedScreen feature="Campaign" onHome={() => setView("nexus")} onLogin={() => setView("register")} />);
    }
    return withBackNavigation(
      <CampaignMap
        campaign={campaign}
        progress={campaignProgress}
        focusLevelId={campaignFocusLevelId}
        musicTitle={musicTrackTitle(profile.settings?.musicTrack)}
        onBack={() => setView("nexus")}
        onStart={(node) => {
          const level = campaign?.levels?.[node.levelIndex] || campaignLevel;
          if (level) {
          setCampaignLevelId(level.id);
          }
          setCampaignFocusLevelId("");
          setDemoGuideStep("match");
          startMatch("campaign", level);
          setView("game");
        }}
      />
    );
  }

  if (view === "daily-puzzle") {
    if (!isAuthenticated) {
      return withBackNavigation(<GuestLockedScreen feature="Daily Challenges" onHome={() => setView("nexus")} onLogin={() => setView("register")} />);
    }
    return withBackNavigation(
      <DailyPuzzleScreen
        profile={profile}
        onBack={() => setView("nexus")}
        onStart={(puzzle = getDailyPuzzle()) => {
          startMatch("puzzle", campaignLevel, {
            variant: puzzle.variant || "classic",
            board: createBoardFromCoordinates(puzzle.white, puzzle.black),
            loadout: puzzle.loadout || loadout,
            aiLevel: puzzle.aiLevel || "smart",
            message: `${puzzle.title}: ${puzzle.objective}`,
          });
          setView("game");
        }}
      />
    );
  }

  if (view === "lobby") {
    if (!isAuthenticated) {
      return withBackNavigation(<GuestLockedScreen feature="Custom Multiplayer Lobby" onHome={() => setView("nexus")} onLogin={() => setView("register")} />);
    }
    return withBackNavigation(
      <>
        <CustomLobbyScreen
          code={lobbyCode}
          role={lobbyRole}
          state={lobbyState}
          profile={profile}
          factions={factions}
          loadout={loadout}
          message={lobbyMessage}
          onBack={() => leaveCurrentLobby("left")}
          onCodeChange={(code) => {
            const cleanCode = sanitizeLobbyCode(code);
            routeLobbyCodeRef.current = cleanCode;
            setLobbyCode(cleanCode);
            setLobbyState(cleanCode ? readLobbyState(cleanCode) : null);
          }}
          onJoin={joinCurrentLobby}
          onLoadout={updateLobbyPlayerLoadout}
          onReady={setLobbyReady}
          onCopy={() => {
            const link = `${window.location.origin}/lobby/${lobbyCode}`;
            navigator.clipboard?.writeText(link).catch(() => undefined);
            addNotification("Lobby link copied", link, "success");
          }}
        />
        {renderChallengeOverlay()}
      </>
    );
  }

  if (FEATURE_VIEWS[view]) {
    return withBackNavigation(<NexusFeatureScreen feature={FEATURE_VIEWS[view]} onNavigate={routeFromNexus} onHome={() => setView("nexus")} />);
  }

  if (view === "multiplayer") {
    if (!isAuthenticated) {
      return withBackNavigation(<GuestLockedScreen feature="Multiplayer" onHome={() => setView("nexus")} onLogin={() => setView("register")} />);
    }
    return withBackNavigation(
      <>
        <NexusMultiplayerScreen
          demoMode={demoMode}
          isAuthenticated={isAuthenticated}
          friendsData={friendsData}
          playerSearchResults={playerSearchResults}
          profile={profile}
          userId={activeUserId}
          leaderboard={leaderboard}
          leaderboardCity={leaderboardCity}
          onNavigate={routeFromNexus}
          onHome={() => setView("nexus")}
          onProfile={() => setView("settings")}
          onNotify={addNotification}
          onStartRoom={startMultiplayerRoom}
          onHostLobby={openHostedLobby}
          onJoinLobby={openJoinLobby}
          onSearchPlayers={searchCommanders}
          onRequestFriend={requestFriend}
          onOpenPublicProfile={openPublicProfile}
          onInviteFriend={sendChallengeToFriend}
          onRespondRequest={respondToFriendRequest}
          onLeaderboardCity={setLeaderboardCity}
        />
        {publicProfile && <PublicProfileModal profile={publicProfile} onClose={() => setPublicProfile(null)} onInvite={(target) => sendChallengeToFriend(target)} />}
        {renderChallengeOverlay()}
      </>
    );
  }

  if (view === "versus-intro") {
    if (!isAuthenticated) {
      return withBackNavigation(<GuestLockedScreen feature="Versus Intel" onHome={() => setView("nexus")} onLogin={() => setView("register")} />);
    }
    return withBackNavigation(<VersusIntro matchup={versusMatchup || createVersusMatchup(profile, null, multiplayerRole, multiplayerRoom?.room_code, loadout, factions)} onSkip={() => setView("game")} />);
  }

  if (view === "postmatch") {
    return withBackNavigation(<PostMatchSummary profile={profile} report={matchReport} isVictory={postMatchVictory} onHome={() => setView("nexus")} onSettings={() => setView(isAuthenticated ? "settings" : "register")} onVault={() => { setDemoGuideStep("vault"); setView("vault"); }} onPowerSkirmish={() => { setPendingMatchSetup(null); setView("skirmish-config"); }} onRetryMoment={() => setEconomyMessage("Retry Moment is ready below the coach report. Step through the replay and try the better move.")} onRematch={() => {
      const stats = normalizeMatchReport(matchReport, DEFAULT_MATCH_REPORT);
      if (stats.gameMode === "campaign" && stats.campaignLevelId) {
        const level = campaign?.levels?.find((item) => item.id === stats.campaignLevelId) || campaignLevel;
        setDemoGuideStep("match");
        startMatch("campaign", level);
      } else {
        startMatch("ai", campaignLevel, { variant: isAuthenticated ? gameVariant : "classic" });
      }
      setView("game");
    }} onNextCampaignLevel={goToNextCampaignLevel} onShare={() => { shareMatchRecap(matchReport, profile); addNotification("Recap copied", "Shareable match recap copied to clipboard.", "success"); }} />);
  }

  if (view === "game" && !isAuthenticated && mode !== "ai") {
    return withBackNavigation(<GuestLockedScreen feature="That match mode" onHome={() => setView("nexus")} onLogin={() => setView("register")} />);
  }

  if (view === "game" && ["ai", "campaign", "puzzle", "multiplayer"].includes(mode)) {
    return withBackNavigation(
      <>
        <BattlefieldMatch
          aiLevel={aiLevel}
          aiProfileId={aiProfileId}
          blockedSquares={blockedSquares}
          board={board}
          campaignLevel={campaignLevel}
          campaignTutorialPrompt={activeTutorialPrompt}
          campaignTutorialTargets={campaignTutorialTargets}
          abilityFlags={abilityFlags}
          abilityFeedback={abilityFeedback}
          counts={counts}
          cosmetics={matchCosmetics}
          gameVariant={gameVariant}
          legalMoves={legalMoves}
          markedPiece={markedPiece}
          message={message}
          mode={mode}
          opponentProfile={versusMatchup?.opponent}
          activeEmotes={activeMatchEmotes}
          boardViewMode={boardViewMode}
          chatMessages={matchChatMessages}
          emotes={availableMatchEmotes(equippedCosmetics, inventoryItems)}
          playerProfile={profile}
          pieceColors={pieceColors}
          tacticalHint={tacticalHint}
          multiplayerRole={multiplayerRole}
          multiplayerStatus={multiplayerStatus}
          momentum={momentum}
          moveLog={moveLog}
          onArmPower={armPower}
          onForfeit={forfeitMultiplayerMatch}
          onHome={() => {
            if (mode === "multiplayer" && !winner) {
              forfeitMultiplayerMatch();
              setView("multiplayer");
              return;
            }
            setView("nexus");
          }}
          onReport={() => openPostMatch(isLocalWinner(winner))}
          onReset={() => startMatch(mode, campaignLevel, { variant: gameVariant, aiLevel, aiProfileId })}
          onSendChat={sendMatchChat}
          onSendEmote={sendMatchEmote}
          onSquare={handleSquare}
          passive={passive}
          passiveTargets={passiveTargets}
          powerMode={powerMode}
          powerTargets={powerTargets}
          protectedSquares={protectedSquares}
          resultText={resultText}
          review={review}
          selected={selected}
          turn={turn}
          ultimate={ultimate}
          ultimateUsed={ultimateUsed}
          winner={winner}
        />
        {renderChallengeOverlay()}
      </>
    );
  }

  return (
    <main className="app">
      <aside className="panel left-panel">
        <div>
          <p className="eyebrow">nFactorial startup prototype</p>
          <h1>Dama Sprint</h1>
          <p className="muted">Fast checkers duels with AI sparring, faction loadouts, and comeback campaign puzzles.</p>
          <button className="nexus-back" onClick={() => setView("nexus")}>Nexus Core</button>
        </div>

        <section className="section">
          <div className="section-title"><span>Player</span><span>{profile.city}</span></div>
          <div className="form-grid">
            <input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
            <select value={profile.city} onChange={(event) => setProfile({ ...profile, city: event.target.value })}>
              {["Almaty", "Astana", "Shymkent", "Aktobe", "Karaganda", "Global"].map((city) => <option key={city}>{city}</option>)}
            </select>
          </div>
          <button className="secondary" onClick={() => saveJson("dama-profile", profile)}>Save profile</button>
        </section>

        <section className="section">
          <div className="section-title"><span>Mode</span><span>{MODE_LABELS[mode]}</span></div>
          <div className="segmented">
            {Object.keys(MODE_LABELS).map((item) => (
              <button key={item} className={mode === item ? "active" : ""} onClick={() => startMatch(item)}>{MODE_LABELS[item]}</button>
            ))}
          </div>
          <div className="form-grid">
            <select value={aiLevel} onChange={(event) => setAiLevel(event.target.value)} disabled={!["ai", "campaign", "puzzle"].includes(mode)}>
              {Object.keys(AI_LABELS).map((item) => <option key={item} value={item}>{AI_LABELS[item]}</option>)}
            </select>
            <button className="primary" onClick={() => startMatch(mode, campaignLevel)}>New match</button>
          </div>
        </section>

        {gameVariant === "classic" && mode === "ai" ? (
          <section className="section faction-section">
            <div className="section-title"><span>Classic rules</span><span>No abilities</span></div>
            <p className="muted">This skirmish disables passives, ultimates, and momentum so the match is decided only by standard checkers tactics.</p>
          </section>
        ) : (
          <FactionLoadout
            factions={factions}
            faction={faction}
            passive={passive}
            ultimate={ultimate}
            loadout={loadout}
            locked={mode === "campaign"}
            onFaction={selectFaction}
            onPassive={(passiveId) => setLoadout({ ...loadout, passiveId })}
            onUltimate={(ultimateId) => setLoadout({ ...loadout, ultimateId })}
          />
        )}

        <div className="summary-grid">
          <Summary label="Turn" value={turn === "white" ? "Azure" : "Amber"} />
          <Summary label="Move" value={String(Math.floor(moveLog.length / 2) + 1)} />
          <Summary label={gameVariant === "classic" && mode === "ai" ? "Rules" : "Power"} value={gameVariant === "classic" && mode === "ai" ? "Classic" : String(momentum)} />
        </div>
        <div className="actions">
          <button className="primary" onClick={armPower} disabled={(gameVariant === "classic" && mode === "ai") || turn !== getLocalPlayerColor(mode, multiplayerRole) || winner}>{gameVariant === "classic" && mode === "ai" ? "No abilities" : (powerMode ? "Cancel" : ultimate?.name)}</button>
          <button onClick={() => startMatch(mode, campaignLevel)}>Reset</button>
        </div>
      </aside>

      {mode === "multiplayer" ? (
        <section className="game multiplayer-stage">
          <MultiplayerOperations userId={activeUserId} leaderboard={leaderboard} onNotify={addNotification} />
        </section>
      ) : (
        <>
          <section className="game">
            <div className="status">
              <strong>{message}</strong>
              {winner && <span>{resultText}</span>}
              {winner && winner !== "campaign" && <button className="status-report" onClick={() => openPostMatch(isLocalWinner(winner))}>View Report</button>}
            </div>
            <Board board={board} selected={selected} legalMoves={legalMoves} powerTargets={powerTargets} blockedSquares={blockedSquares} protectedSquares={protectedSquares} markedPiece={markedPiece} cosmetics={matchCosmetics} pieceColors={pieceColors} boardPerspective={getLocalPlayerColor(mode, multiplayerRole)} onSquare={handleSquare} />
          </section>

          <aside className="panel right-panel">
            <section className="section campaign">
              <div className="section-title">
                <span>Faction trials</span>
                <span>{campaignProgress.completed_levels.length}/{campaign?.levels.length || 0}</span>
              </div>
              <p className="muted">{campaignLevel?.hook}</p>
              <div className="campaign-levels">
                {campaign?.levels.map((level) => (
                  <button
                    key={level.id}
                    className={`${level.id === campaignLevel?.id ? "active" : ""} ${campaignProgress.completed_levels.includes(level.id) ? "completed" : ""}`}
                    onClick={() => {
                      setCampaignLevelId(level.id);
                      startMatch("campaign", level);
                    }}
                  >
                    {level.number}
                  </button>
                ))}
              </div>
              <p className="objective">{campaignLevel?.objective}</p>
              <p className="hint">{campaignLevel?.hint}</p>
            </section>

            <section className="section">
              <div className="section-title"><span>Pieces</span><span>Live</span></div>
              <Meter label="Azure" value={counts.white} color="azure" />
              <Meter label="Amber" value={counts.black} color="amber" />
            </section>

            <section className="section">
              <div className="section-title"><span>Coach review</span><span>{review.length}</span></div>
              <ul className="plain-list">
                {(review.length ? review : ["Coach review appears as key moments happen."]).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
              </ul>
            </section>

            <section className="section">
              <div className="section-title"><span>City leaderboard</span><span>{profile.city}</span></div>
              <ol className="leaderboard">
                {leaderboard.map((row) => <li key={row.id}><span>{row.name}</span><strong>{score(row)}</strong></li>)}
              </ol>
            </section>

            <section className="section">
              <div className="section-title"><span>Move history</span><span>{moveLog.length}</span></div>
              <ol className="plain-list">
                {moveLog.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
              </ol>
            </section>
          </aside>
        </>
      )}
    </main>
  );
}

function AdminDashboard({ profile, factions = [], inventoryItems = [], vaultItems = [], matchHistory = [], onHome, onVault, onLoadout, onCodex, onProgression, onPlayAi }) {
  const unlockedCount = profile.unlocked_factions?.length || 0;
  const abilityCount = factions.reduce((sum, faction) => sum + (faction.passives?.length || 0) + (faction.ultimates?.length || 0), 0);
  const equipped = inventoryItems.filter((item) => item.is_equipped).length;
  const recent = matchHistory.slice(0, 4);
  return (
    <main className="admin-dashboard">
      <header className="admin-dashboard-topbar">
        <div>
          <small>Internal Demo Route / Admin Control</small>
          <h1>Admin Dashboard</h1>
          <p>Inspect every major system with all factions, currencies, abilities, and cosmetics unlocked.</p>
        </div>
        <button onClick={onHome}>Nexus Core</button>
      </header>

      <section className="admin-stats-grid">
        <article><span>Commander</span><strong>{profile.username}</strong><small>Level {profile.level} // Admin</small></article>
        <article><span>Currencies</span><strong>{profile.shards.toLocaleString()} S</strong><small>{profile.essence.toLocaleString()} Essence</small></article>
        <article><span>Factions</span><strong>{unlockedCount}/{factions.length || 4}</strong><small>All campaign checks bypassed</small></article>
        <article><span>Inventory</span><strong>{inventoryItems.length}/{vaultItems.length}</strong><small>{equipped} equipped previews</small></article>
      </section>

      <section className="admin-actions-grid">
        <button onClick={onPlayAi}><strong>Launch Boss AI</strong><span>Start a Power Checkers test match.</span></button>
        <button onClick={onLoadout}><strong>Tactical Loadout</strong><span>Validate every faction ability.</span></button>
        <button onClick={onVault}><strong>Vault QA</strong><span>Inspect cosmetics and premium previews.</span></button>
        <button onClick={onCodex}><strong>Abilities Codex</strong><span>Review art, lore, and unlock states.</span></button>
        <button onClick={onProgression}><strong>Progression Tree</strong><span>Check rewards and achievements.</span></button>
      </section>

      <section className="admin-dashboard-panels">
        <article>
          <h2>Unlocked Factions</h2>
          <ul>
            {factions.map((faction) => (
              <li key={faction.id}><span>{faction.crest || faction.name.slice(0, 1)}</span><div><strong>{faction.name}</strong><small>{profile.unlocked_factions?.includes(faction.id) ? "Unlocked" : "Locked"}</small></div></li>
            ))}
          </ul>
        </article>
        <article>
          <h2>System Snapshot</h2>
          <dl>
            <div><dt>Abilities available</dt><dd>{abilityCount}</dd></div>
            <div><dt>Saved matches</dt><dd>{matchHistory.length}</dd></div>
            <div><dt>Achievements claimed</dt><dd>{profile.achievements_claimed?.length || 0}</dd></div>
            <div><dt>Loadouts</dt><dd>{profile.saved_loadouts?.length || 0}</dd></div>
          </dl>
        </article>
        <article>
          <h2>Recent Match Reports</h2>
          {recent.length ? recent.map((match, index) => <p key={match.match_id || index}>{match.result || "report"} // {match.opponent || match.opponent_ai_level || "AI"} // {match.turns || match.turns_count || 0} turns</p>) : <p>No saved reports yet.</p>}
        </article>
      </section>
    </main>
  );
}

function NexusGatewayRegistration({ profile, error, isBusy = false, showAdminDemo = false, onSubmit, onBack, onAdminAccess }) {
  const [handle, setHandle] = useState(profile.name === "Player" ? "" : profile.name);
  const [email, setEmail] = useState(profile.email || "");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [authMode, setAuthMode] = useState("register");

  function submitRegistration(event) {
    event.preventDefault();
    const username = handle || "VALKYRIE_01";
    if (!isBusy) {
      onSubmit({ mode: authMode, username, email, password });
    }
  }

  return (
    <main className="nexus-gateway">
      <section className="gateway-card" aria-label="Nexus Gateway registration">
        <header className="gateway-header">
          <h1>Aether-<span>Tactics</span></h1>
          <p>Nexus Gateway // Enlistment Protocol 7.2</p>
        </header>

        <form className="gateway-form" onSubmit={submitRegistration}>
          <div className="gateway-tabs" role="tablist" aria-label="Gateway mode">
            <button type="button" className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")} disabled={isBusy}>Create</button>
            <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")} disabled={isBusy}>Login</button>
          </div>
          <label>
            <span>Operator Handle</span>
            <div className="gateway-input">
              <GatewayIcon name="user" />
              <input value={handle} onChange={(event) => setHandle(event.target.value)} placeholder="VALKYRIE_01" autoComplete="username" disabled={isBusy} />
            </div>
          </label>

          <label>
            <span>Aether ID (Email)</span>
            <div className="gateway-input">
              <GatewayIcon name="mail" />
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="commander@nexus.io" autoComplete="email" disabled={isBusy} />
            </div>
          </label>

          <label>
            <span>Decryption Key (Password)</span>
            <div className="gateway-input">
              <GatewayIcon name="key" />
              <input type={reveal ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="************" autoComplete="new-password" disabled={isBusy} />
              <button type="button" onClick={() => setReveal((value) => !value)} aria-label={reveal ? "Hide password" : "Reveal password"} disabled={isBusy}><GatewayIcon name="eye" /></button>
            </div>
          </label>

          {error && <p className="gateway-error">{error}</p>}
          <button className="gateway-submit" type="submit" disabled={isBusy}>{isBusy ? (authMode === "login" ? "Accessing Nexus..." : "Creating Commander...") : (authMode === "login" ? "Access Nexus" : "Create Commander")}</button>
          {showAdminDemo && <button className="gateway-admin" type="button" onClick={onAdminAccess} disabled={isBusy}>Admin Demo Access</button>}
          <button className="gateway-login" type="button" onClick={onBack} disabled={isBusy}>{"<"} Back to Nexus</button>
        </form>

        <footer className="gateway-footer">
          <span>Sector 7 Recruitment Division</span>
          <span><GatewayIcon name="shield" />Security Protocol</span>
        </footer>
      </section>
    </main>
  );
}

function NexusCoreMenu({ demoMode, isAuthenticated, profile, factions = [], loadout = DEFAULT_LOADOUT, campaignProgress = DEFAULT_CAMPAIGN_PROGRESS, connectionHealth = {}, demoGuideStep = "nexus", notifications, notificationsOpen, recentMatches, friendsData, playerSearchResults = [], onLogout, onNavigate, onStartDemo, onNotifications, onPro, onMatchSummary, onProfile, onOpenProfile, onSearchPlayers, onRequestFriend, onLogin }) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [friendsCollapsed, setFriendsCollapsed] = useState(() => localStorage.getItem("dama-nexus-social-collapsed") === "true");
  const [friendQuery, setFriendQuery] = useState("");
  const matches = isAuthenticated && recentMatches.length ? recentMatches.slice(0, 2) : [];
  const latestMatch = matches[0] || null;
  const quests = normalizeQuests(profile.active_quests);
  const friends = isAuthenticated ? normalizeFriendsData(friendsData).friends.slice(0, 3) : [];
  const searchResults = isAuthenticated ? playerSearchResults.slice(0, 3) : [];
  const streaks = normalizeStreaks(profile.streaks);
  const nowPlaying = musicTrackTitle(profile.settings?.musicTrack);
  const liveState = demoMode ? "Demo" : connectionHealth.api === "online" && connectionHealth.database === "online" ? "Live" : "Syncing";
  useEffect(() => {
    localStorage.setItem("dama-nexus-social-collapsed", friendsCollapsed ? "true" : "false");
  }, [friendsCollapsed]);
  function selectProfileAction(action) {
    setProfileMenuOpen(false);
    action?.();
  }
  function updateFriendSearch(value) {
    setFriendQuery(value);
    onSearchPlayers?.(value);
  }
  return (
    <main className={`nexus-core ${friendsCollapsed ? "social-collapsed" : ""}`}>
      <header className="nexus-topbar">
        <div className="nexus-logo"><span>AT</span><strong>Nexus Core</strong></div>
        <div className="nexus-currencies">
          {isAuthenticated ? (
            <>
              <span><b>E</b>{profile.essence}</span>
              <span><b>S</b>{profile.shards}</span>
              {profile.is_admin && <span className="admin-pill">Admin</span>}
              <span className={liveState === "Live" ? "live-pill" : "demo-pill"}>{liveState} Mode</span>
            </>
          ) : <span className="guest-pill">Guest AI Trial</span>}
        </div>
        <div className="nexus-actions">
          {isAuthenticated ? (
            <>
              <button aria-label="Notifications" onClick={onNotifications}>!{notifications.length > 0 && <i>{notifications.length}</i>}</button>
              <button className="pro-chip" onClick={onPro}>PRO</button>
              <div className="profile-menu">
                <button className="nexus-avatar profile-menu-trigger" aria-label="Open profile menu" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((open) => !open)}>
                  <ProfileAvatarWithBadge profile={profile} badge={equippedBadgeForProfile(profile)} />
                </button>
                {profileMenuOpen && (
                  <aside className="profile-menu-panel">
                    <header>
                      <span className="profile-menu-identity">
                        <ProfileAvatarWithBadge profile={profile} badge={equippedBadgeForProfile(profile)} />
                        <b>
                          <strong>{profile.username || "Commander"}</strong>
                          <span>Level {profile.level} // {profile.city || "Global"}</span>
                        </b>
                      </span>
                    </header>
                    {profile.is_admin && <button onClick={() => selectProfileAction(() => onNavigate("admin-dashboard"))}>Admin Dashboard</button>}
                    <button onClick={() => selectProfileAction(onProfile)}>Profile Settings</button>
                    <button onClick={() => selectProfileAction(() => onNavigate("progression"))}>Statistics</button>
                    <button onClick={() => selectProfileAction(() => latestMatch && onMatchSummary(latestMatch))} disabled={!latestMatch}>Review Previous Matches</button>
                    <button className="profile-menu-logout" onClick={() => selectProfileAction(onLogout)}>Logout</button>
                  </aside>
                )}
              </div>
            </>
          ) : (
            <button className="guest-auth-button" onClick={onLogin}>Login / Register</button>
          )}
        </div>
        {isAuthenticated && notificationsOpen && (
          <aside className="notifications-panel">
            <h3>Nexus Feed</h3>
            {notifications.length === 0 && <p>No notifications yet.</p>}
            {notifications.map((item) => (
              <article key={item.id} className={`notice-${item.tone || "info"}`}>
                <strong>{item.title}</strong>
                <span>{item.body}</span>
              </article>
            ))}
          </aside>
        )}
      </header>

      <section className="nexus-menu">
        <p>A strategic void experience</p>
        <h2>Nexus Core</h2>
        <section className="nexus-product-loop">
          <div>
            <span>{demoGuideStep === "nexus" ? "nFactorial judge demo" : `Demo step: ${demoGuideStep}`}</span>
            <strong>Build loadout. Win match. Review mistakes. Claim rewards.</strong>
          </div>
          <div>
            <button className="demo-start-button" onClick={onStartDemo}>Start Demo</button>
            <button onClick={() => onNavigate("skirmish")}>Start Skirmish</button>
            <button onClick={() => onNavigate("loadout")}>Tune Loadout</button>
            <button onClick={() => onNavigate("battle-pass")}>Claim Rewards</button>
          </div>
        </section>
        <nav className="nexus-router" aria-label="Core navigation">
          {NEXUS_ROUTES.map((route) => (
            <div key={route.id} className={`nexus-route-group ${route.children ? "has-subroutes" : ""}`}>
              <button className={`nexus-route ${route.id} ${!isAuthenticated && AUTH_REQUIRED_ROUTES.has(route.id) ? "locked" : ""}`} onClick={() => onNavigate(route.id)}>
                <span className="nexus-iconbox"><NexusMenuIcon name={route.icon} /></span>
                <strong>{route.label}</strong>
                <small>{!isAuthenticated && AUTH_REQUIRED_ROUTES.has(route.id) ? "Login required" : route.subtext}</small>
              </button>
              {route.children && (
                <div className="nexus-subroutes">
                  {route.children.map((child) => (
                    <button key={child.id} className={`nexus-subroute ${child.id} ${!isAuthenticated && AUTH_REQUIRED_ROUTES.has(child.id) ? "locked" : ""}`} onClick={() => onNavigate(child.id)}>
                      <span><NexusMenuIcon name={child.icon} /></span>
                      <strong>{child.label}</strong>
                      <small>{!isAuthenticated && AUTH_REQUIRED_ROUTES.has(child.id) ? "Login required" : child.subtext}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        {isAuthenticated && <FactionMasteryBlock profile={profile} factions={factions} loadout={loadout} matchHistory={recentMatches} campaignProgress={campaignProgress} onNavigate={onNavigate} />}
      </section>

      <aside className="nexus-social">
        <section className={`nexus-friends-section ${friendsCollapsed ? "is-collapsed" : ""}`}>
          <div className="nexus-side-title">
            <span>Friends & Recent Sessions</span>
            <div>
              <b>{isAuthenticated ? `${friends.length} active` : "Locked"}</b>
              <button type="button" aria-expanded={!friendsCollapsed} onClick={() => setFriendsCollapsed((collapsed) => !collapsed)}>{friendsCollapsed ? "Open" : "Hide"}</button>
            </div>
          </div>
          {friendsCollapsed ? (
            <div className="friends-collapsed-pill"><strong>Social minimized</strong><span>{isAuthenticated ? "Open to search, invite, or inspect profiles." : "Login to unlock social tools."}</span></div>
          ) : isAuthenticated ? (
            <>
            <div className="nexus-friend-search">
              <input value={friendQuery} onChange={(event) => updateFriendSearch(event.target.value)} placeholder="Search ID or nickname" />
              {searchResults.length > 0 && (
                <div>
                  {searchResults.map((player) => (
                    <article key={player.user_id}>
                      <button onClick={() => onOpenProfile?.(player)}>{player.username}<small>{shortPlayerId(player.user_id)}</small></button>
                      <button onClick={() => onRequestFriend?.(player)}>Add</button>
                    </article>
                  ))}
                </div>
              )}
            </div>
            <ul className="nexus-friends">
              {friends.map((friend) => (
                <li key={friend.user_id || friend.name} onClick={() => onOpenProfile?.(friend)}>
                  <span>{friend.avatar}</span>
                  <div><strong>{friend.username || friend.name}</strong><small>{friend.favorite_faction || friend.faction || friend.presence}</small></div>
                  <i />
                </li>
              ))}
              {friends.length === 0 && <li className="nexus-empty-social"><div><strong>No friends yet</strong><small>Search by nickname or ID to add commanders.</small></div></li>}
            </ul>
            </>
          ) : <div className="guest-lock-panel"><strong>Social locked</strong><span>Login to add friends, inspect profiles, and invite players.</span></div>}
        </section>
        <section>
          <div className="nexus-side-title"><span>Recent Matches</span></div>
          {isAuthenticated ? (
            <ul className="nexus-matches">
              {matches.map((match, index) => {
                const result = (match.result || (match.isVictory ? "win" : "loss")).toUpperCase();
                return (
                <li key={match.match_id || match.created_at || match.opponent || index}>
                  <span>vs {match.opponent || match.opponent_ai_level || "AI"}</span>
                  <button className={result.toLowerCase()} onClick={() => onMatchSummary(match)}>{result}</button>
                </li>
                );
              })}
              {matches.length === 0 && <li><span>No saved matches yet</span><button>NEW</button></li>}
            </ul>
          ) : <div className="guest-lock-panel"><strong>History locked</strong><span>Guest AI trials are not saved.</span></div>}
        </section>
        <section>
          <div className="nexus-side-title"><span>Daily Missions</span><b>{quests.filter((quest) => quest.is_completed).length}/{quests.length}</b></div>
          {isAuthenticated && quests.length > 0 ? (
            <>
              <div className="nexus-streaks">
                <span>Login {streaks.loginDays}d</span>
                <span>Puzzle {streaks.dailyPuzzle}</span>
                <span>Wins {streaks.dailyWin}</span>
              </div>
              <ul className="nexus-quests">
                {quests.map((quest) => {
                  const pct = Math.min(100, Math.round((quest.progress_count / quest.target_count) * 100));
                  return (
                    <li key={quest.quest_id}>
                      <div><strong>{quest.title}</strong><small>+{quest.reward_shards} Shards</small></div>
                      <i><b style={{ width: `${pct}%` }} /></i>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : <div className="guest-lock-panel"><strong>{isAuthenticated ? "No active missions" : "Missions locked"}</strong><span>{isAuthenticated ? "Daily quests can be assigned later from the backend." : "Login to activate quests, streaks, and rewards."}</span></div>}
        </section>
      </aside>

      <footer className="nexus-footer">
        <span><i />EU servers: stable</span>
        <span>Season 4: 12 days left</span>
        <div className="music-player">
          <b>Now playing</b>
          <strong>{nowPlaying}</strong>
          <div className="waveform"><i /><i /><i /><i /><i /></div>
        </div>
      </footer>
    </main>
  );
}

function ProfileSettingsScreen({ profile, factions, message, connectionHealth = {}, isSaving = false, onSave, onHome, onVault, onTestSound, onTestVoice }) {
  const [draft, setDraft] = useState(profile);
  const [tab, setTab] = useState("profile");
  const nextExp = expRequiredForLevel(draft.level);
  const progress = Math.min(100, Math.round((draft.current_exp / nextExp) * 100));
  const unlocked = factions.filter((faction) => draft.unlocked_factions?.includes(faction.id));
  const settings = normalizeSettings(draft.settings);
  const earnedBadges = earnedBadgeCosmetics(draft);
  const equippedBadge = equippedBadgeForProfile(draft);

  useEffect(() => {
    setDraft(profile);
  }, [profile]);

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateSettings(key, value) {
    setDraft((current) => ({ ...current, settings: normalizeSettings({ ...current.settings, [key]: value }) }));
  }

  function equipBadge(badgeId) {
    const nextDraft = normalizeProfile({ ...draft, equipped_badge: badgeId });
    setDraft(nextDraft);
    onSave?.(nextDraft);
  }

  return (
    <main className="profile-screen">
      <header className="profile-topbar">
        <button onClick={onHome} disabled={isSaving}>{"<"}</button>
        <div>
          <small>Aether-Tactics / Commander Console</small>
          <h1>Profile & Settings</h1>
        </div>
        <button onClick={onVault} disabled={isSaving}>Open Vault</button>
      </header>

      <nav className="profile-tabs" aria-label="Profile settings">
        {["profile", "audio", "gameplay", "account"].map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}
      </nav>

      <section className="profile-layout">
        <article className="profile-card primary">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar">{draft.profile_picture_url ? <img src={draft.profile_picture_url} alt="" /> : <span>{(draft.username || draft.name || "P").slice(0, 2).toUpperCase()}</span>}</div>
            {equippedBadge && <ProfileBadgeIcon badge={equippedBadge} />}
          </div>
          {tab === "profile" && (
            <div>
              <label>Operator Handle<input value={draft.username || draft.name} onChange={(event) => updateDraft("username", event.target.value)} /></label>
              <label>City<select value={draft.city} onChange={(event) => updateDraft("city", event.target.value)}>{["Almaty", "Astana", "Shymkent", "Aktobe", "Karaganda", "Global"].map((city) => <option key={city}>{city}</option>)}</select></label>
              <label>Profile Image URL<input value={draft.profile_picture_url || ""} onChange={(event) => updateDraft("profile_picture_url", event.target.value)} placeholder="https://..." /></label>
              <label>Bio<textarea value={draft.bio || ""} onChange={(event) => updateDraft("bio", event.target.value)} maxLength={240} /></label>
              <section className="profile-badges-section">
                <div>
                  <h3>Badges</h3>
                  <span>{earnedBadges.length ? "Click a badge to equip it on your commander profile." : "Earn badges from achievements, events, and city leaderboards."}</span>
                </div>
                <div className="profile-badge-grid">
                  {earnedBadges.length === 0 && <p>No earned badges yet.</p>}
                  {earnedBadges.map((badge) => (
                    <button key={badge.cosmetic_id} type="button" className={badge.cosmetic_id === draft.equipped_badge ? "active" : ""} onClick={() => equipBadge(badge.cosmetic_id)} disabled={isSaving}>
                      <CosmeticPreview cosmetic={badge} compact />
                      <strong>{badge.name}</strong>
                      <small>{badge.rarity || "earned"}</small>
                    </button>
                  ))}
                  {draft.equipped_badge && (
                    <button type="button" className="clear-badge" onClick={() => equipBadge("")} disabled={isSaving}>
                      <span>No Badge</span>
                      <small>Hide badge overlay</small>
                    </button>
                  )}
                </div>
              </section>
              <button className="profile-save" onClick={() => onSave(draft)} disabled={isSaving}>{isSaving ? "Saving..." : "Save Commander Profile"}</button>
              <p>{message}</p>
            </div>
          )}
          {tab === "audio" && (
            <div className="settings-grid">
              <label>Main Menu Track<select value={settings.musicTrack} onChange={(event) => updateSettings("musicTrack", event.target.value)}>
                {MENU_MUSIC_TRACKS.map((track) => <option key={track.id} value={track.id}>{track.title}</option>)}
              </select></label>
              {[
                ["masterVolume", "Master Volume"],
                ["musicVolume", "Music Volume"],
                ["sfxVolume", "SFX Volume"],
                ["voiceVolume", "Voice Volume"],
              ].map(([key, label]) => (
                <label key={key}>{label}<input type="range" min="0" max="100" value={settings[key]} onChange={(event) => updateSettings(key, Number(event.target.value))} /><span>{settings[key]}%</span></label>
              ))}
              {[
                ["musicEnabled", "Music Enabled"],
                ["sfxEnabled", "SFX Enabled"],
                ["voiceEnabled", "Voice Enabled"],
              ].map(([key, label]) => (
                <label key={key} className="toggle-row">{label}<input type="checkbox" checked={settings[key]} onChange={(event) => updateSettings(key, event.target.checked)} /></label>
              ))}
              <div className="settings-actions">
                <button onClick={() => onTestSound?.("ultimate")} disabled={isSaving}>Test SFX</button>
                <button onClick={onTestVoice} disabled={isSaving}>Test Voice</button>
              </div>
              <button className="profile-save" onClick={() => onSave(draft)} disabled={isSaving}>{isSaving ? "Saving..." : "Save Audio Settings"}</button>
            </div>
          )}
          {tab === "gameplay" && (
            <div className="settings-grid">
              <label>Visual Theme<select value={settings.theme} onChange={(event) => updateSettings("theme", event.target.value)}>
                <option value="dark">Dark Nexus</option>
                <option value="light">Light Command</option>
              </select></label>
              <label className="toggle-row">Reduced Motion<input type="checkbox" checked={settings.reducedMotion} onChange={(event) => updateSettings("reducedMotion", event.target.checked)} /></label>
              <p>Theme and reduced motion apply globally across Nexus, match screens, campaign, and post-match reports.</p>
              <button className="profile-save" onClick={() => onSave(draft)} disabled={isSaving}>{isSaving ? "Saving..." : "Save Gameplay Settings"}</button>
            </div>
          )}
          {tab === "account" && (
            <div className="settings-grid">
              <p>Account identity is powered by Supabase Auth. Profile data, inventory, match history, and friends are owned by your authenticated commander id.</p>
              <section className="connection-health-panel">
                <h3>Connection Health</h3>
                {[
                  ["Backend API", connectionHealth.api || "checking"],
                  ["Supabase DB", connectionHealth.database || "checking"],
                  ["Auth Mode", connectionHealth.supabase || "checking"],
                  ["WebSocket", connectionHealth.websocket || "idle"],
                ].map(([label, value]) => (
                  <div key={label} className={String(value).toLowerCase().includes("online") || value === "configured" ? "online" : "offline"}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
                <small>{connectionHealth.apiUrl || "Local development URL"}</small>
              </section>
              <button className="profile-save" onClick={() => onSave(draft)} disabled={isSaving}>{isSaving ? "Saving..." : "Sync Account"}</button>
            </div>
          )}
        </article>

        <aside className="profile-card">
          <h2>Progression</h2>
          {draft.is_admin && <div className="admin-console-badge"><strong>Admin Commander</strong><span>All factions, abilities, rewards, and Vault checks are unlocked for testing.</span></div>}
          <div className="profile-level"><span>LVL {draft.level}</span><strong>{draft.current_exp}/{nextExp} EXP</strong><i><b style={{ width: `${progress}%` }} /></i></div>
          <div className="profile-currency"><span>Shards</span><strong>{draft.shards}</strong><span>Essence</span><strong>{draft.essence}</strong></div>
          <h3>Unlocked Factions</h3>
          <div className="unlock-list">
            {(unlocked.length ? unlocked : factions.slice(0, 1)).map((faction) => <span key={faction.id}>{faction.crest} {faction.name}</span>)}
          </div>
        </aside>
      </section>
    </main>
  );
}

function VaultScreen({ profile, factions, items, inventoryItems, message, busyItemId = "", onPurchase, onHome, onInventory }) {
  const owned = new Set(inventoryItems.map((item) => item.cosmetic_id));
  const factionNames = Object.fromEntries(factions.map((faction) => [faction.id, faction.name]));
  const featured = items
    .map(normalizeVaultItem)
    .filter((item) => item.kind === "piece_skin")
    .slice(0, 3);
  const proBanner = proArtFor("premium_vault_skins");

  return (
    <main className="vault-screen">
      <header className="profile-topbar">
        <button onClick={onHome}>{"<"}</button>
        <div>
          <small>Commerce Bay / Shard Market</small>
          <h1>The Vault</h1>
        </div>
        <button onClick={onInventory}>Inventory</button>
      </header>
      <section className="vault-status">
        <span>Available Shards</span><strong>{profile.shards}</strong><p>{message}</p>
      </section>
      <section className="vault-featured">
        <div className="vault-feature-copy">
          {proBanner && <img src={proBanner} alt="" loading="lazy" />}
          <CosmeticPreview cosmetic="vault_pro_bundle" compact />
          <span>Featured Rotation</span>
          <strong>Premium previews reset in 18:00</strong>
          <p>Aether Pro highlights premium skins, ranked identity, and coach upgrades without requiring real payments yet.</p>
        </div>
        {featured.map((item) => {
          const locked = item.target_faction_id && !profile.unlocked_factions.includes(item.target_faction_id);
          return (
            <article key={`featured-${item.cosmetic_id}`}>
              <CosmeticPreview cosmetic={item} compact />
              <small>{item.rarity}</small>
              <h2>{item.name}</h2>
              <p>{locked ? "Locked preview - unlock faction to purchase." : item.is_premium ? "Pro showcase item." : "Limited shard rotation."}</p>
            </article>
          );
        })}
      </section>
      <section className="vault-grid">
        {items.length === 0 && <article className="empty-product-state"><strong>Vault offline</strong><span>No items were returned. Check backend and Supabase seed data.</span></article>}
        {items.map((rawItem) => {
          const item = normalizeVaultItem(rawItem);
          const locked = item.target_faction_id && !profile.unlocked_factions.includes(item.target_faction_id);
          const isOwned = owned.has(item.cosmetic_id);
          const isBusy = busyItemId === item.cosmetic_id;
          return (
            <article key={item.cosmetic_id} className={`vault-item rarity-${item.rarity}`}>
              <CosmeticPreview cosmetic={item} />
              <small>{item.rarity} // {item.kind.replace("_", " ")}</small>
              <h2>{item.name}</h2>
              <p>{vaultItemDescription(item, factionNames, profile)}</p>
              <button onClick={() => onPurchase(item)} disabled={isBusy || isOwned}>
                {isBusy ? "Purchasing..." : isOwned ? (item.cosmetic_id === "void_order_campaign_pass" ? "Void Unlocked" : "Owned") : item.is_premium && !hasAetherPro(profile) ? "Preview Pro" : locked ? "Faction Locked" : item.cosmetic_id === "void_order_campaign_pass" ? `Unlock ${item.price_shards} Shards` : `${item.price_shards} Shards`}
              </button>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function InventoryScreen({ items, equippedCosmetics, boardPreferences = DEFAULT_BOARD_PREFERENCES, message, busyItemId = "", onEquip, onEquipBasicPiece, onHome, onVault, onPlay, onViewMode, onPieceColor, onSavePreferences }) {
  const preferences = normalizeBoardPreferences(boardPreferences);
  const pieceColors = preferences.pieceColors;
  const viewMode = preferences.viewMode;
  const [previewOverride, setPreviewOverride] = useState({});
  const previewBoard = useMemo(() => createInventoryPreviewBoard(), []);
  const sortedItems = [...items].sort((left, right) => {
    const leftKind = (left.cosmetics || left).kind || "";
    const rightKind = (right.cosmetics || right).kind || "";
    return leftKind.localeCompare(rightKind) || String((left.cosmetics || left).name || "").localeCompare(String((right.cosmetics || right).name || ""));
  });
  const boardItems = sortedItems.filter((item) => normalizeVaultItem(item.cosmetics || item).kind === "board_skin");
  const pieceItems = sortedItems.filter((item) => normalizeVaultItem(item.cosmetics || item).kind === "piece_skin");
  const extraItems = sortedItems.filter((item) => !["board_skin", "piece_skin"].includes(normalizeVaultItem(item.cosmetics || item).kind));
  const hasPreviewPiece = Object.prototype.hasOwnProperty.call(previewOverride, "piece");
  const hasPreviewBoard = Object.prototype.hasOwnProperty.call(previewOverride, "board");
  const candidatePiece = hasPreviewPiece ? previewOverride.piece : equippedCosmetics.piece;
  const candidateBoard = hasPreviewBoard ? previewOverride.board : equippedCosmetics.board;
  const visiblePieceSkin = candidatePiece && cosmeticCompatibleWithView(candidatePiece, viewMode) ? candidatePiece : null;
  const previewCosmetics = {
    ...equippedCosmetics,
    ...previewOverride,
    piece: visiblePieceSkin,
    board: candidateBoard || null,
    mode: "inventory",
    localPlayer: "white",
    remotePlayer: "black",
    byPlayer: { white: visiblePieceSkin, black: null },
  };
  const currentPieceMode = cosmeticRenderMode(equippedCosmetics.piece);
  const activePieceWarning = equippedCosmetics.piece && !cosmeticCompatibleWithView(equippedCosmetics.piece, viewMode)
    ? `${equippedCosmetics.piece.name} is a ${currentPieceMode.toUpperCase()} skin. Switch to ${currentPieceMode.toUpperCase()} view to use it in matches.`
    : "";
  const previewSlot = (slot, cosmetic) => setPreviewOverride((current) => ({ ...current, [slot]: cosmetic }));
  const renderCosmeticCard = (item, slot) => {
    const cosmetic = normalizeVaultItem(item.cosmetics || item);
    const isBasic = cosmetic.is_basic;
    const mode = cosmeticRenderMode(cosmetic);
    const compatible = cosmeticCompatibleWithView(cosmetic, viewMode);
    const isBusy = busyItemId === item.inventory_item_id;
    const isEquipped = isBasic ? !equippedCosmetics.piece : item.is_equipped || equippedCosmetics[slot]?.cosmetic_id === cosmetic.cosmetic_id;
    const modeLabel = mode === "both" ? "2D + 3D" : `${mode.toUpperCase()} only`;
    const equipLabel = isBusy ? "Equipping..." : isEquipped ? "Active" : compatible ? "Equip" : `Switch to ${mode.toUpperCase()}`;
    const handleEquip = () => {
      if (!compatible || isEquipped) return;
      if (isBasic) onEquipBasicPiece?.();
      else onEquip?.(item.inventory_item_id);
    };
    return (
      <article
        key={item.inventory_item_id}
        className={`inventory-cosmetic-card rarity-${cosmetic.rarity} ${isEquipped ? "is-equipped" : ""} ${compatible ? "" : "is-incompatible"}`}
        tabIndex={0}
        onMouseEnter={() => previewSlot(slot, isBasic ? null : cosmetic)}
        onFocus={() => previewSlot(slot, isBasic ? null : cosmetic)}
        onClick={() => previewSlot(slot, isBasic ? null : cosmetic)}
      >
        <CosmeticPreview cosmetic={cosmetic} />
        <div>
          <small>{cosmetic.kind.replace("_", " ")} // {cosmetic.rarity}</small>
          <h3>{cosmetic.name}</h3>
          <p>{isBasic ? "A clean disk set that can be recolored for your side and the AI side." : slot === "board" ? "Board skins are private: only your screen changes in multiplayer." : compatible ? "Opponents can see this piece skin when you use it online." : "This skin is hidden in the current renderer."}</p>
        </div>
        <span className={`compatibility-pill ${compatible ? "compatible" : "locked"}`}>{modeLabel}</span>
        <button type="button" onClick={(event) => { event.stopPropagation(); handleEquip(); }} disabled={isBusy || isEquipped || !compatible}>{equipLabel}</button>
      </article>
    );
  };
  return (
    <main className="vault-screen inventory-screen">
      <header className="profile-topbar">
        <button onClick={onHome}>{"<"}</button>
        <div>
          <small>Commander Vault / Match Appearance</small>
          <h1>Inventory Customizer</h1>
        </div>
        <button onClick={onVault}>Open Vault</button>
      </header>

      <section className="inventory-customizer">
        <article className="inventory-preview-stage">
          <div>
            <small>Live Match Preview</small>
            <h2>{previewCosmetics.board?.name || "Nexus Neon Board"}</h2>
            <p>{previewCosmetics.piece?.name || "Basic recolorable disks"} // {viewMode.toUpperCase()} renderer</p>
          </div>
          {viewMode === "3d" ? (
            <div className="inventory-three-preview">
              <Battlefield3DBoard board={previewBoard} selected={null} legalMoves={[]} powerTargets={[]} blockedSquares={[]} protectedSquares={[]} markedPiece={null} cosmetics={previewCosmetics} pieceColors={pieceColors} boardPerspective="white" onSquare={() => undefined} />
            </div>
          ) : (
            <SkinPreviewBoard cosmetics={previewCosmetics} pieceColors={pieceColors} viewMode={viewMode} />
          )}
          {activePieceWarning && <strong className="inventory-warning">{activePieceWarning}</strong>}
        </article>

        <aside className="inventory-controls-panel">
          <div>
            <span>Board Renderer</span>
            <div className="inventory-mode-toggle">
              <button className={viewMode === "3d" ? "active" : ""} onClick={() => onViewMode?.("3d")}>3D</button>
              <button className={viewMode === "2d" ? "active" : ""} onClick={() => onViewMode?.("2d")}>2D</button>
            </div>
            <p>Basic disks can be recolored. 3D models work only in 3D; premium SVG skins work only in 2D.</p>
          </div>
          <div className="inventory-color-grid">
            <PieceColorControl label="Your Basic Disks" player="white" value={pieceColors.white} option={paletteIdForColor(pieceColors.white)} onChange={onPieceColor} />
            <PieceColorControl label="AI Basic Disks" player="black" value={pieceColors.black} option={paletteIdForColor(pieceColors.black)} onChange={onPieceColor} />
          </div>
          <div className="inventory-equipped-pills">
            <span><b>Board</b>{equippedCosmetics.board?.name || "Default"}</span>
            <span><b>Pieces</b>{equippedCosmetics.piece?.name || "Color Default"}</span>
            <span><b>Mode</b>{viewMode.toUpperCase()}</span>
          </div>
          <button className="inventory-save-button" onClick={() => onSavePreferences?.(preferences)}>Save Match Look</button>
          <button className="secondary" onClick={onPlay}>Test vs AI</button>
          {message && <p className="inventory-message">{message}</p>}
        </aside>
      </section>

      <section className="inventory-library">
        {items.length === 0 && <article className="vault-item empty"><h2>No items owned yet</h2><p>Open the Vault and buy a cosmetic with Shards.</p></article>}
        <div className="inventory-section-title"><span>Board Skins</span><strong>Private in PvP</strong></div>
        <div className="inventory-card-grid">
          {boardItems.length ? boardItems.map((item) => renderCosmeticCard(item, "board")) : <article className="vault-item empty"><h2>No board skins</h2><p>Buy board skins in the Vault. They change only your local board, even in multiplayer.</p></article>}
        </div>
        <div className="inventory-section-title"><span>Disk Skins</span><strong>Visible to opponents</strong></div>
        <div className="inventory-card-grid">
          {[{ inventory_item_id: "basic-piece-skin", cosmetic_id: BASIC_PIECE_COSMETIC.cosmetic_id, is_equipped: !equippedCosmetics.piece, cosmetics: BASIC_PIECE_COSMETIC }, ...pieceItems].map((item) => renderCosmeticCard(item, "piece"))}
        </div>
        {extraItems.length > 0 && (
          <>
            <div className="inventory-section-title"><span>Badges And Emotes</span><strong>Identity layer</strong></div>
            <div className="inventory-card-grid">
              {extraItems.map((item) => {
                const cosmetic = normalizeVaultItem(item.cosmetics || item);
                const isBusy = busyItemId === item.inventory_item_id;
                return (
                  <article key={item.inventory_item_id} className={`inventory-cosmetic-card rarity-${cosmetic.rarity} ${item.is_equipped ? "is-equipped" : ""}`}>
                    <CosmeticPreview cosmetic={cosmetic} />
                    <div>
                      <small>{cosmetic.kind.replace("_", " ")} // {cosmetic.rarity}</small>
                      <h3>{cosmetic.name}</h3>
                      <p>{cosmetic.kind === "emote" ? (item.is_equipped ? "Pinned as your favorite emote; all owned emotes appear in the match wheel." : "Owned emotes appear in the match wheel. Equip to pin this one as your favorite.") : (item.is_equipped ? "Currently active on your commander identity." : "Equip this identity cosmetic.")}</p>
                    </div>
                    <button type="button" onClick={() => onEquip(item.inventory_item_id)} disabled={isBusy || item.is_equipped}>{isBusy ? "Equipping..." : item.is_equipped ? "Active" : "Equip"}</button>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function FactionMasteryBlock({ profile = DEFAULT_PROFILE, factions = [], loadout = DEFAULT_LOADOUT, matchHistory = [], campaignProgress = DEFAULT_CAMPAIGN_PROGRESS, onNavigate }) {
  const factionRows = (factions.length ? factions : ["nomads", "iron_guard", "sun_court", "void_order"].map(fallbackCampaignFaction)).slice(0, 4);
  const savedLoadouts = profile.saved_loadouts || [];
  return (
    <section className="faction-mastery-block">
      <div className="faction-mastery-head">
        <span>Faction Mastery</span>
        <button onClick={() => onNavigate?.("codex")}>Open Codex</button>
      </div>
      <div className="faction-mastery-grid">
        {factionRows.map((faction) => {
          const unlocked = profile.unlocked_factions?.includes(faction.id);
          const activeLoadout = savedLoadouts.find((item) => item.faction_id === faction.id) || (loadout.factionId === faction.id ? { faction_id: loadout.factionId, passive_id: loadout.passiveId, ultimate_id: loadout.ultimateId } : null);
          const factionMatches = matchHistory.filter((match) => (match.faction_id || match.factionId || "nomads") === faction.id);
          const wins = factionMatches.filter((match) => (match.result || "").toLowerCase() === "win").length;
          const stars = faction.id === "nomads" ? Number(campaignProgress.stars_earned || 0) : 0;
          const masteryXp = Math.min(100, wins * 20 + stars * 8 + (loadout.factionId === faction.id ? 10 : 0));
          const passiveName = abilityNameFromFaction(faction, activeLoadout?.passive_id, "Passive");
          const ultimateName = abilityNameFromFaction(faction, activeLoadout?.ultimate_id, "Ultimate");
          return (
            <article key={faction.id} className={`${unlocked ? "unlocked" : "locked"} ${loadout.factionId === faction.id ? "active" : ""}`}>
              <FactionImage faction={faction} compact />
              <div>
                <strong>{faction.name}</strong>
                <small>{unlocked ? `${wins} wins // ${stars} stars` : factionUnlockText(faction)}</small>
              </div>
              <i><b style={{ width: `${masteryXp}%` }} /></i>
              <p>{unlocked ? `${passiveName} + ${ultimateName}` : "Locked mastery path"}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ProgressionScreen({ focus = "progression", profile, factions, campaignProgress, matchHistory, inventoryItems, battlePass, busyAchievementId = "", onBack, onVault, onClaim, onPro }) {
  const nextExp = expRequiredForLevel(profile.level);
  const levelProgress = Math.min(100, Math.round((profile.current_exp / nextExp) * 100));
  const rewards = buildLevelRewards(factions);
  const achievements = buildAchievements({ profile, campaignProgress, matchHistory, inventoryItems });
  const battlePassState = normalizeBattlePassState(battlePass);
  const nextReward = rewards.find((reward) => reward.level > profile.level) || rewards[rewards.length - 1];
  const claimable = achievements.filter((achievement) => achievement.progress >= achievement.target && !achievement.claimed).length;
  const battlePassFocus = focus === "battle-pass";

  return (
    <main className={`progression-screen ${battlePassFocus ? "battle-pass-focused" : ""}`}>
      <header className="profile-topbar">
        <button onClick={onBack}>{"<"}</button>
        <div>
          <small>{battlePassFocus ? "Founder Season / Missions And Rewards" : "Commander Progression / Reward Track"}</small>
          <h1>{battlePassFocus ? "Battle Pass" : "Progression Tree"}</h1>
        </div>
        <button onClick={onVault}>Open Vault</button>
      </header>

      <section className="progression-hero">
        <article>
          <span>Current Level</span>
          <h2>Level {profile.level}</h2>
          <p>{profile.current_exp}/{nextExp} EXP until the next commander level.</p>
          <i><b style={{ width: `${levelProgress}%` }} /></i>
        </article>
        <article>
          <span>Next Major Unlock</span>
          <h2>{nextReward?.title}</h2>
          <p>Level {nextReward?.level}: {(nextReward?.rewards || []).join(", ")}</p>
        </article>
        <article>
          <span>Claimable</span>
          <h2>{claimable}</h2>
          <p>Achievements ready to convert into Shards, Essence, and EXP.</p>
        </article>
      </section>

      {battlePassFocus && <BattlePassDashboard battlePass={battlePassState} profile={profile} onPro={onPro} />}

      <section className="level-tree">
        <div className="progression-title"><span>Level Reward Tree</span><strong>{profile.unlocked_factions?.length || 1}/{factions.length || 4} factions unlocked</strong></div>
        <div className="level-track">
          {rewards.map((reward) => {
            const status = profile.level >= reward.level ? "unlocked" : reward.level === nextReward?.level ? "next" : "locked";
            const faction = factions.find((item) => item.id === reward.factionId);
            return (
              <article key={reward.level} className={`level-node ${status}`}>
                <span>LVL {reward.level}</span>
                <h3>{reward.title}</h3>
                <p>{faction ? `${faction.crest} ${faction.name}` : reward.type}</p>
                <ul>{reward.rewards.map((item) => <li key={item}>{item}</li>)}</ul>
                <b>{formatReward(reward)}</b>
              </article>
            );
          })}
        </div>
      </section>

      <section className="achievement-panel">
        <div className="progression-title"><span>Achievements</span><strong>{achievements.filter((item) => item.claimed).length}/{achievements.length} claimed</strong></div>
        <div className="achievement-grid">
          {achievements.map((achievement) => {
            const pct = Math.min(100, Math.round((achievement.progress / achievement.target) * 100));
            const ready = achievement.progress >= achievement.target && !achievement.claimed;
            const busy = busyAchievementId === achievement.id;
            const blocked = Boolean(busyAchievementId);
            const actionLabel = busy ? "Claiming..." : achievement.claimed ? "Claimed" : ready ? "Click to claim" : "Locked";
            return (
              <button
                key={achievement.id}
                type="button"
                className={`achievement-card ${achievement.claimed ? "claimed" : ready ? "ready" : ""}`}
                aria-disabled={!ready || blocked}
                aria-label={`${achievement.title}. ${actionLabel}. ${formatReward(achievement.reward)}`}
                onClick={() => {
                  if (ready && !blocked) {
                    onClaim(achievement);
                  }
                }}
              >
                <span>{achievement.claimed ? "Claimed" : ready ? "Ready" : "In Progress"}</span>
                <AchievementBadge achievement={achievement} />
                <h3>{achievement.title}</h3>
                <p>{achievement.description}</p>
                <i><b style={{ width: `${pct}%` }} /></i>
                <small>{Math.min(achievement.progress, achievement.target)}/{achievement.target} // {formatReward(achievement.reward)}</small>
                <strong className="achievement-action">{actionLabel}</strong>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function BattlePassDashboard({ battlePass, profile = DEFAULT_PROFILE, onPro }) {
  const state = normalizeBattlePassState(battlePass);
  const proActive = hasAetherPro(profile);
  const progress = getBattlePassProgressState(state);
  const totalXp = BATTLE_PASS_TIERS.at(-1)?.required_xp || 0;
  const unlockedSet = new Set(state.unlocked_tiers);
  const currentTier = BATTLE_PASS_TIERS.find((tier) => tier.tier === progress.currentTier);
  const nextTier = progress.nextTier;
  const completedMissions = state.missions.filter((mission) => mission.is_completed).length;
  const proLockedMissions = state.missions.filter((mission) => mission.pro_reward && mission.is_completed && !mission.xp_claimed).length;
  const obtainedRewards = state.unlocked_tiers.filter((tierId) => {
    const tier = BATTLE_PASS_TIERS.find((item) => item.tier === tierId);
    return tier && (!isBattlePassTierProReward(tier) || proActive);
  }).length;
  const grouped = ["daily", "weekly"].map((cadence) => ({
    cadence,
    missions: state.missions.filter((mission) => mission.cadence === cadence),
  }));
  const proTierCount = BATTLE_PASS_TIERS.filter(isBattlePassTierProReward).length;
  const freeTierCount = BATTLE_PASS_TIERS.length - proTierCount;
  return (
    <section className="battle-pass-panel battle-pass-dashboard">
      <div className="battle-pass-command">
        <article className="battle-pass-summary-card">
          <div>
            <span>{BATTLE_PASS_SEASON.name}</span>
            <h2>Tier {progress.currentTier}</h2>
            <p>{BATTLE_PASS_SEASON.tagline}</p>
          </div>
          <div className="battle-pass-main-meter">
            <i><b style={{ width: `${progress.percent}%` }} /></i>
            <small>{nextTier ? `${state.xp}/${nextTier.required_xp} BP XP to Tier ${nextTier.tier}` : `${state.xp}/${totalXp} BP XP // Season complete`}</small>
          </div>
        </article>
        <article className={`battle-pass-next-card ${nextTier && isBattlePassTierProReward(nextTier) ? "pro-tier" : ""}`} onClick={() => nextTier && isBattlePassTierProReward(nextTier) && onPro?.()} role={nextTier && isBattlePassTierProReward(nextTier) ? "button" : undefined} tabIndex={nextTier && isBattlePassTierProReward(nextTier) ? 0 : undefined}>
          <span>{nextTier ? "Next Obtainable Reward" : "Latest Obtained Reward"}</span>
          <div>
            {nextTier ? <BattlePassRewardVisual tier={nextTier} /> : currentTier ? <BattlePassRewardVisual tier={currentTier} /> : <b className="currency-reward">BP</b>}
            <section>
              <h3>{nextTier?.title || currentTier?.title || "Start The Pass"}</h3>
              <p>{nextTier ? formatReward(nextTier.reward) : currentTier ? formatReward(currentTier.reward) : "Complete a mission to start earning Founder rewards."}</p>
              <small>{nextTier ? `${Math.max(0, nextTier.required_xp - state.xp)} BP XP remaining` : "All unlocked rewards have been obtained."}</small>
            </section>
          </div>
        </article>
        <article className="battle-pass-stats-card">
          <span>Season Status</span>
          <dl>
            <div><dt>Rewards obtained</dt><dd>{obtainedRewards}/{BATTLE_PASS_TIERS.length}</dd></div>
            <div><dt>Missions complete</dt><dd>{completedMissions}/{state.missions.length}</dd></div>
            <div><dt>Pro rewards waiting</dt><dd>{proActive ? "0" : proLockedMissions}</dd></div>
            <div><dt>Total BP XP</dt><dd>{state.xp}/{totalXp}</dd></div>
          </dl>
        </article>
      </div>

      <div className="battle-pass-layout">
        <section className="battle-pass-track-section">
          <div className="progression-title"><span>Reward Track</span><strong>{BATTLE_PASS_TIERS.length} founder tiers</strong></div>
          <div className="battle-pass-lanes">
            <span><b>Free Track</b>{freeTierCount} currency and progression rewards</span>
            <span><b>Pro Track</b>{proTierCount} premium skin rewards</span>
          </div>
          <div className="battle-pass-track">
            {BATTLE_PASS_TIERS.map((tier) => {
              const unlocked = unlockedSet.has(tier.tier);
              const next = nextTier?.tier === tier.tier;
              const remaining = Math.max(0, tier.required_xp - state.xp);
              const proTier = isBattlePassTierProReward(tier);
              return (
                <button key={tier.tier} type="button" className={`battle-pass-tier ${unlocked ? "unlocked" : next ? "next" : "locked"} ${proTier ? "pro-tier" : ""}`} onClick={() => proTier && onPro?.()} disabled={!proTier}>
                  <div className="battle-pass-tier-top">
                    <span>Tier {tier.tier}</span>
                    <strong>{proTier && !proActive ? "Pro" : unlocked ? "Obtained" : next ? "Next" : `${remaining} XP`}</strong>
                  </div>
                  <BattlePassRewardVisual tier={tier} />
                  <h4>{tier.title}</h4>
                  <small>{formatReward(tier.reward)}</small>
                  <p>{proTier && !proActive ? "Aether Pro reward" : `${tier.required_xp} BP XP`}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="battle-pass-mission-section">
          <div className="progression-title"><span>How To Earn XP</span><strong>Rewards auto-claim when tiers unlock</strong></div>
          {grouped.map((group) => (
            <div key={group.cadence} className="battle-pass-mission-group">
              <h3>{group.cadence}</h3>
              <div className="battle-pass-missions">
                {group.missions.map((mission) => {
                  const pct = Math.min(100, Math.round((mission.progress_count / mission.target_count) * 100));
                  const proLocked = mission.pro_reward && mission.is_completed && !mission.xp_claimed && !proActive;
                  return (
                    <article key={mission.mission_id} className={`battle-pass-mission ${mission.is_completed ? "complete" : ""} ${mission.pro_reward ? "pro-mission" : ""}`}>
                      <div>
                        <span>{proLocked ? "Pro reward locked" : mission.is_completed ? "XP obtained" : `${mission.battle_pass_xp} BP XP`}</span>
                        <small>{Math.min(mission.progress_count, mission.target_count)}/{mission.target_count}</small>
                      </div>
                      <h4>{mission.title}</h4>
                      <p>{mission.description}</p>
                      <i><b style={{ width: `${pct}%` }} /></i>
                      {mission.pro_reward && <button type="button" onClick={onPro}>{proLocked ? "Unlock Reward With Pro" : proActive ? "Pro Active" : "Pro Mission"}</button>}
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      </div>
    </section>
  );
}

function BattlePassRewardVisual({ tier }) {
  const cosmeticId = rewardCosmeticIds(tier.reward)[0];
  if (cosmeticId) {
    const cosmetic = DEFAULT_VAULT_ITEMS.find((item) => item.cosmetic_id === cosmeticId) || { cosmetic_id: cosmeticId, kind: "piece_skin", name: rewardCosmeticLabel(cosmeticId), rarity: "battle-pass" };
    return <CosmeticPreview cosmetic={cosmetic} compact />;
  }
  return <b className="currency-reward">{tier.reward.shards ? "S" : tier.reward.essence ? "E" : "XP"}</b>;
}

function PostMatchSummary({ profile, report = DEFAULT_MATCH_REPORT, isVictory, onHome, onSettings, onRematch, onShare, onNextCampaignLevel, onVault, onPowerSkirmish, onRetryMoment }) {
  const resultClass = isVictory ? "victory" : "defeat";
  const stats = normalizeMatchReport(report, DEFAULT_MATCH_REPORT);
  const isCampaignVictory = stats.gameMode === "campaign" && stats.result === "win";
  const nextExp = stats.nextExp || expRequiredForLevel(profile.level);
  const progress = Math.min(100, Math.round(((stats.factionExp ?? profile.current_exp) / nextExp) * 100));
  const opponentProfile = stats.aiProfileId || stats.opponent_ai_level || stats.difficulty || stats.opponent;
  const nextActions = stats.nextActions?.length ? stats.nextActions : isCampaignVictory ? ["Next Level", "Open Vault"] : isVictory ? ["Try Power Skirmish", "Open Vault"] : ["Retry Moment", "Rematch"];
  return (
    <main className={`postmatch ${resultClass}`}>
      <header className="nexus-topbar">
        <div className="nexus-logo"><span>AT</span><strong>Aether-Tactics</strong></div>
        <div className="nexus-currencies">
          <span><b>E</b>{profile.essence}</span>
          <span><b>S</b>{profile.shards}</span>
        </div>
        <div className="nexus-actions">
          <button onClick={onHome}>NC</button>
          <button aria-label="Settings" onClick={onSettings}>ST</button>
          <button className="nexus-avatar" aria-label="Profile" onClick={onSettings}>{(profile.username || "P").slice(0, 1)}</button>
        </div>
      </header>
      <section className="postmatch-body">
        <div className="postmatch-hero">
          <h2>{isVictory ? "Tactical Victory" : "Tactical Defeat"}</h2>
          <p>{isVictory ? "Target eliminated" : "Objectives failed - squad eliminated"}</p>
        </div>
        <div className="postmatch-cards">
          <article>
            <h3>Combat Stats</h3>
            <dl>
              <div><dt>Pieces captured</dt><dd>{stats.captured}</dd></div>
              <div><dt>Pieces lost</dt><dd>{stats.lost}</dd></div>
              <div><dt>Turns taken</dt><dd>{stats.turns}</dd></div>
            </dl>
          </article>
          <article>
            <h3>Economy</h3>
            <dl>
              <div><dt>Shards gained</dt><dd>+{stats.shards}</dd></div>
              <div><dt>Essence bonus</dt><dd>+{stats.essence}</dd></div>
              <div><dt>EXP gained</dt><dd>+{stats.exp}</dd></div>
            </dl>
          </article>
          <article>
            <h3>Match Report</h3>
            <AiPortrait difficulty={opponentProfile} className="postmatch-opponent" />
            <dl>
              <div><dt>Opponent</dt><dd>{stats.opponent}</dd></div>
              <div><dt>Difficulty</dt><dd>{stats.difficulty}</dd></div>
              <div><dt>ELO change</dt><dd>{stats.elo > 0 ? `+${stats.elo}` : stats.elo}</dd></div>
            </dl>
          </article>
        </div>
        <section className="postmatch-loop">
          <article>
            <span>Best Move</span>
            <strong>{stats.bestMove || "The decisive move is ready in the replay timeline."}</strong>
          </article>
          <article>
            <span>Coach Focus</span>
            <strong>{stats.mistake || "No major mistake found. Improve speed, safety, and center control next."}</strong>
          </article>
          <article>
            <span>Ability Impact</span>
            <strong>{stats.abilityImpact || "Faction powers should create a concrete tactic: capture, safety, promotion, or board control."}</strong>
          </article>
          <aside>
            <span>Next Action</span>
            <strong>{nextActions.join(" / ")}</strong>
          </aside>
        </section>
        <section className="coach-summary">
          <h3>AI Coach Review</h3>
          {(stats.review || []).slice(0, 4).map((line) => <p key={line}>{line}</p>)}
        </section>
        {isCampaignVictory && (
          <section className="campaign-clear-report">
            <div>
              <span>Campaign Sector Cleared</span>
              <h3>{stats.campaignLevelName || stats.difficulty}</h3>
              <p>{stats.campaignObjective || "Ability lesson completed and campaign progress saved."}</p>
            </div>
            <dl>
              <div><dt>Stars earned</dt><dd>{stats.campaignStars || 3}/5</dd></div>
              <div><dt>Abilities used</dt><dd>{countAbilityUses(stats.replay)}</dd></div>
              <div><dt>Next sector</dt><dd>{stats.campaignNextLevelName || "Campaign map"}</dd></div>
            </dl>
          </section>
        )}
        <MatchReplayViewer report={stats} />
        {stats.retryMoment && (
          <RetryMomentTrainer moment={stats.retryMoment} />
        )}
        <footer className="codex-progress">
          <div>
            <span>Faction XP</span>
            <strong>{`Level ${stats.factionLevel || profile.level} Commander`}</strong>
            <b>{stats.factionExp ?? profile.current_exp} / {nextExp} XP</b>
          </div>
          <i><em style={{ width: `${progress}%` }} /></i>
          <aside>
            <small>Next unlock</small>
            <strong>{stats.nextUnlock}</strong>
          </aside>
        </footer>
        <div className="postmatch-actions">
          <button onClick={onRematch}>{isCampaignVictory ? "Replay Level" : "Rematch"}</button>
          <button onClick={onShare}>Share Recap</button>
          {!isVictory && stats.retryMoment && <button onClick={onRetryMoment}>Retry Moment</button>}
          {isCampaignVictory && <button onClick={onNextCampaignLevel}>{stats.campaignNextLevelId ? "Next Level" : "Campaign Map"}</button>}
          {!isCampaignVictory && isVictory && <button onClick={onPowerSkirmish}>Try Power Skirmish</button>}
          {!isCampaignVictory && isVictory && <button onClick={onVault}>Open Vault</button>}
          {!isCampaignVictory && !isVictory && <button onClick={onHome}>Regroup at Nexus</button>}
        </div>
      </section>
    </main>
  );
}

function MatchReplayViewer({ report }) {
  const stats = normalizeMatchReport(report, DEFAULT_MATCH_REPORT);
  const frames = stats.replayFrames?.length ? stats.replayFrames : buildReplayFrames(stats.replay, stats.finalBoard);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [coachLines, setCoachLines] = useState(["Pause or step through the timeline to request tactical feedback for the exact board state."]);
  const [coachStatus, setCoachStatus] = useState("Ready");
  const [coachNonce, setCoachNonce] = useState(0);
  const coachCacheRef = useRef({});
  const frame = frames[Math.min(index, Math.max(0, frames.length - 1))] || createReplayFrame(createInitialBoard(), null, 0);
  const lastMove = frame.move || null;
  const selectedSquare = lastMove?.from ? coordToSquare(lastMove.from) : null;
  const legalHighlights = lastMove?.to ? [{ to: coordToSquare(lastMove.to), captured: Boolean(lastMove.captured) }] : [];

  useEffect(() => {
    setIndex(0);
    setPlaying(false);
    setCoachLines(["Pause or step through the timeline to request tactical feedback for the exact board state."]);
    setCoachStatus("Ready");
    coachCacheRef.current = {};
  }, [stats.match_id, stats.created_at, stats.replay?.length]);

  useEffect(() => {
    if (!playing || frames.length <= 1) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setIndex((current) => {
        if (current >= frames.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 850);
    return () => window.clearInterval(timer);
  }, [playing, frames.length]);

  useEffect(() => {
    if (playing || !frames.length) {
      return;
    }
    const key = `${stats.match_id || stats.created_at || "local"}-${index}`;
    if (coachCacheRef.current[key]) {
      setCoachLines(coachCacheRef.current[key]);
      setCoachStatus("Cached analysis");
      return;
    }
    let cancelled = false;
    setCoachStatus("Analyzing move...");
    analyzeCoach(buildReplayCoachPayload(stats, frame, index))
      .then((analysis) => {
        if (cancelled) {
          return;
        }
        const lines = normalizeReplayCoachLines(analysis, frame, stats);
        coachCacheRef.current[key] = lines;
        setCoachLines(lines);
        setCoachStatus("Coach synced");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        const lines = fallbackReplayCoach(frame, stats);
        coachCacheRef.current[key] = lines;
        setCoachLines(lines);
        setCoachStatus("Local coach fallback");
      });
    return () => {
      cancelled = true;
    };
  }, [index, playing, coachNonce, frames.length, stats.match_id, stats.created_at]);

  function stepTo(nextIndex) {
    setPlaying(false);
    setIndex(Math.max(0, Math.min(frames.length - 1, nextIndex)));
    setCoachNonce((value) => value + 1);
  }

  if (!frames.length) {
    return (
      <section className="match-replay-panel empty">
        <h3>Match Replay</h3>
        <p>No replay states were saved for this match yet. Future completed matches will store move-by-move board states.</p>
      </section>
    );
  }

  return (
    <section className="match-replay-panel">
      <header>
        <div>
          <span>Match Recap Replay</span>
          <h3>{lastMove ? `${lastMove.actor || lastMove.player || "Move"}: ${lastMove.from}-${lastMove.to}` : "Initial Board"}</h3>
          <p>{frame.label}</p>
        </div>
        <strong>{index}/{frames.length - 1}</strong>
      </header>
      <div className="match-replay-grid">
        <div className="match-replay-board battle-live-board view-2d">
          <Board
            board={frame.board}
            selected={selectedSquare}
            legalMoves={legalHighlights}
            powerTargets={[]}
            blockedSquares={[]}
            protectedSquares={[]}
            markedPiece={null}
            cosmetics={{}}
            pieceColors={DEFAULT_PIECE_COLORS}
            onSquare={() => undefined}
          />
        </div>
        <aside className="match-replay-coach">
          <span>Integrated AI Coach</span>
          <h4>{coachStatus}</h4>
          {coachLines.map((line) => <p key={line}>{line}</p>)}
        </aside>
      </div>
      <footer className="match-replay-controls">
        <button onClick={() => stepTo(index - 1)} disabled={index <= 0}>Previous Move</button>
        {playing ? (
          <button onClick={() => { setPlaying(false); setCoachNonce((value) => value + 1); }}>Pause</button>
        ) : (
          <button onClick={() => setPlaying(true)} disabled={index >= frames.length - 1}>Play</button>
        )}
        <button onClick={() => stepTo(index + 1)} disabled={index >= frames.length - 1}>Next Move</button>
        <input
          type="range"
          min="0"
          max={Math.max(0, frames.length - 1)}
          value={index}
          onChange={(event) => stepTo(Number(event.target.value))}
          aria-label="Replay timeline"
        />
      </footer>
    </section>
  );
}

function RetryMomentTrainer({ moment }) {
  const board = Array.isArray(moment.board) ? moment.board : [];
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(moment.betterHint || "Select an Azure piece, then try the better move.");
  const expected = moment.expected || "safe";
  const legalMoves = selected ? getLegalMoves(board, "white").filter((move) => move.from.row === selected.row && move.from.col === selected.col) : [];

  function chooseSquare(row, col) {
    if (!board.length) {
      return;
    }
    if (selected) {
      const move = legalMoves.find((candidate) => candidate.to.row === row && candidate.to.col === col);
      if (move) {
        const preview = applyMove(board, move);
        const replyCaptures = getLegalMoves(preview.board, "black").filter((candidate) => candidate.captured).length;
        const movingPiece = board[move.from.row]?.[move.from.col];
        const chained = move.captured ? getLegalMoves(preview.board, "white", { forcedFrom: move.to }).filter((candidate) => candidate.captured).length : 0;
        setFeedback(getRetryFeedback({ expected, move, preview, replyCaptures, chained, movingPiece }));
        setSelected(null);
        return;
      }
    }
    const piece = board[row]?.[col];
    if (piece?.player === "white") {
      setSelected({ row, col });
      setFeedback(`${squareName({ row, col })} selected. Choose a highlighted landing square.`);
      return;
    }
    setSelected(null);
    setFeedback("Select one of your Azure pieces to replay the moment.");
  }

  return (
    <section className="retry-moment interactive">
      <span>Retry Moment</span>
      <div className="retry-head">
        <AbilityIcon ability={{ id: moment.focusAbilityId || "phase_shift", icon: "RM" }} />
        <div>
          <h3>{moment.title}</h3>
          <p>{moment.prompt}</p>
          {moment.tacticalTip && <small>{moment.tacticalTip}</small>}
        </div>
      </div>
      {board.length > 0 && (
        <div className="retry-board" aria-label="Retry moment board">
          {board.flatMap((row, rowIndex) =>
            row.map((piece, colIndex) => {
              const highlighted = legalMoves.some((move) => move.to.row === rowIndex && move.to.col === colIndex);
              const active = selected?.row === rowIndex && selected?.col === colIndex;
              return (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  className={`${isDarkSquare(rowIndex, colIndex) ? "dark" : "light"} ${highlighted ? "hint" : ""} ${active ? "selected" : ""}`}
                  onClick={() => chooseSquare(rowIndex, colIndex)}
                >
                  {piece && <i className={piece.player}>{piece.king ? "K" : ""}</i>}
                </button>
              );
            }),
          )}
        </div>
      )}
      <small>{feedback}</small>
    </section>
  );
}

function getRetryFeedback({ expected, move, preview, replyCaptures, chained, movingPiece }) {
  if (expected === "capture") {
    if (!move.captured) {
      return "Still missing the tactic: this retry must start with a capture. Look for the enemy piece with an empty square behind it.";
    }
    return chained > 0 ? "Better: you found the first jump. Keep the same piece moving to complete the chain." : "Better: you found the forcing capture and won material immediately.";
  }
  if (expected === "chain") {
    if (!move.captured) {
      return "Still not the chain: the answer must be a jump with the same tactical piece.";
    }
    return chained > 0 ? "Good start: another capture is still available, so continue the multi-jump." : "Better: that capture removes the key defender and finishes the forcing sequence.";
  }
  if (expected === "king_activity") {
    const movedPiece = preview.board[move.to.row]?.[move.to.col];
    const longDiagonal = Math.abs(move.to.row - move.from.row) > 1;
    if (movingPiece?.king || movedPiece?.king || longDiagonal) {
      return replyCaptures ? "Promising king activity, but still check the reply capture before committing." : "Better: the king or promotion controls a long diagonal and keeps escape squares open.";
    }
    return "Try again with the king idea: look for promotion or a long diagonal move that pressures more than one lane.";
  }
  if (expected === "center") {
    if (isCenterSquareForCoach(move.to.row, move.to.col) && replyCaptures === 0) {
      return "Better: this improves center control without giving Amber an immediate jump.";
    }
    return replyCaptures ? "Still unsafe: the AI gets a capture reply. Choose a protected center or connected diagonal." : "Stable, but look for a move that claims d4, e4, d5, or e5 for stronger pressure.";
  }
  return replyCaptures ? "Still unsafe: the AI gets a capture reply. Try a landing protected by another Azure piece." : "Better: this keeps the position stable and denies the immediate counter-jump.";
}

function ProUpgradeModal({ onClose, onInterest, isBusy = false, message = "" }) {
  const proBanners = [
    ["premium_vault_skins", "Premium Vault skins"],
    ["unlimited_ai_coach", "Unlimited AI Coach reviews"],
    ["ranked_identity_badges", "Ranked city duel badge"],
  ];
  return (
    <div className="pro-modal-backdrop" onClick={onClose}>
      <article className="pro-modal" onClick={(event) => event.stopPropagation()}>
        <span>Commercial offer preview</span>
        <h2>Upgrade to Aether Pro</h2>
        <p>Unlock the Void Order faction path, premium 3D skins, Pro Battle Pass rewards, unlimited AI Coach reviews, ranked identity badges, and advanced sparring profiles.</p>
        <div className="pro-banners">
          {proBanners.map(([key, label]) => <img key={key} src={proArtFor(key)} alt={label} loading="lazy" />)}
        </div>
        <div className="pro-benefits">
          {["Void Order archive + Phase Shift loadouts", "Premium 3D and 2D identity skins", "Pro-only Battle Pass missions and rewards", "Unlimited Coach Review + Retry Moments", "Ranked city identity badges"].map((item) => <strong key={item}>{item}</strong>)}
        </div>
        {message && <p className="pro-interest-message">{message}</p>}
        <button onClick={() => onInterest?.("pro_modal", "aether_pro_founder")} disabled={isBusy}>{isBusy ? "Saving..." : "Request Early Access"}</button>
        <button className="pro-secondary" onClick={onClose}>Keep Exploring</button>
      </article>
    </div>
  );
}

function OnboardingModal({ factions, profile, onClose, onStart, onPro }) {
  const [city, setCity] = useState(profile.city || "Almaty");
  const [factionId, setFactionId] = useState("nomads");
  const [stepIndex, setStepIndex] = useState(0);
  const faction = factions.find((item) => item.id === factionId) || factions[0];
  const setupStepIndex = ONBOARDING_TUTORIAL_STEPS.length;
  const totalSteps = setupStepIndex + 1;
  const isSetupStep = stepIndex === setupStepIndex;
  const lesson = ONBOARDING_TUTORIAL_STEPS[stepIndex];
  const factionChoices = (factions.length ? factions : [{ id: "nomads", name: "Nomads", crest: "N", passives: [], ultimates: [] }]).slice(0, 4);

  function buildStarterPatch() {
    const passiveId = faction?.passives?.[0]?.id || "open_roads";
    const ultimateId = faction?.ultimates?.[0]?.id || "dash";
    return {
      city,
      favorite_faction: factionId,
      unlocked_factions: [...new Set(["nomads", factionId])],
      unlocked_abilities: [...new Set(["open_roads", "dash", passiveId, ultimateId])],
      saved_loadouts: [{
        name: "Starter",
        faction_id: factionId,
        passive_id: passiveId,
        ultimate_id: ultimateId,
        is_active: true,
      }],
    };
  }

  return (
    <div className="pro-modal-backdrop" onClick={onClose}>
      <article className="onboarding-modal" onClick={(event) => event.stopPropagation()}>
        <header className="onboarding-header">
          <span>Commander Bootcamp</span>
          <h2>{isSetupStep ? "Choose Your First Test" : lesson.title}</h2>
          <p>{isSetupStep ? "Save your city and starter faction, then jump into a safe test match or open the guided campaign path." : lesson.copy}</p>
        </header>
        <nav className="onboarding-stepper" aria-label="Bootcamp progress">
          {Array.from({ length: totalSteps }).map((_, index) => (
            <button key={index} type="button" className={stepIndex === index ? "active" : ""} onClick={() => setStepIndex(index)}>
              <span>{index + 1}</span>
            </button>
          ))}
        </nav>
        {isSetupStep ? (
          <section className="onboarding-setup">
            <label>City<select value={city} onChange={(event) => setCity(event.target.value)}>{["Almaty", "Astana", "Shymkent", "Aktobe", "Karaganda", "Global"].map((item) => <option key={item}>{item}</option>)}</select></label>
            <div className="onboarding-factions">
              {factionChoices.map((item) => (
                <button key={item.id} type="button" className={factionId === item.id ? "active" : ""} onClick={() => item.id === "void_order" && !profile.unlocked_factions?.includes("void_order") ? onPro?.() : setFactionId(item.id)}>
                  <FactionImage faction={item} compact />
                  <strong>{item.name}</strong>
                  {item.id === "void_order" && !profile.unlocked_factions?.includes("void_order") && <small>Pro</small>}
                </button>
              ))}
            </div>
            <small>{faction?.lore || "Mobile comeback faction with tempo powers."}</small>
          </section>
        ) : (
          <section className="onboarding-lesson">
            <span>{lesson.label}</span>
            <div className="onboarding-lesson-grid">
              {lesson.points.map((point, index) => (
                <article key={point}>
                  <strong>{String(index + 1).padStart(2, "0")}</strong>
                  <p>{point}</p>
                </article>
              ))}
            </div>
          </section>
        )}
        <footer>
          {stepIndex > 0 && <button type="button" className="onboarding-secondary" onClick={() => setStepIndex((value) => Math.max(0, value - 1))}>Back</button>}
          {isSetupStep ? (
            <>
              <button type="button" className="onboarding-primary" onClick={() => onStart(buildStarterPatch(), "training")}>Start Training Match</button>
              <button type="button" className="onboarding-secondary" onClick={() => onStart(buildStarterPatch(), "campaign")}>Open Campaign Path</button>
            </>
          ) : (
            <button type="button" className="onboarding-primary" onClick={() => setStepIndex((value) => Math.min(setupStepIndex, value + 1))}>Next</button>
          )}
          <button type="button" className="onboarding-secondary" onClick={onClose}>Skip</button>
        </footer>
      </article>
    </div>
  );
}

function PublicProfileModal({ profile, onClose, onInvite }) {
  const stats = profile.pvp_stats || {};
  return (
    <div className="pro-modal-backdrop" onClick={onClose}>
      <article className="public-profile-modal" onClick={(event) => event.stopPropagation()}>
        <header>
          <span className="public-avatar">{profile.profile_picture_url ? <img src={profile.profile_picture_url} alt="" /> : profile.avatar}</span>
          <div>
            <small>{profile.city} // {profile.threat} profile</small>
            <h2>{profile.username}</h2>
            <p>{profile.bio || "No public bio yet."}</p>
          </div>
        </header>
        <section>
          <div><span>ELO</span><strong>{stats.mmr_elo_rating || 1000}</strong></div>
          <div><span>Wins</span><strong>{stats.wins || 0}</strong></div>
          <div><span>Streak</span><strong>{stats.current_win_streak || 0}</strong></div>
          <div><span>Faction</span><strong>{profile.favorite_faction || "nomads"}</strong></div>
        </section>
        <footer>
          <button onClick={() => { onInvite(profile); onClose(); }}>Duel</button>
          <button onClick={onClose}>Close Intel</button>
        </footer>
      </article>
    </div>
  );
}

function DuelChallengeModal({ challenge, onAccept, onDecline }) {
  const challenger = normalizePublicProfile(challenge?.from_profile || {});
  return (
    <div className="pro-modal-backdrop duel-challenge-backdrop">
      <article className="duel-challenge-modal" onClick={(event) => event.stopPropagation()}>
        <header>
          <span className="public-avatar">{challenger.profile_picture_url ? <img src={challenger.profile_picture_url} alt="" /> : challenger.avatar}</span>
          <div>
            <small>Direct Duel Challenge</small>
            <h2>{challenger.username} has challenged you to a duel!</h2>
            <p>{challenger.city} // ELO {challenger.pvp_stats?.mmr_elo_rating || 1000} // {challenger.threat}</p>
          </div>
        </header>
        <footer>
          <button onClick={onDecline}>Decline</button>
          <button onClick={onAccept}>Accept Duel</button>
        </footer>
      </article>
    </div>
  );
}

function DuelWaitingToast({ challenge, status, onCancel }) {
  const target = normalizePublicProfile(challenge?.target_profile || {});
  return (
    <aside className="duel-waiting-toast" role="status">
      <span>Waiting for response...</span>
      <strong>{target.username}</strong>
      <p>{status || "Challenge sent. You will enter the lobby only if they accept."}</p>
      <button onClick={onCancel}>Cancel</button>
    </aside>
  );
}

function VersusIntro({ matchup, onSkip }) {
  useEffect(() => {
    const timer = window.setTimeout(onSkip, 2600);
    return () => window.clearTimeout(timer);
  }, [onSkip]);
  const left = matchup?.player || {};
  const right = matchup?.opponent || {};
  return (
    <main className="versus-intro">
      <section className="versus-card player">
        <FactionImage faction={left.favorite_faction || "nomads"} fallback={left.avatar} />
        <small>{left.city} // {left.favorite_faction}</small>
        <h2>{left.username}</h2>
        <p>{left.bio}</p>
        <b>ELO {left.pvp_stats?.mmr_elo_rating || 1000}</b>
      </section>
      <div className="versus-core">
        <strong>VS</strong>
        <small>Room {matchup?.roomCode || "PRIVATE"}</small>
        <button onClick={onSkip}>Deploy Now</button>
      </div>
      <section className="versus-card opponent">
        <FactionImage faction={right.favorite_faction || "void_order"} fallback={right.avatar} />
        <small>{right.city} // Threat: {right.threat}</small>
        <h2>{right.username}</h2>
        <p>{right.bio}</p>
        <b>ELO {right.pvp_stats?.mmr_elo_rating || 1000}</b>
      </section>
    </main>
  );
}

function CampaignFactionSelect({ profile, factions = [], progress, onBack, onNomads, onIron, onSun, onVoid, onProgression, onVault }) {
  const completed = new Set(progress.completed_levels || []);
  const factionList = ["nomads", "iron_guard", "sun_court", "void_order"].map((id) => factions.find((faction) => faction.id === id) || fallbackCampaignFaction(id));
  const ironUnlocked = profile.unlocked_factions?.includes("iron_guard");
  const sunUnlocked = profile.unlocked_factions?.includes("sun_court");
  const statusById = {
    nomads: {
      state: "available",
      label: "Available now",
      title: "The Comeback Trail",
      copy: "Start with the free Nomads campaign: outnumbered positions, escape routes, Dash lessons, and Sandstorm board control.",
      action: "Enter Nomads Campaign",
      onClick: onNomads,
    },
    iron_guard: {
      state: ironUnlocked ? "available" : "locked",
      label: ironUnlocked ? "Available now" : "Progression locked",
      title: "Iron Bastion Trials",
      copy: ironUnlocked
        ? "A strict Fortify tutorial: stop an incoming multi-jump, force the rival AI to reroute, then win the live Iron Guard duel."
        : "A defensive campaign about center control and protected pieces. Unlock Iron Guard through the level tree.",
      action: ironUnlocked ? "Enter Iron Campaign" : "View Level Tree",
      onClick: ironUnlocked ? onIron : onProgression,
    },
    sun_court: {
      state: sunUnlocked ? "available" : "locked",
      label: sunUnlocked ? "Available now" : "Progression locked",
      title: "Solar Crownline",
      copy: sunUnlocked
        ? "A strict Crown Surge tutorial: turn d4 into a king, wait for the rival AI to open one square, then launch a long Solar Leap capture."
        : "A promotion-race campaign built around kings, royal pressure, and fast crown conversions. Unlock Sun Court through the level tree.",
      action: sunUnlocked ? "Enter Sun Campaign" : "View Level Tree",
      onClick: sunUnlocked ? onSun : onProgression,
    },
    void_order: {
      state: profile.unlocked_factions?.includes("void_order") ? "premium owned" : "premium",
      label: profile.unlocked_factions?.includes("void_order") ? "Vault pass owned" : "Vault exclusive",
      title: "Void Order Archive",
      copy: profile.unlocked_factions?.includes("void_order")
        ? "Void access is unlocked. The full premium archive can be expanded after the Nomads campaign foundation."
        : "A premium faction path with phase shifts, lane denial, and collapse puzzles. Upgrade to Aether Pro to preview the Void archive.",
      action: profile.unlocked_factions?.includes("void_order") ? "Start Void Trial" : "Open Pro Preview",
      onClick: profile.unlocked_factions?.includes("void_order") ? onVoid : onVault,
    },
  };
  return (
    <main className="campaign-select-screen">
      <header className="campaign-select-header">
        <button onClick={onBack}>{"<"}</button>
        <div>
          <small>Single Player / Faction Campaigns</small>
          <h1>Choose Campaign Path</h1>
          <p>Nomads are free to play. Future factions create a clear progression loop, while Void is positioned as a premium Vault unlock.</p>
        </div>
      </header>
      <section className="campaign-select-grid">
        {factionList.map((faction) => {
          const meta = statusById[faction.id] || statusById.nomads;
          const artId = faction.id === "nomads" ? "nomad_comeback" : faction.id === "iron_guard" ? "iron_trial" : faction.id === "sun_court" ? "sun_trial" : "void_trial";
          return (
            <article key={faction.id} className={`campaign-path-card ${meta.state.replace(/\s+/g, "-")}`}>
              <div className="campaign-path-art">
                <img src={campaignArtFor(artId)} alt="" loading="lazy" />
                <FactionImage faction={faction} compact />
              </div>
              <span>{meta.label}</span>
              <h2>{faction.name}</h2>
              <h3>{meta.title}</h3>
              <p>{meta.copy}</p>
              <div className="campaign-path-stats">
                <b>{faction.id === "nomads" ? `${completed.size}/${withFactionCampaign(null, "nomads").levels.length} sectors` : faction.id === "iron_guard" ? `${withFactionCampaign(null, "iron_guard").levels.length} Guard missions` : faction.id === "sun_court" ? `${withFactionCampaign(null, "sun_court").levels.length} Court missions` : faction.id === "void_order" ? `${withFactionCampaign(null, "void_order").levels.length} Pro archive missions` : "Coming soon"}</b>
                <small>{faction.id === "void_order" ? "900 Shards" : faction.id === "nomads" ? "Free starter path" : faction.id === "iron_guard" ? (ironUnlocked ? "Unlocked faction path" : "Requires Level 2") : faction.id === "sun_court" ? (sunUnlocked ? "Unlocked faction path" : "Requires Level 4") : "Not playable yet"}</small>
              </div>
              <button onClick={meta.onClick}>{meta.action}</button>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function CampaignMap({ campaign, progress, focusLevelId = "", musicTitle = musicTrackTitle(DEFAULT_SETTINGS.musicTrack), onBack, onStart }) {
  const [activeNode, setActiveNode] = useState(null);
  const levels = campaign?.levels || [];
  const completed = new Set(progress.completed_levels || []);
  const currentLevelId = progress.current_level_id || levels.find((level) => !completed.has(level.id))?.id || levels[0]?.id;
  const baseNodes = buildCampaignMapNodes(levels);
  const nodes = baseNodes.map((node, index) => {
    const level = levels[node.levelIndex] || levels[index] || {};
    const isCompleted = completed.has(level.id);
    const isCurrent = level.id === currentLevelId || (!completed.has(level.id) && index === completed.size);
    return {
      ...node,
      id: level.id || node.id,
      level,
      title: level.name || node.title,
      description: level.objective ? `${level.hook} Objective: ${level.objective}` : node.description,
      showcase: level.showcase || CAMPAIGN_SHOWCASES[level.id] || null,
      levelIndex: levels.findIndex((item) => item.id === level.id) >= 0 ? levels.findIndex((item) => item.id === level.id) : node.levelIndex,
      state: isCompleted ? "completed" : isCurrent ? "current" : "locked",
      stars: isCompleted ? (progress.best_clear_turns?.[`${level.id}_stars`] || 3) : isCurrent ? 0 : 0,
    };
  });
  const pathPoints = nodes.map((node) => `${node.x},${node.y}`).join(" ");
  const completedCount = completed.size;
  const totalStars = Math.max(progress.stars_earned || 0, nodes.reduce((sum, node) => sum + (node.state === "completed" ? node.stars : 0), 0));
  const progressPct = levels.length ? Math.round((completedCount / levels.length) * 100) : 0;

  useEffect(() => {
    if (!focusLevelId) {
      return;
    }
    const focused = nodes.find((node) => node.id === focusLevelId);
    if (focused && focused.state !== "locked") {
      setActiveNode(focused);
    }
  }, [focusLevelId, progress.current_level_id, progress.completed_levels?.length]);

  function openNode(node) {
    if (node.state === "locked") {
      return;
    }
    setActiveNode(node);
  }

  function renderStars(count) {
    return (
      <span className="campaign-stars" aria-label={`${count} of 5 stars`}>
        {Array.from({ length: 5 }, (_, index) => <i key={index} className={index < count ? "filled" : ""} />)}
      </span>
    );
  }

  return (
    <main className="campaign-map">
      <header className="campaign-map-header">
        <div className="campaign-title-row">
          <button className="campaign-back" onClick={onBack} aria-label="Back to Nexus">{"<"}</button>
          <div>
            <h1>{campaign?.name || "Shattered Realms"}</h1>
            <p>{campaign?.description || "Global Campaign Progress"} - {progressPct}% Captured</p>
          </div>
        </div>
        <aside className="campaign-stats">
          <div><span>Completed</span><strong>{completedCount}</strong></div>
          <div><span>Stars Earned</span><strong><i className="campaign-star-icon" />{totalStars}/{Math.max(1, levels.length * 5)}</strong></div>
        </aside>
      </header>

      <section className="realm-map" aria-label="Shattered Realms campaign sectors">
        <svg className="realm-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={pathPoints} />
        </svg>
        {nodes.map((node) => (
          <button
            key={node.id}
            className={`realm-node ${node.state}`}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            onClick={() => openNode(node)}
            disabled={node.state === "locked"}
            aria-label={`${node.title} ${node.state}`}
          >
            <span className="realm-node-ring">{node.state === "locked" ? <span className="map-lock"><i /><b /></span> : <span className="map-crosshair"><i /><b /></span>}</span>
            {renderStars(node.stars)}
          </button>
        ))}
        <aside className="campaign-legend">
          <div><i className="completed" />Completed Sector</div>
          <div><i className="current" />Current Objective</div>
          <div><i className="locked" />Restricted Intel</div>
        </aside>
        <aside className="campaign-music">
          <span>MP</span>
          <div><small>Now Playing</small><strong>{musicTitle}</strong></div>
          <b><i /><i /><i /><i /></b>
        </aside>
      </section>

      {activeNode && (
        <div className="campaign-modal-backdrop" onClick={() => setActiveNode(null)}>
          <article className="campaign-modal" onClick={(event) => event.stopPropagation()}>
            {campaignArtFor(activeNode) && <img className="campaign-modal-art" src={campaignArtFor(activeNode)} alt="" loading="lazy" />}
            <span>{activeNode.state === "completed" ? "Completed Sector" : "Current Objective"}</span>
            <h2>{activeNode.title}</h2>
            <p>{activeNode.description}</p>
            {activeNode.showcase && (
              <section className="campaign-showcase-card">
                <AbilityIcon ability={{ id: activeNode.showcase.abilityId, name: abilityLabel(activeNode.showcase.abilityId), icon: abilityLabel(activeNode.showcase.abilityId).slice(0, 2).toUpperCase() }} />
                <div>
                  <small>{activeNode.showcase.lessonTitle}</small>
                  <strong>{activeNode.showcase.powerPromise}</strong>
                  <p>{activeNode.showcase.disadvantage}</p>
                  <b>{activeNode.showcase.rewardPreview}</b>
                </div>
              </section>
            )}
            {renderStars(activeNode.stars)}
            <button onClick={() => onStart(activeNode)}>Start Mission</button>
          </article>
        </div>
      )}
    </main>
  );
}

function DailyPuzzleScreen({ profile, onBack, onStart }) {
  const challenges = getDailyChallenges();
  const [selectedId, setSelectedId] = useState(getDailyPuzzle().id);
  const puzzle = challenges.find((item) => item.id === selectedId) || getDailyPuzzle();
  const streaks = normalizeStreaks(profile.streaks);
  return (
    <main className="daily-puzzle-screen">
      <header className="profile-topbar">
        <button onClick={onBack}>{"<"}</button>
        <div>
          <small>Retention Loop / Daily Challenge Hub</small>
          <h1>Daily Challenge Hub</h1>
        </div>
        <strong>{streaks.dailyPuzzle} puzzle streak</strong>
      </header>
      <section className="daily-puzzle-card">
        <span>{puzzle.type}</span>
        <h2>{puzzle.title}</h2>
        <p>{puzzle.hook}</p>
        <div className="daily-challenge-grid">
          {challenges.map((challenge) => (
            <button key={challenge.id} className={challenge.id === puzzle.id ? "active" : ""} onClick={() => setSelectedId(challenge.id)}>
              <strong>{challenge.type}</strong>
              <small>{challenge.title}</small>
            </button>
          ))}
        </div>
        <div>
          <strong>Objective</strong>
          <small>{puzzle.objective}</small>
        </div>
        <div>
          <strong>Reward</strong>
          <small>{puzzle.reward}</small>
        </div>
        <button onClick={() => onStart(puzzle)}>Start Challenge</button>
      </section>
    </main>
  );
}

function FactionAbilitiesShowcase({ profile, factions = [], onBack, onLoadout, onProfile, onSettings, onRewards }) {
  const sourceFactions = factions.length ? factions : FACTION_SHOWCASE.map((item) => ({
    id: item.id,
    name: item.name,
    crest: item.name.slice(0, 1),
    lore: item.lore,
    unlock: "Demo",
    required_level_to_unlock: 1,
    passives: item.abilities.slice(0, 1).map((ability) => ({ id: ability.title, name: ability.title, icon: ability.icon, description: ability.text })),
    ultimates: item.abilities.slice(1).map((ability) => ({ id: ability.title, name: ability.title, icon: ability.icon, description: ability.text, cost: 2 })),
  }));
  const [selectedFactionId, setSelectedFactionId] = useState(sourceFactions[0]?.id || "nomads");
  const [tab, setTab] = useState("lore");
  const faction = sourceFactions.find((item) => item.id === selectedFactionId) || sourceFactions[0];
  const isUnlocked = profile.unlocked_factions?.includes(faction?.id);
  const requiredLevel = faction?.required_level_to_unlock || (faction?.id === "nomads" ? 1 : 2);
  const abilities = [
    ...(faction?.passives || []).map((ability) => ({ ...ability, tag: "Always Active" })),
    ...(faction?.ultimates || []).map((ability) => ({ ...ability, tag: `${ability.cost || 2} Momentum` })),
  ];
  const mastery = Math.min(100, Math.round(((profile.level || 1) / Math.max(requiredLevel + 4, 2)) * 100));
  const stats = {
    mobility: faction?.id === "nomads" ? 94 : faction?.id === "iron_guard" ? 58 : 72,
    control: faction?.id === "void_order" ? 91 : faction?.id === "sun_court" ? 76 : 82,
    defense: faction?.id === "iron_guard" ? 92 : faction?.id === "sun_court" ? 84 : 66,
  };
  const nowPlaying = musicTrackTitle(profile.settings?.musicTrack);

  return (
    <main className="faction-showcase">
      <header className="showcase-topbar">
        <button className="showcase-back" onClick={onBack} aria-label="Back to Nexus">{"<"}</button>
        <div className="showcase-currencies">
          <span><b>E</b>{profile.essence}</span>
          <span><b>S</b>{profile.shards}</span>
        </div>
        <div className="showcase-actions">
          <button aria-label="Profile" onClick={onProfile}>PR</button>
          <button aria-label="Settings" onClick={onSettings}>ST</button>
        </div>
      </header>

      <section className="faction-showcase-body">
        <aside className="faction-selector" aria-label="Faction selector">
          {sourceFactions.map((item) => {
            const locked = !profile.unlocked_factions?.includes(item.id);
            return (
            <button
              key={item.id}
              className={`faction-image-card tone-${factionAccent(item.id)} ${item.id === faction.id ? "is-selected" : ""} ${locked ? "is-locked" : ""}`}
              onClick={() => setSelectedFactionId(item.id)}
            >
              <FactionImage faction={item} fallback={item.crest || item.name.split(" ").map((word) => word[0]).join("")} />
              <div><strong>{item.name}</strong><small>{locked ? `Unlocks at level ${item.required_level_to_unlock || 1}` : "Unlocked"}</small></div>
            </button>
            );
          })}
        </aside>

        <section className="faction-content">
          <header className="faction-showcase-title">
            <p>Faction Archive</p>
            <h1>{faction.name}</h1>
          </header>

          <nav className="faction-tabs" aria-label="Faction information tabs">
            <button className={tab === "lore" ? "selected" : ""} onClick={() => setTab("lore")}>Lore</button>
            <button className={tab === "stats" ? "selected" : ""} onClick={() => setTab("stats")}>Stats</button>
          </nav>

          {tab === "lore" ? (
            <article className="faction-lore-box">
              <p>{faction.lore}</p>
            </article>
          ) : (
            <article className="faction-stats-box">
              {Object.entries(stats).map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <i><b style={{ width: `${value}%` }} /></i>
                </div>
              ))}
            </article>
          )}

          <section className="prime-abilities">
            <div className="prime-title"><span>Prime Abilities</span><i /></div>
            <div className="prime-ability-row">
              {abilities.map((ability) => (
                <article key={ability.id || ability.name} className={`prime-ability-card ${!isUnlocked ? "locked" : ""}`}>
                  <AbilityIcon ability={ability} />
                  <div><small>{ability.tag}</small><strong>{ability.name}</strong></div>
                  <p>{ability.description}</p>
                </article>
              ))}
            </div>
          </section>
        </section>
      </section>

      <footer className="showcase-bottom-bar">
        <aside className="showcase-music">
          <span>MP</span>
          <div><small>Now Playing</small><strong>{nowPlaying}</strong></div>
          <b><i /><i /><i /><i /></b>
        </aside>
        <section className="showcase-progression">
          <div><span>{isUnlocked ? "Mastery Level" : "Locked Faction"}</span><strong>LVL {profile.level}</strong><b>{mastery}% XP</b></div>
          <i><b style={{ width: `${mastery}%` }} /></i>
          <button onClick={onRewards}>{isUnlocked ? "Unlock Rewards" : `Requires Level ${requiredLevel}`}</button>
        </section>
        <button className="select-loadout-button" onClick={onLoadout} disabled={!isUnlocked}>Select Tactical Loadout</button>
      </footer>
    </main>
  );
}

function BattlefieldShell({ onExit }) {
  const [matchStatus] = useState({
    opponent: "Commander V",
    level: "LVL 42",
    timer: "00:42",
    turn: "Your Turn",
    pieces: { white: "12/12", black: "8/12" },
  });
  const [powers] = useState([
    { id: "passive", type: "Passive", name: "Aether Guard", status: "Always Active", charge: 100 },
    { id: "ultimate", type: "Ultimate", name: "Phase Shift", status: "80% Charged", charge: 80 },
  ]);
  const [actionLog] = useState(BATTLEFIELD_LOG);
  const tiles = useMemo(() => Array.from({ length: 64 }, (_, index) => ({ id: index, dark: (Math.floor(index / 8) + index) % 2 === 1 })), []);

  return (
    <main className="battlefield-shell">
      <header className="battle-top-hud">
        <section className="battle-opponent">
          <button onClick={onExit} aria-label="Back to Nexus">{"<"}</button>
          <span>CV</span>
          <div><strong>{matchStatus.opponent}</strong><small>{matchStatus.level}</small></div>
        </section>
        <section className="battle-status">
          <strong>{matchStatus.timer}</strong>
          <span>{matchStatus.turn}</span>
        </section>
        <section className="piece-trackers">
          <div><span>White</span><strong>{matchStatus.pieces.white}</strong></div>
          <div><span>Black</span><strong>{matchStatus.pieces.black}</strong></div>
        </section>
      </header>

      <section className="battle-center-stage" aria-label="Battlefield grid preview">
        <div className="iso-board">
          {tiles.map((tile) => <button key={tile.id} className={`iso-tile ${tile.dark ? "dark" : "light"}`} aria-label={`Tile ${tile.id + 1}`} />)}
        </div>
      </section>

      <footer className="battle-bottom-hud">
        <section className="battle-powers">
          {powers.map((power) => (
            <article key={power.id} className={`battle-power-card ${power.id}`}>
              <div className="power-icon">
                <span>{power.id === "passive" ? "AG" : "PS"}</span>
                {power.id === "ultimate" && <i style={{ "--charge": `${power.charge}%` }}><b>{power.charge}%</b></i>}
              </div>
              <div>
                <small>{power.type}: {power.name}</small>
                <strong>{power.status}</strong>
              </div>
            </article>
          ))}
        </section>
        <section className="battle-action-log">
          <div><span>Action Log</span><strong>Live Feed</strong></div>
          <ol>
            {actionLog.map((entry) => <li key={entry}>{entry}</li>)}
          </ol>
        </section>
      </footer>
    </main>
  );
}

function BattlefieldMatch({
  abilityFlags = createAbilityFlags(),
  abilityFeedback,
  activeEmotes = [],
  aiLevel,
  aiProfileId,
  blockedSquares,
  board,
  campaignLevel,
  campaignTutorialPrompt,
  campaignTutorialTargets = [],
  chatMessages = [],
  counts,
  cosmetics,
  emotes = [],
  gameVariant,
  legalMoves,
  markedPiece,
  message,
  mode,
  multiplayerRole,
  multiplayerStatus,
  opponentProfile,
  playerProfile,
  momentum,
  moveLog,
  boardViewMode = "3d",
  onArmPower,
  onForfeit,
  onHome,
  onReport,
  onReset,
  onSendChat,
  onSendEmote,
  onSquare,
  passive,
  passiveTargets = [],
  pieceColors = DEFAULT_PIECE_COLORS,
  powerMode,
  powerTargets,
  protectedSquares,
  resultText,
  review,
  selected,
  tacticalHint,
  turn,
  ultimate,
  ultimateUsed,
  winner,
}) {
  const isClassic = gameVariant === "classic" && mode === "ai";
  const ultimateCost = ultimate?.cost || 2;
  const charge = isClassic ? 0 : Math.min(100, Math.round((momentum / ultimateCost) * 100));
  const playerColor = multiplayerRole === "guest" ? "black" : "white";
  const turnLabel = winner
    ? resultText
    : mode === "multiplayer"
      ? (turn === playerColor ? "Your Turn" : "Opponent Turn")
      : (turn === "white" ? "Your Turn" : `${AI_LABELS[aiLevel]} AI Thinking`);
  const opponent = mode === "campaign" ? "Nexus Campaign AI" : mode === "puzzle" ? "Daily Tactic AI" : mode === "multiplayer" ? (opponentProfile?.username || "Remote Commander") : `${AI_LABELS[aiLevel]} Sparring AI`;
  const playerName = playerProfile?.username || playerProfile?.name || "Commander";
  const boardPerspective = getLocalPlayerColor(mode, multiplayerRole);
  const persona = getCurrentAiPersonality(mode, aiLevel, campaignLevel);
  const opponentMeta = mode === "campaign" ? `${campaignLevel?.name || "Faction Trial"} // ${getAiPersonalityLabel(persona)}` : mode === "puzzle" ? `Daily challenge // ${getAiPersonalityLabel(persona)}` : mode === "multiplayer" ? `${multiplayerStatus} // ${opponentProfile?.city || "Unknown sector"}` : `${gameVariant === "classic" ? "Classic" : "Power"} simulation // ${getAiPersonalityLabel(persona)}`;
  const opponentArtProfile = mode === "campaign" ? "campaign" : mode === "puzzle" ? "puzzle" : aiProfileId || aiLevel;
  const logEntries = moveLog.length
    ? moveLog.map((entry, index) => `[${String(12 + Math.floor(index / 3)).padStart(2, "0")}:${String(45 + ((index * 2) % 15)).padStart(2, "0")}] ${entry}`)
    : BATTLEFIELD_LOG;
  const powerStatus = isClassic
    ? "Classic rules"
    : powerMode
      ? "Armed - choose target"
      : ultimateUsed
        ? "Spent"
        : `${charge}% Charged`;
  const passiveStatus = getPassiveBattleStatus(passive?.id, abilityFlags, {
    isClassic,
    isPlayerTurn: turn === playerColor,
  });
  const campaignCoachMessage = campaignTutorialPrompt || message;
  const campaignCoachStatus = campaignTutorialPrompt && message !== campaignTutorialPrompt ? message : "";

  return (
    <main className="battlefield-shell live-match">
      {mode === "multiplayer" && (
        <MatchEmoteLayer
          activeEmotes={activeEmotes}
          playerProfile={playerProfile}
          opponentProfile={opponentProfile}
        />
      )}
      <header className="battle-top-hud">
        <section className="battle-opponent">
          <button onClick={onHome} aria-label="Back to Nexus">{"<"}</button>
          {mode === "multiplayer" ? <span>{opponentProfile?.avatar || "RC"}</span> : <AiPortrait difficulty={opponentArtProfile} className="battle-avatar" />}
          <div><strong>{opponent}</strong><small>{opponentMeta}</small></div>
        </section>
        <section className="battle-status">
          <strong>{`00:${String(42 + moveLog.length).slice(-2)}`}</strong>
          <span>{turnLabel}</span>
        </section>
        <section className="piece-trackers">
          <article className="battle-player-card">
            <CommanderPortrait profile={playerProfile} />
            <div><span>Commander</span><strong>{playerName}</strong></div>
          </article>
          <div><span>Azure</span><strong>{counts.white}/12</strong></div>
          <div><span>Amber</span><strong>{counts.black}/12</strong></div>
          {mode === "multiplayer" && !winner && <button className="battle-forfeit-button" onClick={onForfeit}>Give Up</button>}
          <button onClick={onReset}>New Sim</button>
        </section>
      </header>

      <section className="battle-center-stage live" aria-label="Playable AI battlefield">
        <div className="battle-status-ribbon">
          <div><span>{mode === "campaign" ? "Campaign Coach" : "Skirmish Feed"}</span><strong>{mode === "campaign" && !winner ? "Follow the left-side campaign panel." : message}</strong></div>
          {winner && winner !== "campaign" && <button onClick={onReport}>View Tactical Report</button>}
        </div>
        {mode === "campaign" && (campaignCoachMessage || tacticalHint) && (
          <aside className="campaign-coach-panel">
            <span>Campaign Coach</span>
            <strong>{campaignLevel?.name || "Faction Trial"}</strong>
            {campaignCoachMessage && <p>{campaignCoachMessage}</p>}
            {campaignCoachStatus && <small>{campaignCoachStatus}</small>}
            {tacticalHint && <em>{tacticalHint}</em>}
          </aside>
        )}
        {abilityFeedback && (
          <aside className="ability-result-toast">
            <span>Ability Impact</span>
            <strong>{abilityFeedback.title}</strong>
            <p>{abilityFeedback.body}</p>
          </aside>
        )}
        {mode !== "campaign" && tacticalHint && <div className="battle-tactical-hint">{tacticalHint}</div>}
        {mode !== "campaign" && campaignTutorialPrompt && <div className="battle-tutorial-prompt">{campaignTutorialPrompt}</div>}
        <div className={`battle-live-board ${boardViewMode === "2d" ? "view-2d" : "true-3d view-3d"}`}>
          {boardViewMode === "2d" ? (
            <Board board={board} selected={selected} legalMoves={legalMoves} powerTargets={powerTargets} passiveTargets={passiveTargets} tutorialTargets={campaignTutorialTargets} blockedSquares={blockedSquares} protectedSquares={protectedSquares} markedPiece={markedPiece} cosmetics={cosmetics} pieceColors={pieceColors} boardPerspective={boardPerspective} onSquare={onSquare} enableDrag />
          ) : (
            <Battlefield3DBoard board={board} selected={selected} legalMoves={legalMoves} powerTargets={powerTargets} passiveTargets={passiveTargets} tutorialTargets={campaignTutorialTargets} blockedSquares={blockedSquares} protectedSquares={protectedSquares} markedPiece={markedPiece} cosmetics={cosmetics} pieceColors={pieceColors} boardPerspective={boardPerspective} onSquare={onSquare} />
          )}
        </div>
      </section>

      <footer className="battle-bottom-hud">
        <section className="battle-powers">
          <article className={`battle-power-card passive ${isClassic ? "disabled" : ""}`}>
            <div className="power-icon">{isClassic ? <span>CR</span> : <AbilityIcon ability={passive} />}</div>
            <div>
              <small>Passive: {isClassic ? "Standard Discipline" : (passive?.name || "Aether Guard")}</small>
              <strong>{passiveStatus}</strong>
            </div>
          </article>
          <button className={`battle-power-card ultimate ${powerMode ? "armed" : ""}`} onClick={onArmPower} disabled={isClassic || winner || turn !== playerColor}>
            <div className="power-icon">
              {isClassic ? <span>NA</span> : <AbilityIcon ability={ultimate} />}
              <i style={{ "--charge": `${charge}%` }}><b>{charge}%</b></i>
            </div>
            <div>
              <small>Ultimate: {isClassic ? "Disabled" : (ultimate?.name || "Phase Shift")}</small>
              <strong>{powerStatus}</strong>
            </div>
          </button>
        </section>
        <section className="battle-action-log">
          <div><span>Action Log</span><strong>{mode === "campaign" ? "Lesson Feed" : "Live Feed"}</strong></div>
          <ol>
            {logEntries.map((entry) => <li key={entry}>{entry}</li>)}
          </ol>
          <div className="battle-coach-line">{review.length ? review[review.length - 1] : "Coach review will surface decisive moments here."}</div>
        </section>
      </footer>
      {mode === "multiplayer" && (
        <MatchChatPanel
          messages={chatMessages}
          emotes={emotes}
          onSendChat={onSendChat}
          onSendEmote={onSendEmote}
        />
      )}
    </main>
  );
}

function MatchChatPanel({ messages = [], emotes = [], onSendChat, onSendEmote }) {
  const [collapsed, setCollapsed] = useState(false);
  const [draft, setDraft] = useState("");
  const [emotesOpen, setEmotesOpen] = useState(false);
  const historyRef = useRef(null);
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages, collapsed]);

  function submit(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) {
      return;
    }
    onSendChat?.(text);
    setDraft("");
  }

  return (
    <aside className={`match-chat-panel ${collapsed ? "collapsed" : ""}`}>
      <button className="match-chat-toggle" type="button" onClick={() => setCollapsed((value) => !value)}>
        {collapsed ? "Open Chat" : "Hide Chat"}
      </button>
      {!collapsed && (
        <>
          <header>
            <span>Match Comms</span>
            <strong>{messages.length} transmissions</strong>
          </header>
          <div className="match-chat-history" ref={historyRef}>
            {messages.length === 0 && <p>No messages yet.</p>}
            {messages.map((message) => (
              <article key={message.id} className={`match-chat-message ${message.side === "local" ? "local" : "remote"}`}>
                <small>{message.sender}</small>
                {message.emote ? (
                  <span className="match-chat-sticker">
                    <MatchEmoteIcon emote={message.emote} />
                    <b>{message.text}</b>
                  </span>
                ) : (
                  <span>{message.text}</span>
                )}
              </article>
            ))}
          </div>
          <form className="match-chat-compose" onSubmit={submit}>
            <div className="match-emote-picker">
              <button type="button" onClick={() => setEmotesOpen((open) => !open)} aria-expanded={emotesOpen}>EM</button>
              {emotesOpen && (
                <div className="match-emote-menu">
                  {emotes.map((emote) => (
                    <button key={emote.id} type="button" onClick={() => { onSendEmote?.(emote); setEmotesOpen(false); }}>
                      <MatchEmoteIcon emote={emote} />
                      <span>{emote.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Send a tactical message..." maxLength={180} />
            <button type="submit">Send</button>
          </form>
        </>
      )}
    </aside>
  );
}

function MatchEmoteLayer({ activeEmotes = [], playerProfile = DEFAULT_PROFILE, opponentProfile = {} }) {
  return (
    <div className="match-emote-layer" aria-live="polite">
      {activeEmotes.map((item) => (
        <div key={item.id} className={`floating-match-emote ${item.side === "local" ? "local" : "opponent"}`}>
          <small>{item.side === "local" ? playerProfile?.username || "You" : opponentProfile?.username || "Opponent"}</small>
          <MatchEmoteIcon emote={item.emote} />
        </div>
      ))}
    </div>
  );
}

function MatchEmoteIcon({ emote }) {
  const normalized = normalizeMatchEmote(emote);
  const src = cosmeticArtFor(normalized.cosmetic || normalized);
  return (
    <span className={`match-emote-icon tone-${normalized.tone || "amber"} ${src ? "has-image" : ""} ${normalized.id?.startsWith("sticker_") ? "is-sticker" : ""}`}>
      <b>{normalized.symbol}</b>
      {src && <img src={src} alt="" loading="lazy" onError={(event) => { event.currentTarget.parentElement?.classList.remove("has-image"); event.currentTarget.style.display = "none"; }} />}
    </span>
  );
}

function SkirmishConfiguration({ profile, isAuthenticated, onBack, onSettings, onLogin, onAuthRequired, onConfirm }) {
  const [variantId, setVariantId] = useState(isAuthenticated ? "power" : "classic");
  const [difficultyId, setDifficultyId] = useState("nexus_prime");
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    if (!isAuthenticated && variantId === "power") {
      setVariantId("classic");
    }
  }, [isAuthenticated, variantId]);
  const variant = SKIRMISH_VARIANTS.find((item) => item.id === variantId) || SKIRMISH_VARIANTS[0];
  const difficulty = SKIRMISH_DIFFICULTIES.find((item) => item.id === difficultyId) || SKIRMISH_DIFFICULTIES[0];
  const speed = Number.parseInt(difficulty.speed, 10);
  const aggression = Number.parseInt(difficulty.aggression, 10);
  const winRate = Math.max(12, 84 - speed + (variantId === "classic" ? 4 : -3));
  const variantDetails = {
    classic: {
      badge: "Standard Rules",
      copy: "The pure tactical experience. No abilities, no enhancements. Pure positional strategy as the ancients played.",
      marks: ["S", "R", "D"],
    },
    power: {
      badge: "Abilities Enabled",
      copy: "Harness the Aether. Unlock character-specific abilities, hyper-jumps, and tactical reinforcements.",
      marks: ["Z", "+", "O"],
    },
  };

  return (
    <main className="skirmish-config">
      <header className="skirmish-osbar">
        <div className="os-left">
          <button className="skirmish-back" onClick={onBack} aria-label="Back to Nexus">{"<"}</button>
          <div className="aether-brand">
            <span>A</span>
            <strong>Aether</strong>
            <small>Tactics_OS</small>
          </div>
        </div>
        <aside className="skirmish-resources">
          {isAuthenticated ? (
            <>
              <span><b>E</b>{profile.essence}</span>
              <span><b>S</b>{profile.shards}</span>
            </>
          ) : <span><b>G</b>AI Trial</span>}
        </aside>
        <div className="commander-chip">
          {isAuthenticated ? (
            <>
              <button aria-label="Settings" onClick={onSettings}>ST</button>
              <div><strong>{profile.username}</strong><small>LVL {profile.level}</small></div>
              <CommanderPortrait profile={profile} />
            </>
          ) : <button className="skirmish-login" onClick={onLogin}>Login / Register</button>}
        </div>
      </header>

      <section className="skirmish-layout">
        <div className="skirmish-left">
          <header className="skirmish-hero">
            <h1>Skirmish Configuration</h1>
            <p><span>i</span>Pick a game variant and set the AI challenge parameters for the simulation.</p>
          </header>

          <section className="config-section">
            <div className="config-section-title"><span>01 // Game Variant</span><i /></div>
            <div className="variant-grid">
              {SKIRMISH_VARIANTS.map((item) => {
                const details = variantDetails[item.id];
                const locked = !isAuthenticated && item.id === "power";
                return (
                  <button
                    key={item.id}
                    className={`variant-card ${variantId === item.id ? "active" : ""} ${locked ? "locked" : ""} ${item.id}`}
                    onClick={() => {
                      if (locked) {
                        setFeedback("Power Checkers requires login because it uses factions, abilities, rewards, and saved progression.");
                        onAuthRequired?.("Power Checkers");
                        return;
                      }
                      setFeedback("");
                      setVariantId(item.id);
                    }}
                  >
                    <b className="select-ring" />
                    <span className="variant-symbol">{item.icon}</span>
                    <em>{locked ? "Login Required" : details.badge}</em>
                    <strong>{item.label}</strong>
                    <p>{locked ? "Create a commander to use faction abilities, ultimates, rewards, and saved progression." : details.copy}</p>
                    <small>{details.marks.map((mark) => <i key={mark}>{mark}</i>)}</small>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="config-section difficulty-section">
            <div className="config-section-title"><span>02 // AI Difficulty</span><i /></div>
            <div className="difficulty-list">
              {SKIRMISH_DIFFICULTIES.map((item) => (
                <button key={item.id} className={`difficulty-card ${difficultyId === item.id ? "active" : ""}`} onClick={() => setDifficultyId(item.id)}>
                  <i className="radio-dot" />
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.id === "recruit" ? "Beginner AI" : item.id === "tactician" ? "Balanced Strategy" : item.id === "veteran" ? "Advanced Positional Play" : "Elite AI Entity"}</small>
                  </div>
                  <span>{Array.from({ length: 5 }, (_, index) => <b key={index} className={index < Math.min(item.stars, 5) ? "filled" : ""} />)}</span>
                </button>
              ))}
            </div>
            <article className="behavior-note">
              <b>i</b>
              <div>
                <strong>Simulated Behavior Analysis</strong>
                <p>Higher difficulty levels significantly increase processing speed, board-state anticipation, and aggression. {difficulty.label} utilizes deep-neural pattern matching for near flawless execution.</p>
              </div>
            </article>
          </section>
        </div>

        <aside className="skirmish-intel-column">
          <section className="target-profile">
            <header>
              <strong>Target Profile</strong>
              <b>Intel Verified</b>
            </header>
            <div className="intel-frame">
              <AiPortrait difficulty={difficulty} className="intel-portrait" />
            </div>
            <div className="intel-stats">
              <div>
                <span>Processing Speed</span>
                <strong>{difficulty.speed}</strong>
                <i><b style={{ width: `${speed}%` }} /></i>
              </div>
              <div>
                <span>Aggression Metric</span>
                <strong>{difficulty.aggression}</strong>
                <i><b style={{ width: `${aggression}%` }} /></i>
              </div>
              <div>
                <span>Estimated Win Rate</span>
                <strong>{winRate}%</strong>
                <i><b style={{ width: `${winRate}%` }} /></i>
              </div>
            </div>
            <article className="tactical-advice">
              <b>TX</b>
              <div>
                <strong>Tactical Advice</strong>
                <p>{difficulty.label} predicts your moves up to {difficulty.id === "nexus_prime" ? 12 : difficulty.stars + 2} steps ahead. Focus on unpredictable flank maneuvers.</p>
              </div>
            </article>
          </section>
          <section className="latency-card">
            <b>OS</b>
            <div><span>System Latency</span><strong>0.02ms // Optimal</strong></div>
          </section>
        </aside>
      </section>

      <footer className="skirmish-footer">
        <button onClick={() => onConfirm({ variant: variantId, difficulty })}><span>Confirm Match Setup</span><b>{"<"}</b></button>
        {feedback && <p className="skirmish-inline-message">{feedback}</p>}
        <p>{isAuthenticated ? "Estimated match duration: 10-15 minutes" : "Guest mode: Classic AI only, no saved rewards"}<br />{isAuthenticated ? "Rewards: +150 XP // 40 Essence guaranteed" : "Login to unlock Power Checkers and progression"}</p>
      </footer>
    </main>
  );
}

function TacticalLoadout({ profile = DEFAULT_PROFILE, factions = [], loadout = DEFAULT_LOADOUT, message = "", pendingSetup = null, onLoadout, onBack, onInitialize, onLockedFaction, onVault, onProgression }) {
  const firstFaction = factions[0];
  const [selectedFactionId, setSelectedFactionId] = useState(loadout.factionId || firstFaction?.id || "nomads");
  const selectedFaction = factions.find((item) => item.id === selectedFactionId) || firstFaction;
  const passives = selectedFaction?.passives.map((ability) => normalizeLoadoutAbility(ability, "passive", selectedFaction)) || TACTICAL_ABILITIES.filter((ability) => ability.type === "passive");
  const ultimates = selectedFaction?.ultimates.map((ability) => normalizeLoadoutAbility(ability, "ultimate", selectedFaction)) || TACTICAL_ABILITIES.filter((ability) => ability.type === "ultimate");
  const activePassive = passives.find((ability) => ability.id === loadout.passiveId) || passives[0];
  const activeUltimate = ultimates.find((ability) => ability.id === loadout.ultimateId) || ultimates[0];
  const [selectedId, setSelectedId] = useState(activePassive?.id || passives[0]?.id);
  const selectedAbility = [...passives, ...ultimates].find((ability) => ability.id === selectedId) || activePassive || activeUltimate || TACTICAL_ABILITIES[0];
  const setupDifficulty = pendingSetup?.difficulty;
  const setupLabel = setupDifficulty?.label || AI_LABELS[pendingSetup?.aiLevel] || "Smart";
  const setupRewards = setupDifficulty?.id === "nexus_prime" ? "+160 XP // +60 Essence" : setupDifficulty?.id === "veteran" ? "+140 XP // +50 Essence" : setupDifficulty?.id === "recruit" ? "+80 XP // +25 Essence" : "+110 XP // +40 Essence";
  const selectedFactionUnlocked = Boolean(selectedFaction && profile.unlocked_factions?.includes(selectedFaction.id));
  const activeLoadout = {
    factionId: selectedFaction?.id,
    passiveId: activePassive?.id,
    ultimateId: activeUltimate?.id,
  };

  function equipSelected() {
    if (!selectedFaction || !onLoadout || !selectedFactionUnlocked) {
      if (selectedFaction && !selectedFactionUnlocked) {
        onLockedFaction?.(selectedFaction);
      }
      return;
    }
    if (selectedAbility.type === "passive") {
      onLoadout({ factionId: selectedFaction.id, passiveId: selectedAbility.id, ultimateId: activeUltimate.id });
      return;
    }
    onLoadout({ factionId: selectedFaction.id, passiveId: activePassive.id, ultimateId: selectedAbility.id });
  }

  function chooseFaction(factionId) {
    const nextFaction = factions.find((item) => item.id === factionId);
    if (!nextFaction) {
      return;
    }
    if (!profile.unlocked_factions?.includes(factionId)) {
      onLockedFaction?.(nextFaction);
      return;
    }
    setSelectedFactionId(factionId);
    setSelectedId(nextFaction.passives[0]?.id || nextFaction.ultimates[0]?.id);
    onLoadout?.({
      factionId,
      passiveId: nextFaction.passives[0]?.id,
      ultimateId: nextFaction.ultimates[0]?.id,
    });
  }

  function renderAbilityButton(ability) {
    const isEquipped = ability.id === activePassive?.id || ability.id === activeUltimate?.id;
    return (
      <button
        key={ability.id}
        className={`library-item ability-${ability.accent} ${selectedId === ability.id ? "active" : ""}`}
        onClick={() => setSelectedId(ability.id)}
      >
        <AbilityIcon ability={ability} />
        <div>
          <strong>{ability.name}</strong>
          <small>{ability.costLabel}</small>
        </div>
        {isEquipped && <b>Equipped</b>}
      </button>
    );
  }

  return (
    <main className="tactical-loadout">
      <header className="loadout-topbar">
        <button className="loadout-back" onClick={onBack} aria-label="Back to Nexus">{"<"}</button>
        <div className="loadout-title">
          <p>Aether-Tactics / Combat Rig</p>
          <h1>Tactical Loadout</h1>
          <span>Configure your modular rig before entering the board.</span>
        </div>
        <div className="loadout-resources">
          <span><b>E</b>{profile.essence}</span>
          <span><b>S</b>{profile.shards}</span>
        </div>
      </header>

      <section className="pending-setup-summary">
        <article>
          <span>Selected Mode</span>
          <strong>{pendingSetup?.variant === "power" ? "Power Checkers" : "Manual Power Loadout"}</strong>
        </article>
        <article>
          <span>AI Difficulty</span>
          <strong>{setupLabel}</strong>
        </article>
        <article>
          <span>Expected Rewards</span>
          <strong>{setupRewards}</strong>
        </article>
        {message && <p>{message}</p>}
      </section>

      <section className="active-loadout" aria-label="Active loadout">
        <article className={`loadout-slot ability-${activePassive?.accent || "cobalt"}`}>
          <small>Active Passive</small>
          <div><AbilityIcon ability={activePassive} /><strong>{activePassive?.name}</strong></div>
          <p>{activePassive?.tag}</p>
        </article>
        <article className={`loadout-slot ability-${activeUltimate?.accent || "void"}`}>
          <small>Active Ultimate</small>
          <div><AbilityIcon ability={activeUltimate} /><strong>{activeUltimate?.name}</strong></div>
          <p>{activeUltimate?.tag}</p>
        </article>
      </section>

      <section className="loadout-workspace">
        <aside className="ability-library">
          {factions.length > 0 && (
          <section>
            <h2>Faction Rig</h2>
            <div>
                {factions.map((faction) => {
                  const unlocked = profile.unlocked_factions?.includes(faction.id);
                  const requirement = faction.id === "void_order" || String(faction.unlock || "").toLowerCase().includes("vault")
                    ? "Unlock in Vault"
                    : `Level ${faction.required_level_to_unlock || 1}`;
                  return (
                  <button key={faction.id} className={`library-item ability-${factionAccent(faction.id)} ${selectedFaction?.id === faction.id ? "active" : ""} ${!unlocked ? "locked" : ""}`} onClick={() => chooseFaction(faction.id)} aria-disabled={!unlocked}>
                    <span>{faction.crest}</span>
                    <div>
                      <strong>{faction.name}</strong>
                      <small>{unlocked ? "Unlocked" : requirement}</small>
                    </div>
                    {unlocked ? selectedFaction?.id === faction.id && <b>Active</b> : <b>Locked</b>}
                  </button>
                  );
                })}
              </div>
            </section>
          )}
          <section>
            <h2>Passive Cores</h2>
            <div>{passives.map(renderAbilityButton)}</div>
          </section>
          <section>
            <h2>Ultimate Charges</h2>
            <div>{ultimates.map(renderAbilityButton)}</div>
          </section>
        </aside>

        <article className={`inspection-pane ability-${selectedAbility.accent}`}>
          <div className="inspection-head">
            <AbilityIcon ability={selectedAbility} className="inspection-icon" />
            <div>
              <small>{selectedAbility.tag}</small>
              <h2>{selectedAbility.name}</h2>
              <b>{selectedAbility.costLabel}</b>
            </div>
          </div>
          <div className="inspection-copy">
            <section>
              <h3>Lore Archive</h3>
              <p>{selectedAbility.lore}</p>
            </section>
            <section>
              <h3>Mechanical Specs</h3>
              <ul>
                {selectedAbility.specs.map((spec) => <li key={spec}>{spec}</li>)}
              </ul>
            </section>
          </div>
          <button className="equip-button" onClick={equipSelected}>Equip to {selectedAbility.type === "passive" ? "Passive" : "Ultimate"} Slot</button>
          {!selectedFactionUnlocked && (
            <div className="locked-loadout-actions">
              <span>This faction is not available for matchmaking yet.</span>
              {selectedFaction?.id === "void_order" ? <button onClick={onVault}>Preview Pro</button> : <button onClick={onProgression}>View Progression</button>}
            </div>
          )}
        </article>
      </section>

      <footer className="loadout-footer">
        <button onClick={() => onInitialize?.(activeLoadout, pendingSetup)} disabled={!selectedFactionUnlocked || !activePassive || !activeUltimate}>Initialize Battle</button>
      </footer>
    </main>
  );
}

function GatewayIcon({ name }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
    "aria-hidden": "true",
  };
  if (name === "user") {
    return <svg {...common}><circle cx="12" cy="8" r="3.3" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>;
  }
  if (name === "mail") {
    return <svg {...common}><path d="M4 6h16v12H4z" /><path d="m4 7 8 6 8-6" /></svg>;
  }
  if (name === "key") {
    return <svg {...common}><circle cx="8" cy="15" r="3" /><path d="m10.2 12.8 7.3-7.3" /><path d="M15 8h3V5" /></svg>;
  }
  if (name === "eye") {
    return <svg {...common}><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
  }
  return <svg {...common}><path d="M12 3 5.5 5.7v5.5c0 4.1 2.7 7.8 6.5 9.1 3.8-1.3 6.5-5 6.5-9.1V5.7L12 3Z" /><path d="m9.4 12 1.7 1.7 3.7-4" /></svg>;
}

function NexusMenuIcon({ name }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    viewBox: "0 0 24 24",
    "aria-hidden": "true",
  };
  if (name === "gamepad") {
    return <svg {...common}><path d="M7 10h10a4 4 0 0 1 3.7 5.5l-.5 1.4a2.3 2.3 0 0 1-3.9.8L14.8 16H9.2l-1.5 1.7a2.3 2.3 0 0 1-3.9-.8l-.5-1.4A4 4 0 0 1 7 10Z" /><path d="M8 13v3" /><path d="M6.5 14.5h3" /><path d="M16.8 13.7h.1" /><path d="M18.8 15.4h.1" /></svg>;
  }
  if (name === "blade") {
    return <svg {...common}><path d="m6 18 2-4 8-8 2 2-8 8-4 2Z" /><path d="m13 7 4 4" /></svg>;
  }
  if (name === "map") {
    return <svg {...common}><path d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2V6Z" /><path d="M9 4v14" /><path d="M15 6v14" /></svg>;
  }
  if (name === "target") {
    return <svg {...common}><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3" /><path d="M12 19v3" /><path d="M2 12h3" /><path d="M19 12h3" /></svg>;
  }
  if (name === "users") {
    return <svg {...common}><path d="M16 19v-1.4c0-1.8-1.5-3.3-3.3-3.3H8.3A3.3 3.3 0 0 0 5 17.6V19" /><circle cx="10.5" cy="8" r="3" /><path d="M19 18v-1.2c0-1.7-1.1-3.1-2.7-3.6" /><path d="M15.2 5.2a3 3 0 0 1 0 5.6" /></svg>;
  }
  if (name === "trophy") {
    return <svg {...common}><path d="M8 4h8v3.5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5.5A2.5 2.5 0 0 0 8 10" /><path d="M16 6h2.5A2.5 2.5 0 0 1 16 10" /><path d="M12 12v4" /><path d="M8.5 20h7" /><path d="M10 16h4" /></svg>;
  }
  if (name === "pass") {
    return <svg {...common}><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.2a2 2 0 0 0 0 3.6V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.2a2 2 0 0 0 0-3.6V8Z" /><path d="M9 9.5h6" /><path d="M9 14.5h4" /><path d="M16.5 6v12" /></svg>;
  }
  if (name === "vault") {
    return <svg {...common}><path d="M5 8h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8Z" /><path d="M8 8V5h8v3" /><path d="M9 12h6" /><path d="m10 15 2 1.5L14 15" /></svg>;
  }
  if (name === "inventory") {
    return <svg {...common}><path d="M5 6.5h14v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-12Z" /><path d="M8 6.5 10 3h4l2 3.5" /><path d="M8.5 11h7" /><path d="M8.5 15h4.5" /></svg>;
  }
  if (name === "book") {
    return <svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v17H6.5A2.5 2.5 0 0 1 4 17.5v-12Z" /><path d="M12 3h5.5A2.5 2.5 0 0 1 20 5.5v12a2.5 2.5 0 0 1-2.5 2.5H12" /></svg>;
  }
  return <svg {...common}><path d="M4 7h10" /><path d="M18 7h2" /><circle cx="16" cy="7" r="2" /><path d="M4 17h2" /><path d="M10 17h10" /><circle cx="8" cy="17" r="2" /></svg>;
}

function NexusFeatureScreen({ feature, onNavigate, onHome }) {
  const nowPlaying = musicTrackTitle(DEFAULT_SETTINGS.musicTrack);
  return (
    <main className="nexus-core feature-core">
      <header className="nexus-topbar">
        <div className="nexus-logo"><span>AT</span><strong>Nexus Core</strong></div>
        <div className="nexus-currencies">
          <span><b>E</b>2,450</span>
          <span><b>S</b>12,800</span>
        </div>
        <div className="nexus-actions">
          <button onClick={onHome}>NC</button>
          <button aria-label="Settings" onClick={() => onNavigate("settings")}>ST</button>
          <button className="nexus-avatar" aria-label="Profile">P</button>
        </div>
      </header>
      <section className="feature-panel">
        <p>{feature.eyebrow}</p>
        <h2>{feature.title}</h2>
        <span>{feature.copy}</span>
        <div>
          {feature.actions.map((action) => <button key={action}>{action}</button>)}
          <button onClick={onHome}>Return to Nexus</button>
        </div>
      </section>
      <footer className="nexus-footer">
        <span><i />EU servers: stable</span>
        <span>Season 4: 12 days left</span>
        <div className="music-player">
          <b>Now playing</b>
          <strong>{nowPlaying}</strong>
          <div className="waveform"><i /><i /><i /><i /><i /></div>
        </div>
      </footer>
    </main>
  );
}

function GuestLockedScreen({ feature, onHome, onLogin }) {
  return (
    <main className="nexus-core feature-core">
      <header className="nexus-topbar">
        <div className="nexus-logo"><span>AT</span><strong>Nexus Core</strong></div>
        <div className="nexus-currencies"><span className="guest-pill">Guest AI Trial</span></div>
        <div className="nexus-actions"><button className="guest-auth-button" onClick={onLogin}>Login / Register</button></div>
      </header>
      <section className="feature-panel guest-locked-screen">
        <p>Login required</p>
        <h2>{feature} Locked</h2>
        <span>Guests can only play Classic AI skirmishes. Create a commander to unlock Power mode, Multiplayer, Vault, quests, achievements, and saved progression.</span>
        <div>
          <button onClick={onLogin}>Login / Register</button>
          <button onClick={onHome}>Return to Nexus</button>
        </div>
      </section>
    </main>
  );
}

function CustomLobbyScreen({ code, role, state, profile, factions = [], loadout, message, onBack, onCodeChange, onJoin, onLoadout, onReady, onCopy }) {
  const cleanCode = sanitizeLobbyCode(code);
  const player = state?.[role] || null;
  const joined = Boolean(player && player.connected !== false);
  const selectedFaction = factions.find((faction) => faction.id === loadout.factionId) || factions[0];
  const passives = selectedFaction?.passives || [];
  const ultimates = selectedFaction?.ultimates || [];
  const canReady = joined && loadout.factionId && loadout.passiveId && loadout.ultimateId;
  const hostConnected = Boolean(state?.host && state.host.connected !== false);
  const guestConnected = Boolean(state?.guest && state.guest.connected !== false);
  const bothReady = Boolean(hostConnected && guestConnected && state?.host?.ready && state?.guest?.ready);

  function chooseFaction(factionId) {
    const faction = factions.find((item) => item.id === factionId);
    if (!faction || !profile.unlocked_factions?.includes(faction.id)) {
      return;
    }
    onLoadout?.({
      factionId: faction.id,
      passiveId: faction.passives?.[0]?.id || "open_roads",
      ultimateId: faction.ultimates?.[0]?.id || "dash",
    });
  }

  return (
    <main className="custom-lobby-screen">
      <header className="lobby-topbar">
        <button onClick={onBack}>{"<"}</button>
        <div>
          <small>Custom Multiplayer Lobby</small>
          <h1>{cleanCode || "Join Lobby"}</h1>
          <p>{message || "Configure factions and abilities. The match starts only when both commanders are ready."}</p>
        </div>
        <button onClick={onCopy} disabled={!cleanCode}>Copy Link</button>
      </header>

      <section className="lobby-code-panel">
        <label>Join Code<input value={cleanCode} onChange={(event) => onCodeChange?.(event.target.value)} placeholder="A1B2C3" maxLength={6} /></label>
        <button onClick={onJoin} disabled={role === "host"}>{role === "host" ? "Hosting" : joined ? "Refresh Join" : "Join Lobby"}</button>
        <span>{bothReady ? "Both ready // Launching" : !hostConnected && state?.host ? "Host left the room" : state?.guest && !guestConnected ? "Opponent left the room" : hostConnected && guestConnected ? "Two commanders connected" : "Waiting for opponent"}</span>
      </section>

      <section className="lobby-players">
        <LobbyPlayerCard title="Host" player={state?.host} active={role === "host"} />
        <LobbyPlayerCard title="Guest" player={state?.guest} active={role === "guest"} />
      </section>

      <section className="lobby-loadout">
        <aside>
          <h2>Faction</h2>
          <div>
            {factions.map((faction) => {
              const unlocked = profile.unlocked_factions?.includes(faction.id);
              return (
                <button key={faction.id} className={loadout.factionId === faction.id ? "active" : ""} onClick={() => chooseFaction(faction.id)} disabled={!joined || !unlocked}>
                  <span>{faction.crest || faction.name.slice(0, 1)}</span>
                  <strong>{faction.name}</strong>
                  <small>{unlocked ? "Available" : "Locked"}</small>
                </button>
              );
            })}
          </div>
        </aside>
        <article>
          <h2>Abilities</h2>
          <div className="lobby-ability-row">
            <section>
              <h3>Passive</h3>
              {passives.map((ability) => <button key={ability.id} className={loadout.passiveId === ability.id ? "active" : ""} onClick={() => onLoadout?.({ ...loadout, passiveId: ability.id })} disabled={!joined}>{ability.name}</button>)}
            </section>
            <section>
              <h3>Ultimate</h3>
              {ultimates.map((ability) => <button key={ability.id} className={loadout.ultimateId === ability.id ? "active" : ""} onClick={() => onLoadout?.({ ...loadout, ultimateId: ability.id })} disabled={!joined}>{ability.name}</button>)}
            </section>
          </div>
          <button className="lobby-ready-button" onClick={() => onReady?.(!player?.ready)} disabled={!canReady}>{player?.ready ? "Cancel Ready" : "Ready"}</button>
        </article>
      </section>
    </main>
  );
}

function LobbyPlayerCard({ title, player, active }) {
  const connected = Boolean(player && player.connected !== false);
  return (
    <article className={`lobby-player-card ${active ? "active" : ""} ${player?.ready ? "ready" : ""} ${player && !connected ? "disconnected" : ""}`}>
      <span>{player?.avatar || title.slice(0, 1)}</span>
      <div>
        <small>{title}</small>
        <h2>{player ? connected ? player.username : `${player.username} left` : "Waiting..."}</h2>
        <p>{connected ? `${player?.loadout?.factionId || "No faction selected"} // ${player?.ready ? "Ready" : "Not ready"}` : "Disconnected // Not ready"}</p>
      </div>
    </article>
  );
}

function NexusMultiplayerScreen({ demoMode, isAuthenticated, friendsData, playerSearchResults, profile, userId, leaderboard, leaderboardCity, onNavigate, onHome, onProfile, onNotify, onStartRoom, onHostLobby, onJoinLobby, onSearchPlayers, onRequestFriend, onOpenPublicProfile, onInviteFriend, onRespondRequest, onLeaderboardCity }) {
  const nowPlaying = musicTrackTitle(profile.settings?.musicTrack);
  return (
    <main className="ops-shell">
      <header className="nexus-topbar">
        <div className="nexus-logo"><span>AT</span><strong>Aether-Tactics / Nexus Core</strong></div>
        <div className="nexus-currencies">
          <span><b>E</b>{profile.essence}</span>
          <span><b>S</b>{profile.shards}</span>
          {demoMode && <span className="demo-pill">Demo Mode</span>}
        </div>
        <div className="nexus-actions">
          <button onClick={onHome}>NC</button>
          <button aria-label="Settings" onClick={() => onNavigate("settings")}>ST</button>
          <button className="nexus-avatar" aria-label="Profile" onClick={onProfile}>{(profile.username || "P").slice(0, 1)}</button>
        </div>
      </header>
      <MultiplayerOperations isAuthenticated={isAuthenticated} friendsData={friendsData} playerSearchResults={playerSearchResults} userId={userId} leaderboard={leaderboard} leaderboardCity={leaderboardCity} onNotify={onNotify} onStartRoom={onStartRoom} onHostLobby={onHostLobby} onJoinLobby={onJoinLobby} onSearchPlayers={onSearchPlayers} onRequestFriend={onRequestFriend} onOpenPublicProfile={onOpenPublicProfile} onInviteFriend={onInviteFriend} onRespondRequest={onRespondRequest} onLeaderboardCity={onLeaderboardCity} />
      <footer className="nexus-footer">
        <span><i />EU servers: stable</span>
        <span>Season 4: 12 days left</span>
        <div className="music-player">
          <b>Now playing</b>
          <strong>{nowPlaying}</strong>
          <div className="waveform"><i /><i /><i /><i /><i /></div>
        </div>
      </footer>
    </main>
  );
}

function MultiplayerOperations({ isAuthenticated = false, friendsData, playerSearchResults, userId, leaderboard, leaderboardCity, onNotify, onStartRoom, onHostLobby, onJoinLobby, onSearchPlayers, onRequestFriend, onOpenPublicProfile, onInviteFriend, onRespondRequest, onLeaderboardCity }) {
  const [queueState, setQueueState] = useState({ mode: "idle", label: "Connected to Nexus_Core_Node_01", roomCode: "" });
  const [joinCode, setJoinCode] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const queuePollRef = useRef(null);
  const queueTimeoutRef = useRef(null);
  const filteredLeaderboard = filterLeaderboardByCity(leaderboard || [], leaderboardCity);
  const leaderboardSource = filteredLeaderboard.length ? filteredLeaderboard : normalizeLeaderboardCity(leaderboardCity) === "global" && !(leaderboard || []).length ? MULTIPLAYER_LEADERS : [];
  const leaders = leaderboardSource.slice(0, 5).map((row, index) => ({
    id: row.id || row.user_id || `${row.name || row.username}-${row.city || "global"}-${index}`,
    rank: index + 1,
    name: row.name || row.username || "Commander",
    city: row.city || "Global",
    elo: row.elo || row.mmr_elo_rating || score(row),
  }));
  const social = normalizeFriendsData(friendsData);
  const friends = isAuthenticated ? social.friends : [];
  const searchResults = isAuthenticated ? playerSearchResults.slice(0, 4) : [];

  useEffect(() => () => clearMatchmakingTimers(), []);

  function clearMatchmakingTimers() {
    if (queuePollRef.current) {
      window.clearInterval(queuePollRef.current);
      queuePollRef.current = null;
    }
    if (queueTimeoutRef.current) {
      window.clearTimeout(queueTimeoutRef.current);
      queueTimeoutRef.current = null;
    }
  }

  function startMatchmakingTimeout(mode, roomCode = "") {
    queueTimeoutRef.current = window.setTimeout(() => {
      clearMatchmakingTimers();
      cancelMultiplayerQueue(userId).catch((error) => onNotify?.("Queue cancel failed", error.message || "Could not cancel queue on the server.", "warning"));
      setQueueState({ mode: "idle", label: "No players found. Please try again later.", roomCode: "" });
      onNotify?.("Matchmaking timeout", "No players found. Please try again later.", "warning");
    }, 600000);
    setQueueState((current) => ({ ...current, mode, roomCode: roomCode || current.roomCode, label: "Searching for match..." }));
  }

  function openMatchedRoom(room, roomCode, mode, role = "host") {
    clearMatchmakingTimers();
    const resolvedCode = room?.room_code || roomCode;
    setQueueState({ mode, label: "Opponent found. Preparing room.", roomCode: resolvedCode });
    onNotify?.(mode === "ranked" ? "Ranked match found" : "Match found", `Paired into room ${resolvedCode}.`, "success");
    onStartRoom?.({ ...(room || {}), room_code: resolvedCode, mode }, role);
  }

  function pollForMatch(roomCode, mode, role = "host") {
    queuePollRef.current = window.setInterval(() => {
      getMultiplayerQueueStatus({ userId, mode, roomCode })
        .then((payload) => {
          const room = payload.room;
          if (!room) {
            return;
          }
          if ((payload.status === "matched" || room.status === "ready") && room.guest_user_id) {
            openMatchedRoom(room, room.room_code || roomCode, mode, payload.role || role);
            return;
          }
          if (room.status === "abandoned" || room.status === "finished") {
            clearMatchmakingTimers();
            setQueueState({ mode: "idle", label: "No players found. Please try again later.", roomCode: "" });
            onNotify?.("Matchmaking ended", "No players found. Please try again later.", "warning");
          }
        })
        .catch((error) => {
          getMultiplayerRoom(roomCode)
            .then((payload) => {
              const room = payload.room;
              if ((room?.status === "ready" || room?.guest_user_id) && room?.guest_user_id) {
                openMatchedRoom(room, room.room_code || roomCode, mode, role);
                return;
              }
              setQueueState((current) => ({ ...current, label: `Searching for match... (${error.status ? `API ${error.status}` : "retrying"})` }));
            })
            .catch(() => setQueueState((current) => ({ ...current, label: `Searching for match... (${error.status ? `API ${error.status}` : "retrying"})` })));
        });
    }, 2000);
  }

  function beginQueue(mode) {
    if (!isAuthenticated) {
      onNotify?.("Login required", "Login to use multiplayer matchmaking.", "warning");
      return;
    }
    clearMatchmakingTimers();
    setQueueState({ mode, label: "Searching for match...", roomCode: "" });
    joinMultiplayerQueue({ userId, mode })
      .then((payload) => {
        const roomCode = payload.room?.room_code || payload.ticket?.room_code || "";
        const matched = payload.status === "matched";
        if (matched && roomCode) {
          openMatchedRoom(payload.room, roomCode, mode, payload.role || "guest");
          return;
        }
        if (roomCode) {
          setQueueState({ mode, label: "Searching for match...", roomCode });
          onNotify?.(mode === "ranked" ? "Ranked queue" : "Fast match", "Searching for match...", "info");
          startMatchmakingTimeout(mode, roomCode);
          pollForMatch(roomCode, mode, payload.role || "host");
          return;
        }
        throw new Error("Queue did not return a room code.");
      })
      .catch((error) => {
        clearMatchmakingTimers();
        setQueueState({ mode: "idle", label: "Queue unavailable. Please try again later.", roomCode: "" });
        onNotify?.(mode === "ranked" ? "Ranked queue failed" : "Fast match failed", error.message || "Queue API unavailable.", "warning");
      });
  }

  function hostRoom() {
    if (!isAuthenticated) {
      onNotify?.("Login required", "Login to host private lobbies.", "warning");
      return;
    }
    setQueueState({ mode: "private", label: "Opening custom lobby setup.", roomCode: "" });
    onHostLobby?.();
  }

  function shareLink() {
    if (!isAuthenticated) {
      onNotify?.("Login required", "Login to generate invite links.", "warning");
      return;
    }
    const code = queueState.roomCode || Math.random().toString(36).slice(2, 8).toUpperCase();
    const link = `${window.location.origin}/lobby/${code}`;
    navigator.clipboard?.writeText(link).catch(() => undefined);
    setQueueState({ mode: "private", label: "Invite link copied.", roomCode: code });
    onNotify?.("Invite copied", link, "success");
  }

  function inviteFriend(friend) {
    if (!isAuthenticated) {
      onNotify?.("Login required", "Login to invite friends.", "warning");
      return;
    }
    Promise.resolve(onInviteFriend?.(friend, queueState.roomCode)).then((code) => {
      if (code) {
        setQueueState({ mode: "private", label: "Friend invite sent.", roomCode: code });
      }
    });
  }

  function search(event) {
    const value = event.target.value;
    setSearchTerm(value);
    if (!isAuthenticated) {
      return;
    }
    onSearchPlayers?.(value);
  }

  function joinRoom() {
    if (!isAuthenticated) {
      onNotify?.("Login required", "Login to join private lobbies.", "warning");
      return;
    }
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      onNotify?.("Join room", "Enter a private lobby code first.", "warning");
      return;
    }
    setQueueState({ mode: "private", label: "Joined private lobby.", roomCode: code });
    onNotify?.("Joined room", `Connected to ${code}.`, "success");
    onJoinLobby?.(code);
  }

  function cancelQueue() {
    clearMatchmakingTimers();
    cancelMultiplayerQueue(userId).catch((error) => onNotify?.("Queue cancel failed", error.message || "Could not cancel queue on the server.", "warning"));
    setQueueState({ mode: "idle", label: "Queue cancelled. Connected to Nexus_Core_Node_01", roomCode: "" });
    onNotify?.("Queue cancelled", "Matchmaking search stopped.", "info");
  }

  return (
    <div className="multiplayer-ops">
      <div className="ops-main">
        <header className="ops-header">
          <p>Aether-Tactics / Nexus Core</p>
          <h2>Multiplayer Operations</h2>
          <span>{queueState.label}{queueState.roomCode ? ` // ${queueState.roomCode}` : ""}</span>
        </header>

        <section className="ops-section">
          <div className="ops-title"><i />The Queue</div>
          <div className="queue-grid">
            <button className={`queue-card fast-card ${queueState.mode === "fast" ? "active" : ""}`} onClick={() => beginQueue("fast")}>
              <span className="ops-icon">X</span>
              <small>ETA: 1:20</small>
              <strong>Fast Match</strong>
              <p>Instant skirmish deployment with balanced casual matchmaking.</p>
              <b>Begin Search</b>
            </button>
            <button className={`queue-card ranked-card ${queueState.mode === "ranked" ? "active" : ""}`} onClick={() => beginQueue("ranked")}>
              <span className="ops-icon">Q</span>
              <small>ETA: 2:45</small>
              <strong>Ranked Queue</strong>
              <p>Competitive Elo ladder with high-stakes city leaderboard progress.</p>
              <b>Begin Search</b>
            </button>
          </div>
          {queueState.mode !== "idle" && <button className="queue-cancel" onClick={cancelQueue}>Cancel Queue / Room Search</button>}
        </section>

        <section className="ops-section">
          <div className="ops-title"><i />Private Sessions</div>
          <div className="private-grid">
            <button className="private-card" onClick={hostRoom}>
              <span className="ops-icon">H</span>
              <div><strong>Host Private Lobby</strong><p>Create a secure room. Copy the shareable link inside the lobby.</p></div>
              <b>+</b>
            </button>
          </div>
          <div className="join-room-row">
            <input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="ENTER ROOM CODE" />
            <button onClick={joinRoom}>Join Room</button>
          </div>
        </section>

        <aside className="ops-alert">
          <span>Season 4: Neon Void</span>
          <strong>Vanguard Reinforcements Active</strong>
          <p>Earn extra Essence from Fast Match and Ranked Queue sessions this weekend.</p>
        </aside>
      </div>

      <aside className="ops-sidebar">
        <section>
          <div className="ops-side-title"><span>Online Friends</span><b>{friends.length} linked</b></div>
          <ul className="friend-list">
            {friends.map((friend) => (
              <li key={friend.user_id || friend.name}>
                <span className={`friend-avatar ${friend.accent}`}>{friend.avatar}</span>
                <div onClick={() => onOpenPublicProfile?.(friend)}><strong>{friend.username || friend.name}</strong><small>{friend.status || friend.presence || "Online"}</small></div>
                <button onClick={() => inviteFriend(friend)}>Invite</button>
              </li>
            ))}
            {friends.length === 0 && <li className="friend-empty-row"><div><strong>No friends linked</strong><small>Search by nickname or ID to add commanders.</small></div></li>}
          </ul>
        </section>
        <section>
          <div className="ops-side-title"><span>Find Commanders</span></div>
          <div className="friend-search">
            <input value={searchTerm} onChange={search} placeholder="Search ID or nickname" disabled={!isAuthenticated} />
            <div>
              {searchResults.map((player) => (
                <article key={player.user_id}>
                  <span>{player.avatar}</span>
                  <button onClick={() => onOpenPublicProfile?.(player)}>{player.username}<small>{shortPlayerId(player.user_id)}</small></button>
                  <button onClick={() => onRequestFriend?.(player)}>Add</button>
                </article>
              ))}
              {isAuthenticated && searchTerm.trim().length >= 2 && searchResults.length === 0 && <article className="friend-empty-result"><span>?</span><button disabled>No commanders found</button><button disabled>Add</button></article>}
            </div>
          </div>
          {social.incoming.length > 0 && (
            <div className="friend-requests">
              {social.incoming.map((request) => (
                <article key={request.request_id}>
                  <span>{request.profile?.username || "Commander"} wants to connect</span>
                  <button onClick={() => onRespondRequest?.(request, "accept")}>Accept</button>
                  <button onClick={() => onRespondRequest?.(request, "decline")}>Decline</button>
                </article>
              ))}
            </div>
          )}
        </section>
        <section>
          <div className="ops-side-title"><span>Global Leaderboard</span></div>
          <div className="leaderboard-filters">
            {["Global", "Almaty", "Astana", "Shymkent"].map((city) => <button key={city} className={leaderboardCity === city ? "active" : ""} onClick={() => onLeaderboardCity?.(city)}>{city}</button>)}
            <button onClick={() => { const city = window.prompt("City leaderboard", leaderboardCity || "Almaty"); if (city) onLeaderboardCity?.(city); }}>Custom</button>
          </div>
          <ol className="ops-leaders">
            {leaders.map((player) => (
              <li key={player.id}>
                <b>#{player.rank}</b>
                <span className="ops-leader-name"><i>{player.name}</i><small>{formatLeaderboardCity(player.city)}</small></span>
                <strong>ELO {player.elo}</strong>
              </li>
            ))}
            {leaders.length === 0 && <li className="ops-empty-leader"><span>No commanders from {formatLeaderboardCity(leaderboardCity)} yet.</span></li>}
          </ol>
        </section>
      </aside>
    </div>
  );
}

function FactionLoadout({ factions, faction, passive, ultimate, loadout, locked, onFaction, onPassive, onUltimate }) {
  return (
    <section className="section faction-section">
      <div className="section-title"><span>Faction loadout</span><span>{faction?.unlock}</span></div>
      <div className="faction-menu">
        <div className="faction-rail">
          {factions.map((item) => <button key={item.id} className={item.id === faction?.id ? "active" : ""} onClick={() => onFaction(item.id)} disabled={locked}>{item.crest}</button>)}
        </div>
        <div className="faction-detail">
          <div className="faction-head">
            <span>{faction?.crest}</span>
            <div><strong>{faction?.name}</strong><p>{faction?.lore}</p></div>
          </div>
          <AbilityCard label="Passive" ability={passive} shape="round" />
          <AbilityCard label="Ultimate" ability={ultimate} shape="square" />
          <div className="choice-grid">
            {faction?.passives.map((item) => <button key={item.id} className={item.id === loadout.passiveId ? "active" : ""} onClick={() => onPassive(item.id)} disabled={locked}>{item.name}</button>)}
          </div>
          <div className="choice-grid">
            {faction?.ultimates.map((item) => <button key={item.id} className={item.id === loadout.ultimateId ? "active" : ""} onClick={() => onUltimate(item.id)} disabled={locked}>{item.name}</button>)}
          </div>
        </div>
      </div>
    </section>
  );
}

function FactionImage({ faction, fallback = "", compact = false }) {
  const src = factionArtFor(faction);
  const label = fallback || (typeof faction === "object" ? faction?.crest || faction?.name?.slice(0, 1) : String(faction || "F").slice(0, 2)).toUpperCase();
  return (
    <span className={`faction-art ${compact ? "compact" : ""}`}>
      <b>{label}</b>
      {src && <img src={src} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
    </span>
  );
}

function AbilityIcon({ ability, className = "" }) {
  const src = abilityArtFor(ability);
  const fallback = ability?.icon || "AT";
  return (
    <span className={`ability-art ${className}`}>
      <b>{fallback}</b>
      {src && <img src={src} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
    </span>
  );
}

function BoardViewControls({ viewMode = "3d", pieceColors = DEFAULT_PIECE_COLORS, onViewMode, onPieceColor }) {
  const whiteOption = paletteIdForColor(pieceColors.white);
  const blackOption = paletteIdForColor(pieceColors.black);
  return (
    <section className="battle-board-toolbar" aria-label="Board view and piece color controls">
      <div className="board-view-toggle">
        <button className={viewMode === "3d" ? "active" : ""} onClick={() => onViewMode?.("3d")}>3D</button>
        <button className={viewMode === "2d" ? "active" : ""} onClick={() => onViewMode?.("2d")}>2D</button>
      </div>
      <PieceColorControl label="Azure Pieces" player="white" value={pieceColors.white} option={whiteOption} onChange={onPieceColor} />
      <PieceColorControl label="Amber Pieces" player="black" value={pieceColors.black} option={blackOption} onChange={onPieceColor} />
    </section>
  );
}

function PieceColorControl({ label, player, value, option, onChange }) {
  return (
    <label className="piece-color-control">
      <span>{label}</span>
      <select value={option} onChange={(event) => {
        const next = PIECE_COLOR_PALETTE.find((item) => item.id === event.target.value);
        if (next) onChange?.(player, next.hex);
      }}>
        {PIECE_COLOR_PALETTE.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        <option value="custom">Custom</option>
      </select>
      <input type="color" value={toHexInput(value)} onChange={(event) => onChange?.(player, event.target.value)} aria-label={`${label} custom color`} />
    </label>
  );
}

const THREE_BOARD_HALF = 3.5;
const THREE_TILE_SIZE = 1;

function squareToWorld(row, col) {
  return new THREE.Vector3((col - THREE_BOARD_HALF) * THREE_TILE_SIZE, 0, (row - THREE_BOARD_HALF) * THREE_TILE_SIZE);
}

function cameraPositionForPerspective(boardPerspective = "white") {
  return boardPerspective === "black" ? new THREE.Vector3(0, 7.4, -7.8) : new THREE.Vector3(0, 7.4, 7.8);
}

function getLocalPlayerColor(mode = "ai", multiplayerRole = "host") {
  return mode === "multiplayer" && multiplayerRole === "guest" ? "black" : "white";
}

function boardSkinConfigFor(cosmetics = {}) {
  const id = cosmetics?.board?.cosmetic_id || cosmetics?.board?.skin_id || cosmetics?.boardSkinId || "";
  const aliases = {
    board_steppe_sunset: "classic_mahogany",
    board_iron_bastion: "obsidian_gold",
    board_void_grid: "void_grid",
    legacy_neon: "nexus_neon",
    nexus_neon: "nexus_neon",
    classic_mahogany: "classic_mahogany",
    obsidian_gold: "obsidian_gold",
    void_grid: "void_grid",
    celestial_marble: "celestial_marble",
  };
  return BOARD_SKINS[aliases[id] || id] || BOARD_SKINS.nexus_neon;
}

function boardLightingFor(skin = BOARD_SKINS.nexus_neon) {
  const lighting = {
    exposure: 0.78,
    fogDensity: 0.024,
    hemisphere: 0.5,
    ambient: 0.16,
    key: 0.9,
    purple: 0.55,
    cyan: 0.58,
    rim: 0.48,
    underglow: 0.045,
    ...(skin.lighting || {}),
  };
  return {
    ...lighting,
    exposure: Math.min(lighting.exposure, 0.82),
    hemisphere: Math.min(lighting.hemisphere, 0.58),
    ambient: Math.min(lighting.ambient, 0.2),
    key: Math.min(lighting.key, 0.95),
    purple: Math.min(lighting.purple, 0.72),
    cyan: Math.min(lighting.cyan, 0.76),
    rim: Math.min(lighting.rim, 0.62),
    underglow: Math.min(lighting.underglow, 0.065),
  };
}

function createBoardSkinRuntime(skin, maxAnisotropy = 8) {
  const textures = {
    base: createBoardSurfaceTextures(skin, "base", maxAnisotropy),
    rail: createBoardSurfaceTextures(skin, "rail", maxAnisotropy),
    light: createBoardSurfaceTextures(skin, "light", maxAnisotropy),
    dark: createBoardSurfaceTextures(skin, "dark", maxAnisotropy),
  };
  return {
    skinId: skin.id,
    textures,
    materials: {
      base: createBoardPhysicalMaterial(skin.materials.base, textures.base),
      rail: createBoardPhysicalMaterial(skin.materials.rail, textures.rail),
      lightTile: createBoardPhysicalMaterial(skin.materials.light, textures.light),
      darkTile: createBoardPhysicalMaterial(skin.materials.dark, textures.dark),
      shadow: new THREE.ShadowMaterial({ opacity: 0.36 }),
    },
  };
}

function createBoardPhysicalMaterial(settings, textures) {
  return new THREE.MeshPhysicalMaterial({
    color: settings.color,
    metalness: Math.min(settings.metalness ?? 0.18, 0.42),
    roughness: Math.max(settings.roughness ?? 0.58, 0.54),
    clearcoat: Math.min(settings.clearcoat ?? 0.18, 0.34),
    clearcoatRoughness: Math.max(settings.clearcoatRoughness ?? 0.5, 0.46),
    emissive: settings.emissive || 0x000000,
    emissiveIntensity: Math.min(settings.emissiveIntensity || 0, 0.06),
    envMapIntensity: Math.min(settings.envMapIntensity ?? 0.42, 0.46),
    map: textures.map,
    roughnessMap: textures.roughnessMap,
    metalnessMap: textures.metalnessMap,
    bumpMap: textures.bumpMap,
    bumpScale: settings.bumpScale || 0.02,
  });
}

function createBoardSurfaceTextures(skin, surface, maxAnisotropy) {
  return {
    map: createBoardCanvasTexture(skin, surface, "color", maxAnisotropy),
    roughnessMap: createBoardCanvasTexture(skin, surface, "roughness", maxAnisotropy),
    metalnessMap: createBoardCanvasTexture(skin, surface, "metalness", maxAnisotropy),
    bumpMap: createBoardCanvasTexture(skin, surface, "bump", maxAnisotropy),
  };
}

function createBoardCanvasTexture(skin, surface, channel, maxAnisotropy) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  drawBoardTexture(context, skin, surface, channel);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(surface === "rail" ? 3 : 2, surface === "base" ? 2 : 2);
  texture.anisotropy = maxAnisotropy;
  if (channel === "color") texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function drawBoardTexture(context, skin, surface, channel) {
  const material = skin.materials[surface];
  const base = boardTextureColor(material, channel, 0);
  context.fillStyle = base;
  context.fillRect(0, 0, 512, 512);
  if (skin.textureStyle === "neon") drawNeonGridTexture(context, material, channel, surface);
  if (skin.textureStyle === "wood") drawWoodTexture(context, material, channel, surface);
  if (skin.textureStyle === "carbon") drawCarbonTexture(context, material, channel, surface);
  if (skin.textureStyle === "marble") drawMarbleTexture(context, material, channel, surface);
  drawMicroSurfaceTexture(context, material, channel, surface);
}

function drawNeonGridTexture(context, material, channel, surface) {
  if (channel !== "color") {
    return;
  }
  const lineColor = surface === "dark" ? "rgba(157,78,221,0.18)" : "rgba(0,229,255,0.12)";
  context.strokeStyle = lineColor;
  context.lineWidth = surface === "rail" ? 1.4 : 0.9;
  for (let index = 0; index <= 512; index += surface === "rail" ? 64 : 32) {
    context.globalAlpha = index % 64 === 0 ? 0.5 : 0.28;
    context.beginPath();
    context.moveTo(index, 0);
    context.lineTo(index, 512);
    context.stroke();
    context.beginPath();
    context.moveTo(0, index);
    context.lineTo(512, index);
    context.stroke();
  }
  const glow = context.createRadialGradient(256, 256, 20, 256, 256, 330);
  glow.addColorStop(0, "rgba(0,229,255,0.08)");
  glow.addColorStop(0.55, "rgba(157,78,221,0.045)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  context.globalAlpha = 1;
  context.fillStyle = glow;
  context.fillRect(0, 0, 512, 512);
}

function drawWoodTexture(context, material, channel, surface) {
  for (let index = 0; index < 32; index += 1) {
    const y = index * 18 + seededTextureValue(index, surface) * 12;
    context.beginPath();
    context.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) {
      context.lineTo(x, y + Math.sin(x * 0.03 + index) * 8);
    }
    context.strokeStyle = boardTextureColor(material, channel, index % 2 ? 34 : -28);
    context.lineWidth = 2 + seededTextureValue(index + 7, surface) * 4;
    context.globalAlpha = channel === "color" ? 0.28 : 0.18;
    context.stroke();
  }
  context.globalAlpha = 1;
}

function drawCarbonTexture(context, material, channel, surface) {
  for (let offset = -512; offset < 512; offset += 24) {
    context.strokeStyle = boardTextureColor(material, channel, offset % 48 ? 24 : -18);
    context.lineWidth = 7;
    context.globalAlpha = channel === "color" ? 0.18 : 0.12;
    context.beginPath();
    context.moveTo(offset, 0);
    context.lineTo(offset + 512, 512);
    context.stroke();
    context.beginPath();
    context.moveTo(offset + 512, 0);
    context.lineTo(offset, 512);
    context.stroke();
  }
  context.globalAlpha = 1;
}

function drawMarbleTexture(context, material, channel, surface) {
  for (let index = 0; index < 24; index += 1) {
    context.beginPath();
    const start = seededTextureValue(index, surface) * 512;
    context.moveTo(start, -20);
    for (let y = -20; y <= 532; y += 28) {
      context.lineTo(start + Math.sin(y * 0.018 + index) * 72 + (seededTextureValue(index + y, surface) - 0.5) * 42, y);
    }
    context.strokeStyle = boardTextureColor(material, channel, index % 3 ? 42 : -34);
    context.lineWidth = index % 5 === 0 ? 3.4 : 1.2;
    context.globalAlpha = channel === "color" ? 0.24 : 0.16;
    context.stroke();
  }
  context.globalAlpha = 1;
}

function drawMicroSurfaceTexture(context, material, channel, surface) {
  const image = context.getImageData(0, 0, 512, 512);
  const data = image.data;
  for (let index = 0; index < data.length; index += 4) {
    const pixel = index / 4;
    const noise = (seededTextureValue(pixel, surface + channel) - 0.5) * (channel === "bump" ? 58 : 28);
    data[index] = Math.max(0, Math.min(255, data[index] + noise));
    data[index + 1] = Math.max(0, Math.min(255, data[index + 1] + noise));
    data[index + 2] = Math.max(0, Math.min(255, data[index + 2] + noise));
  }
  context.putImageData(image, 0, 0);
  context.globalAlpha = channel === "color" ? 0.14 : 0.08;
  context.strokeStyle = boardTextureColor(material, channel, channel === "metalness" ? 80 : 44);
  for (let index = 0; index < 28; index += 1) {
    const y = seededTextureValue(index + 300, surface) * 512;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(512, y + (seededTextureValue(index + 500, surface) - 0.5) * 40);
    context.lineWidth = seededTextureValue(index + 800, surface) * 1.6;
    context.stroke();
  }
  context.globalAlpha = 1;
}

function boardTextureColor(material, channel, shift) {
  if (channel === "roughness") return grayscaleColor((material.roughness ?? 0.5) * 255 + shift);
  if (channel === "metalness") return grayscaleColor((material.metalness ?? 0.2) * 255 + shift);
  if (channel === "bump") return grayscaleColor(128 + shift);
  return shiftThreeColor(material.color, shift);
}

function shiftThreeColor(color, amount) {
  const normalized = typeof color === "number" ? `#${color.toString(16).padStart(6, "0")}` : normalizeColorValue(String(color), "#555555");
  return shiftHexColor(normalized, amount);
}

function grayscaleColor(value) {
  const channel = Math.max(0, Math.min(255, Math.round(value)));
  return `rgb(${channel}, ${channel}, ${channel})`;
}

function seededTextureValue(seed, salt = "") {
  const key = String(salt);
  if (!TEXTURE_SEED_CACHE.has(key)) {
    TEXTURE_SEED_CACHE.set(key, key.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0));
  }
  const value = Math.sin(seed * 12.9898 + TEXTURE_SEED_CACHE.get(key) * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function disposeBoardSkinRuntime(runtime) {
  if (!runtime) return;
  Object.values(runtime.materials || {}).forEach((material) => material?.dispose?.());
  Object.values(runtime.textures || {}).forEach((surface) => {
    Object.values(surface || {}).forEach((texture) => texture?.dispose?.());
  });
}

function makePieceMaterials(pieceColors = DEFAULT_PIECE_COLORS) {
  const colors = normalizePieceColors(pieceColors);
  const white = makeThreePieceColor(colors.white);
  const black = makeThreePieceColor(colors.black);
  return {
    azure: new THREE.MeshStandardMaterial({ color: white.main, metalness: 0.22, roughness: 0.56, emissive: white.emissive, emissiveIntensity: 0.055, envMapIntensity: 0.38 }),
    azureDark: new THREE.MeshStandardMaterial({ color: white.dark, metalness: 0.28, roughness: 0.62, envMapIntensity: 0.34 }),
    amber: new THREE.MeshStandardMaterial({ color: black.main, metalness: 0.22, roughness: 0.56, emissive: black.emissive, emissiveIntensity: 0.05, envMapIntensity: 0.38 }),
    amberDark: new THREE.MeshStandardMaterial({ color: black.dark, metalness: 0.28, roughness: 0.62, envMapIntensity: 0.34 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc7892e, metalness: 0.36, roughness: 0.5, emissive: 0x120802, emissiveIntensity: 0.035, envMapIntensity: 0.36 }),
  };
}

function updatePieceMaterials(materials, pieceColors = DEFAULT_PIECE_COLORS) {
  const colors = normalizePieceColors(pieceColors);
  const white = makeThreePieceColor(colors.white);
  const black = makeThreePieceColor(colors.black);
  materials.azure.color.copy(white.main);
  materials.azure.emissive.copy(white.emissive);
  materials.azureDark.color.copy(white.dark);
  materials.amber.color.copy(black.main);
  materials.amber.emissive.copy(black.emissive);
  materials.amberDark.color.copy(black.dark);
}

function makeProceduralPiece(piece, materials) {
  const group = new THREE.Group();
  const isAzure = piece.player === "white";
  const coreMaterial = isAzure ? materials.azure : materials.amber;
  const rimMaterial = isAzure ? materials.azureDark : materials.amberDark;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.18, 56), rimMaterial);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.35, 0.1, 56), coreMaterial);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.025, 10, 56), materials.gold);
  base.castShadow = true;
  base.receiveShadow = true;
  top.castShadow = true;
  ring.castShadow = true;
  base.position.y = 0.13;
  top.position.y = 0.27;
  ring.position.y = 0.33;
  ring.rotation.x = Math.PI / 2;
  group.add(base, top, ring);
  if (piece.king) {
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.62, 4), coreMaterial);
    crest.position.y = 0.7;
    crest.rotation.y = Math.PI / 4;
    crest.castShadow = true;
    group.add(crest);
  }
  return group;
}

function normalizeGltfTemplate(scene) {
  const root = scene.clone(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const scale = 0.76 / Math.max(size.x, size.z, 0.001);
  root.scale.setScalar(scale);
  root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  root.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      if (node.material) {
        const normalizeMaterial = (material) => {
          material.metalness = Math.min(material.metalness ?? 0.24, 0.34);
          material.roughness = Math.max(material.roughness ?? 0.58, 0.58);
          material.envMapIntensity = Math.min(material.envMapIntensity ?? 0.42, 0.42);
          if (material.emissive) {
            material.emissiveIntensity = Math.min(material.emissiveIntensity || 0, 0.025);
          }
        };
        if (Array.isArray(node.material)) node.material.forEach(normalizeMaterial);
        else normalizeMaterial(node.material);
      }
    }
  });
  return root;
}

function pieceModelKeyFor(piece, cosmetics = {}) {
  const skinId = pieceCosmeticForPlayer(cosmetics, piece.player)?.cosmetic_id;
  if (skinId && PIECE_MODEL_ASSETS[skinId]) {
    return skinId;
  }
  return piece.player === "white" ? "default_azure" : "default_amber";
}

function createPieceModelAccent(piece, materials) {
  const isAzure = piece.player === "white";
  const group = new THREE.Group();
  const colorMaterial = isAzure ? materials.azure : materials.amber;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.025, 10, 64), colorMaterial);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.08;
  rim.castShadow = true;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.045, 64), isAzure ? materials.azureDark : materials.amberDark);
  base.position.y = 0.035;
  base.receiveShadow = true;
  group.add(base, rim);
  return group;
}

function createKingCrest(piece, materials) {
  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 5), piece.player === "white" ? materials.azure : materials.amber);
  crest.position.y = 0.92;
  crest.rotation.y = Math.PI / 5;
  crest.castShadow = true;
  return crest;
}

function applyPieceModelTint(root, piece, pieceColors = DEFAULT_PIECE_COLORS, cosmetics = {}) {
  const tint = new THREE.Color(getPieceColorHex(renderPieceColors(pieceColors, cosmetics), piece.player));
  root.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const tintMaterial = (material) => {
      const next = material.clone();
      if (next.color) next.color.lerp(tint, 0.12);
      if (next.emissive) {
        next.emissive.copy(tint).multiplyScalar(0.22);
        next.emissiveIntensity = Math.min(next.emissiveIntensity || 0.018, 0.025);
      }
      next.metalness = Math.min(next.metalness ?? 0.24, 0.34);
      next.roughness = Math.max(next.roughness ?? 0.58, 0.58);
      next.envMapIntensity = Math.min(next.envMapIntensity ?? 0.42, 0.42);
      return next;
    };
    node.material = Array.isArray(node.material) ? node.material.map(tintMaterial) : tintMaterial(node.material);
  });
  return root;
}

function createHighlightMesh(color, opacity, radius = 0.38) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.72, radius, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.16;
  return ring;
}

function Battlefield3DBoard({ board, selected, legalMoves, powerTargets, passiveTargets = [], tutorialTargets = [], blockedSquares, protectedSquares = [], markedPiece, cosmetics = {}, pieceColors = DEFAULT_PIECE_COLORS, boardPerspective = "white", onSquare }) {
  const mountRef = useRef(null);
  const latestRef = useRef({ board, selected, legalMoves, powerTargets, passiveTargets, tutorialTargets, blockedSquares, protectedSquares, markedPiece, cosmetics, pieceColors, boardPerspective, onSquare });
  const syncRef = useRef(() => {});

  useEffect(() => {
    latestRef.current = { board, selected, legalMoves, powerTargets, passiveTargets, tutorialTargets, blockedSquares, protectedSquares, markedPiece, cosmetics, pieceColors, boardPerspective, onSquare };
    syncRef.current();
  }, [board, selected, legalMoves, powerTargets, passiveTargets, tutorialTargets, blockedSquares, protectedSquares, markedPiece, cosmetics, pieceColors, boardPerspective, onSquare]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.1, 100);
    camera.position.set(0, 7.4, 7.8);
    camera.lookAt(0, 0, 0);
    const cameraTarget = new THREE.Vector3();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ReinhardToneMapping;
    mount.appendChild(renderer.domElement);
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const environmentTexture = pmremGenerator.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    scene.environment = environmentTexture;

    const boardGroup = new THREE.Group();
    const markerGroup = new THREE.Group();
    const pieceGroup = new THREE.Group();
    const tileTargets = [];
    const activePieces = new Map();
    const rememberedPositions = new Map();
    const materials = makePieceMaterials(renderPieceColors(latestRef.current.pieceColors, latestRef.current.cosmetics));
    const maxAnisotropy = Math.min(renderer.capabilities.getMaxAnisotropy?.() || 8, 12);
    const initialBoardSkin = boardSkinConfigFor(latestRef.current.cosmetics);
    const initialLighting = boardLightingFor(initialBoardSkin);
    renderer.toneMappingExposure = initialLighting.exposure;
    const boardSkinState = { current: initialBoardSkin.id, runtime: createBoardSkinRuntime(initialBoardSkin, maxAnisotropy) };
    const railMeshes = [];
    const lightTileMeshes = [];
    const darkTileMeshes = [];
    const modelTemplates = { current: new Map() };
    scene.add(boardGroup, markerGroup, pieceGroup);
    scene.fog = new THREE.FogExp2(initialBoardSkin.accent.fog, initialLighting.fogDensity);
    const hemisphereLight = new THREE.HemisphereLight(0xcff8ff, 0x160b24, initialLighting.hemisphere);
    scene.add(hemisphereLight);
    const ambientFill = new THREE.AmbientLight(0x86a4ff, initialLighting.ambient);
    scene.add(ambientFill);
    const keyLight = new THREE.DirectionalLight(0xffffff, initialLighting.key);
    keyLight.position.set(3.4, 7.8, 4.8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 24;
    keyLight.shadow.camera.left = -7;
    keyLight.shadow.camera.right = 7;
    keyLight.shadow.camera.top = 7;
    keyLight.shadow.camera.bottom = -7;
    keyLight.shadow.radius = 8;
    keyLight.shadow.blurSamples = 12;
    scene.add(keyLight);
    const purpleLight = new THREE.PointLight(initialBoardSkin.accent.purple, initialLighting.purple, 9);
    purpleLight.position.set(-5.2, 1.3, 3.9);
    scene.add(purpleLight);
    const cyanLight = new THREE.PointLight(initialBoardSkin.accent.cyan, initialLighting.cyan, 9);
    cyanLight.position.set(5.2, 1.3, -3.9);
    scene.add(cyanLight);
    const rimLight = new THREE.SpotLight(initialBoardSkin.accent.amber, initialLighting.rim, 18, Math.PI / 5.4, 0.42, 1.2);
    rimLight.position.set(-2.8, 5.2, -5.8);
    rimLight.castShadow = true;
    rimLight.shadow.mapSize.set(1024, 1024);
    rimLight.shadow.radius = 6;
    scene.add(rimLight);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), boardSkinState.runtime.materials.shadow);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.42;
    ground.receiveShadow = true;
    scene.add(ground);

    const underglow = new THREE.Mesh(
      new THREE.RingGeometry(4.8, 6.1, 96),
      new THREE.MeshBasicMaterial({ color: initialBoardSkin.accent.cyan, transparent: true, opacity: initialLighting.underglow, side: THREE.DoubleSide }),
    );
    underglow.rotation.x = -Math.PI / 2;
    underglow.position.y = -0.4;
    scene.add(underglow);

    const base = new THREE.Mesh(new THREE.BoxGeometry(9.35, 0.34, 9.35), boardSkinState.runtime.materials.base);
    base.position.y = -0.22;
    base.castShadow = true;
    base.receiveShadow = true;
    boardGroup.add(base);
    [
      { pos: [0, 0.06, -4.62], size: [8.8, 0.22, 0.22] },
      { pos: [0, 0.06, 4.62], size: [8.8, 0.22, 0.22] },
      { pos: [-4.62, 0.06, 0], size: [0.22, 0.22, 8.8] },
      { pos: [4.62, 0.06, 0], size: [0.22, 0.22, 8.8] },
    ].forEach(({ pos, size }) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(...size), boardSkinState.runtime.materials.rail);
      rail.position.set(...pos);
      rail.castShadow = true;
      rail.receiveShadow = true;
      boardGroup.add(rail);
      railMeshes.push(rail);
    });

    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const dark = isDarkSquare(row, col);
        const tile = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.08, 0.98), dark ? boardSkinState.runtime.materials.darkTile : boardSkinState.runtime.materials.lightTile);
        const position = squareToWorld(row, col);
        tile.position.set(position.x, 0.03, position.z);
        tile.castShadow = true;
        tile.receiveShadow = true;
        tile.userData = { row, col };
        boardGroup.add(tile);
        tileTargets.push(tile);
        if (dark) darkTileMeshes.push(tile);
        else lightTileMeshes.push(tile);
      }
    }

    function applyBoardSkin(skin) {
      if (boardSkinState.current === skin.id) return;
      const previousRuntime = boardSkinState.runtime;
      const nextRuntime = createBoardSkinRuntime(skin, maxAnisotropy);
      boardSkinState.current = skin.id;
      boardSkinState.runtime = nextRuntime;
      base.material = nextRuntime.materials.base;
      ground.material = nextRuntime.materials.shadow;
      railMeshes.forEach((mesh) => { mesh.material = nextRuntime.materials.rail; });
      lightTileMeshes.forEach((mesh) => { mesh.material = nextRuntime.materials.lightTile; });
      darkTileMeshes.forEach((mesh) => { mesh.material = nextRuntime.materials.darkTile; });
      const lighting = boardLightingFor(skin);
      renderer.toneMappingExposure = lighting.exposure;
      scene.fog = new THREE.FogExp2(skin.accent.fog, lighting.fogDensity);
      hemisphereLight.intensity = lighting.hemisphere;
      ambientFill.intensity = lighting.ambient;
      keyLight.intensity = lighting.key;
      purpleLight.color.setHex(skin.accent.purple);
      purpleLight.intensity = lighting.purple;
      cyanLight.color.setHex(skin.accent.cyan);
      cyanLight.intensity = lighting.cyan;
      rimLight.color.setHex(skin.accent.amber);
      rimLight.intensity = lighting.rim;
      underglow.material.color.setHex(skin.accent.cyan);
      underglow.material.opacity = lighting.underglow;
      setTimeout(() => disposeBoardSkinRuntime(previousRuntime), 0);
    }

    const gltfLoader = new GLTFLoader();
    Object.entries(PIECE_MODEL_ASSETS).forEach(([key, path]) => {
      gltfLoader.load(path, (gltf) => {
        modelTemplates.current.set(key, normalizeGltfTemplate(gltf.scene));
        syncRef.current();
      });
    });

    function clearGroup(group) {
      while (group.children.length) group.remove(group.children[0]);
    }

    function addMarker(row, col, color, opacity, radius) {
      const marker = createHighlightMesh(color, opacity, radius);
      const target = squareToWorld(row, col);
      marker.position.x = target.x;
      marker.position.z = target.z;
      markerGroup.add(marker);
    }

    function makePiece(piece, state) {
      const template = modelTemplates.current.get(pieceModelKeyFor(piece, state.cosmetics));
      if (template) {
        const wrapper = new THREE.Group();
        wrapper.add(createPieceModelAccent(piece, materials));
        wrapper.add(applyPieceModelTint(template.clone(true), piece, state.pieceColors, state.cosmetics));
        if (piece.king) wrapper.add(createKingCrest(piece, materials));
        return wrapper;
      }
      return makeProceduralPiece(piece, materials);
    }

    function syncScene() {
      const state = latestRef.current;
      cameraTarget.copy(cameraPositionForPerspective(state.boardPerspective));
      applyBoardSkin(boardSkinConfigFor(state.cosmetics));
      updatePieceMaterials(materials, renderPieceColors(state.pieceColors, state.cosmetics));
      clearGroup(markerGroup);
      state.passiveTargets.forEach((item) => addMarker(item.row, item.col, 0x00e5ff, 0.16, 0.5));
      state.legalMoves.forEach((move) => addMarker(move.to.row, move.to.col, move.captured ? 0xffb400 : 0x00e5ff, move.captured ? 0.5 : 0.36, move.captured ? 0.44 : 0.34));
      state.powerTargets.forEach((item) => addMarker(item.row, item.col, 0x9d4edd, 0.42, 0.4));
      state.tutorialTargets.forEach((item) => addMarker(item.row, item.col, item.kind === "capture" ? 0xff4d6d : item.kind === "source" ? 0xffffff : 0xffb400, 0.38, item.kind === "source" ? 0.52 : 0.46));
      state.blockedSquares.forEach((item) => addMarker(item.row, item.col, 0xff4d6d, 0.34, 0.42));
      state.protectedSquares.forEach((item) => addMarker(item.row, item.col, 0x00e5ff, 0.22, 0.46));
      if (state.selected) addMarker(state.selected.row, state.selected.col, 0xffffff, 0.5, 0.48);
      activePieces.forEach((pieceObject, id) => rememberedPositions.set(id, pieceObject.position.clone()));
      clearGroup(pieceGroup);
      activePieces.clear();
      state.board.forEach((row, rowIndex) => {
        row.forEach((piece, colIndex) => {
          if (!piece) return;
          const object = makePiece(piece, state);
          const square = squareToWorld(rowIndex, colIndex);
          const target = new THREE.Vector3(square.x, piece.king ? 0.42 : 0.32, square.z);
          object.position.copy(rememberedPositions.get(piece.id) || target);
          object.userData.target = target;
          object.userData.pieceId = piece.id;
          if (state.markedPiece?.id === piece.id) object.scale.setScalar(1.14);
          pieceGroup.add(object);
          activePieces.set(piece.id, object);
        });
      });
    }

    syncRef.current = syncScene;
    syncScene();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    function handlePointerDown(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(tileTargets, false)[0];
      if (hit?.object?.userData) latestRef.current.onSquare(hit.object.userData.row, hit.object.userData.col);
    }
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    function resize() {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
    window.addEventListener("resize", resize);

    let frame = 0;
    let raf = 0;
    function animate() {
      raf = requestAnimationFrame(animate);
      frame += 1;
      camera.position.lerp(cameraTarget, 0.14);
      camera.lookAt(0, 0, 0);
      activePieces.forEach((object, id) => {
        object.position.lerp(object.userData.target, 0.16);
        object.rotation.y = Math.sin(frame * 0.012 + object.position.x) * 0.025;
        rememberedPositions.set(id, object.position.clone());
      });
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      syncRef.current = () => {};
      disposeBoardSkinRuntime(boardSkinState.runtime);
      environmentTexture.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="battle-three-board" ref={mountRef}>
      <div className="battle-three-hint">3D tactical board</div>
    </div>
  );
}

function CosmeticPreview({ cosmetic, compact = false }) {
  const src = cosmeticArtFor(cosmetic);
  const id = typeof cosmetic === "object" ? cosmetic?.cosmetic_id || cosmetic?.id : cosmetic;
  const kind = typeof cosmetic === "object" ? cosmetic?.kind || cosmetic?.cosmetic_id || "cosmetic" : String(cosmetic || "cosmetic");
  const fallback = id === BASIC_PIECE_COSMETIC.cosmetic_id ? "B" : kind.split("_").map((part) => part[0]).join("").slice(0, 3).toUpperCase();
  const modelPreview = isModelAsset(src);
  const svgPreview = isPremium2DPieceSkin(id);
  return (
    <div className={`vault-preview ${compact ? "compact" : ""} ${src && !modelPreview ? "has-image" : ""} ${modelPreview ? "has-model" : ""} ${svgPreview ? "has-svg" : ""}`}>
      <span>{fallback || "VK"}</span>
      {svgPreview && <PremiumPieceSkinPreview skinId={id} />}
      {modelPreview && <b>3D</b>}
      {src && !modelPreview && <img src={src} alt="" loading="lazy" onError={(event) => { event.currentTarget.parentElement?.classList.remove("has-image"); event.currentTarget.style.display = "none"; }} />}
    </div>
  );
}

function ProfileBadgeIcon({ badge, className = "" }) {
  if (!badge) {
    return null;
  }
  const src = cosmeticArtFor(badge);
  const fallback = String(badge.name || badge.cosmetic_id || "BG").split(/[_\s]/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "BG";
  return (
    <span className={`profile-badge-icon ${className} ${src ? "has-image" : ""}`} title={badge.name || "Equipped badge"}>
      <b>{fallback}</b>
      {src && <img src={src} alt="" loading="lazy" onError={(event) => { event.currentTarget.parentElement?.classList.remove("has-image"); event.currentTarget.style.display = "none"; }} />}
    </span>
  );
}

function ProfileAvatarWithBadge({ profile = DEFAULT_PROFILE, badge = null }) {
  const src = profile.profile_picture_url || "";
  const fallback = (profile.username || profile.name || "P").slice(0, 1).toUpperCase();
  return (
    <span className="profile-avatar-shell">
      <span className={`profile-avatar-core ${src ? "has-image" : ""}`}>
        {src ? <img src={src} alt="" loading="lazy" onError={(event) => { event.currentTarget.parentElement?.classList.remove("has-image"); event.currentTarget.style.display = "none"; }} /> : fallback}
      </span>
      {badge && <ProfileBadgeIcon badge={badge} />}
    </span>
  );
}

function AiPortrait({ difficulty, className = "" }) {
  const src = aiPortraitFor(difficulty);
  const label = typeof difficulty === "string" ? difficulty : difficulty?.label || difficulty?.id || "AI";
  const fallback = String(label || "AI").split(/[_\s]/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span className={`ai-portrait ${className} ${src ? "has-image" : ""}`}>
      <b>{fallback || "AI"}</b>
      {src && <img src={src} alt="" loading="lazy" onError={(event) => { event.currentTarget.parentElement?.classList.remove("has-image"); event.currentTarget.style.display = "none"; }} />}
    </span>
  );
}

function CommanderPortrait({ profile = DEFAULT_PROFILE, className = "" }) {
  const src = profile?.profile_picture_url || "";
  const fallback = (profile?.username || profile?.name || "CV").slice(0, 2).toUpperCase();
  return (
    <span className={`commander-portrait ${className} ${src ? "has-image" : ""}`}>
      <b>{fallback}</b>
      {src && <img src={src} alt="" loading="lazy" onError={(event) => { event.currentTarget.parentElement?.classList.remove("has-image"); event.currentTarget.style.display = "none"; }} />}
    </span>
  );
}

function AchievementBadge({ achievement }) {
  const src = achievementArtFor(achievement);
  const fallback = String(achievement?.title || achievement?.id || "A").split(/[_\s]/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span className={`achievement-badge-art ${src ? "has-image" : ""}`}>
      <b>{fallback || "AT"}</b>
      {src && <img src={src} alt="" loading="lazy" onError={(event) => { event.currentTarget.parentElement?.classList.remove("has-image"); event.currentTarget.style.display = "none"; }} />}
    </span>
  );
}

function createInventoryPreviewBoard() {
  const board = createBoardFromCoordinates(["a1", "c1", "e1", "b2", "d4", "f6", "h6"], ["b8", "d8", "f8", "h8", "a7", "c7", "g7"]);
  const crown = coordToSquare("d4");
  if (board[crown.row]?.[crown.col]) {
    board[crown.row][crown.col] = { ...board[crown.row][crown.col], king: true };
  }
  return board;
}

function SkinPreviewBoard({ cosmetics = {}, pieceColors = DEFAULT_PIECE_COLORS, viewMode = "2d" }) {
  const boardSkin = cosmeticClass(cosmetics.board?.cosmetic_id);
  const previewPieces = new Map([
    ["1-0", "black"],
    ["2-1", "black"],
    ["2-5", "black"],
    ["4-3", "white"],
    ["5-2", "white"],
    ["6-5", "white"],
  ]);
  return (
    <div className={`skin-preview-board view-${viewMode} ${boardSkin}`} aria-label="Equipped skin board preview">
      {Array.from({ length: 64 }, (_, index) => {
        const row = Math.floor(index / 8);
        const col = index % 8;
        const piece = previewPieces.get(`${row}-${col}`);
        const pieceCosmetic = piece ? pieceCosmeticForPlayer(cosmetics, piece) : null;
        const pieceSkin = cosmeticClass(pieceCosmetic?.cosmetic_id);
        const modelPiece = pieceCosmetic?.model_url || PIECE_MODEL_ASSETS[pieceCosmetic?.cosmetic_id] || isModelAsset(pieceCosmetic?.preview_url);
        const premium2dSkinId = isPremium2DPieceSkin(pieceCosmetic?.cosmetic_id) ? pieceCosmetic.cosmetic_id : "";
        return (
          <span key={index} className={`skin-preview-square ${isDarkSquare(row, col) ? "dark" : "light"}`}>
            {piece && <i className={`piece ${piece} ${pieceSkin} ${modelPiece ? "has-3d-model" : ""} ${premium2dSkinId ? "has-premium-svg" : ""}`} style={getRenderPieceColorStyle(pieceColors, piece, cosmetics)}>{premium2dSkinId ? <PremiumPieceSkin skinId={premium2dSkinId} player={piece} king={piece === "white" && row === 4} /> : (piece === "white" && row === 4 ? "K" : "")}</i>}
          </span>
        );
      })}
    </div>
  );
}

function AbilityCard({ label, ability, shape }) {
  return (
    <article className="ability">
      <AbilityIcon ability={ability} className={shape} />
      <div>
        <small>{label}</small>
        <strong>{ability?.name}</strong>
        <p>{ability?.description}</p>
      </div>
    </article>
  );
}

function Board({ board, selected, legalMoves, powerTargets, passiveTargets = [], tutorialTargets = [], blockedSquares, protectedSquares = [], markedPiece, cosmetics = {}, pieceColors = DEFAULT_PIECE_COLORS, boardPerspective = "white", onSquare, enableDrag = false }) {
  const boardSkin = cosmeticClass(cosmetics.board?.cosmetic_id);
  const rowOrder = boardPerspective === "black" ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const colOrder = boardPerspective === "black" ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  function handleDragStart(event, row, col, piece) {
    if (!enableDrag || !piece) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${row}-${col}`);
    onSquare(row, col);
  }
  function handleDrop(event, row, col) {
    if (!enableDrag) return;
    event.preventDefault();
    onSquare(row, col);
  }
  return (
    <div className={`board-rig ${boardSkin}`} data-board-skin={cosmetics.board?.name || "Nexus Tactical Board"} data-perspective={boardPerspective}>
      <span className="board-rail rail-top" aria-hidden="true" />
      <span className="board-rail rail-right" aria-hidden="true" />
      <span className="board-rail rail-bottom" aria-hidden="true" />
      <span className="board-rail rail-left" aria-hidden="true" />
      <span className="board-corner-chip chip-top-left" aria-hidden="true">C</span>
      <span className="board-corner-chip chip-top-right" aria-hidden="true">P</span>
      <span className="board-corner-chip chip-bottom-left" aria-hidden="true">T-04</span>
      <span className="board-corner-chip chip-bottom-right" aria-hidden="true">T-04</span>
      <div className={`board ${boardSkin}`}>
        {rowOrder.flatMap((rowIndex) =>
          colOrder.map((colIndex) => {
            const piece = board[rowIndex][colIndex];
            const dark = isDarkSquare(rowIndex, colIndex);
            const notation = squareName({ row: rowIndex, col: colIndex }).toUpperCase();
            const selectedSquare = isSameSquare(selected, { row: rowIndex, col: colIndex });
            const legal = legalMoves.find((move) => move.to.row === rowIndex && move.to.col === colIndex);
            const powerTarget = powerTargets.some((item) => item.row === rowIndex && item.col === colIndex);
            const passiveTarget = passiveTargets.some((item) => item.row === rowIndex && item.col === colIndex);
            const tutorialTarget = tutorialTargets.find((item) => item.row === rowIndex && item.col === colIndex);
            const blocked = blockedSquares.some((item) => item.row === rowIndex && item.col === colIndex);
            const protectedSquare = protectedSquares.some((item) => item.row === rowIndex && item.col === colIndex);
            const marked = piece && markedPiece?.id === piece.id;
            const pieceCosmetic = piece ? pieceCosmeticForPlayer(cosmetics, piece.player) : null;
            const pieceSkin = cosmeticClass(pieceCosmetic?.cosmetic_id);
            const modelPiece = pieceCosmetic?.model_url || PIECE_MODEL_ASSETS[pieceCosmetic?.cosmetic_id] || isModelAsset(pieceCosmetic?.preview_url);
            const premium2dSkinId = isPremium2DPieceSkin(pieceCosmetic?.cosmetic_id) ? pieceCosmetic.cosmetic_id : "";
            return (
              <button
                key={`${rowIndex}-${colIndex}`}
                className={`square ${dark ? "dark" : "light"} ${selectedSquare ? "selected" : ""} ${legal ? (legal.captured ? "capture" : "move") : ""} ${powerTarget ? "power-target" : ""} ${passiveTarget ? "passive-target" : ""} ${tutorialTarget ? `tutorial-${tutorialTarget.kind || "target"}` : ""} ${blocked ? "blocked" : ""} ${protectedSquare ? "protected" : ""} ${marked ? "marked" : ""}`}
                onClick={() => onSquare(rowIndex, colIndex)}
                onDragOver={(event) => enableDrag && event.preventDefault()}
                onDrop={(event) => handleDrop(event, rowIndex, colIndex)}
                aria-label={squareName({ row: rowIndex, col: colIndex })}
              >
                {!piece && dark && <span className="square-label">{notation}</span>}
                {piece && (
                  <span className={`piece ${piece.player} ${piece.king ? "king" : ""} ${pieceSkin} ${modelPiece ? "has-3d-model" : ""} ${premium2dSkinId ? "has-premium-svg" : ""}`} style={getRenderPieceColorStyle(pieceColors, piece.player, cosmetics)} draggable={enableDrag} onDragStart={(event) => handleDragStart(event, rowIndex, colIndex, piece)}>
                    {premium2dSkinId ? <PremiumPieceSkin skinId={premium2dSkinId} player={piece.player} king={piece.king} /> : <><em aria-hidden="true" />{piece.king && <b>K</b>}</>}
                  </span>
                )}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

function Summary({ label, value }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function Meter({ label, value, color }) {
  return (
    <div className="meter">
      <div><span>{label}</span><strong>{value}</strong></div>
      <i><b className={color} style={{ width: `${(value / 12) * 100}%` }} /></i>
    </div>
  );
}

function normalizeLoadoutAbility(ability, type, faction) {
  return {
    ...ability,
    type,
    tag: type === "passive" ? "Passive Core" : "Ultimate Charge",
    accent: factionAccent(faction.id),
    costLabel: type === "passive" ? "Always active" : `${ability.cost || 2} Momentum`,
    lore: `${faction.name}: ${faction.lore}`,
    specs: abilitySpecs(ability.id, ability.description),
  };
}

function factionAccent(factionId) {
  if (factionId === "nomads") {
    return "amber";
  }
  if (factionId === "iron_guard") {
    return "cobalt";
  }
  if (factionId === "sun_court") {
    return "solar";
  }
  return "void";
}

function abilitySpecs(id, fallback) {
  const specs = {
    open_roads: ["Works only when Azure has no mandatory capture.", "A normal piece may move one diagonal square backward.", "Creates escape routes without spending Momentum."],
    dust_veil: ["Triggers after a quiet Azure move.", "The moved piece is protected from capture for the enemy turn.", "Great for baiting overextended AI pieces."],
    dash: ["Costs 2 Momentum and one ultimate use.", "Moves a normal piece exactly two diagonal empty squares.", "Cannot be used while Azure has a mandatory capture."],
    sandstorm_corridor: ["Costs 2 Momentum.", "Choose two empty dark squares.", "Enemy quiet landings are blocked for one turn; captures still punch through."],
    shield_wall: ["Triggers once per match.", "Move into a highlighted center square: c3, e3, d4, f4, c5, e5, d6, or f6.", "The guarded piece cannot be captured during the enemy turn."],
    vengeance_ledger: ["Triggers up to twice after Azure loses a piece.", "Your next capture grants one extra Momentum.", "Best for comeback lines after sacrifice traps."],
    fortify: ["Costs 2 Momentum and consumes the turn.", "Choose one Azure piece to protect.", "That piece cannot be captured for two enemy turns, even if it moves."],
    barricade: ["Costs 2 Momentum.", "Choose two empty dark squares.", "No piece may land on those squares for the enemy turn."],
    royal_pressure: ["Triggers once per match.", "A normal piece entering the enemy final three rows gains Momentum.", "Rewards fast promotion pressure."],
    crown_tax: ["Triggers once per match.", "When the opponent promotes, gain 2 Momentum.", "Turns an enemy king into a comeback resource."],
    crown_surge: ["Costs 2 Momentum and consumes the turn.", "Choose a normal piece in the middle four rows.", "That piece becomes a king immediately."],
    sun_lance: ["Costs 2 Momentum before the move.", "Choose a normal piece with an enemy on any diagonal line.", "That piece strikes like a king for one capture, landing beyond the target."],
    pressure_field: ["Triggers once per match.", "If your move gives the AI a capture threat, gain Momentum.", "Useful for risky bait and counterplay."],
    echo_mark: ["Marks the AI's quiet move.", "Capture the marked piece before it escapes.", "Claiming the mark grants one Momentum."],
    phase_shift: ["Costs 2 Momentum.", "Teleport a normal piece up to 3 squares to any empty dark square, ignoring blockers.", "Cannot be used during a mandatory capture."],
    collapse: ["Costs 2 Momentum.", "Choose one empty dark square.", "No piece may land there for the enemy turn."],
  };
  return specs[id] || [fallback];
}

function getPassiveBattleStatus(passiveId, abilityFlags, { isClassic = false, isPlayerTurn = false } = {}) {
  if (isClassic) {
    return "No abilities enabled";
  }
  if (passiveId === "shield_wall") {
    if (abilityFlags?.shieldWall) {
      return "Center guard used";
    }
    return isPlayerTurn ? "Ready: enter center" : "Ready for your move";
  }
  return "Always Active";
}

function createAbilityFlags() {
  return {
    shieldWall: false,
    vengeanceReady: false,
    vengeanceTriggers: 0,
    royalPressure: false,
    crownTax: false,
    pressureField: false,
  };
}

function isCenterSquare(square) {
  return square.row >= 2 && square.row <= 5 && square.col >= 2 && square.col <= 5;
}

function isPlayableCenterSquare(row, col) {
  return isCenterSquare({ row, col }) && isDarkSquare(row, col);
}

function addProtectedSquare(protectedSquares, square, source, options = {}) {
  const next = protectedSquares.filter((item) => {
    if (options.pieceId && item.pieceId) {
      return item.pieceId !== options.pieceId;
    }
    return item.row !== square.row || item.col !== square.col;
  });
  return [...next, {
    row: square.row,
    col: square.col,
    source,
    pieceId: options.pieceId || null,
    owner: options.owner || "white",
    enemyTurnsRemaining: Math.max(1, Number(options.enemyTurnsRemaining || 1)),
  }];
}

function refreshProtectedSquaresAfterMove(protectedSquares, move, result) {
  return protectedSquares
    .filter((item) => !result.capturedPiece?.id || item.pieceId !== result.capturedPiece.id)
    .map((item) => (item.pieceId && item.pieceId === result.piece.id
      ? { ...item, row: move.to.row, col: move.to.col }
      : item));
}

function expireProtectedSquaresAfterTurn(protectedSquares, movingPlayer) {
  return protectedSquares.flatMap((item) => {
    const owner = item.owner || "white";
    if (owner === movingPlayer) {
      return [item];
    }
    const remaining = Number(item.enemyTurnsRemaining ?? item.remainingEnemyTurns ?? 1) - 1;
    if (remaining <= 0) {
      return [];
    }
    return [{ ...item, enemyTurnsRemaining: remaining }];
  });
}

function normalizeProfile(profile) {
  const username = profile.username || profile.name || DEFAULT_PROFILE.username;
  return {
    ...DEFAULT_PROFILE,
    ...profile,
    name: username,
    username,
    current_exp: Number(profile.current_exp ?? DEFAULT_PROFILE.current_exp),
    level: Number(profile.level ?? DEFAULT_PROFILE.level),
    essence: Number(profile.essence ?? DEFAULT_PROFILE.essence),
    shards: Number(profile.shards ?? DEFAULT_PROFILE.shards),
    is_admin: Boolean(profile.is_admin ?? DEFAULT_PROFILE.is_admin),
    is_pro: Boolean(profile.is_pro ?? DEFAULT_PROFILE.is_pro),
    unlocked_factions: profile.unlocked_factions || DEFAULT_PROFILE.unlocked_factions,
    unlocked_abilities: profile.unlocked_abilities || DEFAULT_PROFILE.unlocked_abilities || ["open_roads", "dash"],
    owned_cosmetics: profile.owned_cosmetics || [],
    earned_badges: profile.earned_badges || profile.earnedBadges || [],
    achievements_claimed: profile.achievements_claimed || [],
    active_quests: normalizeQuests(profile.active_quests),
    settings: normalizeSettings(profile.settings),
    streaks: normalizeStreaks(profile.streaks),
    equipped_piece_skin: profile.equipped_piece_skin || profile.equippedPieceSkin || "",
    equipped_board_skin: profile.equipped_board_skin || profile.equippedBoardSkin || "",
    equipped_badge: profile.equipped_badge || profile.equippedBadge || "",
  };
}

function profileFromApiPayload(payload, fallback = DEFAULT_PROFILE) {
  const profile = payload?.profile || payload?.data?.profile || payload?.data || payload;
  if (!profile || typeof profile !== "object") {
    return normalizeProfile(fallback);
  }
  return normalizeProfile({
    ...fallback,
    ...profile,
    essence: profile.essence ?? fallback.essence ?? 0,
    shards: profile.shards ?? fallback.shards ?? 0,
    current_exp: profile.current_exp ?? fallback.current_exp ?? 0,
    level: profile.level ?? fallback.level ?? 1,
  });
}

function hasPlayableSession(session) {
  return Boolean(session?.user?.id && (session.access_token || session.offline || session.admin));
}

function createGuestProfile() {
  return normalizeProfile({
    ...DEFAULT_PROFILE,
    name: "Guest",
    username: "Guest",
    email: "",
    city: "Global",
    bio: "Guest trial commander. Login required for progression.",
    current_exp: 0,
    level: 1,
    essence: 0,
    shards: 0,
    is_admin: false,
    unlocked_factions: ["nomads"],
    unlocked_abilities: ["open_roads", "dash"],
    owned_cosmetics: [],
    earned_badges: [],
    achievements_claimed: [],
    active_quests: [],
    streaks: { loginDays: 0, dailyPuzzle: 0, dailyWin: 0, lastLoginDate: null },
    equipped_piece_skin: "",
    equipped_board_skin: "",
    equipped_badge: "",
  });
}

function createStarterProfile(username, email, currentProfile = DEFAULT_PROFILE) {
  return normalizeProfile({
    ...DEFAULT_PROFILE,
    username,
    name: username,
    email,
    city: currentProfile.city && currentProfile.city !== "Global" ? currentProfile.city : "Almaty",
    profile_picture_url: "",
    bio: "",
    current_exp: 0,
    level: 1,
    essence: 0,
    shards: 0,
    is_admin: false,
    unlocked_factions: ["nomads"],
    unlocked_abilities: ["open_roads", "dash"],
    owned_cosmetics: [],
    earned_badges: [],
    saved_loadouts: [{ name: "Nomad Starter", faction_id: "nomads", passive_id: "open_roads", ultimate_id: "dash", is_active: true }],
    active_quests: [],
    achievements_claimed: [],
    settings: normalizeSettings({ ...currentProfile.settings, onboardingCompleted: false }),
    streaks: { loginDays: 0, dailyPuzzle: 0, dailyWin: 0, lastLoginDate: null },
    equipped_piece_skin: "",
    equipped_board_skin: "",
    equipped_badge: "",
  });
}

function toProfileUpsert(userId, profile) {
  return {
    user_id: userId,
    username: profile.username,
    profile_picture_url: profile.profile_picture_url || null,
    bio: profile.bio || "",
    city: profile.city || "Almaty",
    current_exp: profile.current_exp || 0,
    level: profile.level || 1,
    essence: profile.essence || 0,
    shards: profile.shards || 0,
    is_admin: profile.is_admin || false,
    unlocked_factions: profile.unlocked_factions || ["nomads"],
    unlocked_abilities: profile.unlocked_abilities || ["open_roads", "dash"],
    owned_cosmetics: profile.owned_cosmetics || [],
    earned_badges: profile.earned_badges || [],
    saved_loadouts: profile.saved_loadouts || [],
    active_quests: profile.active_quests || [],
    settings: normalizeSettings(profile.settings),
    streaks: profile.streaks || DEFAULT_PROFILE.streaks,
    achievements_claimed: profile.achievements_claimed || [],
    equipped_piece_skin: profile.equipped_piece_skin || profile.equippedPieceSkin || null,
    equipped_board_skin: profile.equipped_board_skin || profile.equippedBoardSkin || null,
    equipped_badge: profile.equipped_badge || profile.equippedBadge || null,
  };
}

function normalizeSettings(settings = {}) {
  const theme = settings?.theme === "light" ? "light" : "dark";
  return {
    ...DEFAULT_SETTINGS,
    ...(settings || {}),
    masterVolume: Number(settings?.masterVolume ?? DEFAULT_SETTINGS.masterVolume),
    musicVolume: Number(settings?.musicVolume ?? DEFAULT_SETTINGS.musicVolume),
    sfxVolume: Number(settings?.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume),
    voiceVolume: Number(settings?.voiceVolume ?? DEFAULT_SETTINGS.voiceVolume),
    musicEnabled: Boolean(settings?.musicEnabled ?? DEFAULT_SETTINGS.musicEnabled),
    sfxEnabled: Boolean(settings?.sfxEnabled ?? DEFAULT_SETTINGS.sfxEnabled),
    voiceEnabled: Boolean(settings?.voiceEnabled ?? DEFAULT_SETTINGS.voiceEnabled),
    reducedMotion: Boolean(settings?.reducedMotion ?? DEFAULT_SETTINGS.reducedMotion),
    theme,
    musicTrack: MENU_MUSIC_TRACKS.some((track) => track.id === settings?.musicTrack) ? settings.musicTrack : DEFAULT_SETTINGS.musicTrack,
    onboardingCompleted: Boolean(settings?.onboardingCompleted ?? DEFAULT_SETTINGS.onboardingCompleted),
    boardPreferences: normalizeBoardPreferences(settings?.boardPreferences),
  };
}

function musicTrackTitle(trackId) {
  return MENU_MUSIC_TRACKS.find((track) => track.id === trackId)?.title || MENU_MUSIC_TRACKS[0]?.title || "Echoes of the Void";
}

function normalizeBoardPreferences(preferences = {}) {
  return {
    viewMode: preferences?.viewMode === "2d" ? "2d" : "3d",
    pieceColors: normalizePieceColors(preferences?.pieceColors),
  };
}

function defaultBoardPreferencesForDevice() {
  const mobile = typeof window !== "undefined" && window.matchMedia?.("(max-width: 760px)")?.matches;
  return {
    ...DEFAULT_BOARD_PREFERENCES,
    viewMode: mobile ? "2d" : "3d",
  };
}

function boardPreferencesEqual(left = {}, right = {}) {
  const normalizedLeft = normalizeBoardPreferences(left);
  const normalizedRight = normalizeBoardPreferences(right);
  return normalizedLeft.viewMode === normalizedRight.viewMode
    && normalizedLeft.pieceColors.white === normalizedRight.pieceColors.white
    && normalizedLeft.pieceColors.black === normalizedRight.pieceColors.black;
}

function normalizePieceColors(colors = {}) {
  return {
    white: normalizeColorValue(colors?.white, DEFAULT_PIECE_COLORS.white),
    black: normalizeColorValue(colors?.black, DEFAULT_PIECE_COLORS.black),
  };
}

function normalizeColorValue(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toUpperCase();
  const shortHex = trimmed.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (shortHex) return `#${shortHex.slice(1).map((part) => part + part).join("")}`.toUpperCase();
  const rgb = trimmed.match(/^rgba?\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})(?:,\s*(?:0|1|0?\.\d+))?\)$/i);
  if (rgb) {
    const values = rgb.slice(1, 4).map((part) => Math.max(0, Math.min(255, Number(part))));
    return `#${values.map((number) => number.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  }
  return fallback;
}

function toHexInput(value) {
  return normalizeColorValue(value, DEFAULT_PIECE_COLORS.white);
}

function paletteIdForColor(value) {
  const hex = normalizeColorValue(value, "");
  return PIECE_COLOR_PALETTE.find((item) => item.hex.toUpperCase() === hex)?.id || "custom";
}

function getPieceColorHex(pieceColors, player) {
  const colors = normalizePieceColors(pieceColors);
  return player === "white" ? colors.white : colors.black;
}

function getPieceColorStyle(pieceColors, player) {
  const hex = getPieceColorHex(pieceColors, player);
  return {
    "--piece-main": hex,
    "--piece-highlight": shiftHexColor(hex, 44),
    "--piece-deep": shiftHexColor(hex, -64),
    "--piece-glow": hexToRgba(hex, 0.36),
    "--piece-core": hexToRgba(hex, 0.72),
  };
}

function makeThreePieceColor(hex) {
  return {
    main: new THREE.Color(hex),
    dark: new THREE.Color(shiftHexColor(hex, -72)),
    emissive: new THREE.Color(shiftHexColor(hex, -112)),
  };
}

function shiftHexColor(hex, amount) {
  const normalized = normalizeColorValue(hex, "#000000").slice(1);
  const channels = [0, 2, 4].map((index) => Math.max(0, Math.min(255, Number.parseInt(normalized.slice(index, index + 2), 16) + amount)));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function hexToRgba(hex, alpha) {
  const normalized = normalizeColorValue(hex, "#000000").slice(1);
  const channels = [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16));
  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
}

function normalizeStreaks(streaks = {}) {
  return {
    ...DEFAULT_PROFILE.streaks,
    ...(streaks || {}),
    loginDays: Number(streaks?.loginDays ?? DEFAULT_PROFILE.streaks.loginDays),
    dailyPuzzle: Number(streaks?.dailyPuzzle ?? DEFAULT_PROFILE.streaks.dailyPuzzle),
    dailyWin: Number(streaks?.dailyWin ?? DEFAULT_PROFILE.streaks.dailyWin),
    lastLoginDate: streaks?.lastLoginDate || DEFAULT_PROFILE.streaks.lastLoginDate,
  };
}

function getAdminUserId() {
  const key = "dama-admin-user-id";
  const existing = localStorage.getItem(key);
  if (existing) {
    return existing;
  }
  const generated = "00000000-0000-4000-8000-00000000ad01";
  localStorage.setItem(key, generated);
  return generated;
}

function createAdminProfile(currentProfile, factions = []) {
  const allFactionIds = factions.length ? factions.map((faction) => faction.id) : ["nomads", "iron_guard", "sun_court", "void_order"];
  const allAbilityIds = factions.flatMap((faction) => [
    ...(faction.passives || []).map((ability) => ability.id),
    ...(faction.ultimates || []).map((ability) => ability.id),
  ]);
  const fallbackAbilities = ["open_roads", "dust_veil", "dash", "sandstorm_corridor", "shield_wall", "vengeance_ledger", "fortify", "barricade", "royal_pressure", "crown_tax", "crown_surge", "sun_lance", "pressure_field", "echo_mark", "phase_shift", "collapse"];
  const firstFaction = factions.find((faction) => faction.id === "void_order") || factions[0];
  return normalizeProfile({
    ...currentProfile,
    ...ADMIN_PROFILE_PATCH,
    streaks: { ...ADMIN_PROFILE_PATCH.streaks, lastLoginDate: currentDateKey() },
    unlocked_factions: allFactionIds,
    unlocked_abilities: allAbilityIds.length ? allAbilityIds : fallbackAbilities,
    owned_cosmetics: DEFAULT_VAULT_ITEMS.map((item) => item.cosmetic_id),
    earned_badges: DEFAULT_BADGE_ITEMS.map((item) => item.cosmetic_id),
    achievements_claimed: ACHIEVEMENT_CATALOG.map((achievement) => achievement.id),
    active_quests: normalizeQuests(DEFAULT_QUESTS).map((quest) => ({ ...quest, progress_count: quest.target_count, is_completed: true })),
    saved_loadouts: factions.map((faction, index) => ({
      name: `${faction.name} Admin`,
      faction_id: faction.id,
      passive_id: faction.passives?.[0]?.id || "open_roads",
      ultimate_id: faction.ultimates?.[0]?.id || "dash",
      is_active: index === 0,
    })),
    profile_picture_url: currentProfile.profile_picture_url || "",
    favorite_faction: firstFaction?.id || "void_order",
    equipped_piece_skin: "pieces_cosmos",
    equipped_board_skin: "",
    equipped_badge: "badge_global_champion",
    settings: normalizeSettings({ ...currentProfile.settings, onboardingCompleted: true }),
  });
}

function normalizePublicProfile(profile = {}) {
  const username = profile.username || profile.name || "Remote_Commander";
  const initials = profile.avatar || username.split(/[_\s]/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "RC";
  return {
    ...profile,
    user_id: profile.user_id || profile.id || `demo-${username}`,
    username,
    name: username,
    avatar: initials,
    bio: profile.bio || "A commander from the Nexus ladder.",
    city: profile.city || "Global",
    level: Number(profile.level || 1),
    favorite_faction: profile.favorite_faction || profile.faction || "nomads",
    presence: profile.presence || profile.status || "online",
    pvp_stats: {
      wins: Number(profile.pvp_stats?.wins || profile.wins || 0),
      losses: Number(profile.pvp_stats?.losses || profile.losses || 0),
      current_win_streak: Number(profile.pvp_stats?.current_win_streak || profile.current_win_streak || 0),
      mmr_elo_rating: Number(profile.pvp_stats?.mmr_elo_rating || profile.elo || 1000),
    },
    threat: profile.threat || inferThreat(profile.pvp_stats || profile),
  };
}

function normalizeChallenge(challenge = {}) {
  const fromProfile = normalizePublicProfile({
    ...(challenge.from_profile || {}),
    user_id: challenge.from_user_id || challenge.from_profile?.user_id,
  });
  const targetProfile = normalizePublicProfile({
    ...(challenge.target_profile || {}),
    user_id: challenge.target_user_id || challenge.target_profile?.user_id,
  });
  return {
    ...challenge,
    challenge_id: challenge.challenge_id || challenge.id || `local-${Date.now()}`,
    from_user_id: String(challenge.from_user_id || fromProfile.user_id || ""),
    target_user_id: String(challenge.target_user_id || targetProfile.user_id || ""),
    from_profile: fromProfile,
    target_profile: targetProfile,
    loadout: challenge.loadout || DEFAULT_LOADOUT,
    skinIds: normalizeSkinIds(challenge.skinIds || challenge.skin_ids || {}),
    status: challenge.status || "pending",
  };
}

function shortPlayerId(userId) {
  const text = String(userId || "");
  if (!text) {
    return "No ID";
  }
  return text.startsWith("demo-") ? "Demo" : `ID ${text.slice(0, 8)}`;
}

function normalizeFriendsData(payload = {}) {
  return {
    friends: (payload.friends || []).map(normalizePublicProfile),
    incoming: (payload.incoming || []).map((item) => ({ ...item, profile: normalizePublicProfile(item.profile) })),
    outgoing: (payload.outgoing || []).map((item) => ({ ...item, profile: normalizePublicProfile(item.profile) })),
  };
}

function inferThreat(stats = {}) {
  const wins = Number(stats.wins || 0);
  const losses = Number(stats.losses || 0);
  const streak = Number(stats.current_win_streak || 0);
  if (wins + losses === 0) {
    return "Unknown";
  }
  if (wins > losses * 1.4 || streak >= 3) {
    return "Aggressive";
  }
  if (losses > wins) {
    return "Defensive";
  }
  return "Tactical";
}

function fallbackCampaignFaction(id) {
  const data = {
    nomads: { id: "nomads", name: "Steppe Nomads", crest: "N", lore: "Win by tempo, escape routes, and sudden board control." },
    iron_guard: { id: "iron_guard", name: "Iron Guard", crest: "G", lore: "Hold the center, survive attacks, and punish overextension." },
    sun_court: { id: "sun_court", name: "Sun Court", crest: "S", lore: "Race for promotion and turn kings into pressure." },
    void_order: { id: "void_order", name: "Void Order", crest: "V", lore: "Disrupt lanes, mark mistakes, and bend board geometry." },
  };
  return data[id] || data.nomads;
}

function abilityNameFromFaction(faction = {}, abilityId = "", fallback = "Ability") {
  const abilities = [...(faction.passives || []), ...(faction.ultimates || [])];
  return abilities.find((ability) => ability.id === abilityId || ability.ability_id === abilityId)?.name || fallback;
}

function factionUnlockText(faction = {}) {
  if (faction.id === "void_order") {
    return "Aether Pro";
  }
  const level = faction.unlock_requirement?.level || faction.required_level_to_unlock;
  return level ? `Level ${level}` : faction.unlock_label || "Locked";
}

function createVersusMatchup(playerProfile, opponentProfile, role, roomCode, loadout, factions) {
  const faction = factions.find((item) => item.id === loadout?.factionId);
  return {
    role,
    roomCode,
    player: normalizePublicProfile({
      ...playerProfile,
      favorite_faction: faction?.name || loadout?.factionId || "nomads",
    }),
    opponent: normalizePublicProfile(opponentProfile || {
      username: role === "host" ? "Awaiting_Rival" : "Room_Host",
      avatar: role === "host" ? "AR" : "RH",
      city: "Unknown sector",
      bio: "Opponent intel will resolve when the commander joins.",
      pvp_stats: { mmr_elo_rating: 1000 },
      threat: "Unknown",
    }),
  };
}

function generateJoinCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint8Array(6);
  if (crypto.getRandomValues) {
    crypto.getRandomValues(values);
  } else {
    values.forEach((_, index) => {
      values[index] = Math.floor(Math.random() * alphabet.length);
    });
  }
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

function sanitizeLobbyCode(value = "") {
  return String(value).replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase();
}

function lobbyStorageKey(code) {
  return `aether-lobby-${sanitizeLobbyCode(code)}`;
}

function readLobbyState(code) {
  const cleanCode = sanitizeLobbyCode(code);
  return cleanCode ? loadJson(lobbyStorageKey(cleanCode), null) : null;
}

function writeLobbyState(state) {
  if (!state?.code) {
    return;
  }
  saveJson(lobbyStorageKey(state.code), state);
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(`aether-lobby-${state.code}`);
    channel.postMessage({ type: "lobby_state", state });
    channel.close();
  }
}

function mergeLobbyState(current, incoming) {
  if (!incoming?.code) {
    return current || incoming;
  }
  const next = {
    ...(current || {}),
    ...incoming,
    host: newestLobbyPlayer(current?.host, incoming.host),
    guest: newestLobbyPlayer(current?.guest, incoming.guest),
    updatedAt: latestTimestamp(current?.updatedAt, incoming.updatedAt),
  };
  next.status = next.host?.ready && next.guest?.ready ? "ready_check" : incoming.status || current?.status || "configuring";
  return next;
}

function lobbyStateFromRoomUpdate(payload = {}, current = null, fallbackCode = "", factions = []) {
  const room = payload.room || {};
  const code = sanitizeLobbyCode(room.room_code || fallbackCode || current?.code);
  const roomPlayers = room.lobby_players && typeof room.lobby_players === "object" ? Object.values(room.lobby_players) : [];
  const players = Array.isArray(payload.players) && payload.players.length ? payload.players : roomPlayers;
  const hostEntry = players.find((player) => player.role === "host" || String(player.user_id) === String(room.host_user_id));
  const guestEntry = players.find((player) => player.role === "guest" || String(player.user_id) === String(room.guest_user_id));
  return {
    ...(current || {}),
    code,
    status: room.status || current?.status || "configuring",
    host: hostEntry ? lobbyPlayerFromServer(hostEntry, factions) : current?.host || null,
    guest: guestEntry ? lobbyPlayerFromServer(guestEntry, factions) : current?.guest || null,
    createdAt: room.created_at || current?.createdAt || new Date().toISOString(),
    updatedAt: room.updated_at || new Date().toISOString(),
  };
}

function lobbyPlayerFromServer(player = {}, factions = []) {
  const username = player.username || player.name || "Commander";
  return {
    user_id: player.user_id,
    username,
    avatar: player.avatar || username.split(/[_\s]/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "C",
    profile_picture_url: player.profile_picture_url || "",
    city: player.city || "Global",
    level: Number(player.level || 1),
    bio: player.bio || "",
    loadout: normalizeLobbyLoadout(player.loadout || DEFAULT_LOADOUT, factions),
    skinIds: normalizeSkinIds(player.skinIds || player.skin_ids || {}),
    ready: Boolean(player.ready),
    connected: Boolean(player.connected),
    updatedAt: player.updatedAt || player.updated_at || new Date().toISOString(),
  };
}

function newestLobbyPlayer(current, incoming) {
  if (!current) {
    return incoming || null;
  }
  if (!incoming) {
    return current;
  }
  return new Date(incoming.updatedAt || 0).getTime() >= new Date(current.updatedAt || 0).getTime() ? incoming : current;
}

function latestTimestamp(left, right) {
  return new Date(right || 0).getTime() >= new Date(left || 0).getTime() ? right || left || new Date().toISOString() : left || right || new Date().toISOString();
}

function createLobbyState(code, role, player) {
  const cleanCode = sanitizeLobbyCode(code);
  return {
    code: cleanCode,
    status: "waiting",
    host: role === "host" ? player : null,
    guest: role === "guest" ? player : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createLobbyPlayer(profile, userId, loadout, factions = [], skinIds = {}) {
  const safeLoadout = normalizeLobbyLoadout(loadout, factions);
  return {
    user_id: userId,
    username: profile.username || profile.name || "Commander",
    avatar: profile.profile_picture_url ? "" : (profile.username || profile.name || "C").slice(0, 2).toUpperCase(),
    profile_picture_url: profile.profile_picture_url || "",
    city: profile.city || "Global",
    level: profile.level || 1,
    bio: profile.bio || "",
    loadout: safeLoadout,
    skinIds: normalizeSkinIds(skinIds),
    ready: false,
    connected: true,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeLobbyLoadout(loadout, factions = []) {
  const faction = factions.find((item) => item.id === loadout?.factionId) || factions[0];
  if (!faction) {
    return loadout || DEFAULT_LOADOUT;
  }
  return {
    factionId: faction.id,
    passiveId: faction.passives?.some((item) => item.id === loadout?.passiveId) ? loadout.passiveId : faction.passives?.[0]?.id || "open_roads",
    ultimateId: faction.ultimates?.some((item) => item.id === loadout?.ultimateId) ? loadout.ultimateId : faction.ultimates?.[0]?.id || "dash",
  };
}

function normalizeQuests(quests = []) {
  if (!Array.isArray(quests) || quests.length === 0) {
    return [];
  }
  const incoming = quests;
  const catalog = Object.fromEntries(DEFAULT_QUESTS.map((quest) => [quest.quest_id, quest]));
  return incoming.map((quest) => {
    const base = catalog[quest.quest_id] || quest;
    return {
      ...base,
      ...quest,
      progress_count: Number(quest.progress_count || 0),
      target_count: Number(quest.target_count || base.target_count || 1),
      reward_shards: Number(quest.reward_shards ?? base.reward_shards ?? 0),
      is_completed: Boolean(quest.is_completed),
    };
  });
}

function updateQuestProgress(quests, event) {
  const completed = [];
  const normalized = normalizeQuests(quests);
  if (normalized.length === 0) {
    return { quests: [], completed, rewardShards: 0 };
  }
  const next = normalized.map((quest) => {
    if (quest.is_completed) {
      return quest;
    }
    const increment = quest.quest_id === "daily_capture_5"
      ? event.captured
      : quest.quest_id === "daily_ai_win" && event.aiWin
        ? 1
        : quest.quest_id === "daily_campaign_clear" && event.campaignClear
          ? 1
          : quest.quest_id === "daily_puzzle_solve" && event.puzzleSolve
            ? 1
            : 0;
    if (!increment) {
      return quest;
    }
    const progress = Math.min(quest.target_count, quest.progress_count + increment);
    const updated = { ...quest, progress_count: progress, is_completed: progress >= quest.target_count };
    if (updated.is_completed) {
      completed.push(updated);
    }
    return updated;
  });
  return {
    quests: next,
    completed,
    rewardShards: completed.reduce((sum, quest) => sum + quest.reward_shards, 0),
  };
}

function battlePassStorageKey(ownerId) {
  return `dama-battle-pass-${ownerId || "guest"}`;
}

function createBattlePassState(date = new Date()) {
  return normalizeBattlePassState({
    season_id: BATTLE_PASS_SEASON.id,
    xp: 0,
    unlocked_tiers: [],
    missions: createBattlePassMissionState(date),
  }, date);
}

function createCompletedBattlePassState(date = new Date()) {
  return normalizeBattlePassState({
    season_id: BATTLE_PASS_SEASON.id,
    xp: BATTLE_PASS_TIERS.at(-1)?.required_xp || 0,
    unlocked_tiers: BATTLE_PASS_TIERS.map((tier) => tier.tier),
    missions: createBattlePassMissionState(date).map((mission) => ({
      ...mission,
      progress_count: mission.target_count,
      is_completed: true,
      xp_claimed: true,
    })),
  }, date);
}

function createBattlePassMissionState(date = new Date()) {
  return BATTLE_PASS_MISSIONS.map((mission) => ({
    ...mission,
    period_key: battlePassPeriodKey(mission.cadence, date),
    progress_count: 0,
    is_completed: false,
    xp_claimed: false,
  }));
}

function normalizeBattlePassState(state = {}, date = new Date()) {
  const storedMissions = new Map((Array.isArray(state?.missions) ? state.missions : []).map((mission) => [mission.mission_id, mission]));
  const maxXp = BATTLE_PASS_TIERS.at(-1)?.required_xp || 0;
  const missions = BATTLE_PASS_MISSIONS.map((base) => {
    const stored = storedMissions.get(base.mission_id) || {};
    const periodKey = battlePassPeriodKey(base.cadence, date);
    const samePeriod = stored.period_key === periodKey;
    const target = Number(base.target_count || 1);
    const progress = samePeriod ? Math.max(0, Math.min(target, Number(stored.progress_count || 0))) : 0;
    const complete = samePeriod && Boolean(stored.is_completed || progress >= target);
    return {
      ...base,
      period_key: periodKey,
      progress_count: progress,
      target_count: target,
      battle_pass_xp: Number(base.battle_pass_xp || 0),
      is_completed: complete,
      pro_reward: Boolean(base.pro_reward),
      xp_claimed: samePeriod && Boolean(stored.xp_claimed),
    };
  });
  return {
    season_id: state?.season_id || BATTLE_PASS_SEASON.id,
    xp: Math.max(0, Math.min(maxXp, Number(state?.xp || 0))),
    unlocked_tiers: [...new Set((state?.unlocked_tiers || []).map(Number).filter((tier) => BATTLE_PASS_TIERS.some((item) => item.tier === tier)))].sort((a, b) => a - b),
    missions,
  };
}

function battlePassPeriodKey(cadence, date = new Date()) {
  return cadence === "weekly" ? battlePassWeekKey(date) : currentDateKey(date);
}

function battlePassWeekKey(date = new Date()) {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((copy - yearStart) / 86400000) + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function createBattlePassMissionEvent({ result, captured, mode, gameVariant, loadout = DEFAULT_LOADOUT, ultimateUsed = false }) {
  const win = result === "win";
  const factionId = loadout?.factionId || loadout?.faction_id;
  const ultimateId = loadout?.ultimateId || loadout?.ultimate_id;
  return {
    matches: 1,
    wins: win ? 1 : 0,
    captures: Number(captured || 0),
    powerMatches: gameVariant === "power" ? 1 : 0,
    nomadDashWins: win && gameVariant === "power" && factionId === "nomads" && ultimateId === "dash" && ultimateUsed ? 1 : 0,
    ironFortifyWins: win && gameVariant === "power" && factionId === "iron_guard" && ultimateId === "fortify" ? 1 : 0,
    sunCourtWins: win && gameVariant === "power" && factionId === "sun_court" ? 1 : 0,
    campaignWins: mode === "campaign" && win ? 1 : 0,
    puzzleWins: mode === "puzzle" && win ? 1 : 0,
    pvpWins: mode === "multiplayer" && win ? 1 : 0,
  };
}

function progressBattlePassMissions(state, event = {}, profile = DEFAULT_PROFILE) {
  const normalized = normalizeBattlePassState(state);
  const completedMissions = [];
  const proLockedMissions = [];
  const proActive = hasAetherPro(profile);
  let xpGained = 0;
  const missions = normalized.missions.map((mission) => {
    if (mission.is_completed && mission.xp_claimed) {
      return mission;
    }
    const increment = Math.max(0, Number(event[mission.metric] || 0));
    if (!increment && !mission.is_completed) {
      return mission;
    }
    const progress = Math.min(mission.target_count, mission.progress_count + increment);
    const complete = progress >= mission.target_count;
    const proBlocked = mission.pro_reward && complete && !proActive;
    const newlyClaimed = complete && !mission.xp_claimed && !proBlocked;
    const updated = { ...mission, progress_count: progress, is_completed: complete, xp_claimed: complete && !proBlocked ? true : mission.xp_claimed };
    if (newlyClaimed) {
      xpGained += mission.battle_pass_xp;
      completedMissions.push(updated);
    } else if (proBlocked && progress >= mission.target_count && mission.progress_count < mission.target_count) {
      proLockedMissions.push(updated);
    }
    return updated;
  });
  return {
    state: { ...normalized, missions },
    xpGained,
    completedMissions,
    proLockedMissions,
  };
}

function applyBattlePassXp(state, xpGained = 0) {
  const normalized = normalizeBattlePassState(state);
  const oldUnlocked = new Set(normalized.unlocked_tiers);
  const maxXp = BATTLE_PASS_TIERS.at(-1)?.required_xp || 0;
  const nextXp = Math.max(0, Math.min(maxXp, normalized.xp + Number(xpGained || 0)));
  const unlockedTiers = BATTLE_PASS_TIERS.filter((tier) => tier.required_xp <= nextXp && !oldUnlocked.has(tier.tier));
  return {
    state: {
      ...normalized,
      xp: nextXp,
      unlocked_tiers: [...new Set([...normalized.unlocked_tiers, ...unlockedTiers.map((tier) => tier.tier)])].sort((a, b) => a - b),
    },
    unlockedTiers,
  };
}

function collectBattlePassRewards(tiers = [], profile = DEFAULT_PROFILE) {
  const proActive = hasAetherPro(profile);
  return tiers.reduce((reward, tier) => ({
    shards: Number(reward.shards || 0) + Number(tier.reward?.shards || 0),
    essence: Number(reward.essence || 0) + Number(tier.reward?.essence || 0),
    exp: Number(reward.exp || 0) + Number(tier.reward?.exp || 0),
    cosmetic_ids: [...new Set([...(reward.cosmetic_ids || []), ...(isBattlePassTierProReward(tier) && !proActive ? [] : rewardCosmeticIds(tier.reward))])],
  }), { shards: 0, essence: 0, exp: 0, cosmetic_ids: [] });
}

function isBattlePassTierProReward(tier = {}) {
  return rewardCosmeticIds(tier.reward).length > 0;
}

function hasAetherPro(profile = DEFAULT_PROFILE) {
  return Boolean(profile.is_pro || profile.is_admin);
}

function getBattlePassProgressState(state) {
  const normalized = normalizeBattlePassState(state);
  const unlocked = new Set(normalized.unlocked_tiers);
  const currentTier = normalized.unlocked_tiers.length ? Math.max(...normalized.unlocked_tiers) : 0;
  const nextTier = BATTLE_PASS_TIERS.find((tier) => !unlocked.has(tier.tier));
  const previousXp = currentTier ? BATTLE_PASS_TIERS.find((tier) => tier.tier === currentTier)?.required_xp || 0 : 0;
  const denominator = nextTier ? Math.max(1, nextTier.required_xp - previousXp) : 1;
  const percent = nextTier ? Math.max(0, Math.min(100, Math.round(((normalized.xp - previousXp) / denominator) * 100))) : 100;
  return { currentTier, nextTier, previousXp, percent };
}

function shareMatchRecap(report, profile) {
  const stats = normalizeMatchReport(report, DEFAULT_MATCH_REPORT);
  const recap = `${profile.username || "Commander"} ${stats.result === "win" ? "won" : "lost"} in Aether-Tactics vs ${stats.opponent}. Captures: ${stats.captured}. Turns: ${stats.turns}. Best coach note: ${(stats.review || [])[0] || "Tempo decides the board."}`;
  navigator.clipboard?.writeText(recap).catch(() => undefined);
  return recap;
}

function inferNetworkActionType(reason, override = {}, currentReplay = []) {
  if (override.actionType) {
    return override.actionType;
  }
  if (override.abilityAction) {
    return "ability_cast";
  }
  if (reason !== "move") {
    return reason;
  }
  const replay = override.moveReplay || currentReplay || [];
  const latest = replay[replay.length - 1];
  return latest?.powerId || latest?.passiveId ? "ability_cast" : "standard_move";
}

function countAbilityUses(replay = []) {
  const entries = normalizeReplayEntries(replay);
  const count = entries.filter((move) => move.powerId || move.passiveId).length;
  return count || entries.filter((move) => /power|dash|fortify|crown|sandstorm|lance|collapse/i.test(`${move.actor || ""} ${move.label || ""}`)).length;
}

function abilityImpactText(abilityId, loadout = {}, campaignLevel = {}) {
  const showcase = campaignLevel?.showcase || CAMPAIGN_SHOWCASES[campaignLevel?.id] || {};
  const id = abilityId || showcase.abilityId || loadout.ultimateId || loadout.passiveId;
  const showcaseMatches = Boolean(showcase.successText && showcase.abilityId && showcase.abilityId === id);
  const impact = {
    open_roads: "Open Roads retreated against the normal flow of checkers, preserving the scout and resetting the capture angle.",
    dust_veil: "Dust Veil protected the bait piece, so the enemy threat disappeared and the counterattack stayed alive.",
    dash: "Dash reached a pocket that a normal piece could not enter, creating the first link in a capture chain.",
    sandstorm_corridor: "Sandstorm closed two landing squares, turning enemy mobility into a tactical traffic jam.",
    shield_wall: "Shield Wall converted a highlighted center entry into protection, making trades safer for the Iron Guard.",
    vengeance_ledger: "Vengeance Ledger transformed a lost piece into Momentum for the next capture.",
    fortify: "Fortify protected the key defender for two enemy turns and broke the enemy multi-jump before it started.",
    barricade: "Barricade changed the board state by removing landing squares from the enemy plan.",
    royal_pressure: "Royal Pressure rewarded the promotion lane and turned forward tempo into Momentum.",
    crown_tax: "Crown Tax punished the enemy king race by converting their promotion into your Momentum.",
    crown_surge: "Crown Surge created an instant king, opening long diagonal pressure before the enemy could react.",
    sun_lance: "Sun Lance let a normal piece strike down a long diagonal like a king, creating a capture that standard movement would forbid.",
    pressure_field: "Pressure Field read the danger and converted the opponent's threat into Momentum.",
    echo_mark: "Echo Mark turned a quiet enemy move into a target that can be cashed in for Momentum.",
    phase_shift: "Phase Shift bent the position by teleporting through blockers into a dark-square pocket standard checkers cannot reach.",
    collapse: "Collapse removed a landing square and forced the opponent to reroute around the Void.",
  };
  return showcaseMatches ? showcase.successText : impact[id] || `${abilityLabel(id)} changed the tactical shape of the match.`;
}

function buildProductLoopInsights({ result, mode, campaignLevel, replay = [], finalBoard = [], loadout = {}, captured = 0, lost = 0, turns = 0 }) {
  const entries = normalizeReplayEntries(replay);
  const playerMoves = entries.filter((entry) => entry.player === "white");
  const abilityMove = playerMoves.find((entry) => entry.powerId || entry.passiveId);
  const chainMove = playerMoves.find((entry) => Number(entry.chainOptions || 0) > 0);
  const captureMove = playerMoves.find((entry) => entry.captured);
  const promotionMove = playerMoves.find((entry) => entry.promoted);
  const missedCapture = playerMoves.find((entry) => Number(entry.captureOptions || 0) > 0 && !entry.captured);
  const unsafeMove = playerMoves.find((entry) => Number(entry.unsafeReplyCaptures || 0) > 0);
  const material = summarizeBoardForCoach(finalBoard);
  const bestMove = abilityMove
    ? `Move ${abilityMove.turnIndex}: ${abilityLabel(abilityMove.powerId || abilityMove.passiveId)} turned ${abilityMove.from}-${abilityMove.to} into the lesson moment.`
    : chainMove
      ? `Move ${chainMove.turnIndex}: ${chainMove.from}x${chainMove.to} created ${chainMove.chainOptions} continuation${Number(chainMove.chainOptions) === 1 ? "" : "s"}.`
      : captureMove
        ? `Move ${captureMove.turnIndex}: ${captureMove.from}x${captureMove.to} won material and simplified the board.`
        : promotionMove
          ? `Move ${promotionMove.turnIndex}: ${promotionMove.from}-${promotionMove.to} created a king and opened long diagonals.`
          : mode === "campaign" && campaignLevel?.showcase?.powerPromise
            ? campaignLevel.showcase.powerPromise
            : `You finished with Azure ${material.white} vs Amber ${material.black} after ${turns} turn${turns === 1 ? "" : "s"}.`;
  const mistake = missedCapture
    ? `Move ${missedCapture.turnIndex}: a forced capture was available before ${missedCapture.from}-${missedCapture.to}.`
    : unsafeMove
      ? `Move ${unsafeMove.turnIndex}: ${unsafeMove.from}-${unsafeMove.to} allowed ${unsafeMove.unsafeReplyCaptures} immediate reply capture${Number(unsafeMove.unsafeReplyCaptures) === 1 ? "" : "s"}.`
      : result === "win"
        ? "No major tactical mistake was detected. Next, convert faster and protect the center."
        : lost > captured
          ? "Material fell behind. Use abilities to deny the next landing square before attacking."
          : "The position was close. Retry the turning point and look for a safer center move.";
  const abilityImpact = abilityMove
    ? abilityImpactText(abilityMove.powerId || abilityMove.passiveId, loadout, campaignLevel)
    : mode === "campaign"
      ? abilityImpactText(campaignLevel?.showcase?.abilityId, loadout, campaignLevel)
      : loadout?.ultimateId
        ? abilityImpactText(loadout.ultimateId, loadout, campaignLevel)
        : "Classic fundamentals decided the match: center control, forced captures, and king lanes.";
  const nextActions = mode === "campaign" && result === "win"
    ? ["Next Level", campaignLevel?.showcase?.recommendedNextAction || "Open Vault"]
    : result === "win"
      ? ["Try Power Skirmish", "Open Vault"]
      : ["Retry Moment", "Rematch"];
  return { bestMove, mistake, abilityImpact, nextActions };
}

function normalizeUsername(value) {
  const cleaned = String(value || "VALKYRIE_01").replace(/[^A-Za-z0-9_]/g, "_").slice(0, 24);
  return cleaned.length >= 3 ? cleaned : `cmd_${cleaned || "01"}`;
}

function normalizeCampaignProgress(progress) {
  return {
    ...DEFAULT_CAMPAIGN_PROGRESS,
    ...(progress || {}),
    completed_levels: progress?.completed_levels || DEFAULT_CAMPAIGN_PROGRESS.completed_levels,
    stars_earned: Number(progress?.stars_earned || 0),
    best_clear_turns: progress?.best_clear_turns || {},
  };
}

function loadCampaignProgressForFaction(factionId = "nomads") {
  return normalizeCampaignProgress(loadJson(`dama-campaign-progress-${factionId}`, factionId === "nomads" ? loadJson("dama-campaign-progress", DEFAULT_CAMPAIGN_PROGRESS) : DEFAULT_CAMPAIGN_PROGRESS));
}

function withFactionCampaign(campaignData, factionId = "nomads") {
  const local = FACTION_CAMPAIGNS[factionId] || FACTION_CAMPAIGNS.nomads;
  const remote = campaignData?.campaigns?.[factionId] || campaignData?.[factionId] || (campaignData?.factionId === factionId ? campaignData : null);
  const remoteLevels = (remote?.levels || []).filter((level) => !level.factionId || level.factionId === factionId);
  const levels = remoteLevels.length >= local.levels.length ? remoteLevels : local.levels;
  return {
    ...local,
    ...(remote || {}),
    id: local.id,
    factionId,
    name: remote?.name || local.name,
    description: remote?.description || local.description,
    levels: levels.map((level, index) => withCampaignShowcase({
      ...level,
      factionId: level.factionId || factionId,
      number: level.number || index + 1,
    })),
  };
}

function withCampaignShowcase(level = {}) {
  return {
    ...level,
    showcase: {
      ...(CAMPAIGN_SHOWCASES[level.id] || {}),
      ...(level.showcase || {}),
    },
  };
}

function buildCampaignMapNodes(levels = []) {
  return levels.map((level, index) => {
    const position = CAMPAIGN_NODE_POSITIONS[index] || {
      x: Math.min(90, 15 + index * 16),
      y: index % 2 ? 32 : 58,
    };
    return {
      id: level.id,
      title: level.name,
      state: "locked",
      stars: 0,
      x: position.x,
      y: position.y,
      levelIndex: index,
      description: level.objective ? `${level.hook} Objective: ${level.objective}` : level.hook,
    };
  });
}

function createCampaignTutorial(level) {
  const script = GUIDED_CAMPAIGN_TUTORIALS[level?.id];
  if (!script) {
    return null;
  }
  const snapshot = createBoardFromCoordinates(script.white, script.black);
  return {
    ...script,
    levelId: level.id,
    phase: "guided",
    stepIndex: 0,
    snapshot,
    intro: `${level.name}: ${script.intro}`,
  };
}

function isGuidedCampaignLevel(level) {
  return Boolean(GUIDED_CAMPAIGN_TUTORIALS[level?.id]);
}

function isGuidedCampaignTutorialActive(tutorial) {
  return tutorial?.phase === "guided" && Array.isArray(tutorial.requiredMoves);
}

function getCampaignTutorialStep(tutorial) {
  if (!isGuidedCampaignTutorialActive(tutorial)) {
    return null;
  }
  return tutorial.requiredMoves[tutorial.stepIndex] || null;
}

function getCampaignTutorialPrompt(tutorial) {
  if (!tutorial) {
    return "";
  }
  if (tutorial.phase === "freeplay") {
    return tutorial.freePlayPrompt;
  }
  if (tutorial.phase === "complete") {
    return "Campaign lesson complete. Open the tactical report for the coach review.";
  }
  const step = getCampaignTutorialStep(tutorial);
  if (!step) {
    return "";
  }
  const exactInstruction = campaignTutorialInstruction(tutorial, step);
  return `Step ${tutorial.stepIndex + 1}/${tutorial.requiredMoves.length}: ${exactInstruction}${step.prompt}`;
}

function getBootcampTutorialPrompt(tutorial) {
  if (!tutorial) {
    return "";
  }
  const stepIndex = Math.max(0, Math.min(tutorial.stepIndex || 0, BOOTCAMP_MATCH_PROMPTS.length - 1));
  return BOOTCAMP_MATCH_PROMPTS[stepIndex];
}

function getCampaignTutorialTargets(tutorial) {
  const step = getCampaignTutorialStep(tutorial);
  if (!step) {
    return [];
  }
  const targets = [];
  const pushCoord = (coord, kind) => {
    if (!coord) return;
    const square = coordToSquare(coord);
    if (square.row >= 0 && square.col >= 0) {
      targets.push({ ...square, kind });
    }
  };
  pushCoord(step.from, "source");
  pushCoord(step.to, "target");
  pushCoord(step.captured, "capture");
  (step.targets || []).forEach((coord) => pushCoord(coord, "target"));
  return targets;
}

function campaignTutorialInstruction(tutorial, step) {
  if (!tutorial || !step || step.actor !== "player") {
    return "";
  }
  if (step.kind === "power_board" && Array.isArray(step.targets)) {
    return `Use ${abilityLabel(step.powerId)} on ${step.targets.join(", ")}. `;
  }
  if (step.kind === "power" && step.from && step.to) {
    return `Use ${abilityLabel(step.powerId)} from ${step.from} to ${step.to}. `;
  }
  if (tutorial.factionId === "iron_guard") {
    return `Move Iron Guard at ${step.from} to ${step.to}. `;
  }
  if (tutorial.factionId === "sun_court") {
    return `The Sun Court demands you move ${step.from} to ${step.to}. `;
  }
  return "";
}

function isPowerTutorialStep(step) {
  return step?.kind === "power" || step?.kind === "power_board";
}

function tutorialMoveMatches(step, move) {
  if (!step || !move) {
    return false;
  }
  const from = squareName(move.from);
  const to = squareName(move.to);
  const captured = move.captured ? squareName(move.captured) : null;
  if (from !== step.from || to !== step.to) {
    return false;
  }
  if (step.powerId && move.powerId !== step.powerId) {
    return false;
  }
  if (step.captured && captured !== step.captured) {
    return false;
  }
  if (!step.captured && captured) {
    return false;
  }
  return true;
}

function moveFromTutorialStep(board, step) {
  const from = coordToSquare(step.from);
  const to = coordToSquare(step.to);
  const captured = step.captured ? coordToSquare(step.captured) : null;
  if (!board[from.row]?.[from.col] || board[to.row]?.[to.col]) {
    return null;
  }
  if (captured && !board[captured.row]?.[captured.col]) {
    return null;
  }
  return {
    from,
    to,
    captured,
    powerId: step.powerId || null,
  };
}

function mergeCampaignProgress(progress, levelId, levels, turns, stars) {
  const normalized = normalizeCampaignProgress(progress);
  const completed = [...new Set([...normalized.completed_levels, levelId])];
  const nextLevel = levels.find((level) => !completed.includes(level.id));
  const previousTurns = normalized.best_clear_turns?.[levelId];
  const previousStars = normalized.best_clear_turns?.[`${levelId}_stars`] || 0;
  const bestClearTurns = {
    ...normalized.best_clear_turns,
    [levelId]: previousTurns ? Math.min(previousTurns, turns) : turns,
    [`${levelId}_stars`]: Math.max(previousStars, stars),
  };
  const starsEarned = levels.reduce((sum, level) => sum + (bestClearTurns[`${level.id}_stars`] || 0), 0);
  return {
    ...normalized,
    completed_levels: completed,
    current_level_id: nextLevel?.id || levelId,
    stars_earned: starsEarned,
    best_clear_turns: bestClearTurns,
  };
}

function getNextCampaignLevel(levelId, levels = []) {
  const index = levels.findIndex((level) => level.id === levelId);
  if (index < 0) {
    return levels[0] || null;
  }
  return levels[index + 1] || null;
}

function buildCampaignCompletion({ progress, level, levels = [], turns = 1, finalBoard = [], startingPieces = 1 }) {
  const whitePieces = Array.isArray(finalBoard) && finalBoard.length ? countPieces(finalBoard).white : startingPieces;
  const stars = calculateCampaignStars(level, turns, whitePieces, startingPieces);
  const nextProgress = mergeCampaignProgress(progress, level.id, levels, turns, stars);
  return {
    level,
    stars,
    progress: nextProgress,
    nextLevel: getNextCampaignLevel(level.id, levels),
  };
}

function calculateCampaignStars(level, turns, remainingPieces, startingPieces) {
  let stars = 3;
  if (turns <= 6) {
    stars += 1;
  }
  if (remainingPieces >= Math.max(1, startingPieces - 1)) {
    stars += 1;
  }
  if (level?.number === 1 && turns <= 4) {
    stars = Math.max(stars, 5);
  }
  return Math.min(5, stars);
}

function getDailyPuzzle() {
  const dayIndex = Math.floor(Date.now() / 86400000) % DAILY_CHALLENGES.length;
  return DAILY_CHALLENGES[dayIndex] || DAILY_CHALLENGES[0];
}

function getDailyChallenges() {
  return DAILY_CHALLENGES;
}

function getCurrentAiPersonality(mode, aiLevel, campaignLevel) {
  if (mode === "campaign" && campaignLevel?.aiPersonality) {
    return campaignLevel.aiPersonality;
  }
  if (mode === "puzzle") {
    return "void_order";
  }
  if (aiLevel === "beginner") {
    return "nomads";
  }
  if (aiLevel === "smart") {
    return "iron_guard";
  }
  return "void_order";
}

function getAiPersonalityLabel(personality) {
  return AI_PERSONALITY_LABELS[personality] || AI_PERSONALITY_LABELS.void_order;
}

function buildCoachPayload({ replay = [], finalBoard, moveLog = [], mode, loadout, result, campaignLevel, aiLevel }) {
  const retryContext = buildInteractiveRetryMoment({ replay, finalBoard, result, mode, campaignLevel, loadout });
  return {
    system_prompt: CHECKERS_COACH_SYSTEM_PROMPT,
    mode,
    result,
    loadout,
    final_board: finalBoard,
    current_board: finalBoard,
    recent_moves: buildRecentMoveContext(replay, moveLog),
    retry_context: retryContext,
    replay: replay.map((entry) => ({
      turnIndex: entry.turnIndex,
      actor: entry.actor,
      player: entry.player,
      from: entry.from,
      to: entry.to,
      captured: entry.captured,
      promoted: Boolean(entry.promoted),
      pieceWasKing: Boolean(entry.pieceWasKing),
      powerId: entry.powerId,
      passiveId: entry.passiveId,
      captureOptions: Number(entry.captureOptions || 0),
      unsafeReplyCaptures: Number(entry.unsafeReplyCaptures || 0),
      chainOptions: Number(entry.chainOptions || 0),
      beforeBoard: entry.beforeBoard,
      afterBoard: entry.afterBoard,
    })),
    match_context: {
      aiLevel,
      campaignLevelId: campaignLevel?.id || null,
      campaignObjective: campaignLevel?.objective || null,
      prompt_contract: "Return grounded checkers coaching only: no invented pieces, no random lore, no generic praise without a tactical reason.",
    },
  };
}

function buildReplayCoachPayload(report, frame, index) {
  const replay = normalizeReplayEntries(report.replay || []);
  const move = frame.move || null;
  return {
    system_prompt: CHECKERS_COACH_SYSTEM_PROMPT,
    mode: report.gameMode || "ai",
    result: report.result || "loss",
    loadout: {
      factionId: report.faction_id || report.factionId || null,
      passiveId: report.passive_id || report.passiveId || null,
      ultimateId: report.ultimate_id || report.ultimateId || null,
    },
    final_board: frame.board,
    current_board: frame.board,
    recent_moves: move ? [{
      turnIndex: move.turnIndex || index,
      player: move.player,
      actor: move.actor,
      move: `${move.from}${move.captured ? "x" : "-"}${move.to}`,
      captured: move.captured,
      promoted: Boolean(move.promoted),
      captureOptions: Number(move.captureOptions || 0),
      unsafeReplyCaptures: Number(move.unsafeReplyCaptures || 0),
      chainOptions: Number(move.chainOptions || 0),
    }] : [],
    retry_context: {
      moveIndex: index,
      title: move ? `Analyze Move ${move.turnIndex || index}` : "Analyze Opening Position",
      prompt: move ? `Give tactical feedback for ${move.from}${move.captured ? "x" : "-"}${move.to} using only this board.` : "Give tactical feedback for the starting position.",
      tacticalTip: "Focus on center control, forced captures, king lanes, double-jump potential, and immediate safety.",
      betterHint: "Name a concrete tactical pattern the player should check from this exact board.",
      board: frame.board,
      originalMove: move ? { from: move.from, to: move.to, captured: move.captured } : {},
      expected: move?.captured ? "chain" : Number(move?.unsafeReplyCaptures || 0) > 0 ? "safe" : "center",
    },
    replay: replay.slice(0, Math.max(0, index)).map((entry) => ({
      turnIndex: entry.turnIndex,
      actor: entry.actor,
      player: entry.player,
      from: entry.from,
      to: entry.to,
      captured: entry.captured,
      promoted: Boolean(entry.promoted),
      pieceWasKing: Boolean(entry.pieceWasKing),
      powerId: entry.powerId,
      passiveId: entry.passiveId,
      captureOptions: Number(entry.captureOptions || 0),
      unsafeReplyCaptures: Number(entry.unsafeReplyCaptures || 0),
      chainOptions: Number(entry.chainOptions || 0),
      beforeBoard: entry.beforeBoard,
      afterBoard: entry.afterBoard,
    })),
    match_context: {
      replayIndex: index,
      prompt_contract: "Return contextual checkers advice for this single replay frame. Mention concrete squares when possible.",
    },
  };
}

function buildRecentMoveContext(replay = [], moveLog = []) {
  if (replay.length) {
    return replay.slice(-8).map((entry) => ({
      turnIndex: entry.turnIndex,
      player: entry.player,
      move: `${entry.from}${entry.captured ? "x" : "-"}${entry.to}`,
      captured: entry.captured,
      promoted: Boolean(entry.promoted),
      captureOptions: Number(entry.captureOptions || 0),
      unsafeReplyCaptures: Number(entry.unsafeReplyCaptures || 0),
      chainOptions: Number(entry.chainOptions || 0),
    }));
  }
  return moveLog.slice(0, 8).map((notation, index) => ({ turnIndex: index + 1, notation }));
}

function buildInteractiveRetryMoment({ replay = [], finalBoard, result, mode, campaignLevel, loadout }) {
  const candidate = [...replay].reverse().find((entry) => entry.player === "white" && entry.captureOptions > 0 && !entry.captured)
    || [...replay].reverse().find((entry) => entry.player === "white" && entry.unsafeReplyCaptures > 0)
    || [...replay].reverse().find((entry) => entry.player === "white" && entry.promoted)
    || [...replay].reverse().find((entry) => entry.player === "white")
    || null;
  const missedCapture = candidate?.captureOptions > 0 && !candidate?.captured;
  const unsafe = candidate?.unsafeReplyCaptures > 0;
  const promoted = Boolean(candidate?.promoted);
  const expected = missedCapture ? "capture" : unsafe ? "safe" : promoted ? "king_activity" : "center";
  return {
    moveIndex: candidate?.turnIndex || null,
    title: missedCapture ? "Missed Forcing Capture" : unsafe ? "Unsafe Tempo Choice" : promoted ? "Use The New King" : result === "win" ? "Convert The Advantage Again" : "Find The Stabilizing Move",
    prompt: missedCapture
      ? `Move ${candidate.turnIndex}: you had a capture available before ${candidate.from}-${candidate.to}. Replay the board and find it.`
      : unsafe
        ? `Move ${candidate.turnIndex}: ${candidate.from}-${candidate.to} allowed ${candidate.unsafeReplyCaptures} capture reply. Try a safer move.`
        : promoted
          ? `Move ${candidate.turnIndex}: the promotion created a king. Replay the position and use the long diagonal pressure.`
          : mode === "campaign"
            ? `${campaignLevel?.name || "Faction Trial"} cleared. Replay the position and look for the cleanest tactical move.`
            : "Replay this position and look for a move that keeps material safe while improving center control.",
    betterHint: missedCapture ? "Captures are mandatory and usually the strongest retry answer." : unsafe ? "A good retry move avoids giving Amber an immediate capture." : promoted ? "Kings are strongest on long diagonals where they attack and defend at once." : "Try to improve piece safety, center control, or a future capture threat.",
    tacticalTip: missedCapture
      ? "Scan one enemy piece and the empty square directly behind it; that is the jump pattern."
      : unsafe
        ? "Before moving, imagine Amber's next jump. If the landing square gives Amber a capture, choose a protected diagonal instead."
        : promoted
          ? "After crowning, do not play like a normal piece. Use the king's range to pressure two diagonals."
          : "Central squares make double jumps easier because more diagonals stay connected.",
    expected,
    successCriteria: retrySuccessCriteria(expected),
    originalMove: candidate ? { from: candidate.from, to: candidate.to, captured: candidate.captured } : null,
    board: candidate?.beforeBoard || finalBoard,
    focusAbilityId: loadout?.ultimateId || loadout?.passiveId || "dash",
  };
}

function getTacticalHint({ board, turn, legalMoves, captureChain, selected, winner, mode, campaignLevel, options }) {
  if (winner) {
    return "Match finished. Open the tactical report to review the decisive sequence.";
  }
  if (captureChain) {
    return `Forced multi-capture: continue from ${squareName(captureChain)} with the same piece.`;
  }
  const allMoves = getLegalMoves(board, turn, options);
  const captures = allMoves.filter((move) => move.captured);
  if (captures.length > 0) {
    return `Forced capture available: ${captures.length} jump${captures.length === 1 ? "" : "s"} must be considered before quiet moves.`;
  }
  const promotionMove = allMoves.find((move) => {
    const piece = board[move.from.row]?.[move.from.col];
    return piece && !piece.king && move.to.row === PLAYERS[piece.player].kingRow;
  });
  if (promotionMove) {
    return `Promotion chance: ${squareName(promotionMove.from)} can become a king on ${squareName(promotionMove.to)}.`;
  }
  if (selected && legalMoves.length === 0) {
    return "Selected piece has no legal move; choose a piece with a highlighted diagonal.";
  }
  if (mode === "campaign" && campaignLevel?.hint) {
    return campaignLevel.hint;
  }
  if (mode === "puzzle") {
    return "Daily tactic: create contact first, then look for the capture chain.";
  }
  return "Hint: control center diagonals and keep pieces paired so single captures become chains.";
}

function buildCoachReview({ result, captured, lost, turns, mode, campaignLevel, replay = [], finalBoard = [], loadout = {} }) {
  const lines = [];
  const material = summarizeBoardForCoach(finalBoard);
  const whiteMoves = replay.filter((entry) => entry.player === "white");
  const missedCapture = whiteMoves.find((entry) => entry.captureOptions > 0 && !entry.captured);
  const chain = replay.find((entry) => entry.chainOptions > 0);
  const unsafe = whiteMoves.find((entry) => entry.unsafeReplyCaptures > 0);
  const promotion = whiteMoves.find((entry) => entry.promoted);
  if (result === "win") {
    lines.push(`Strong finish: final material was Azure ${material.white} vs Amber ${material.black}. You converted the board instead of only surviving it.`);
  } else {
    lines.push(`The decisive issue was tempo: final material was Azure ${material.white} vs Amber ${material.black}. Stabilize the formation before chasing quiet moves.`);
  }
  if (missedCapture) {
    lines.push(`Move ${missedCapture.turnIndex}: ${missedCapture.from}-${missedCapture.to} skipped a forced capture. Check every jump before quiet moves.`);
  } else if (chain) {
    lines.push(`Move ${chain.turnIndex}: the jump created ${chain.chainOptions} continuation${chain.chainOptions === 1 ? "" : "s"}. Keep the same piece active until the chain ends.`);
  } else if (captured > 0) {
    lines.push(`You captured ${captured} piece${captured === 1 ? "" : "s"}; now try arranging two Azure pieces so one capture becomes a double jump.`);
  } else {
    lines.push("No captures landed. Prioritize forcing diagonal contact before spending quiet moves.");
  }
  if (unsafe) {
    lines.push(`Safety warning: ${unsafe.from}-${unsafe.to} allowed ${unsafe.unsafeReplyCaptures} immediate reply capture${unsafe.unsafeReplyCaptures === 1 ? "" : "s"}.`);
  } else if (material.whiteCenter >= material.blackCenter) {
    lines.push("Center control was solid: occupying d/e-file diagonals limits the AI's safe replies.");
  } else {
    lines.push("The AI controlled more center squares. Re-enter with connected pieces, not a single isolated runner.");
  }
  if (promotion || material.whiteKings > 0) {
    lines.push("King lesson: use crowned pieces across long diagonals so they attack and defend multiple lanes at once.");
  } else if (lost > captured) {
    lines.push("Material dropped faster than pressure was created. Use abilities to deny the next capture square.");
  }
  if (mode === "campaign" && campaignLevel?.objective) {
    lines.push(`Campaign lesson: ${campaignLevel.objective}`);
  }
  if (loadout?.ultimateId) {
    lines.push(`Loadout note: ${abilityLabel(loadout.ultimateId)} should create a concrete tactic: capture, safety, center control, or promotion.`);
  }
  lines.push(`Match length: ${turns} turn${turns === 1 ? "" : "s"}.`);
  return lines;
}

function normalizeReplayCoachLines(analysis, frame, report) {
  const review = normalizeReviewLines(analysis?.review, []);
  if (review.length) {
    return review.slice(0, 3);
  }
  const retry = analysis?.retry_moment || analysis?.retryMoment;
  if (retry?.tacticalTip || retry?.betterHint) {
    return [retry.tacticalTip, retry.betterHint].filter(Boolean).slice(0, 3);
  }
  return fallbackReplayCoach(frame, report);
}

function fallbackReplayCoach(frame, report) {
  const board = frame.board || [];
  const move = frame.move || null;
  const material = summarizeBoardForCoach(board);
  const lines = [];
  if (!move) {
    lines.push(`Opening read: Azure ${material.white} vs Amber ${material.black}. Start by contesting center diagonals before chasing edge moves.`);
  } else if (move.captured) {
    lines.push(`Good forcing move: ${move.from}x${move.to} won material. Now check whether the same piece has another jump available.`);
  } else if (Number(move.captureOptions || 0) > 0) {
    lines.push(`Missed tactic: before ${move.from}-${move.to}, at least one capture existed. Forced jumps come before quiet moves.`);
  } else if (Number(move.unsafeReplyCaptures || 0) > 0) {
    lines.push(`Safety issue: ${move.from}-${move.to} allowed ${move.unsafeReplyCaptures} immediate reply capture${Number(move.unsafeReplyCaptures) === 1 ? "" : "s"}.`);
  } else if (move.promoted) {
    lines.push(`Promotion swing: ${move.from}-${move.to} created a king. Use long diagonals to attack without standing adjacent to danger.`);
  } else if (isCenterSquareForCoach(coordToSquare(move.to).row, coordToSquare(move.to).col)) {
    lines.push(`Useful center control: ${move.to} improves access to multiple diagonals and makes double jumps easier to prepare.`);
  } else {
    lines.push(`Quiet tempo: ${move.from}-${move.to}. Check whether it improves safety, center control, or a future capture threat.`);
  }
  if (material.whiteCenter < material.blackCenter) {
    lines.push("Amber has more central presence. Reconnect Azure pieces around d4/e4/d5/e5 before attacking.");
  } else {
    lines.push("Azure center control is stable enough to look for capture chains or promotion lanes.");
  }
  if (report.result === "loss") {
    lines.push("Because this match ended in defeat, prioritize moves that deny immediate jumps over cosmetic pressure.");
  }
  return lines.slice(0, 3);
}

function retrySuccessCriteria(expected) {
  if (expected === "capture") {
    return ["must_capture"];
  }
  if (expected === "safe") {
    return ["avoid_reply_capture"];
  }
  if (expected === "king_activity") {
    return ["use_king_or_promote", "control_long_diagonal"];
  }
  return ["improve_center", "avoid_reply_capture"];
}

function summarizeBoardForCoach(board = []) {
  return board.reduce((stats, row, rowIndex) => {
    row.forEach((piece, colIndex) => {
      if (!piece) {
        return;
      }
      const key = piece.player === "white" ? "white" : "black";
      stats[key] += 1;
      if (piece.king) {
        stats[`${key}Kings`] += 1;
      }
      if (isCenterSquareForCoach(rowIndex, colIndex)) {
        stats[`${key}Center`] += 1;
      }
    });
    return stats;
  }, { white: 0, black: 0, whiteKings: 0, blackKings: 0, whiteCenter: 0, blackCenter: 0 });
}

function isCenterSquareForCoach(row, col) {
  const square = squareName({ row, col });
  return square === "d4" || square === "e4" || square === "d5" || square === "e5";
}

function abilityLabel(id) {
  return String(id || "")
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function getNextUnlock(profile, factions) {
  const nextFaction = [...factions]
    .filter((faction) => faction.id !== "void_order")
    .filter((faction) => !profile.unlocked_factions?.includes(faction.id))
    .sort((left, right) => (left.required_level_to_unlock || 1) - (right.required_level_to_unlock || 1))[0];
  if (nextFaction) {
    return `${nextFaction.name} at Level ${nextFaction.required_level_to_unlock || 1}`;
  }
  return profile.unlocked_factions?.includes("void_order") ? "Seasonal cosmetics" : "Void Order Campaign Pass in Vault";
}

function vaultItemDescription(item, factionNames, profile) {
  if (item.cosmetic_id === "void_order_campaign_pass") {
    return profile.unlocked_factions?.includes("void_order")
      ? "Premium faction access owned. Void loadouts and its first campaign trial are open."
      : "Premium unlock: opens the Void Order faction, Phase Shift loadouts, and the first Void campaign trial.";
  }
  if (item.model_url || PIECE_MODEL_ASSETS[item.cosmetic_id]) {
    return "3D piece model skin. Equip it in Inventory to style only your own pieces in live matches.";
  }
  if (isPremium2DPieceSkin(item.cosmetic_id)) {
    return "Premium responsive SVG piece set for the clean 2D tactical board.";
  }
  if (item.kind === "emote") {
    return item.target_faction_id ? `Match emote for ${factionNames[item.target_faction_id] || item.target_faction_id}. Buy it once and send it from the in-game chat wheel.` : "Match emote. Buy it once and send it from the in-game chat wheel.";
  }
  return item.target_faction_id ? `Faction: ${factionNames[item.target_faction_id] || item.target_faction_id}` : "Universal cosmetic";
}

function parseJsonMaybe(value, fallback) {
  if (typeof value !== "string") {
    return value ?? fallback;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeReplayEntries(replay = []) {
  const parsed = parseJsonMaybe(replay, []);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.map((move, index) => ({
    ...move,
    turnIndex: Number(move.turnIndex || move.turn_index || index + 1),
    beforeBoard: Array.isArray(move.beforeBoard || move.before_board) ? cloneBoard(move.beforeBoard || move.before_board) : null,
    afterBoard: Array.isArray(move.afterBoard || move.after_board) ? cloneBoard(move.afterBoard || move.after_board) : null,
  }));
}

function createReplayFrame(board, move, index) {
  return {
    index,
    board: cloneBoard(board || createInitialBoard()),
    move,
    label: move ? `${move.actor || move.player || "Move"} ${move.turnIndex || index}: ${move.from}${move.captured ? "x" : "-"}${move.to}` : "Initial position before the first move.",
  };
}

function buildReplayFrames(replay = [], finalBoard = []) {
  const entries = normalizeReplayEntries(replay);
  if (entries.length === 0) {
    return Array.isArray(finalBoard) && finalBoard.length ? [createReplayFrame(finalBoard, null, 0)] : [];
  }
  const frames = [];
  const firstBoard = entries[0]?.beforeBoard || finalBoard;
  if (Array.isArray(firstBoard) && firstBoard.length) {
    frames.push(createReplayFrame(firstBoard, null, 0));
  }
  entries.forEach((move, index) => {
    const board = move.afterBoard || entries[index + 1]?.beforeBoard || finalBoard;
    if (Array.isArray(board) && board.length) {
      frames.push(createReplayFrame(board, move, index + 1));
    }
  });
  return frames;
}

function normalizeReviewLines(value, fallback = []) {
  const parsed = parseJsonMaybe(value, fallback);
  if (Array.isArray(parsed)) {
    return parsed.map((item) => String(item)).filter(Boolean);
  }
  if (typeof parsed === "string" && parsed.trim()) {
    return [parsed.trim()];
  }
  return fallback;
}

function normalizeMatchReport(match, fallback = DEFAULT_MATCH_REPORT) {
  if (!match) {
    return fallback;
  }
  const result = match.result || (match.isVictory ? "win" : "loss");
  const replay = normalizeReplayEntries(match.replay || match.moveReplay || match.move_replay || fallback.replay);
  const finalBoard = Array.isArray(match.finalBoard || match.final_board) ? cloneBoard(match.finalBoard || match.final_board) : (replay.at(-1)?.afterBoard || fallback.finalBoard || []);
  const replayFrames = Array.isArray(match.replayFrames || match.replay_frames || match.boardStates || match.board_states)
    ? (match.replayFrames || match.replay_frames || match.boardStates || match.board_states)
      .map((frame, index) => {
        const board = Array.isArray(frame?.board) ? frame.board : Array.isArray(frame) ? frame : null;
        return board ? createReplayFrame(board, frame?.move || replay[index - 1] || null, index) : null;
      })
      .filter(Boolean)
    : buildReplayFrames(replay, finalBoard);
  return {
    ...fallback,
    ...match,
    isVictory: result === "win",
    result,
    opponent: match.opponent || match.opponent_ai_level || match.opponent_type || fallback.opponent,
    aiProfileId: match.aiProfileId || match.ai_profile_id || fallback.aiProfileId,
    difficulty: match.difficulty || match.ai_difficulty || match.opponent_ai_level || fallback.difficulty,
    gameMode: match.gameMode || match.game_mode || fallback.gameMode,
    captured: Number(match.captured ?? match.captures_made ?? fallback.captured),
    lost: Number(match.lost ?? fallback.lost),
    turns: Number(match.turns ?? match.turns_count ?? fallback.turns),
    shards: Number(match.shards ?? match.shards_gained ?? fallback.shards),
    essence: Number(match.essence ?? fallback.essence),
    exp: Number(match.exp ?? match.exp_gained ?? fallback.exp),
    elo: Number(match.elo ?? match.mmr_delta ?? fallback.elo),
    review: normalizeReviewLines(match.review || match.review_summary, fallback.review),
    replay,
    replayFrames,
    finalBoard,
    retryMoment: match.retryMoment || match.retry_moment || fallback.retryMoment || null,
    equippedPieceSkin: match.equippedPieceSkin || match.equipped_piece_skin || fallback.equippedPieceSkin || "",
    equippedBoardSkin: match.equippedBoardSkin || match.equipped_board_skin || fallback.equippedBoardSkin || "",
    opponentPieceSkin: match.opponentPieceSkin || match.opponent_piece_skin || fallback.opponentPieceSkin || "",
    opponentBoardSkin: match.opponentBoardSkin || match.opponent_board_skin || fallback.opponentBoardSkin || "",
    campaignLevelId: match.campaignLevelId || match.campaign_level_id || fallback.campaignLevelId || "",
    campaignLevelName: match.campaignLevelName || match.campaign_level_name || fallback.campaignLevelName || "",
    campaignObjective: match.campaignObjective || match.campaign_objective || fallback.campaignObjective || "",
    campaignStars: Number(match.campaignStars ?? match.campaign_stars ?? fallback.campaignStars ?? 0),
    campaignNextLevelId: match.campaignNextLevelId || match.campaign_next_level_id || fallback.campaignNextLevelId || "",
    campaignNextLevelName: match.campaignNextLevelName || match.campaign_next_level_name || fallback.campaignNextLevelName || "",
    bestMove: match.bestMove || match.best_move || fallback.bestMove || "",
    mistake: match.mistake || match.biggest_mistake || fallback.mistake || "",
    abilityImpact: match.abilityImpact || match.ability_impact || fallback.abilityImpact || "",
    nextActions: Array.isArray(match.nextActions || match.next_actions) ? (match.nextActions || match.next_actions) : (fallback.nextActions || []),
  };
}

function normalizeLeaderboardRow(row) {
  return {
    id: row.user_id || row.id || row.username,
    name: row.username || row.name || row.player_name || "Commander",
    city: row.city || "Global",
    wins: Number(row.wins || 0),
    losses: Number(row.losses || 0),
    captures: Number(row.captures || 0),
    puzzles: Number(row.puzzles || 0),
    elo: Number(row.mmr_elo_rating || row.elo || 1000),
  };
}

function normalizeLeaderboardCity(city = "Global") {
  return String(city || "Global").trim().toLowerCase();
}

function filterLeaderboardByCity(rows = [], activeCity = "Global") {
  const normalizedCity = normalizeLeaderboardCity(activeCity);
  if (normalizedCity === "global") {
    return rows;
  }
  return rows.filter((row) => normalizeLeaderboardCity(row.city) === normalizedCity);
}

function formatLeaderboardCity(city = "Global") {
  const value = String(city || "Global").trim();
  if (!value) {
    return "CITY: GLOBAL";
  }
  return `CITY: ${value.toUpperCase()}`;
}

function normalizeVaultItem(item) {
  const previewUrl = item.preview_url || item.art_url || item.image || "";
  const id = item.cosmetic_id || item.id;
  return {
    cosmetic_id: id,
    kind: item.kind || "cosmetic",
    name: item.name || "Vault Item",
    rarity: item.rarity || "common",
    price_shards: Number(item.price_shards || 0),
    target_faction_id: item.target_faction_id || null,
    preview_url: previewUrl,
    model_url: item.model_url || PIECE_MODEL_ASSETS[id] || (isModelAsset(previewUrl) ? previewUrl : ""),
    is_premium: Boolean(item.is_premium),
    is_basic: Boolean(item.is_basic),
  };
}

function mergeVaultCatalog(items = []) {
  const byId = new Map(DEFAULT_VAULT_ITEMS.map((item) => [item.cosmetic_id, item]));
  const allowedIds = new Set(byId.keys());
  (Array.isArray(items) ? items : []).forEach((item) => {
    if (item?.cosmetic_id && allowedIds.has(item.cosmetic_id)) {
      const current = byId.get(item.cosmetic_id);
      const next = { ...current, ...item };
      if (current?.model_url) {
        next.model_url = current.model_url;
      }
      if (isModelAsset(next.preview_url) && current?.preview_url && !isModelAsset(current.preview_url)) {
        next.preview_url = current.preview_url;
      }
      byId.set(item.cosmetic_id, next);
    }
  });
  return Array.from(byId.values());
}

function isModelAsset(src) {
  return typeof src === "string" && /\.glb($|\?)/i.test(src);
}

function normalizeInventoryItem(item) {
  const cosmetic = item.cosmetics || item.cosmetic || item;
  return {
    inventory_item_id: item.inventory_item_id || `${item.cosmetic_id}-${Date.now()}`,
    user_id: item.user_id,
    cosmetic_id: item.cosmetic_id || cosmetic.cosmetic_id,
    is_equipped: Boolean(item.is_equipped),
    purchased_at: item.purchased_at,
    equipped_at: item.equipped_at,
    cosmetics: normalizeVaultItem(cosmetic),
  };
}

function getEquippedCosmetics(items, profile = DEFAULT_PROFILE, catalog = []) {
  const equipped = items
    .filter((item) => item.is_equipped)
    .map(normalizeInventoryItem)
    .sort((left, right) => new Date(right.equipped_at || right.purchased_at || 0) - new Date(left.equipped_at || left.purchased_at || 0));
  const profilePieceId = profile.equipped_piece_skin || profile.equippedPieceSkin || "";
  const profileBoardId = profile.equipped_board_skin || profile.equippedBoardSkin || "";
  return {
    board: profileBoardId ? cosmeticFromCatalog(profileBoardId, "board_skin", catalog) : null,
    piece: profilePieceId ? cosmeticFromCatalog(profilePieceId, "piece_skin", catalog) : null,
    badge: equippedBadgeForProfile(profile, catalog) || equipped.find((item) => item.cosmetics.kind === "badge")?.cosmetics,
    emote: equipped.find((item) => item.cosmetics.kind === "emote")?.cosmetics,
  };
}

function normalizeMatchEmote(emote = {}) {
  const cosmetic = emote.cosmetic || emote.cosmetics || emote;
  const id = emote.id || cosmetic.cosmetic_id || cosmetic.id || "emote_good_tempo";
  const label = emote.label || cosmetic.name || rewardCosmeticLabel(id);
  const words = label.split(/\s+/).filter(Boolean);
  const symbol = (emote.symbol || cosmetic.icon || words.map((word) => word[0]).join("").slice(0, 2) || "EM").toUpperCase();
  const toneById = {
    emote_good_tempo: "amber",
    emote_brilliant_jump: "amber",
    emote_crown_rush: "amber",
    emote_close_call: "purple",
    emote_void_glitch: "purple",
    emote_fortified: "cyan",
    emote_well_played: "cyan",
    sticker_laugh_burst: "cyan",
    sticker_thumbs_up: "amber",
    sticker_oops_trap: "purple",
    sticker_hype_flame: "amber",
  };
  return {
    id,
    cosmetic_id: cosmetic.cosmetic_id || id,
    label,
    symbol,
    text: emote.text || label,
    tone: emote.tone || toneById[id] || "cyan",
    cosmetic: normalizeVaultItem({
      cosmetic_id: cosmetic.cosmetic_id || id,
      kind: cosmetic.kind || "emote",
      name: cosmetic.name || label,
      rarity: cosmetic.rarity || "common",
      price_shards: cosmetic.price_shards || 0,
      preview_url: cosmetic.preview_url || cosmetic.art_url || cosmetic.image || "",
      is_premium: Boolean(cosmetic.is_premium),
    }),
  };
}

function availableMatchEmotes(equippedCosmetics = {}, inventoryItems = []) {
  const emotes = new Map(DEFAULT_MATCH_EMOTES.map((item) => [item.id, normalizeMatchEmote(item)]));
  if (equippedCosmetics.emote) {
    const normalized = normalizeMatchEmote(equippedCosmetics.emote);
    emotes.set(normalized.id, normalized);
  }
  inventoryItems
    .map(normalizeInventoryItem)
    .filter((item) => item.cosmetics.kind === "emote")
    .forEach((item) => {
      const normalized = normalizeMatchEmote(item.cosmetics);
      emotes.set(normalized.id, normalized);
    });
  return Array.from(emotes.values());
}

function normalizeSkinIds(skinIds = {}) {
  return {
    piece: skinIds?.piece || skinIds?.equippedPieceSkin || skinIds?.equipped_piece_skin || "",
    board: skinIds?.board || skinIds?.equippedBoardSkin || skinIds?.equipped_board_skin || "",
  };
}

function cosmeticRenderMode(cosmetic = {}) {
  const item = normalizeVaultItem(cosmetic || {});
  if (item.kind === "piece_skin") {
    if (item.model_url || PIECE_MODEL_ASSETS[item.cosmetic_id] || isModelAsset(item.preview_url)) {
      return "3d";
    }
    if (isPremium2DPieceSkin(item.cosmetic_id)) {
      return "2d";
    }
  }
  return "both";
}

function cosmeticCompatibleWithView(cosmetic = {}, viewMode = "3d") {
  if (!cosmetic) {
    return true;
  }
  const renderMode = cosmeticRenderMode(cosmetic);
  return renderMode === "both" || renderMode === viewMode;
}

function skinIdsFromCosmetics(cosmetics = {}, viewMode = "3d") {
  const piece = cosmetics.piece && cosmeticCompatibleWithView(cosmetics.piece, viewMode) ? cosmetics.piece.cosmetic_id || "" : "";
  return normalizeSkinIds({
    piece,
    board: cosmetics.board?.cosmetic_id || "",
  });
}

function profileSkinPatchForCosmetic(cosmetic = {}) {
  if (cosmetic.kind === "piece_skin") {
    return { equipped_piece_skin: cosmetic.cosmetic_id || "" };
  }
  if (cosmetic.kind === "board_skin") {
    return { equipped_board_skin: cosmetic.cosmetic_id || "" };
  }
  return {};
}

function cosmeticFromCatalog(cosmeticId, kind, catalog = []) {
  if (!cosmeticId) {
    return null;
  }
  const item = [...(catalog || []), ...DEFAULT_BADGE_ITEMS, ...DEFAULT_VAULT_ITEMS].find((entry) => entry.cosmetic_id === cosmeticId || entry.id === cosmeticId);
  return normalizeVaultItem(item || { cosmetic_id: cosmeticId, kind, name: rewardCosmeticLabel(cosmeticId), rarity: "remote", preview_url: "" });
}

function earnedBadgeCosmetics(profile = DEFAULT_PROFILE, catalog = []) {
  return [...new Set(asArray(profile.earned_badges || profile.earnedBadges))]
    .map((badgeId) => cosmeticFromCatalog(badgeId, "badge", catalog))
    .filter(Boolean);
}

function equippedBadgeForProfile(profile = DEFAULT_PROFILE, catalog = []) {
  const badgeId = profile.equipped_badge || profile.equippedBadge || "";
  if (!badgeId) {
    return null;
  }
  const earned = new Set(asArray(profile.earned_badges || profile.earnedBadges));
  if (earned.size && !earned.has(badgeId)) {
    return null;
  }
  return cosmeticFromCatalog(badgeId, "badge", catalog);
}

function cosmeticsFromSkinIds(skinIds = {}, catalog = []) {
  const normalized = normalizeSkinIds(skinIds);
  return {
    piece: cosmeticFromCatalog(normalized.piece, "piece_skin", catalog),
    board: cosmeticFromCatalog(normalized.board, "board_skin", catalog),
  };
}

function skinIdsForRemotePlayer(playerSkinIds = {}, activeUserId = "") {
  const entries = Object.entries(playerSkinIds || {});
  const remote = entries.find(([userId]) => String(userId) !== String(activeUserId));
  return remote ? normalizeSkinIds(remote[1]) : null;
}

function buildMatchCosmetics({ localCosmetics = {}, remoteSkinIds = {}, mode = "ai", multiplayerRole = "host", catalog = [], viewMode = "3d" } = {}) {
  const localPlayer = mode === "multiplayer" && multiplayerRole === "guest" ? "black" : "white";
  const remotePlayer = localPlayer === "white" ? "black" : "white";
  const remoteCosmetics = cosmeticsFromSkinIds(remoteSkinIds, catalog);
  const localPiece = localCosmetics.piece && cosmeticCompatibleWithView(localCosmetics.piece, viewMode) ? localCosmetics.piece : null;
  const remotePiece = remoteCosmetics.piece && cosmeticCompatibleWithView(remoteCosmetics.piece, viewMode) ? remoteCosmetics.piece : null;
  const byPlayer = { white: null, black: null };
  byPlayer[localPlayer] = localPiece;
  if (mode === "multiplayer") {
    byPlayer[remotePlayer] = remotePiece;
  }
  return {
    ...localCosmetics,
    piece: localPiece,
    board: localCosmetics.board || null,
    mode,
    byPlayer,
    localPlayer,
    remotePlayer: mode === "multiplayer" ? remotePlayer : null,
    remoteBoard: mode === "multiplayer" ? remoteCosmetics.board : null,
  };
}

function pieceCosmeticForPlayer(cosmetics = {}, player) {
  if (cosmetics?.byPlayer) {
    return cosmetics.byPlayer[player] || null;
  }
  return cosmetics?.piece || null;
}

function renderPieceColors(pieceColors = DEFAULT_PIECE_COLORS, cosmetics = {}) {
  const colors = normalizePieceColors(pieceColors);
  if (!cosmetics?.byPlayer) {
    return colors;
  }
  const localPlayer = cosmetics.localPlayer || "white";
  if (cosmetics.mode !== "multiplayer") {
    return {
      white: colors.white,
      black: colors.black,
    };
  }
  return {
    white: localPlayer === "white" ? colors.white : DEFAULT_PIECE_COLORS.white,
    black: localPlayer === "black" ? colors.white : STANDARD_AMBER_PIECE_COLORS.black,
  };
}

function getRenderPieceColorStyle(pieceColors, player, cosmetics = {}) {
  return getPieceColorStyle(renderPieceColors(pieceColors, cosmetics), player);
}

function aiDifficultyFromLevel(level) {
  if (level === "coach") {
    return "hard";
  }
  if (level === "smart") {
    return "medium";
  }
  return "easy";
}

function calculateMatchReward({ aiDifficulty, result }) {
  const multiplier = aiDifficulty === "hard" ? 2 : aiDifficulty === "medium" ? 1.5 : 1;
  return {
    exp: Math.floor(80 * multiplier) + (result === "win" ? 40 : 0),
    shards: result === "win" ? 35 : 12,
  };
}

function expRequiredForLevel(level) {
  return 120 + Math.max(1, level) * 80;
}

function applyProgression(profile, reward, factions) {
  let level = profile.level;
  let currentExp = profile.current_exp + Number(reward.exp || 0);
  while (currentExp >= expRequiredForLevel(level)) {
    currentExp -= expRequiredForLevel(level);
    level += 1;
  }
  const unlocked = new Set(profile.unlocked_factions || ["nomads"]);
  factions.forEach((faction) => {
    if (faction.id === "void_order") {
      return;
    }
    const required = faction.required_level_to_unlock || faction.requiredLevelToUnlock || (faction.id === "nomads" ? 1 : faction.id === "iron_guard" ? 2 : faction.id === "sun_court" ? 4 : 6);
    if (required <= level) {
      unlocked.add(faction.id);
    }
  });
  return normalizeProfile({
    ...profile,
    current_exp: currentExp,
    level,
    essence: profile.essence + Number(reward.essence || 0),
    shards: profile.shards + Number(reward.shards || 0),
    unlocked_factions: [...unlocked],
  });
}

function buildLevelRewards(factions = []) {
  return LEVEL_REWARD_TRACK.map((reward) => {
    const faction = factions.find((item) => item.id === reward.factionId);
    return {
      ...reward,
      title: faction && reward.type === "faction" ? `${faction.name} Unlock` : reward.title,
      rewards: faction && reward.type === "faction"
        ? [`${faction.name} faction`, `${faction.passives?.[0]?.name || "Passive"} core`, `${faction.ultimates?.[0]?.name || "Ultimate"} charge`]
        : reward.rewards,
    };
  });
}

function buildAchievements({ profile, campaignProgress, matchHistory, inventoryItems }) {
  const reports = (matchHistory || []).map((item) => normalizeMatchReport(item, DEFAULT_MATCH_REPORT));
  const wins = reports.filter((item) => item.result === "win").length
    + Number(profile.pve_stats?.wins || 0)
    + Number(profile.pvp_stats?.wins || 0);
  const captures = reports.reduce((sum, item) => sum + Number(item.captured || item.captures_made || 0), 0);
  const completedCampaign = campaignProgress?.completed_levels?.length || 0;
  const claimed = new Set(profile.achievements_claimed || []);
  const values = {
    first_victory: wins,
    capture_artist: captures,
    trail_runner: completedCampaign,
    city_banner: profile.city && profile.city !== "Global" ? 1 : 0,
    vault_collector: inventoryItems?.length || 0,
    daily_tactician: normalizeStreaks(profile.streaks).dailyPuzzle,
    coach_student: reports.some((item) => item.retryMoment || item.review?.length) ? 1 : 0,
    faction_recruiter: profile.unlocked_factions?.length || 1,
  };
  return ACHIEVEMENT_CATALOG.map((achievement) => ({
    ...achievement,
    progress: Number(values[achievement.id] || 0),
    claimed: claimed.has(achievement.id),
  }));
}

function rewardCosmeticIds(reward = {}) {
  const values = [
    ...asArray(reward.cosmetic_id),
    ...asArray(reward.cosmetic_ids),
    ...asArray(reward.cosmetic),
    ...asArray(reward.cosmetics),
  ];
  return [...new Set(values.map((item) => typeof item === "string" ? item : item?.cosmetic_id).filter(Boolean))];
}

function asArray(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function rewardCosmeticLabel(cosmeticId) {
  const item = DEFAULT_VAULT_ITEMS.find((cosmetic) => cosmetic.cosmetic_id === cosmeticId);
  if (item?.name) {
    return item.name;
  }
  return String(cosmeticId).split("_").filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
}

function createAchievementInventoryItem(cosmeticId, userId, vaultItems = []) {
  const source = [...(vaultItems || []), ...DEFAULT_VAULT_ITEMS].find((item) => item.cosmetic_id === cosmeticId) || {
    cosmetic_id: cosmeticId,
    kind: "badge",
    name: rewardCosmeticLabel(cosmeticId),
    rarity: "achievement",
    price_shards: 0,
    target_faction_id: null,
    preview_url: "",
    is_premium: false,
  };
  const cosmetic = normalizeVaultItem(source);
  return normalizeInventoryItem({
    inventory_item_id: crypto.randomUUID ? crypto.randomUUID() : `${cosmeticId}-${Date.now()}`,
    user_id: userId,
    cosmetic_id: cosmeticId,
    is_equipped: false,
    purchased_at: new Date().toISOString(),
    cosmetics: cosmetic,
  });
}

function formatReward(reward = {}) {
  const parts = [];
  if (reward.shards) {
    parts.push(`+${reward.shards} Shards`);
  }
  if (reward.essence) {
    parts.push(`+${reward.essence} Essence`);
  }
  if (reward.exp) {
    parts.push(`+${reward.exp} EXP`);
  }
  rewardCosmeticIds(reward).forEach((cosmeticId) => {
    parts.push(rewardCosmeticLabel(cosmeticId));
  });
  return parts.length ? parts.join(" / ") : "Cosmetic unlock";
}

function cosmeticClass(id) {
  return id ? `cosmetic-${id.replaceAll("_", "-")}` : "";
}

function score(row) {
  return row.wins * 30 + row.puzzles * 12 + row.captures * 2 - row.losses * 5;
}

function getResultText(winner, resultLabel) {
  if (resultLabel) {
    return resultLabel;
  }
  if (winner === "white") {
    return "Azure wins";
  }
  if (winner === "black") {
    return "Amber wins";
  }
  return "";
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function currentDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function previousDateKey() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return currentDateKey(date);
}
