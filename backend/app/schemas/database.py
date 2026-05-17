from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl


AiLevel = Literal["beginner", "smart", "coach"]
AiDifficulty = Literal["easy", "medium", "hard"]
GameMode = Literal["classic", "power", "campaign", "puzzle", "sprint"]
MatchResult = Literal["win", "loss", "draw", "abandoned"]
OpponentType = Literal["AI", "Player"]


class CurrencyBalance(BaseModel):
    essence: int = Field(default=0, ge=0)
    shards: int = Field(default=0, ge=0)


class PveStats(BaseModel):
    matches_played: int = Field(default=0, ge=0)
    wins: int = Field(default=0, ge=0)
    losses: int = Field(default=0, ge=0)
    highest_ai_defeated: str = "none"


class PvpStats(BaseModel):
    matches_played: int = Field(default=0, ge=0)
    wins: int = Field(default=0, ge=0)
    losses: int = Field(default=0, ge=0)
    current_win_streak: int = Field(default=0, ge=0)
    mmr_elo_rating: int = Field(default=1000, ge=100)


class SavedLoadout(BaseModel):
    name: str = Field(default="Nomad Starter", min_length=1, max_length=32)
    faction_id: str = "nomads"
    passive_id: str = "open_roads"
    ultimate_id: str = "dash"
    is_active: bool = False


class ActiveQuest(BaseModel):
    quest_id: str
    progress_count: int = Field(default=0, ge=0)
    target_count: int = Field(default=1, ge=1)
    is_completed: bool = False
    expires_at: datetime | None = None


class UserSettings(BaseModel):
    masterVolume: int = Field(default=80, ge=0, le=100)
    musicVolume: int = Field(default=45, ge=0, le=100)
    sfxVolume: int = Field(default=70, ge=0, le=100)
    voiceVolume: int = Field(default=60, ge=0, le=100)
    musicEnabled: bool = True
    sfxEnabled: bool = True
    voiceEnabled: bool = True
    reducedMotion: bool = False
    theme: Literal["dark", "light"] = "dark"
    musicTrack: str = "echoes_of_void"
    onboardingCompleted: bool = False
    boardPreferences: dict[str, Any] = Field(default_factory=dict)


class PlayerStreaks(BaseModel):
    loginDays: int = Field(default=1, ge=0)
    dailyPuzzle: int = Field(default=0, ge=0)
    dailyWin: int = Field(default=0, ge=0)
    lastLoginDate: str | None = None


class ProfileUpsert(BaseModel):
    user_id: UUID
    username: str = Field(min_length=3, max_length=24, pattern=r"^[A-Za-z0-9_]+$")
    profile_picture_url: HttpUrl | None = None
    bio: str = Field(default="", max_length=240)
    city: str = Field(default="Almaty", min_length=1, max_length=48)
    current_exp: int = Field(default=0, ge=0)
    level: int = Field(default=1, ge=1)
    essence: int = Field(default=0, ge=0)
    shards: int = Field(default=0, ge=0)
    is_admin: bool = False
    is_pro: bool = False
    pve_stats: PveStats = Field(default_factory=PveStats)
    pvp_stats: PvpStats = Field(default_factory=PvpStats)
    unlocked_factions: list[str] = Field(default_factory=lambda: ["nomads"])
    unlocked_abilities: list[str] = Field(default_factory=lambda: ["open_roads", "dash"])
    owned_cosmetics: list[str] = Field(default_factory=list)
    earned_badges: list[str] = Field(default_factory=list)
    saved_loadouts: list[SavedLoadout] = Field(default_factory=lambda: [SavedLoadout(is_active=True)])
    active_quests: list[ActiveQuest] = Field(default_factory=list)
    settings: UserSettings = Field(default_factory=UserSettings)
    streaks: PlayerStreaks = Field(default_factory=PlayerStreaks)
    achievements_claimed: list[str] = Field(default_factory=list)
    equipped_piece_skin: str | None = None
    equipped_board_skin: str | None = None
    equipped_badge: str | None = None


class ProfilePatch(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=24, pattern=r"^[A-Za-z0-9_]+$")
    profile_picture_url: HttpUrl | None = None
    bio: str | None = Field(default=None, max_length=240)
    city: str | None = Field(default=None, min_length=1, max_length=48)
    current_exp: int | None = Field(default=None, ge=0)
    level: int | None = Field(default=None, ge=1)
    essence: int | None = Field(default=None, ge=0)
    shards: int | None = Field(default=None, ge=0)
    is_admin: bool | None = None
    is_pro: bool | None = None
    unlocked_factions: list[str] | None = None
    unlocked_abilities: list[str] | None = None
    earned_badges: list[str] | None = None
    active_quests: list[ActiveQuest] | None = None
    settings: UserSettings | None = None
    streaks: PlayerStreaks | None = None
    achievements_claimed: list[str] | None = None
    equipped_piece_skin: str | None = None
    equipped_board_skin: str | None = None
    equipped_badge: str | None = None


class ProfileAvatarUpdate(BaseModel):
    profile_picture_url: HttpUrl | None = None


class MatchHistoryCreate(BaseModel):
    user_id: UUID
    opponent_user_id: UUID | None = None
    opponent_type: OpponentType = "AI"
    ai_difficulty: AiDifficulty | None = None
    opponent_ai_level: AiLevel | None = None
    game_mode: GameMode = "classic"
    result: MatchResult
    faction_id: str | None = None
    passive_id: str | None = None
    ultimate_id: str | None = None
    turns_count: int = Field(default=0, ge=0)
    captures_made: int = Field(default=0, ge=0)
    duration_seconds: int = Field(default=0, ge=0)
    replay: list[dict[str, Any]] = Field(default_factory=list)
    review_summary: list[str] = Field(default_factory=list)
    mmr_delta: int = 0
    base_exp: int = Field(default=80, ge=0)
    essence_reward: int = Field(default=0, ge=0)
    shards_reward: int = Field(default=0, ge=0)
    equipped_piece_skin: str | None = None
    equipped_board_skin: str | None = None
    opponent_piece_skin: str | None = None
    opponent_board_skin: str | None = None


class VaultPurchaseRequest(BaseModel):
    user_id: UUID
    cosmetic_id: str


class InventoryEquipRequest(BaseModel):
    user_id: UUID
    inventory_item_id: UUID


class InventoryGrantRequest(BaseModel):
    user_id: UUID
    cosmetic_id: str
    source: str = "achievement"


class CampaignProgressUpsert(BaseModel):
    completed_levels: list[str] = Field(default_factory=list)
    current_level_id: str | None = None
    stars_earned: int = Field(default=0, ge=0)
    best_clear_turns: dict[str, int] = Field(default_factory=dict)


class MultiplayerRoomCreate(BaseModel):
    user_id: UUID | str
    mode: str = Field(default="private", max_length=24)


class FriendRequestCreate(BaseModel):
    user_id: UUID | str | None = None
    target_user_id: UUID | str


class FriendInviteCreate(BaseModel):
    user_id: UUID | str | None = None
    room_code: str = Field(min_length=3, max_length=24)


class CoachAnalysisRequest(BaseModel):
    replay: list[dict[str, Any]] = Field(default_factory=list)
    final_board: list[list[dict[str, Any] | None]] = Field(default_factory=list)
    current_board: list[list[dict[str, Any] | None]] = Field(default_factory=list)
    recent_moves: list[dict[str, Any] | str] = Field(default_factory=list)
    retry_context: dict[str, Any] = Field(default_factory=dict)
    system_prompt: str = ""
    mode: str = "ai"
    loadout: dict[str, Any] = Field(default_factory=dict)
    result: str = "loss"


class ProInterestRequest(BaseModel):
    user_id: UUID | str | None = None
    source: str = Field(default="pro_modal", max_length=64)
    selected_offer: str = Field(default="aether_pro", max_length=96)
    metadata: dict[str, Any] = Field(default_factory=dict)
