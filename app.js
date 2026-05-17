const BOARD_SIZE = 8;
const GAME_STORAGE_KEY = "dama-sprint-state-v3";
const PROFILE_STORAGE_KEY = "dama-sprint-profile-v1";
const LEADERBOARD_STORAGE_KEY = "dama-sprint-leaderboard-v1";
const CAMPAIGN_STORAGE_KEY = "dama-sprint-campaign-v1";
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

const PLAYERS = {
  azure: {
    name: "Azure",
    direction: -1,
    kingRow: 0,
    rival: "amber",
  },
  amber: {
    name: "Amber",
    direction: 1,
    kingRow: 7,
    rival: "azure",
  },
};

const MODE_LABELS = {
  local: "Local",
  ai: "vs AI",
  puzzle: "Daily",
  campaign: "Trail",
};

const AI_LABELS = {
  beginner: "Beginner",
  smart: "Smart",
  coach: "Coach",
};

const TIMER_LABELS = {
  0: "No timer",
  180: "3 min duel",
  300: "5 min classic",
};

const DEFAULT_PROFILE = {
  name: "Player",
  city: "Almaty",
  streak: 0,
  lastPuzzleDate: "",
};

const DAILY_PUZZLE = {
  id: "capture-chain-01",
  title: "Capture Chain",
  goalCaptures: 2,
  highlight: { row: 5, col: 2 },
  objective: "Find the two-jump capture chain for Azure.",
};

const NOMAD_CAMPAIGN = [
  {
    id: "road_behind",
    number: 1,
    name: "The Road Behind",
    hook: "A scout is boxed in by a larger army. The only winning lesson is that Nomads can retreat without losing tempo.",
    objective: "Use Open Roads to move one normal piece backward while no capture exists.",
    hint: "Select the Nomad on c3 and move backward to b2 or d2.",
    loadout: {
      factionId: "nomads",
      passiveId: "open_roads",
      ultimateId: "dash",
    },
    completion: {
      type: "passive_move",
      id: "open_roads",
    },
    white: ["c3", "e1", "g1"],
    black: ["b6", "d6", "f6", "h6", "a7", "c7", "e7", "g7"],
  },
  {
    id: "salt_road_sprint",
    number: 2,
    name: "Salt-Road Sprint",
    hook: "The caravan is too slow to fight head-on. One rider must cut two diagonals at once and reopen the center.",
    objective: "Use Dash to move a normal piece exactly two diagonal empty squares.",
    hint: "Arm Dash, choose c1, then land on e3.",
    loadout: {
      factionId: "nomads",
      passiveId: "open_roads",
      ultimateId: "dash",
    },
    completion: {
      type: "scripted_win",
      id: "dash_chain",
    },
    white: ["a1", "c1", "g1", "h2"],
    black: ["b6", "c5", "g7", "h6"],
  },
  {
    id: "dust_trap",
    number: 3,
    name: "Dust Veil Bait",
    hook: "Amber has a capture ready on the center lane. Dust Veil absorbs the strike, then the Nomads punish with a forced chain.",
    objective: "Trigger Dust Veil, wait for the blocked e5xc3 jump to resolve, then clear Amber with d4xf6xh8.",
    hint: "Move c3 to d4. After Dust Veil blocks e5xc3 over d4, capture d4xf6 and continue f6xh8.",
    loadout: {
      factionId: "nomads",
      passiveId: "dust_veil",
      ultimateId: "dash",
    },
    completion: {
      type: "scripted_win",
      id: "dust_veil_chain",
    },
    white: ["a1", "c3"],
    black: ["e5", "g7"],
  },
  {
    id: "storm_gate",
    number: 4,
    name: "Storm at the Blue Gate",
    hook: "Amber's f6 guard controls both exits. Sandstorm closes e5 and g5, then the Nomads turn the frozen lane into a capture chain.",
    objective: "Use Sandstorm Corridor on e5 and g5, wait for the lane-denial pulse, then clear Amber with c3xe5xg7.",
    hint: "Arm Sandstorm, block e5 and g5, then capture c3xe5 over d4 and continue e5xg7 over f6.",
    loadout: {
      factionId: "nomads",
      passiveId: "open_roads",
      ultimateId: "sandstorm_corridor",
    },
    completion: {
      type: "scripted_win",
      id: "sandstorm_chain",
    },
    white: ["a1", "c3"],
    black: ["d4", "f6"],
  },
];

const DEFAULT_LEADERBOARD = [
  { id: "seed-almaty-1", name: "Aruzhan", city: "Almaty", wins: 18, losses: 5, captures: 71, puzzles: 9 },
  { id: "seed-almaty-2", name: "Daniyar", city: "Almaty", wins: 13, losses: 4, captures: 52, puzzles: 7 },
  { id: "seed-astana-1", name: "Miras", city: "Astana", wins: 16, losses: 6, captures: 64, puzzles: 6 },
  { id: "seed-shymkent-1", name: "Amina", city: "Shymkent", wins: 12, losses: 3, captures: 45, puzzles: 8 },
  { id: "seed-aktobe-1", name: "Timur", city: "Aktobe", wins: 10, losses: 5, captures: 38, puzzles: 4 },
  { id: "seed-karaganda-1", name: "Dana", city: "Karaganda", wins: 11, losses: 7, captures: 49, puzzles: 5 },
];

const FACTION_LIBRARY = [
  {
    id: "nomads",
    name: "Steppe Nomads",
    crest: "N",
    unlock: "Free",
    lore: "Win by tempo, escape routes, and sudden board control.",
    passives: [
      {
        id: "open_roads",
        name: "Open Roads",
        icon: "OR",
        description: "If no capture is available, one normal piece may move one diagonal square backward.",
      },
      {
        id: "dust_veil",
        name: "Dust Veil",
        icon: "DV",
        description: "After a quiet move, the moved piece blocks the first normal capture against it.",
      },
    ],
    ultimates: [
      {
        id: "dash",
        name: "Dash",
        icon: "DS",
        cost: 2,
        description: "Move one normal piece exactly two diagonal empty squares. No capture.",
      },
      {
        id: "sandstorm_corridor",
        name: "Sandstorm",
        icon: "SC",
        cost: 2,
        description: "Block two empty dark squares from enemy quiet landings for one turn.",
      },
    ],
  },
  {
    id: "iron_guard",
    name: "Iron Guard",
    crest: "G",
    unlock: "Chapter 1",
    lore: "Hold the center, survive attacks, and punish overextension.",
    passives: [
      {
        id: "shield_wall",
        name: "Shield Wall",
        icon: "SW",
        description: "The first allied piece that enters a highlighted playable center square becomes guarded for the enemy turn.",
      },
      {
        id: "vengeance_ledger",
        name: "Vengeance Ledger",
        icon: "VL",
        description: "After losing a piece, your next capture grants one extra Momentum.",
      },
    ],
    ultimates: [
      {
        id: "fortify",
        name: "Fortify",
        icon: "FT",
        cost: 2,
        description: "Choose one allied piece. For two enemy turns, that piece cannot be captured.",
      },
      {
        id: "barricade",
        name: "Barricade",
        icon: "BR",
        cost: 2,
        description: "Place two temporary blockers on empty dark squares for one enemy turn.",
      },
    ],
  },
  {
    id: "sun_court",
    name: "Sun Court",
    crest: "S",
    unlock: "Chapter 2",
    lore: "Race for promotion and turn kings into pressure.",
    passives: [
      {
        id: "royal_pressure",
        name: "Royal Pressure",
        icon: "RP",
        description: "The first normal piece that enters the enemy final three rows grants Momentum.",
      },
      {
        id: "crown_tax",
        name: "Crown Tax",
        icon: "CT",
        description: "The first time the opponent promotes a king, gain two Momentum.",
      },
    ],
    ultimates: [
      {
        id: "crown_surge",
        name: "Crown Surge",
        icon: "CS",
        cost: 2,
        description: "Promote one normal piece in the middle rows immediately.",
      },
      {
        id: "sun_lance",
        name: "Sun Lance",
        icon: "SL",
        cost: 2,
        description: "One normal piece strikes like a king for a diagonal capture this turn.",
      },
    ],
  },
  {
    id: "void_order",
    name: "Void Order",
    crest: "V",
    unlock: "Achievement",
    lore: "Disrupt lanes, mark mistakes, and bend board geometry.",
    passives: [
      {
        id: "pressure_field",
        name: "Pressure Field",
        icon: "PF",
        description: "Once per match, danger created by the opponent grants Momentum.",
      },
      {
        id: "echo_mark",
        name: "Echo Mark",
        icon: "EM",
        description: "The first enemy quiet move is marked. Capture it for Momentum.",
      },
    ],
    ultimates: [
      {
        id: "phase_shift",
        name: "Phase Shift",
        icon: "PS",
        cost: 2,
        description: "Move one normal piece to an adjacent empty dark square.",
      },
      {
        id: "collapse",
        name: "Collapse",
        icon: "CL",
        cost: 2,
        description: "Void one empty dark square so no piece may land there for one turn.",
      },
    ],
  },
];

const DEFAULT_LOADOUT = {
  factionId: "nomads",
  passiveId: "open_roads",
  ultimateId: "dash",
};

const INITIAL_COACH =
  "Control the center early. Captures become mandatory as soon as they appear.";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const boardEl = $("#board");
const turnNameEl = $("#turnName");
const moveCountEl = $("#moveCount");
const timerDisplayEl = $("#timerDisplay");
const momentumDisplayEl = $("#momentumDisplay");
const gameMessageEl = $("#gameMessage");
const winnerBadgeEl = $("#winnerBadge");
const turnDotEl = $("#turnDot");
const coachNoteEl = $("#coachNote");
const moveHistoryEl = $("#moveHistory");
const historyCountEl = $("#historyCount");
const reviewListEl = $("#reviewList");
const reviewCountEl = $("#reviewCount");
const recapTextEl = $("#recapText");
const recapBadgeEl = $("#recapBadge");
const puzzleStatusEl = $("#puzzleStatus");
const streakCountEl = $("#streakCount");
const campaignProgressBadgeEl = $("#campaignProgressBadge");
const campaignStatusEl = $("#campaignStatus");
const campaignLevelButtonsEl = $("#campaignLevelButtons");
const campaignObjectiveEl = $("#campaignObjective");
const leaderboardListEl = $("#leaderboardList");
const leaderboardScopeEl = $("#leaderboardScope");
const profileBadgeEl = $("#profileBadge");
const modeBadgeEl = $("#modeBadge");
const factionUnlockBadgeEl = $("#factionUnlockBadge");
const factionRailEl = $("#factionRail");
const factionCrestEl = $("#factionCrest");
const factionNameEl = $("#factionName");
const factionLoreEl = $("#factionLore");
const passiveCardEl = $("#passiveCard");
const ultimateCardEl = $("#ultimateCard");
const passiveChoicesEl = $("#passiveChoices");
const ultimateChoicesEl = $("#ultimateChoices");
const azurePiecesEl = $("#azurePieces");
const amberPiecesEl = $("#amberPieces");
const azureMeterEl = $("#azureMeter");
const amberMeterEl = $("#amberMeter");
const ruleStatusEl = $("#ruleStatus");
const newGameButton = $("#newGameButton");
const ultimateButton = $("#ultimateButton");
const undoButton = $("#undoButton");
const themeButton = $("#themeButton");
const proButton = $("#proButton");
const shareButton = $("#shareButton");
const saveProfileButton = $("#saveProfileButton");
const playerNameInput = $("#playerNameInput");
const citySelect = $("#citySelect");
const aiLevelSelect = $("#aiLevelSelect");
const timerSelect = $("#timerSelect");
const proModal = $("#proModal");
const closeProButton = $("#closeProButton");
const mockCheckoutButton = $("#mockCheckoutButton");
const modeButtons = $$("[data-mode]");

let profile = loadProfile();
let leaderboard = loadLeaderboard();
let campaignProgress = loadCampaignProgress();
let aiTimer = null;
let state = loadGame(profile) || createNewState({ theme: "dark", profile });

hydrateControls();
render();
window.setInterval(tickClock, 1000);

newGameButton.addEventListener("click", () => {
  startNewMatch();
});

ultimateButton.addEventListener("click", () => {
  toggleUltimateMode();
});

undoButton.addEventListener("click", () => {
  window.clearTimeout(aiTimer);
  state.aiThinking = false;

  const last = state.undoStack.pop();
  if (!last) {
    state.message = "No moves to undo yet.";
    render();
    return;
  }

  state = {
    ...createNewState({
      theme: state.theme,
      profile,
      mode: state.mode,
      aiLevel: state.aiLevel,
      timerMode: state.timerMode,
      loadout: state.loadout,
    }),
    ...last,
    undoStack: state.undoStack,
    theme: state.theme,
    profile,
    aiThinking: false,
  };
  state.message = "Last move undone.";
  render();
});

themeButton.addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  render();
});

saveProfileButton.addEventListener("click", () => {
  profile = {
    ...profile,
    name: cleanProfileName(playerNameInput.value),
    city: citySelect.value || DEFAULT_PROFILE.city,
  };
  state.profile = profile;
  saveProfile();
  state.message = `Profile saved for ${profile.name} from ${profile.city}.`;
  hydrateControls();
  render();
});

aiLevelSelect.addEventListener("change", () => {
  state.aiLevel = aiLevelSelect.value;
  state.message = `AI sparring partner set to ${AI_LABELS[state.aiLevel]}.`;
  render();
});

timerSelect.addEventListener("change", () => {
  state.timerMode = timerSelect.value;
  state.clocks = createClocks(state.timerMode);
  state.message = `${TIMER_LABELS[state.timerMode]} selected.`;
  render();
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.mode;
    startNewMatch({
      mode,
      campaignLevelId: mode === "campaign" ? getDefaultCampaignLevelId() : state.campaign?.levelId,
    });
  });
});

proButton.addEventListener("click", () => {
  proModal.hidden = false;
});

closeProButton.addEventListener("click", () => {
  proModal.hidden = true;
});

mockCheckoutButton.addEventListener("click", () => {
  state.message = "Pro waitlist interest saved for this prototype.";
  proModal.hidden = true;
  render();
});

shareButton.addEventListener("click", async () => {
  const text = buildShareText();
  if (!text) {
    state.message = "Finish a match first to create a recap.";
    render();
    return;
  }

  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      state.message = "Share recap copied.";
    } else {
      state.message = text;
    }
  } catch (error) {
    state.message = text;
  }
  render();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !proModal.hidden) {
    proModal.hidden = true;
  }
});

function startNewMatch(overrides = {}) {
  window.clearTimeout(aiTimer);
  const nextMode = overrides.mode || state.mode;
  const nextCampaignLevelId =
    overrides.campaignLevelId || state.campaign?.levelId || getDefaultCampaignLevelId();
  const campaignLevel = nextMode === "campaign"
    ? getCampaignLevel(nextCampaignLevelId)
    : null;
  const settings = {
    mode: state.mode,
    aiLevel: aiLevelSelect.value,
    timerMode: timerSelect.value,
    loadout: state.loadout,
    campaignLevelId: state.campaign?.levelId,
    ...readSettings(),
    ...overrides,
    ...(campaignLevel
      ? {
          aiLevel: "smart",
          timerMode: "0",
          loadout: campaignLevel.loadout,
          campaignLevelId: campaignLevel.id,
        }
      : {}),
  };

  state = createNewState({
    theme: state.theme,
    profile,
    ...settings,
  });

  hydrateControls();
  render();
}

function readSettings() {
  const activeMode = modeButtons.find((button) => button.classList.contains("active"));
  return {
    mode: activeMode?.dataset.mode || state.mode || "local",
    aiLevel: aiLevelSelect.value || "beginner",
    timerMode: timerSelect.value || "0",
  };
}

function hydrateControls() {
  playerNameInput.value = profile.name;
  citySelect.value = profile.city;
  aiLevelSelect.value = state.aiLevel;
  timerSelect.value = state.timerMode;
  renderModeButtons();
}

function createNewState({
  theme = "dark",
  profile: nextProfile = DEFAULT_PROFILE,
  mode = "local",
  aiLevel = "beginner",
  timerMode = "0",
  loadout = DEFAULT_LOADOUT,
  campaignLevelId = getDefaultCampaignLevelId(),
} = {}) {
  const isPuzzle = mode === "puzzle";
  const isCampaign = mode === "campaign";
  const campaignLevel = getCampaignLevel(campaignLevelId);
  const normalizedLoadout = normalizeLoadout(isCampaign ? campaignLevel.loadout : loadout);

  return {
    board: isCampaign
      ? createCampaignBoard(campaignLevel)
      : isPuzzle
        ? createPuzzleBoard()
        : createInitialBoard(),
    turn: "azure",
    selected: null,
    legalMoves: [],
    forcedFrom: null,
    winner: null,
    winnerReason: "",
    message: isCampaign
      ? `${campaignLevel.name}: ${campaignLevel.objective}`
      : isPuzzle
        ? DAILY_PUZZLE.objective
        : "Azure opens the match.",
    coach: isPuzzle
      ? "Daily tactic: look for a capture that keeps the same piece active."
      : isCampaign
        ? campaignLevel.hint
        : INITIAL_COACH,
    moveLog: [],
    moveEvents: [],
    reviewEvents: [],
    undoStack: [],
    theme,
    mode,
    aiLevel,
    timerMode,
    loadout: normalizedLoadout,
    momentum: 2,
    ultimateUsed: false,
    abilityMode: null,
    powerSelection: [],
    statuses: createInitialStatuses(),
    abilityLog: [],
    clocks: createClocks(timerMode),
    profile: nextProfile,
    resultRecorded: false,
    recap: null,
    puzzle: {
      id: DAILY_PUZZLE.id,
      captures: 0,
      solved: false,
      failed: false,
    },
    campaign: {
      levelId: campaignLevel.id,
      solved: false,
      objective: campaignLevel.objective,
    },
    aiThinking: false,
  };
}

function createInitialBoard() {
  const board = createEmptyBoard();
  let amberId = 1;
  let azureId = 1;

  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (isDarkSquare(row, col)) {
        board[row][col] = {
          id: `amber-${amberId}`,
          player: "amber",
          king: false,
        };
        amberId += 1;
      }
    }
  }

  for (let row = 5; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (isDarkSquare(row, col)) {
        board[row][col] = {
          id: `azure-${azureId}`,
          player: "azure",
          king: false,
        };
        azureId += 1;
      }
    }
  }

  return board;
}

function createPuzzleBoard() {
  const board = createEmptyBoard();
  board[5][2] = { id: "azure-puzzle-1", player: "azure", king: false };
  board[4][3] = { id: "amber-puzzle-1", player: "amber", king: false };
  board[2][5] = { id: "amber-puzzle-2", player: "amber", king: false };
  board[6][5] = { id: "azure-puzzle-2", player: "azure", king: false };
  board[1][0] = { id: "amber-puzzle-3", player: "amber", king: false };
  return board;
}

function createCampaignBoard(level) {
  const board = createEmptyBoard();
  level.white.forEach((coord, index) => {
    const square = coordToSquare(coord);
    board[square.row][square.col] = {
      id: `azure-campaign-${level.id}-${index + 1}`,
      player: "azure",
      king: false,
    };
  });
  level.black.forEach((coord, index) => {
    const square = coordToSquare(coord);
    board[square.row][square.col] = {
      id: `amber-campaign-${level.id}-${index + 1}`,
      player: "amber",
      king: false,
    };
  });
  return board;
}

function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null),
  );
}

function createClocks(timerMode) {
  const seconds = Number(timerMode) || 0;
  return {
    azure: seconds,
    amber: seconds,
  };
}

function createInitialStatuses() {
  return {
    guarded: [],
    blockedSquares: [],
    passiveTriggers: {},
    counters: {
      azureCaptures: 0,
      azureLosses: 0,
    },
    vengeanceArmed: false,
    echoMark: null,
    sunLancePieceId: null,
  };
}

function render() {
  document.body.dataset.theme = state.theme;
  renderModeButtons();
  renderFactionMenu();
  renderBoard();
  renderStatus();
  renderInsights();
  saveGame();
  queueAiIfNeeded();
}

function renderModeButtons() {
  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  });
}

function renderFactionMenu() {
  const faction = getSelectedFaction();
  const passive = getSelectedPassive();
  const ultimate = getSelectedUltimate();

  factionRailEl.innerHTML = "";
  FACTION_LIBRARY.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      "faction-button",
      item.id === faction.id ? "active" : "",
      item.unlock !== "Free" ? "locked" : "",
    ]
      .filter(Boolean)
      .join(" ");
    button.textContent = item.crest;
    button.title = item.name;
    button.setAttribute("aria-label", item.name);
    button.addEventListener("click", () => selectFaction(item.id));
    factionRailEl.appendChild(button);
  });

  factionUnlockBadgeEl.textContent = faction.unlock;
  factionCrestEl.textContent = faction.crest;
  factionNameEl.textContent = faction.name;
  factionLoreEl.textContent = faction.lore;
  passiveCardEl.innerHTML = renderAbilityCardMarkup("Passive", passive, "passive");
  ultimateCardEl.innerHTML = renderAbilityCardMarkup("Ultimate", ultimate, "ultimate");

  renderAbilityChoices(passiveChoicesEl, faction.passives, state.loadout.passiveId, "passive");
  renderAbilityChoices(ultimateChoicesEl, faction.ultimates, state.loadout.ultimateId, "ultimate");
}

function renderAbilityCardMarkup(label, ability, kind) {
  return `
    <span class="ability-icon">${ability.icon}</span>
    <div>
      <span class="summary-label">${label}</span>
      <strong>${escapeHtml(ability.name)}</strong>
      <p>${escapeHtml(ability.description)}</p>
    </div>
  `;
}

function renderAbilityChoices(container, abilities, selectedId, type) {
  container.innerHTML = "";
  abilities.forEach((ability) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = ability.id === selectedId ? "active" : "";
    button.textContent = ability.name;
    button.addEventListener("click", () => selectAbility(type, ability.id));
    container.appendChild(button);
  });
}

function selectFaction(factionId) {
  if (state.mode === "campaign") {
    state.message = "Campaign levels lock the Nomads loadout for the lesson.";
    render();
    return;
  }

  const faction = getFactionById(factionId);
  state.loadout = {
    factionId: faction.id,
    passiveId: faction.passives[0].id,
    ultimateId: faction.ultimates[0].id,
  };
  resetPowerState();
  state.message = `${faction.name} selected. New matches will use this loadout.`;
  render();
}

function selectAbility(type, abilityId) {
  if (state.mode === "campaign") {
    state.message = "Campaign levels choose the required passive and ultimate.";
    render();
    return;
  }

  state.loadout = {
    ...state.loadout,
    [type === "passive" ? "passiveId" : "ultimateId"]: abilityId,
  };
  resetPowerState();
  state.message = `${type === "passive" ? "Passive" : "Ultimate"} selected.`;
  render();
}

function toggleUltimateMode() {
  if (state.abilityMode) {
    resetPowerState();
    state.message = "Power cancelled.";
    render();
    return;
  }

  if (!canUseUltimate()) {
    const ultimate = getSelectedUltimate();
    state.message = state.ultimateUsed
      ? `${ultimate.name} was already used this match.`
      : `${ultimate.name} needs ${ultimate.cost} Momentum.`;
    render();
    return;
  }

  state.abilityMode = state.loadout.ultimateId;
  state.powerSelection = [];
  state.selected = null;
  state.legalMoves = [];
  state.message = `${getSelectedUltimate().name} armed.`;
  render();
}

function handlePowerClick(row, col) {
  const ultimateId = state.abilityMode;
  if (!ultimateId) {
    return;
  }

  if (["dash", "phase_shift"].includes(ultimateId)) {
    handleMovementPower(row, col, ultimateId);
    return;
  }

  if (["sandstorm_corridor", "barricade", "collapse"].includes(ultimateId)) {
    handleBlockerPower(row, col, ultimateId);
    return;
  }

  if (ultimateId === "fortify") {
    handleFortify(row, col);
    return;
  }

  if (ultimateId === "crown_surge") {
    handleCrownSurge(row, col);
    return;
  }

  if (ultimateId === "sun_lance") {
    handleSunLance(row, col);
  }
}

function handleMovementPower(row, col, ultimateId) {
  const piece = state.board[row][col];
  if (!state.selected) {
    if (!piece || piece.player !== "azure" || piece.king) {
      state.message = "Choose one normal Azure piece.";
      render();
      return;
    }

    const moves = ultimateId === "dash"
      ? getDashMoves(row, col, piece)
      : getPhaseShiftMoves(row, col, piece);
    if (moves.length === 0) {
      state.message = "That piece has no power move.";
      render();
      return;
    }

    state.selected = { row, col };
    state.legalMoves = moves;
    state.message = `${getSelectedUltimate().name} target selected.`;
    render();
    return;
  }

  const chosenMove = state.legalMoves.find(
    (move) => move.to.row === row && move.to.col === col,
  );
  if (chosenMove) {
    applyMove(chosenMove, { actor: "human" });
    return;
  }

  state.selected = null;
  state.legalMoves = [];
  render();
}

function handleBlockerPower(row, col, ultimateId) {
  const required = ultimateId === "collapse" ? 1 : 2;
  const kind = ultimateId === "sandstorm_corridor" ? "quiet" : "all";

  if (!isValidBlockerTarget(row, col)) {
    state.message = "Choose an empty dark square.";
    render();
    return;
  }

  if (state.powerSelection.some((item) => item.row === row && item.col === col)) {
    state.powerSelection = state.powerSelection.filter(
      (item) => item.row !== row || item.col !== col,
    );
    render();
    return;
  }

  state.powerSelection.push({ row, col });
  if (state.powerSelection.length < required) {
    state.message = `${required - state.powerSelection.length} more square needed.`;
    render();
    return;
  }

  pushUndoSnapshot();
  spendUltimate(ultimateId);
  state.statuses.blockedSquares.push(
    ...state.powerSelection.map((square) => ({
      ...square,
      owner: "azure",
      kind,
      remainingEnemyTurns: 1,
    })),
  );
  state.abilityLog.push({
    name: getSelectedUltimate().name,
    text: `${getSelectedUltimate().name} blocked ${state.powerSelection.map(squareName).join(", ")}.`,
  });
  if (completeCampaignObjective({
    type: "ultimate_board",
    id: ultimateId,
  })) {
    render();
    return;
  }
  endPowerTurn(`${getSelectedUltimate().name} reshaped the board.`);
}

function handleFortify(row, col) {
  const piece = state.board[row][col];
  if (!piece || piece.player !== "azure") {
    state.message = "Choose an Azure piece to fortify.";
    render();
    return;
  }

  pushUndoSnapshot();
  spendUltimate("fortify");
  addGuardedPiece(piece.id, { row, col }, "azure", 2, "Fortify");
  endPowerTurn(`${squareName({ row, col })} is fortified.`);
}

function handleCrownSurge(row, col) {
  const piece = state.board[row][col];
  if (!piece || piece.player !== "azure" || piece.king || row < 2 || row > 5) {
    state.message = "Choose a normal Azure piece in the middle rows.";
    render();
    return;
  }

  pushUndoSnapshot();
  spendUltimate("crown_surge");
  state.board[row][col] = { ...piece, king: true };
  gainMomentum(1, "Royal breakthrough");
  endPowerTurn(`${squareName({ row, col })} became a king.`);
}

function handleSunLance(row, col) {
  const piece = state.board[row][col];
  if (!piece || piece.player !== "azure" || piece.king) {
    state.message = "Choose a normal Azure piece.";
    render();
    return;
  }

  const moves = getBackwardCapturesForPiece(state.board, row, col, piece);
  if (moves.length === 0) {
    state.message = "That piece has no backward capture.";
    render();
    return;
  }

  pushUndoSnapshot();
  spendUltimate("sun_lance");
  state.statuses.sunLancePieceId = piece.id;
  state.abilityMode = null;
  state.powerSelection = [];
  state.selected = { row, col };
  state.legalMoves = moves.map((move) => ({ ...move, powerId: "sun_lance" }));
  state.message = "Sun Lance opened a backward capture.";
  render();
}

function endPowerTurn(message) {
  state.turn = "amber";
  state.selected = null;
  state.legalMoves = [];
  state.forcedFrom = null;
  resetPowerState({ keepMessage: true });
  state.message = message;
  render();
}

function getPowerTargets() {
  if (!state.abilityMode) {
    return state.powerSelection || [];
  }

  if (["dash", "phase_shift"].includes(state.abilityMode)) {
    if (state.selected) {
      return state.legalMoves.map((move) => move.to);
    }

    return getPlayerPieces("azure")
      .filter(({ piece }) => !piece.king)
      .map(({ row, col }) => ({ row, col }));
  }

  if (["sandstorm_corridor", "barricade", "collapse"].includes(state.abilityMode)) {
    return [
      ...getAllEmptyDarkSquares(),
      ...state.powerSelection,
    ];
  }

  if (state.abilityMode === "fortify") {
    return getPlayerPieces("azure").map(({ row, col }) => ({ row, col }));
  }

  if (state.abilityMode === "crown_surge") {
    return getPlayerPieces("azure")
      .filter(({ piece, row }) => !piece.king && row >= 2 && row <= 5)
      .map(({ row, col }) => ({ row, col }));
  }

  if (state.abilityMode === "sun_lance") {
    return getPlayerPieces("azure")
      .filter(({ piece, row, col }) =>
        !piece.king && getBackwardCapturesForPiece(state.board, row, col, piece).length > 0,
      )
      .map(({ row, col }) => ({ row, col }));
  }

  return [];
}

function renderBoard() {
  boardEl.innerHTML = "";
  const visibleMoves = state.selected ? state.legalMoves : [];
  const powerTargets = getPowerTargets();

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const square = document.createElement("button");
      const piece = state.board[row][col];
      const isDark = isDarkSquare(row, col);
      const isSelected = isSameSquare(state.selected, { row, col });
      const move = visibleMoves.find((item) => item.to.row === row && item.to.col === col);
      const powerTarget = powerTargets.some((item) => item.row === row && item.col === col);
      const isBlocked = isBlockedSquareForDisplay(row, col);
      const isGuarded = isGuardedSquare(row, col);
      const isPuzzleSource =
        state.mode === "puzzle" &&
        row === DAILY_PUZZLE.highlight.row &&
        col === DAILY_PUZZLE.highlight.col &&
        !state.puzzle.solved;

      square.type = "button";
      square.className = [
        "square",
        isDark ? "dark" : "light",
        isSelected ? "selected" : "",
        move && move.captured ? "capture-target" : "",
        move && !move.captured ? "move-target" : "",
        powerTarget ? "power-target" : "",
        isBlocked ? "blocked-square" : "",
        isGuarded ? "guarded-square" : "",
        isPuzzleSource ? "puzzle-source" : "",
      ]
        .filter(Boolean)
        .join(" ");
      square.dataset.file = FILES[col];
      square.dataset.rank = String(BOARD_SIZE - row);
      square.setAttribute("role", "gridcell");
      square.setAttribute("aria-label", getSquareLabel(row, col, piece, move));
      square.addEventListener("click", () => handleSquareClick(row, col));

      if (piece) {
        const token = document.createElement("span");
        token.className = ["piece", piece.player, piece.king ? "king" : ""]
          .filter(Boolean)
          .join(" ");
        square.appendChild(token);
      }

      boardEl.appendChild(square);
    }
  }
}

function renderStatus() {
  const current = PLAYERS[state.turn];
  const moveNumber = Math.floor(state.moveEvents.length / 2) + 1;
  const activeClock = state.mode === "puzzle"
    ? "Daily"
    : state.timerMode === "0"
      ? "--:--"
      : formatClock(state.clocks[state.turn]);

  turnNameEl.textContent = state.winner ? PLAYERS[state.winner].name : current.name;
  moveCountEl.textContent = String(Math.max(moveNumber, 1));
  timerDisplayEl.textContent = activeClock;
  momentumDisplayEl.textContent = `${state.momentum}`;
  gameMessageEl.textContent = state.aiThinking
    ? `${AI_LABELS[state.aiLevel]} AI is thinking.`
    : state.message;
  coachNoteEl.textContent = state.coach;
  profileBadgeEl.textContent = profile.city;
  modeBadgeEl.textContent = MODE_LABELS[state.mode];

  ruleStatusEl.textContent = getRuleStatusText();

  turnDotEl.classList.toggle("azure", state.turn === "azure");
  turnDotEl.classList.toggle("amber", state.turn === "amber");

  if (state.winner) {
    winnerBadgeEl.hidden = false;
    winnerBadgeEl.textContent = `${PLAYERS[state.winner].name} wins`;
  } else {
    winnerBadgeEl.hidden = true;
    winnerBadgeEl.textContent = "";
  }

  undoButton.disabled = state.undoStack.length === 0 || state.aiThinking;
  ultimateButton.disabled = !canUseUltimate();
  ultimateButton.textContent = state.abilityMode ? "Cancel" : getSelectedUltimate().name;
  aiLevelSelect.disabled = state.mode !== "ai";
  timerSelect.disabled = state.mode === "puzzle" || state.mode === "campaign";
}

function renderInsights() {
  const counts = countPieces(state.board);
  azurePiecesEl.textContent = String(counts.azure);
  amberPiecesEl.textContent = String(counts.amber);
  azureMeterEl.style.width = `${Math.min(100, (counts.azure / 12) * 100)}%`;
  amberMeterEl.style.width = `${Math.min(100, (counts.amber / 12) * 100)}%`;

  renderMoveHistory();
  renderReview();
  renderRecap();
  renderPuzzle();
  renderCampaign();
  renderLeaderboard();
}

function renderMoveHistory() {
  historyCountEl.textContent = String(state.moveLog.length);
  moveHistoryEl.innerHTML = "";

  const entries = state.moveLog.slice(-40);
  entries.forEach((entry, index) => {
    const item = document.createElement("li");
    const moveNumber = state.moveLog.length > 40 ? state.moveLog.length - 39 + index : index + 1;
    const number = document.createElement("strong");
    number.textContent = `${moveNumber}. `;
    item.appendChild(number);
    item.append(entry);
    moveHistoryEl.appendChild(item);
  });
}

function renderReview() {
  reviewCountEl.textContent = String(state.reviewEvents.length);
  reviewListEl.innerHTML = "";

  const visible = state.reviewEvents.slice(-5).reverse();
  if (visible.length === 0) {
    const item = document.createElement("li");
    item.textContent = "Coach review will appear as key moments happen.";
    reviewListEl.appendChild(item);
    return;
  }

  visible.forEach((event) => {
    const item = document.createElement("li");
    const label = document.createElement("strong");
    label.textContent = `${event.label}: `;
    item.appendChild(label);
    item.append(event.text);
    reviewListEl.appendChild(item);
  });
}

function renderRecap() {
  if (!state.recap) {
    recapBadgeEl.textContent = "Ready";
    recapTextEl.textContent = "Finish a game to generate a shareable recap.";
    shareButton.disabled = true;
    return;
  }

  recapBadgeEl.textContent = state.recap.result;
  recapTextEl.textContent = state.recap.summary;
  shareButton.disabled = false;
}

function renderPuzzle() {
  streakCountEl.textContent = `${profile.streak || 0} streak`;

  if (state.mode !== "puzzle") {
    puzzleStatusEl.textContent = "Switch to Daily mode for a capture challenge.";
    return;
  }

  if (state.puzzle.solved) {
    puzzleStatusEl.textContent = "Solved. Your streak is saved locally.";
    return;
  }

  puzzleStatusEl.textContent = `${DAILY_PUZZLE.title}: ${DAILY_PUZZLE.objective}`;
}

function renderCampaign() {
  const completedCount = Object.values(campaignProgress.completed).filter(Boolean).length;
  const level = getCampaignLevel(state.campaign?.levelId);
  campaignProgressBadgeEl.textContent = `${completedCount}/${NOMAD_CAMPAIGN.length}`;
  campaignStatusEl.textContent = state.mode === "campaign"
    ? `${level.name}: ${level.hook}`
    : "Switch to Trail mode to begin The Comeback Trail.";
  campaignObjectiveEl.textContent = state.mode === "campaign"
    ? `Objective: ${level.objective}`
    : "Four comeback boards teach Open Roads, Dash, Dust Veil, and Sandstorm.";
  campaignLevelButtonsEl.innerHTML = "";

  NOMAD_CAMPAIGN.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      state.mode === "campaign" && item.id === level.id ? "active" : "",
      campaignProgress.completed[item.id] ? "completed" : "",
    ]
      .filter(Boolean)
      .join(" ");
    button.textContent = `${item.number}${campaignProgress.completed[item.id] ? " OK" : ""}`;
    button.title = item.name;
    button.addEventListener("click", () => {
      startNewMatch({
        mode: "campaign",
        campaignLevelId: item.id,
      });
    });
    campaignLevelButtonsEl.appendChild(button);
  });
}

function renderLeaderboard() {
  leaderboardScopeEl.textContent = profile.city;
  leaderboardListEl.innerHTML = "";

  const rows = getLeaderboardRows(profile.city).slice(0, 6);
  rows.forEach((entry, index) => {
    const item = document.createElement("li");
    const name = document.createElement("span");
    const score = document.createElement("span");
    name.innerHTML = `<strong>${index + 1}. ${escapeHtml(entry.name)}</strong> ${escapeHtml(entry.city)}`;
    score.className = "leaderboard-score";
    score.textContent = String(getLeaderboardScore(entry));
    item.append(name, score);
    leaderboardListEl.appendChild(item);
  });
}

function handleSquareClick(row, col) {
  if (state.abilityMode) {
    handlePowerClick(row, col);
    return;
  }

  if (state.aiThinking || isAiTurn()) {
    state.message = `${AI_LABELS[state.aiLevel]} AI is thinking.`;
    render();
    return;
  }

  if (state.winner) {
    state.message = `${PLAYERS[state.winner].name} already won. Start a new match.`;
    render();
    return;
  }

  const chosenMove = state.legalMoves.find(
    (move) => move.to.row === row && move.to.col === col,
  );

  if (chosenMove) {
    applyMove(chosenMove, { actor: "human" });
    return;
  }

  const piece = state.board[row][col];
  if (!piece || piece.player !== state.turn) {
    state.selected = null;
    state.legalMoves = [];
    state.message = `${PLAYERS[state.turn].name} to move.`;
    render();
    return;
  }

  selectPiece(row, col);
}

function selectPiece(row, col) {
  if (state.forcedFrom && !isSameSquare(state.forcedFrom, { row, col })) {
    state.message = "Finish the capture chain with the selected piece.";
    render();
    return;
  }

  const activeMoves = getActiveLegalMoves();
  const moves = activeMoves.filter(
    (move) => move.from.row === row && move.from.col === col,
  );

  state.selected = { row, col };
  state.legalMoves = moves;

  if (moves.length === 0) {
    const hasCapture = activeMoves.some((move) => move.captured);
    state.message = hasCapture
      ? "A capture is available with another piece."
      : "That piece has no legal move.";
  } else {
    const captureCount = moves.filter((move) => move.captured).length;
    state.message = captureCount
      ? `${PLAYERS[state.turn].name} has ${captureCount} capture option${captureCount === 1 ? "" : "s"}.`
      : `${PLAYERS[state.turn].name} selected ${squareName({ row, col })}.`;
  }

  render();
}

function applyMove(move, { actor = "human" } = {}) {
  if (state.winner) {
    return;
  }

  const movingPlayer = state.turn;
  const beforeBoard = cloneBoard(state.board);
  const beforeForced = state.forcedFrom ? { ...state.forcedFrom } : null;
  pushUndoSnapshot();

  const movingPiece = state.board[move.from.row][move.from.col];
  const capturedPiece = move.captured
    ? state.board[move.captured.row][move.captured.col]
    : null;
  const promoted = !movingPiece.king && move.to.row === PLAYERS[movingPiece.player].kingRow;
  const nextPiece = {
    ...movingPiece,
    king: movingPiece.king || promoted,
  };

  state.board[move.from.row][move.from.col] = null;
  if (move.captured) {
    state.board[move.captured.row][move.captured.col] = null;
  }
  state.board[move.to.row][move.to.col] = nextPiece;
  if (move.powerId) {
    spendUltimate(move.powerId);
  }

  const nextCaptures =
    move.captured && !promoted
      ? getCapturesForPiece(state.board, move.to.row, move.to.col, nextPiece)
      : [];
  const chainContinues = nextCaptures.length > 0;
  const record = createMoveRecord(move, movingPiece, promoted, actor);
  state.moveEvents.push(record);
  state.moveLog.push(record.notation);
  applyLoadoutAfterMove({
    move,
    movingPiece,
    capturedPiece,
    promoted,
    chainContinues,
    movingPlayer,
  });

  if (state.mode === "campaign" && state.campaign?.solved) {
    render();
    return;
  }

  const reviewEvent = buildReviewEvent({
    move,
    beforeBoard,
    beforeForced,
    afterBoard: state.board,
    player: movingPlayer,
    actor,
    promoted,
    chainContinues,
  });
  if (reviewEvent) {
    state.reviewEvents.push(reviewEvent);
  }

  state.coach = buildCoachNote(move, beforeBoard, state.board, chainContinues, promoted, movingPlayer);

  if (state.mode === "puzzle" && move.captured) {
    state.puzzle.captures += 1;
  }

  if (state.mode === "puzzle" && state.puzzle.captures >= DAILY_PUZZLE.goalCaptures && !chainContinues) {
    finishPuzzle();
    render();
    return;
  }

  if (completeCampaignObjective({
    type: move.powerId ? "ultimate_move" : move.passiveId ? "passive_move" : "move",
    id: move.powerId || move.passiveId || "",
    move,
  })) {
    render();
    return;
  }

  if (chainContinues) {
    state.forcedFrom = { ...move.to };
    state.selected = { ...move.to };
    state.legalMoves = nextCaptures;
    state.message = `${PLAYERS[state.turn].name} must continue the capture.`;
    render();
    return;
  }

  const nextPlayer = PLAYERS[state.turn].rival;
  state.turn = nextPlayer;
  state.selected = null;
  state.legalMoves = [];
  state.forcedFrom = null;
  expireStatusesAfterTurn(movingPlayer);

  const winner = getWinner(state.board, nextPlayer, movingPlayer);
  if (winner) {
    finishGame(winner, "by controlling the board");
  } else {
    const nextMoves = getActiveLegalMoves();
    const captureCount = nextMoves.filter((item) => item.captured).length;
    state.message = captureCount
      ? `${PLAYERS[nextPlayer].name} has a mandatory capture.`
      : `${PLAYERS[nextPlayer].name} to move.`;
  }

  render();
}

function applyLoadoutAfterMove({
  move,
  movingPiece,
  capturedPiece,
  promoted,
  chainContinues,
  movingPlayer,
}) {
  if (capturedPiece?.player === "azure") {
    state.statuses.counters.azureLosses += 1;
    if (state.statuses.counters.azureLosses % 2 === 0) {
      gainMomentum(1, "Comeback pressure");
    }
    if (hasPassive("vengeance_ledger")) {
      state.statuses.vengeanceArmed = true;
    }
  }

  if (movingPlayer === "azure" && capturedPiece) {
    state.statuses.counters.azureCaptures += 1;
    if (state.statuses.counters.azureCaptures % 2 === 0) {
      gainMomentum(1, "Raid pressure");
    }
    if (state.statuses.vengeanceArmed) {
      gainMomentum(1, "Vengeance Ledger");
      state.statuses.vengeanceArmed = false;
    }
    if (state.statuses.echoMark?.pieceId === capturedPiece.id) {
      gainMomentum(1, "Echo Mark");
      state.statuses.echoMark = null;
    }
  }

  if (promoted) {
    if (movingPlayer === "azure") {
      gainMomentum(1, "Royal breakthrough");
    }
    if (movingPlayer === "amber" && hasPassive("crown_tax") && !state.statuses.passiveTriggers.crown_tax) {
      gainMomentum(2, "Crown Tax");
      state.statuses.passiveTriggers.crown_tax = true;
    }
  }

  if (move.captured && chainContinues && movingPlayer === "azure") {
    gainMomentum(1, "Chain attack");
  }

  if (movingPlayer === "azure" && !move.captured && hasPassive("dust_veil")) {
    addGuardedPiece(movingPiece.id, move.to, "azure", 1, "Dust Veil");
    completeCampaignObjective({
      type: "passive_trigger",
      id: "dust_veil",
      move,
    });
  }

  if (
    movingPlayer === "azure" &&
    hasPassive("shield_wall") &&
    isCenterSquare(move.to) &&
    !state.statuses.passiveTriggers.shield_wall
  ) {
    addGuardedPiece(movingPiece.id, move.to, "azure", 1, "Shield Wall");
    state.statuses.passiveTriggers.shield_wall = true;
  }

  if (
    movingPlayer === "azure" &&
    hasPassive("royal_pressure") &&
    !movingPiece.king &&
    move.to.row <= 2 &&
    !state.statuses.passiveTriggers.royal_pressure
  ) {
    gainMomentum(1, "Royal Pressure");
    state.statuses.passiveTriggers.royal_pressure = true;
  }

  if (movingPlayer === "amber" && !move.captured && hasPassive("echo_mark") && !state.statuses.echoMark) {
    state.statuses.echoMark = {
      pieceId: movingPiece.id,
      square: { ...move.to },
    };
  }

  if (movingPlayer === "amber" && hasPassive("pressure_field") && !state.statuses.passiveTriggers.pressure_field) {
    const nextMoves = getLegalMovesForPlayer(state.board, "amber");
    if (nextMoves.some((item) => item.captured)) {
      gainMomentum(1, "Pressure Field");
      state.statuses.passiveTriggers.pressure_field = true;
    }
  }

  if (movingPlayer === "azure" && state.statuses.sunLancePieceId === movingPiece.id) {
    state.statuses.sunLancePieceId = null;
  }
}

function expireStatusesAfterTurn(movingPlayer) {
  state.statuses.guarded = state.statuses.guarded.filter((guard) => {
    if (guard.owner === movingPlayer) {
      return true;
    }
    return guard.durationPly > 1;
  }).map((guard) => (
    guard.owner === movingPlayer ? guard : { ...guard, durationPly: guard.durationPly - 1 }
  ));

  state.statuses.blockedSquares = state.statuses.blockedSquares.filter((block) => {
    if (block.owner === movingPlayer) {
      return true;
    }
    return block.remainingEnemyTurns > 1;
  }).map((block) => (
    block.owner === movingPlayer
      ? block
      : { ...block, remainingEnemyTurns: block.remainingEnemyTurns - 1 }
  ));
}

function finishGame(winner, reason) {
  state.winner = winner;
  state.winnerReason = reason;
  state.selected = null;
  state.legalMoves = [];
  state.forcedFrom = null;
  state.aiThinking = false;
  state.message = `${PLAYERS[winner].name} wins ${reason}.`;
  state.coach = buildVictoryCoachNote(winner);
  state.recap = buildRecap(winner, reason);
  recordGameResult(winner);
}

function finishPuzzle() {
  state.winner = "azure";
  state.winnerReason = "by solving the daily tactic";
  state.selected = null;
  state.legalMoves = [];
  state.forcedFrom = null;
  state.puzzle.solved = true;
  state.resultRecorded = true;
  state.message = "Daily tactic solved.";
  state.coach = "Nice sequence. The key was choosing a capture that created the second jump.";
  state.reviewEvents.push({
    label: "Retry Moment",
    text: "This puzzle becomes a reusable training moment after every missed capture in a real game.",
  });
  updatePuzzleStreak();
  state.recap = {
    result: "Solved",
    summary: `${profile.name} solved today's ${DAILY_PUZZLE.title} in Aether Tactics.`,
  };
}

function completeCampaignObjective(event) {
  if (state.mode !== "campaign" || state.campaign?.solved) {
    return false;
  }

  const level = getCampaignLevel(state.campaign.levelId);
  if (level.completion.type !== event.type || level.completion.id !== event.id) {
    return false;
  }

  finishCampaignLevel(level);
  return true;
}

function finishCampaignLevel(level) {
  state.winner = "azure";
  state.winnerReason = "by mastering the Nomad lesson";
  state.selected = null;
  state.legalMoves = [];
  state.forcedFrom = null;
  state.abilityMode = null;
  state.powerSelection = [];
  state.aiThinking = false;
  state.campaign.solved = true;
  state.message = `${level.name} complete.`;
  state.coach = `Nomad lesson learned: ${level.objective}`;
  state.reviewEvents.push({
    label: "Campaign",
    text: `${level.name} proves why ${getSelectedPassive().name} plus ${getSelectedUltimate().name} matters.`,
  });
  state.recap = {
    result: "Trail",
    summary: `${profile.name} cleared Nomads ${level.number}: ${level.name}. ${level.objective}`,
  };

  campaignProgress.completed[level.id] = true;
  const nextLevel = NOMAD_CAMPAIGN.find((item) => !campaignProgress.completed[item.id]);
  campaignProgress.currentLevelId = nextLevel?.id || level.id;
  saveCampaignProgress();
}

function pushUndoSnapshot() {
  const snapshot = {
    board: cloneBoard(state.board),
    turn: state.turn,
    selected: state.selected ? { ...state.selected } : null,
    legalMoves: state.legalMoves.map(cloneMove),
    forcedFrom: state.forcedFrom ? { ...state.forcedFrom } : null,
    winner: state.winner,
    winnerReason: state.winnerReason,
    message: state.message,
    coach: state.coach,
    moveLog: [...state.moveLog],
    moveEvents: state.moveEvents.map((event) => ({ ...event })),
    reviewEvents: state.reviewEvents.map((event) => ({ ...event })),
    clocks: { ...state.clocks },
    loadout: { ...state.loadout },
    momentum: state.momentum,
    ultimateUsed: state.ultimateUsed,
    abilityMode: state.abilityMode,
    powerSelection: state.powerSelection.map((item) => ({ ...item })),
    statuses: cloneStatuses(state.statuses),
    abilityLog: state.abilityLog.map((event) => ({ ...event })),
    resultRecorded: state.resultRecorded,
    recap: state.recap ? { ...state.recap } : null,
    puzzle: { ...state.puzzle },
    campaign: { ...state.campaign },
  };

  state.undoStack.push(snapshot);
  if (state.undoStack.length > 80) {
    state.undoStack.shift();
  }
}

function tickClock() {
  if (state.winner || state.mode === "puzzle" || state.timerMode === "0") {
    return;
  }

  const currentSeconds = state.clocks[state.turn];
  if (currentSeconds <= 0) {
    return;
  }

  state.clocks[state.turn] = currentSeconds - 1;
  if (state.clocks[state.turn] <= 0) {
    finishGame(PLAYERS[state.turn].rival, "on time");
  }
  render();
}

function queueAiIfNeeded() {
  if (!isAiTurn() || state.aiThinking || state.winner) {
    return;
  }

  state.aiThinking = true;
  renderStatus();
  window.clearTimeout(aiTimer);
  aiTimer = window.setTimeout(() => {
    state.aiThinking = false;
    if (!isAiTurn() || state.winner) {
      render();
      return;
    }

    const move = chooseAiMove();
    if (!move) {
      finishGame("azure", "because the AI has no legal moves");
      render();
      return;
    }

    applyMove(move, { actor: "ai" });
  }, state.aiLevel === "coach" ? 620 : 420);
}

function chooseAiMove() {
  const moves = getActiveLegalMoves();
  if (moves.length === 0) {
    return null;
  }

  if (state.aiLevel === "beginner") {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  if (state.aiLevel === "smart") {
    return chooseScoredMove(state.board, state.turn, state.forcedFrom, 2);
  }

  return chooseScoredMove(state.board, state.turn, state.forcedFrom, 4);
}

function chooseScoredMove(board, player, forcedFrom, depth) {
  const moves = getAvailableMoves(board, player, forcedFrom);
  let bestMove = moves[0];
  let bestScore = -Infinity;

  moves.forEach((move) => {
    const simulation = simulateMove(board, move, player);
    const score = minimax(
      simulation.board,
      simulation.nextTurn,
      simulation.forcedFrom,
      simulation.nextTurn === player ? depth : depth - 1,
      -Infinity,
      Infinity,
      player,
    );
    const tieBreaker = Math.random() * 0.02;
    if (score + tieBreaker > bestScore) {
      bestScore = score + tieBreaker;
      bestMove = move;
    }
  });

  return bestMove;
}

function minimax(board, player, forcedFrom, depth, alpha, beta, perspective) {
  const moves = getAvailableMoves(board, player, forcedFrom);
  if (depth <= 0 || moves.length === 0) {
    if (moves.length === 0) {
      return player === perspective ? -999 : 999;
    }
    return evaluateBoard(board, perspective);
  }

  const maximizing = player === perspective;
  let best = maximizing ? -Infinity : Infinity;

  for (const move of moves) {
    const simulation = simulateMove(board, move, player);
    const nextDepth = simulation.nextTurn === player ? depth : depth - 1;
    const score = minimax(
      simulation.board,
      simulation.nextTurn,
      simulation.forcedFrom,
      nextDepth,
      alpha,
      beta,
      perspective,
    );

    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, score);
    }

    if (beta <= alpha) {
      break;
    }
  }

  return best;
}

function simulateMove(board, move, player) {
  const nextBoard = cloneBoard(board);
  const movingPiece = nextBoard[move.from.row][move.from.col];
  const promoted = !movingPiece.king && move.to.row === PLAYERS[movingPiece.player].kingRow;
  const nextPiece = {
    ...movingPiece,
    king: movingPiece.king || promoted,
  };

  nextBoard[move.from.row][move.from.col] = null;
  if (move.captured) {
    nextBoard[move.captured.row][move.captured.col] = null;
  }
  nextBoard[move.to.row][move.to.col] = nextPiece;

  const chainCaptures =
    move.captured && !promoted
      ? getCapturesForPiece(nextBoard, move.to.row, move.to.col, nextPiece)
      : [];
  const forcedFrom = chainCaptures.length > 0 ? { ...move.to } : null;

  return {
    board: nextBoard,
    nextTurn: forcedFrom ? player : PLAYERS[player].rival,
    forcedFrom,
    promoted,
  };
}

function getWinner(board, nextPlayer, movingPlayer) {
  const counts = countPieces(board);
  if (counts[nextPlayer] === 0) {
    return movingPlayer;
  }

  const nextMoves = getLegalMovesForPlayer(board, nextPlayer);
  if (nextMoves.length === 0) {
    return movingPlayer;
  }

  return null;
}

function getActiveLegalMoves() {
  if (state.winner) {
    return [];
  }

  const moves = getAvailableMoves(state.board, state.turn, state.forcedFrom);
  if (state.forcedFrom) {
    return moves;
  }

  const filteredMoves = filterGuardedCapturesForActiveTurn(moves);
  if (filteredMoves.some((move) => move.captured)) {
    return filteredMoves;
  }

  if (state.turn === "azure" && hasPassive("open_roads")) {
    return [...filteredMoves, ...getOpenRoadsMoves(state.board)];
  }

  if (state.turn === "azure" && state.statuses.sunLancePieceId) {
    const lanceMoves = getBackwardCapturesForPieceId(state.statuses.sunLancePieceId);
    return lanceMoves.length > 0 ? lanceMoves : filteredMoves;
  }

  return filteredMoves;
}

function getAvailableMoves(board, player, forcedFrom = null) {
  if (forcedFrom) {
    const piece = board[forcedFrom.row]?.[forcedFrom.col];
    return piece ? getCapturesForPiece(board, forcedFrom.row, forcedFrom.col, piece) : [];
  }

  return getLegalMovesForPlayer(board, player);
}

function getLegalMovesForPlayer(board, player) {
  const captures = [];
  const quietMoves = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (!piece || piece.player !== player) {
        continue;
      }

      captures.push(...getCapturesForPiece(board, row, col, piece));
      quietMoves.push(...getQuietMovesForPiece(board, row, col, piece));
    }
  }

  return captures.length > 0 ? captures : quietMoves;
}

function getQuietMovesForPiece(board, row, col, piece) {
  return getMoveDirections(piece)
    .map(([rowDelta, colDelta]) => ({
      from: { row, col },
      to: { row: row + rowDelta, col: col + colDelta },
      captured: null,
    }))
    .filter((move) => isInsideBoard(move.to.row, move.to.col))
    .filter((move) => !board[move.to.row][move.to.col])
    .filter((move) => !isQuietLandingBlocked(board, move));
}

function getCapturesForPiece(board, row, col, piece) {
  return getMoveDirections(piece)
    .map(([rowDelta, colDelta]) => {
      const enemy = { row: row + rowDelta, col: col + colDelta };
      const landing = { row: row + rowDelta * 2, col: col + colDelta * 2 };

      return {
        from: { row, col },
        to: landing,
        captured: enemy,
      };
    })
    .filter((move) => {
      if (!isInsideBoard(move.to.row, move.to.col)) {
        return false;
      }

      const capturedPiece = board[move.captured.row]?.[move.captured.col];
      return (
        capturedPiece &&
        capturedPiece.player !== piece.player &&
        !board[move.to.row][move.to.col] &&
        !isCaptureLandingBlocked(board, move)
      );
    });
}

function getMoveDirections(piece) {
  if (piece.king) {
    return [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];
  }

  return [
    [PLAYERS[piece.player].direction, -1],
    [PLAYERS[piece.player].direction, 1],
  ];
}

function getFactionById(factionId) {
  return FACTION_LIBRARY.find((faction) => faction.id === factionId) || FACTION_LIBRARY[0];
}

function getCampaignLevel(levelId) {
  return NOMAD_CAMPAIGN.find((level) => level.id === levelId) || NOMAD_CAMPAIGN[0];
}

function getDefaultCampaignLevelId() {
  return campaignProgress?.currentLevelId || NOMAD_CAMPAIGN[0].id;
}

function getSelectedFaction() {
  return getFactionById(state.loadout?.factionId || DEFAULT_LOADOUT.factionId);
}

function getSelectedPassive() {
  const faction = getSelectedFaction();
  return faction.passives.find((ability) => ability.id === state.loadout?.passiveId) || faction.passives[0];
}

function getSelectedUltimate() {
  const faction = getSelectedFaction();
  return faction.ultimates.find((ability) => ability.id === state.loadout?.ultimateId) || faction.ultimates[0];
}

function normalizeLoadout(loadout) {
  const faction = getFactionById(loadout?.factionId || DEFAULT_LOADOUT.factionId);
  const passive = faction.passives.find((ability) => ability.id === loadout?.passiveId) || faction.passives[0];
  const ultimate = faction.ultimates.find((ability) => ability.id === loadout?.ultimateId) || faction.ultimates[0];
  return {
    factionId: faction.id,
    passiveId: passive.id,
    ultimateId: ultimate.id,
  };
}

function hasPassive(passiveId) {
  return state.loadout?.passiveId === passiveId;
}

function canUseUltimate() {
  if (state.winner || state.turn !== "azure" || isAiTurn()) {
    return false;
  }

  const ultimate = getSelectedUltimate();
  return state.abilityMode || (!state.ultimateUsed && state.momentum >= ultimate.cost);
}

function spendUltimate(powerId) {
  if (!powerId || state.ultimateUsed) {
    return;
  }

  const ultimate = getSelectedUltimate();
  state.momentum = Math.max(0, state.momentum - ultimate.cost);
  state.ultimateUsed = true;
  state.abilityMode = null;
  state.powerSelection = [];
  state.abilityLog.push({
    name: ultimate.name,
    text: `${ultimate.name} used.`,
  });
}

function gainMomentum(amount, label) {
  state.momentum = Math.min(9, state.momentum + amount);
  state.reviewEvents.push({
    label: "Momentum",
    text: `${label}: +${amount} Momentum.`,
  });
}

function resetPowerState() {
  state.abilityMode = null;
  state.powerSelection = [];
  state.selected = null;
  state.legalMoves = [];
}

function getPlayerPieces(player) {
  const pieces = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = state.board[row][col];
      if (piece?.player === player) {
        pieces.push({ row, col, piece });
      }
    }
  }
  return pieces;
}

function getAllEmptyDarkSquares() {
  const squares = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (isValidBlockerTarget(row, col)) {
        squares.push({ row, col });
      }
    }
  }
  return squares;
}

function isValidBlockerTarget(row, col) {
  return isInsideBoard(row, col) && isDarkSquare(row, col) && !state.board[row][col];
}

function getDashMoves(row, col, piece) {
  if (!piece || piece.king || getLegalMovesForPlayer(state.board, "azure").some((move) => move.captured)) {
    return [];
  }

  return [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]
    .map(([rowDelta, colDelta]) => {
      const middle = { row: row + rowDelta, col: col + colDelta };
      const to = { row: row + rowDelta * 2, col: col + colDelta * 2 };
      return {
        from: { row, col },
        to,
        captured: null,
        powerId: "dash",
        middle,
      };
    })
    .filter((move) =>
      isInsideBoard(move.to.row, move.to.col) &&
      !state.board[move.middle.row]?.[move.middle.col] &&
      !state.board[move.to.row][move.to.col],
    );
}

function getPhaseShiftMoves(row, col, piece) {
  if (!piece || piece.king || getLegalMovesForPlayer(state.board, "azure").some((move) => move.captured)) {
    return [];
  }

  return [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]
    .map(([rowDelta, colDelta]) => ({
      from: { row, col },
      to: { row: row + rowDelta, col: col + colDelta },
      captured: null,
      powerId: "phase_shift",
    }))
    .filter((move) =>
      isInsideBoard(move.to.row, move.to.col) &&
      isDarkSquare(move.to.row, move.to.col) &&
      !state.board[move.to.row][move.to.col],
    );
}

function getOpenRoadsMoves(board) {
  if (board !== state.board) {
    return [];
  }

  return getPlayerPieces("azure")
    .filter(({ piece }) => !piece.king)
    .flatMap(({ row, col }) => [
      {
        from: { row, col },
        to: { row: row + 1, col: col - 1 },
        captured: null,
        passiveId: "open_roads",
      },
      {
        from: { row, col },
        to: { row: row + 1, col: col + 1 },
        captured: null,
        passiveId: "open_roads",
      },
    ])
    .filter((move) =>
      isInsideBoard(move.to.row, move.to.col) &&
      isDarkSquare(move.to.row, move.to.col) &&
      !board[move.to.row][move.to.col],
    );
}

function getBackwardCapturesForPieceId(pieceId) {
  const match = getPlayerPieces("azure").find(({ piece }) => piece.id === pieceId);
  return match ? getBackwardCapturesForPiece(state.board, match.row, match.col, match.piece) : [];
}

function getBackwardCapturesForPiece(board, row, col, piece) {
  return [
    [1, -1],
    [1, 1],
  ]
    .map(([rowDelta, colDelta]) => {
      const enemy = { row: row + rowDelta, col: col + colDelta };
      const landing = { row: row + rowDelta * 2, col: col + colDelta * 2 };
      return {
        from: { row, col },
        to: landing,
        captured: enemy,
        powerId: "sun_lance",
      };
    })
    .filter((move) => {
      if (!isInsideBoard(move.to.row, move.to.col)) {
        return false;
      }
      const capturedPiece = board[move.captured.row]?.[move.captured.col];
      return capturedPiece && capturedPiece.player !== piece.player && !board[move.to.row][move.to.col];
    });
}

function addGuardedPiece(pieceId, square, owner, durationPly, source) {
  state.statuses.guarded = state.statuses.guarded.filter((guard) => guard.pieceId !== pieceId);
  state.statuses.guarded.push({
    pieceId,
    square: { ...square },
    owner,
    durationPly,
    source,
  });
}

function isGuardedSquare(row, col) {
  return state.statuses.guarded.some((guard) => guard.square.row === row && guard.square.col === col);
}

function isBlockedSquareForDisplay(row, col) {
  return state.statuses.blockedSquares.some((block) => block.row === row && block.col === col);
}

function isQuietLandingBlocked(board, move) {
  if (board !== state.board) {
    return false;
  }

  return state.statuses.blockedSquares.some(
    (block) =>
      block.row === move.to.row &&
      block.col === move.to.col &&
      (block.kind === "quiet" || block.kind === "all"),
  );
}

function isCaptureLandingBlocked(board, move) {
  if (board !== state.board) {
    return false;
  }

  return state.statuses.blockedSquares.some(
    (block) =>
      block.row === move.to.row &&
      block.col === move.to.col &&
      block.kind === "all",
  );
}

function filterGuardedCapturesForActiveTurn(moves) {
  if (state.turn !== "amber" || !moves.some((move) => move.captured)) {
    return moves;
  }

  const guardedIds = new Set(state.statuses.guarded.map((guard) => guard.pieceId));
  const absoluteGuardedIds = new Set(
    state.statuses.guarded
      .filter((guard) => guard.source === "Fortify")
      .map((guard) => guard.pieceId),
  );
  const alternateCaptures = moves.filter((move) => {
    const capturedPiece = state.board[move.captured?.row]?.[move.captured?.col];
    return move.captured && capturedPiece && !guardedIds.has(capturedPiece.id);
  });

  if (alternateCaptures.length === 0 && absoluteGuardedIds.size === 0) {
    return moves;
  }

  return moves.filter((move) => {
    if (!move.captured) {
      return false;
    }
    const capturedPiece = state.board[move.captured.row]?.[move.captured.col];
    if (!capturedPiece) {
      return false;
    }
    if (absoluteGuardedIds.has(capturedPiece.id)) {
      return false;
    }
    return alternateCaptures.length === 0 || !guardedIds.has(capturedPiece.id);
  });
}

function cloneStatuses(statuses) {
  return {
    guarded: statuses.guarded.map((guard) => ({
      ...guard,
      square: { ...guard.square },
    })),
    blockedSquares: statuses.blockedSquares.map((block) => ({ ...block })),
    passiveTriggers: { ...statuses.passiveTriggers },
    counters: { ...statuses.counters },
    vengeanceArmed: statuses.vengeanceArmed,
    echoMark: statuses.echoMark
      ? {
          ...statuses.echoMark,
          square: { ...statuses.echoMark.square },
        }
      : null,
    sunLancePieceId: statuses.sunLancePieceId,
  };
}

function buildReviewEvent({
  move,
  beforeBoard,
  beforeForced,
  afterBoard,
  player,
  actor,
  promoted,
  chainContinues,
}) {
  const legalBefore = getAvailableMoves(beforeBoard, player, beforeForced);
  const chosenScore = evaluateMoveOutcome(beforeBoard, move, player);
  const best = findBestMove(legalBefore, beforeBoard, player);
  const opponent = PLAYERS[player].rival;
  const opponentMoves = chainContinues ? [] : getLegalMovesForPlayer(afterBoard, opponent);
  const opponentCaptures = opponentMoves.filter((item) => item.captured).length;
  const moverName = actor === "ai" ? `${AI_LABELS[state.aiLevel]} AI` : PLAYERS[player].name;
  const notation = `${squareName(move.from)}${move.captured ? "x" : "-"}${squareName(move.to)}`;

  if (promoted) {
    return {
      label: "Brilliant",
      text: `${moverName} promoted on ${notation}. Kings change the value of the board.`,
    };
  }

  if (move.captured && chainContinues) {
    return {
      label: "Tactic",
      text: `${moverName} found a capture that keeps the chain alive.`,
    };
  }

  if (move.captured) {
    return {
      label: "Good",
      text: `${moverName} won material with ${notation}.`,
    };
  }

  if (opponentCaptures >= 2) {
    return {
      label: "Warning",
      text: `${notation} gives the opponent ${opponentCaptures} capture options.`,
    };
  }

  if (best && best.score - chosenScore > 1.25 && !isSameMove(best.move, move)) {
    return {
      label: "Review",
      text: `${notation} was playable, but ${squareName(best.move.from)}-${squareName(best.move.to)} kept more pressure.`,
    };
  }

  if (isCenterSquare(move.to)) {
    return {
      label: "Tempo",
      text: `${moverName} improved center control with ${notation}.`,
    };
  }

  return null;
}

function findBestMove(moves, board, player) {
  if (moves.length === 0) {
    return null;
  }

  return moves.reduce(
    (best, move) => {
      const score = evaluateMoveOutcome(board, move, player);
      return score > best.score ? { move, score } : best;
    },
    { move: moves[0], score: -Infinity },
  );
}

function evaluateMoveOutcome(board, move, player) {
  const simulation = simulateMove(board, move, player);
  const opponent = PLAYERS[player].rival;
  const opponentMoves = simulation.nextTurn === opponent
    ? getAvailableMoves(simulation.board, opponent, simulation.forcedFrom)
    : [];
  const capturePenalty = opponentMoves.filter((item) => item.captured).length * 0.55;
  const promotionBonus = simulation.promoted ? 1.4 : 0;
  const captureBonus = move.captured ? 0.7 : 0;

  return evaluateBoard(simulation.board, player) + promotionBonus + captureBonus - capturePenalty;
}

function evaluateBoard(board, perspective) {
  const opponent = PLAYERS[perspective].rival;
  let score = 0;

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (!piece) {
        continue;
      }

      const material = piece.king ? 2.25 : 1;
      const advancement = piece.king
        ? 0.15
        : piece.player === "azure"
          ? (7 - row) * 0.045
          : row * 0.045;
      const center = isCenterSquare({ row, col }) ? 0.16 : 0;
      const edgePenalty = col === 0 || col === 7 ? -0.08 : 0;
      const value = material + advancement + center + edgePenalty;
      score += piece.player === perspective ? value : -value;
    }
  }

  const myMoves = getLegalMovesForPlayer(board, perspective).length;
  const theirMoves = getLegalMovesForPlayer(board, opponent).length;
  score += (myMoves - theirMoves) * 0.03;

  return score;
}

function buildCoachNote(move, beforeBoard, afterBoard, chainContinues, promoted, player) {
  if (promoted) {
    return `${squareName(move.to)} became a king. Kings can move and capture in both diagonal directions.`;
  }

  if (chainContinues) {
    return "The capture chain continues. Multi-captures are often the fastest way to create a winning material lead.";
  }

  if (move.captured) {
    return "Clean capture. The coach review saves this as a key moment for the recap.";
  }

  const opponent = PLAYERS[player].rival;
  const opponentCaptures = getLegalMovesForPlayer(afterBoard, opponent).filter((item) => item.captured).length;
  if (opponentCaptures > 0) {
    return `Careful: that move gives ${PLAYERS[opponent].name} a capture threat.`;
  }

  if (isCenterSquare(move.to)) {
    return "Good centralization. Center pieces usually have more future move and capture options.";
  }

  return "Quiet move. Scan for loose pieces before the opponent's reply.";
}

function buildVictoryCoachNote(winner) {
  const topMoment = state.reviewEvents.at(-1)?.label || "Key Moment";
  return `${PLAYERS[winner].name} closed the match. ${topMoment} is ready in the post-game review.`;
}

function buildRecap(winner, reason) {
  const azureCaptures = state.moveEvents.filter((event) => event.player === "azure" && event.captured).length;
  const amberCaptures = state.moveEvents.filter((event) => event.player === "amber" && event.captured).length;
  const kings = state.moveEvents.filter((event) => event.promoted).length;
  const best = state.reviewEvents.find((event) =>
    ["Brilliant", "Tactic", "Good"].includes(event.label),
  );
  const risk = state.reviewEvents.find((event) =>
    ["Warning", "Review"].includes(event.label),
  );
  const result = winner === "azure" ? "Win" : "Loss";

  return {
    result,
    summary:
      `${PLAYERS[winner].name} wins ${reason}. ` +
      `Captures ${azureCaptures}-${amberCaptures}, kings ${kings}. ` +
      `${best ? `Best moment: ${best.text}` : "Best moment: steady board control."} ` +
      `${risk ? `Review point: ${risk.text}` : "No major warning was detected."}`,
  };
}

function buildShareText() {
  if (!state.recap) {
    return "";
  }

  return `${profile.name} from ${profile.city} played Aether Tactics. ${state.recap.summary}`;
}

function createMoveRecord(move, piece, promoted, actor) {
  const separator = move.captured ? "x" : "-";
  const crown = promoted ? " K" : "";
  const power = move.powerId ? ` ${getSelectedUltimate().name}` : "";
  const passive = move.passiveId ? " Open Roads" : "";
  const notation = `${PLAYERS[piece.player].name}: ${squareName(move.from)}${separator}${squareName(move.to)}${crown}${power}${passive}`;

  return {
    player: piece.player,
    actor,
    from: squareName(move.from),
    to: squareName(move.to),
    captured: Boolean(move.captured),
    promoted,
    notation,
  };
}

function recordGameResult(winner) {
  if (state.resultRecorded || state.mode === "puzzle" || state.mode === "campaign") {
    return;
  }

  const entry = getOrCreateLeaderboardEntry();
  entry.games = (entry.games || 0) + 1;
  entry.captures += state.moveEvents.filter((event) => event.player === "azure" && event.captured).length;

  if (winner === "azure") {
    entry.wins += 1;
  } else {
    entry.losses += 1;
  }

  entry.updatedAt = new Date().toISOString();
  state.resultRecorded = true;
  saveLeaderboard();
}

function updatePuzzleStreak() {
  const today = new Date().toISOString().slice(0, 10);
  if (profile.lastPuzzleDate !== today) {
    profile.streak = (profile.streak || 0) + 1;
    profile.lastPuzzleDate = today;
  }

  const entry = getOrCreateLeaderboardEntry();
  entry.puzzles += 1;
  entry.updatedAt = new Date().toISOString();
  saveProfile();
  saveLeaderboard();
}

function getOrCreateLeaderboardEntry() {
  const id = getProfileId(profile);
  let entry = leaderboard.find((item) => item.id === id);
  if (!entry) {
    entry = {
      id,
      name: profile.name,
      city: profile.city,
      wins: 0,
      losses: 0,
      captures: 0,
      puzzles: 0,
      games: 0,
    };
    leaderboard.push(entry);
  }

  entry.name = profile.name;
  entry.city = profile.city;
  return entry;
}

function getLeaderboardRows(city) {
  const combined = [...DEFAULT_LEADERBOARD, ...leaderboard];
  const filtered = city === "Global"
    ? combined
    : combined.filter((entry) => entry.city === city);

  return filtered.sort((a, b) => getLeaderboardScore(b) - getLeaderboardScore(a));
}

function getLeaderboardScore(entry) {
  return (entry.wins || 0) * 30 + (entry.puzzles || 0) * 12 + (entry.captures || 0) * 2 - (entry.losses || 0) * 5;
}

function getRuleStatusText() {
  if (state.abilityMode) {
    return `${getSelectedUltimate().name} targeting`;
  }

  if (state.mode === "campaign") {
    return `Nomad Trail ${getCampaignLevel(state.campaign?.levelId).number} | ${getSelectedUltimate().name}`;
  }

  if (state.mode === "puzzle") {
    return state.puzzle.solved ? "Daily tactic solved" : "Daily tactic: capture chain";
  }

  if (state.forcedFrom) {
    return "Multi-capture in progress";
  }

  if (state.mode === "ai") {
    return `${AI_LABELS[state.aiLevel]} AI sparring | ${getSelectedFaction().name}`;
  }

  return `${getSelectedFaction().name} | Mandatory capture active`;
}

function isAiTurn() {
  return (state.mode === "ai" || state.mode === "campaign") && state.turn === "amber" && !state.winner;
}

function countPieces(board) {
  return board.flat().reduce(
    (counts, piece) => {
      if (piece) {
        counts[piece.player] += 1;
      }
      return counts;
    },
    { azure: 0, amber: 0 },
  );
}

function cloneBoard(board) {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

function cloneMove(move) {
  return {
    from: { ...move.from },
    to: { ...move.to },
    captured: move.captured ? { ...move.captured } : null,
  };
}

function isDarkSquare(row, col) {
  return (row + col) % 2 === 1;
}

function isInsideBoard(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function isSameSquare(first, second) {
  return Boolean(
    first &&
      second &&
      first.row === second.row &&
      first.col === second.col,
  );
}

function isSameMove(first, second) {
  return Boolean(
    first &&
      second &&
      isSameSquare(first.from, second.from) &&
      isSameSquare(first.to, second.to),
  );
}

function isCenterSquare(square) {
  return square.row >= 2 && square.row <= 5 && square.col >= 2 && square.col <= 5;
}

function coordToSquare(coord) {
  const file = coord[0].toLowerCase();
  const rank = Number(coord.slice(1));
  return {
    row: BOARD_SIZE - rank,
    col: FILES.indexOf(file),
  };
}

function squareName(square) {
  return `${FILES[square.col]}${BOARD_SIZE - square.row}`;
}

function formatClock(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function getSquareLabel(row, col, piece, move) {
  const name = squareName({ row, col });
  if (piece) {
    return `${name}, ${PLAYERS[piece.player].name}${piece.king ? " king" : " piece"}`;
  }
  if (move?.captured) {
    return `${name}, capture target`;
  }
  if (move) {
    return `${name}, move target`;
  }
  return `${name}, empty square`;
}

function cleanProfileName(name) {
  const clean = String(name || "").trim().replace(/\s+/g, " ").slice(0, 18);
  return clean || DEFAULT_PROFILE.name;
}

function getProfileId(nextProfile) {
  return `${nextProfile.city}:${nextProfile.name}`.toLowerCase().replace(/[^a-z0-9:]+/g, "-");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function saveGame() {
  try {
    const snapshot = {
      ...state,
      aiThinking: false,
    };
    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn("Could not save local game state.", error);
  }
}

function loadGame(nextProfile) {
  try {
    const saved = localStorage.getItem(GAME_STORAGE_KEY);
    if (!saved) {
      return null;
    }

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.board) || !PLAYERS[parsed.turn]) {
      return null;
    }

    return {
      ...createNewState({
        theme: parsed.theme === "light" ? "light" : "dark",
        profile: nextProfile,
        mode: parsed.mode || "local",
        aiLevel: parsed.aiLevel || "beginner",
        timerMode: parsed.timerMode || "0",
        loadout: normalizeLoadout(parsed.loadout || DEFAULT_LOADOUT),
        campaignLevelId: parsed.campaign?.levelId || getDefaultCampaignLevelId(),
      }),
      ...parsed,
      loadout: normalizeLoadout(parsed.loadout || DEFAULT_LOADOUT),
      profile: nextProfile,
      legalMoves: [],
      selected: null,
      moveEvents: Array.isArray(parsed.moveEvents) ? parsed.moveEvents : [],
      reviewEvents: Array.isArray(parsed.reviewEvents) ? parsed.reviewEvents : [],
      undoStack: Array.isArray(parsed.undoStack) ? parsed.undoStack : [],
      clocks: parsed.clocks || createClocks(parsed.timerMode || "0"),
      momentum: Number.isFinite(parsed.momentum) ? parsed.momentum : 2,
      ultimateUsed: Boolean(parsed.ultimateUsed),
      abilityMode: null,
      powerSelection: [],
      statuses: parsed.statuses ? cloneStatuses({
        ...createInitialStatuses(),
        ...parsed.statuses,
        counters: {
          ...createInitialStatuses().counters,
          ...(parsed.statuses.counters || {}),
        },
      }) : createInitialStatuses(),
      abilityLog: Array.isArray(parsed.abilityLog) ? parsed.abilityLog : [],
      puzzle: parsed.puzzle || {
        id: DAILY_PUZZLE.id,
        captures: 0,
        solved: false,
        failed: false,
      },
      campaign: parsed.campaign || {
        levelId: parsed.campaignLevelId || getDefaultCampaignLevelId(),
        solved: false,
        objective: getCampaignLevel(parsed.campaignLevelId || getDefaultCampaignLevelId()).objective,
      },
      aiThinking: false,
    };
  } catch (error) {
    console.warn("Could not load local game state.", error);
    return null;
  }
}

function saveProfile() {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.warn("Could not save profile.", error);
  }
}

function loadProfile() {
  try {
    const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!saved) {
      return { ...DEFAULT_PROFILE };
    }

    const parsed = JSON.parse(saved);
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      name: cleanProfileName(parsed.name),
      city: parsed.city || DEFAULT_PROFILE.city,
    };
  } catch (error) {
    console.warn("Could not load profile.", error);
    return { ...DEFAULT_PROFILE };
  }
}

function saveLeaderboard() {
  try {
    localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(leaderboard));
  } catch (error) {
    console.warn("Could not save leaderboard.", error);
  }
}

function loadLeaderboard() {
  try {
    const saved = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    if (!saved) {
      return [];
    }

    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Could not load leaderboard.", error);
    return [];
  }
}

function saveCampaignProgress() {
  try {
    localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(campaignProgress));
  } catch (error) {
    console.warn("Could not save campaign progress.", error);
  }
}

function loadCampaignProgress() {
  try {
    const saved = localStorage.getItem(CAMPAIGN_STORAGE_KEY);
    if (!saved) {
      return {
        currentLevelId: NOMAD_CAMPAIGN[0].id,
        completed: {},
      };
    }

    const parsed = JSON.parse(saved);
    return {
      currentLevelId: parsed.currentLevelId || NOMAD_CAMPAIGN[0].id,
      completed: parsed.completed || {},
    };
  } catch (error) {
    console.warn("Could not load campaign progress.", error);
    return {
      currentLevelId: NOMAD_CAMPAIGN[0].id,
      completed: {},
    };
  }
}
