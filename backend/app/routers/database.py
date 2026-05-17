from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request

from app.schemas.database import (
    CampaignProgressUpsert,
    CoachAnalysisRequest,
    FriendInviteCreate,
    FriendRequestCreate,
    InventoryEquipRequest,
    InventoryGrantRequest,
    MatchHistoryCreate,
    ProInterestRequest,
    ProfileAvatarUpdate,
    ProfilePatch,
    ProfileUpsert,
    VaultPurchaseRequest,
)
from app.services.coach import analyze_replay
from app.services.supabase_client import (
    SupabaseConfigurationError,
    get_supabase_service_client,
    is_supabase_configured,
)
from app.services.auth import get_authenticated_user_id, optional_owned_user_id, resolve_owned_user_id

router = APIRouter()

PUBLIC_PROFILE_FIELDS = "user_id,username,profile_picture_url,bio,city,level,pvp_stats,unlocked_factions,saved_loadouts"
KNOWN_CHAMPION_CITIES = ["Almaty", "Astana", "Shymkent", "Aktobe", "Karaganda"]


def is_leaderboard_badge_id(cosmetic_id: str | None) -> bool:
    value = str(cosmetic_id or "")
    return value.startswith("badge_") and value.endswith("_champion")


def city_badge_id(city: str | None) -> str:
    city_name = (city or "global").strip().lower()
    slug = "".join(char if char.isalnum() else "_" for char in city_name).strip("_") or "global"
    while "__" in slug:
        slug = slug.replace("__", "_")
    return f"badge_{slug}_champion"


def champion_badge_name(city: str | None) -> str:
    city_name = (city or "Global").strip() or "Global"
    return f"{city_name} Champion Badge"


def champion_badge_preview_url(city: str | None) -> str:
    badge_id = city_badge_id(city)
    known = {
        "badge_global_champion",
        "badge_almaty_champion",
        "badge_astana_champion",
        "badge_shymkent_champion",
        "badge_aktobe_champion",
        "badge_karaganda_champion",
    }
    return f"/assets/cosmetics/{badge_id}.png" if badge_id in known else ""


def strip_unearned_leaderboard_badges(values: list[str] | None, earned: set[str] | None = None) -> list[str]:
    earned = earned or set()
    kept = [item for item in values or [] if not is_leaderboard_badge_id(item) or item in earned]
    return sorted(set(kept))


def existing_earned_leaderboard_badges(supabase, user_id: str) -> set[str]:
    try:
        response = supabase.table("profiles").select("owned_cosmetics,earned_badges").eq("user_id", user_id).limit(1).execute()
        row = response.data[0] if response.data else {}
    except Exception:
        return set()
    badges = set(row.get("earned_badges") or [])
    return {item for item in badges if is_leaderboard_badge_id(item)}


def existing_earned_badges(supabase, user_id: str) -> set[str]:
    try:
        response = supabase.table("profiles").select("earned_badges").eq("user_id", user_id).limit(1).execute()
        row = response.data[0] if response.data else {}
    except Exception:
        return set()
    return set(row.get("earned_badges") or [])


def sanitize_profile_badge_payload(supabase, user_id: str, payload: dict) -> dict:
    earned = existing_earned_leaderboard_badges(supabase, user_id)
    if "owned_cosmetics" in payload:
        payload["owned_cosmetics"] = strip_unearned_leaderboard_badges(payload.get("owned_cosmetics"), earned)
    if "earned_badges" in payload:
        payload["earned_badges"] = strip_unearned_leaderboard_badges(payload.get("earned_badges"), earned)
    if "equipped_badge" in payload:
        equipped_badge = str(payload.get("equipped_badge") or "")
        available_badges = existing_earned_badges(supabase, user_id) | set(payload.get("earned_badges") or [])
        payload["equipped_badge"] = equipped_badge if equipped_badge and equipped_badge in available_badges else None
    return payload


def pvp_elo(row: dict) -> int:
    try:
        return int((row.get("pvp_stats") or {}).get("mmr_elo_rating") or 1000)
    except (TypeError, ValueError):
        return 1000


def pvp_matches(row: dict) -> int:
    try:
        return int((row.get("pvp_stats") or {}).get("matches_played") or 0)
    except (TypeError, ValueError):
        return 0


def supabase_or_503():
    try:
        return get_supabase_service_client()
    except SupabaseConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def public_profile(row: dict | None, recent_match: dict | None = None, badge: dict | None = None) -> dict:
    if not row:
        return {}
    pvp_stats = row.get("pvp_stats") or {}
    loadouts = row.get("saved_loadouts") or []
    active_loadout = next((item for item in loadouts if item.get("is_active")), loadouts[0] if loadouts else {})
    wins = int(pvp_stats.get("wins") or 0)
    losses = int(pvp_stats.get("losses") or 0)
    captures = int((recent_match or {}).get("captures_made") or 0)
    threat = "Unknown"
    if wins + losses > 0:
        if captures >= 6 or wins > losses * 1.4:
            threat = "Aggressive"
        elif losses > wins:
            threat = "Defensive"
        else:
            threat = "Tactical"
    return {
        "user_id": str(row.get("user_id")),
        "username": row.get("username"),
        "profile_picture_url": row.get("profile_picture_url"),
        "bio": row.get("bio") or "",
        "city": row.get("city") or "Global",
        "level": row.get("level") or 1,
        "pvp_stats": pvp_stats,
        "favorite_faction": active_loadout.get("faction_id") or (row.get("unlocked_factions") or ["nomads"])[0],
        "equipped_badge": badge,
        "recent_match": recent_match,
        "threat": threat,
    }


def profile_for_user(supabase, user_id: str) -> dict:
    profile_response = supabase.table("profiles").select(PUBLIC_PROFILE_FIELDS).eq("user_id", user_id).single().execute()
    recent = None
    badge = None
    try:
        match_response = (
            supabase.table("match_history")
            .select("result,game_mode,opponent_type,opponent_ai_level,captures_made,turns_count,created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        recent = match_response.data[0] if match_response.data else None
    except Exception:
        recent = None
    try:
        badge_response = (
            supabase.table("inventory_items")
            .select("cosmetics(*)")
            .eq("user_id", user_id)
            .eq("is_equipped", True)
            .execute()
        )
        badge = next((item.get("cosmetics") for item in badge_response.data or [] if (item.get("cosmetics") or {}).get("kind") == "badge"), None)
    except Exception:
        badge = None
    return public_profile(profile_response.data, recent, badge)


def owned_user_or_demo(request: Request, supplied_user_id: str | None = None) -> str:
    return resolve_owned_user_id(request, supplied_user_id)


@router.get("/database/health")
def database_health():
    if not is_supabase_configured():
        return {"ok": False, "configured": False}

    supabase = supabase_or_503()
    try:
        response = supabase.table("profiles").select("user_id", count="exact").limit(1).execute()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Supabase connection failed: {exc}") from exc

    return {"ok": True, "configured": True, "profile_count": response.count}


@router.post("/profiles")
def upsert_profile(profile: ProfileUpsert, request: Request):
    supabase = supabase_or_503()
    row = profile.model_dump(mode="json")
    row["user_id"] = resolve_owned_user_id(request, str(profile.user_id))
    row = sanitize_profile_badge_payload(supabase, row["user_id"], row)

    try:
        response = supabase.table("profiles").upsert(row, on_conflict="user_id").execute()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Profile upsert failed: {exc}") from exc

    return {"saved": True, "profile": response.data[0] if response.data else row}


@router.get("/profiles/{user_id}")
def get_profile(user_id: str, request: Request):
    supabase = supabase_or_503()
    owned_user_id = resolve_owned_user_id(request, user_id)
    try:
        response = supabase.table("profiles").select("*").eq("user_id", owned_user_id).single().execute()
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Profile not found: {exc}") from exc

    return {"profile": response.data}


@router.patch("/profiles/{user_id}")
def update_profile(user_id: str, patch: ProfilePatch, request: Request):
    supabase = supabase_or_503()
    owned_user_id = resolve_owned_user_id(request, user_id)
    payload = patch.model_dump(mode="json", exclude_none=True)
    if not payload:
        raise HTTPException(status_code=400, detail="No profile fields provided.")
    payload = sanitize_profile_badge_payload(supabase, owned_user_id, payload)

    try:
        response = supabase.table("profiles").update(payload).eq("user_id", owned_user_id).execute()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Profile update failed: {exc}") from exc

    return {"saved": True, "profile": response.data[0] if response.data else payload}


@router.post("/profiles/{user_id}/avatar")
def update_profile_avatar(user_id: str, avatar: ProfileAvatarUpdate, request: Request):
    supabase = supabase_or_503()
    owned_user_id = resolve_owned_user_id(request, user_id)
    payload = avatar.model_dump(mode="json")
    try:
        response = supabase.table("profiles").update(payload).eq("user_id", owned_user_id).execute()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Avatar update failed: {exc}") from exc

    return {"saved": True, "profile": response.data[0] if response.data else payload}


@router.get("/players/search")
def search_players(username: str = Query(min_length=1, max_length=64), limit: int = Query(default=8, ge=1, le=20)):
    supabase = supabase_or_503()
    term = username.strip()
    try:
        query = supabase.table("profiles").select(PUBLIC_PROFILE_FIELDS)
        try:
            UUID(term)
            query = query.or_(f"user_id.eq.{term},username.ilike.%{term}%")
        except ValueError:
            query = query.ilike("username", f"%{term}%")
        response = query.order("level", desc=True).limit(limit).execute()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Player search failed: {exc}") from exc

    return {"players": [public_profile(row) for row in response.data or []]}


@router.get("/players/{user_id}/public")
def get_public_player_profile(user_id: str):
    supabase = supabase_or_503()
    try:
        profile = profile_for_user(supabase, user_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Public profile not found: {exc}") from exc
    return {"profile": profile}


@router.get("/friends")
def get_friends(request: Request, user_id: str | None = None):
    supabase = supabase_or_503()
    owned_user_id = owned_user_or_demo(request, user_id)
    try:
        friendship_response = supabase.table("friendships").select("friend_id,created_at").eq("user_id", owned_user_id).execute()
        incoming_response = supabase.table("friend_requests").select("*").eq("addressee_id", owned_user_id).eq("status", "pending").execute()
        outgoing_response = supabase.table("friend_requests").select("*").eq("requester_id", owned_user_id).eq("status", "pending").execute()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Friend list query failed: {exc}") from exc

    friends = []
    for item in friendship_response.data or []:
        try:
            friends.append({
                **profile_for_user(supabase, str(item["friend_id"])),
                "friendship_created_at": item.get("created_at"),
                "presence": "online",
            })
        except Exception:
            continue

    def attach_request_profile(item: dict, key: str) -> dict:
        try:
            return {**item, "profile": profile_for_user(supabase, str(item[key]))}
        except Exception:
            return item

    return {
        "friends": friends,
        "incoming": [attach_request_profile(item, "requester_id") for item in incoming_response.data or []],
        "outgoing": [attach_request_profile(item, "addressee_id") for item in outgoing_response.data or []],
    }


@router.post("/friends/requests")
def send_friend_request(friend_request: FriendRequestCreate, request: Request):
    supabase = supabase_or_503()
    user_id = owned_user_or_demo(request, str(friend_request.user_id) if friend_request.user_id else None)
    target_user_id = str(friend_request.target_user_id)
    if user_id == target_user_id:
        raise HTTPException(status_code=400, detail="You cannot add yourself.")

    try:
        existing_friend = (
            supabase.table("friendships")
            .select("user_id")
            .eq("user_id", user_id)
            .eq("friend_id", target_user_id)
            .limit(1)
            .execute()
        )
        if existing_friend.data:
            raise HTTPException(status_code=409, detail="This player is already your friend.")
        existing_request = (
            supabase.table("friend_requests")
            .select("request_id,status")
            .or_(f"and(requester_id.eq.{user_id},addressee_id.eq.{target_user_id}),and(requester_id.eq.{target_user_id},addressee_id.eq.{user_id})")
            .in_("status", ["pending", "accepted"])
            .limit(1)
            .execute()
        )
        if existing_request.data:
            raise HTTPException(status_code=409, detail="A friend request already exists.")
        response = supabase.table("friend_requests").insert({
            "requester_id": user_id,
            "addressee_id": target_user_id,
            "status": "pending",
        }).execute()
        supabase.table("notifications").insert({
            "user_id": target_user_id,
            "type": "friend_request",
            "title": "Friend request",
            "body": "A commander sent you a friend request.",
            "metadata": {"requester_id": user_id},
        }).execute()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Friend request failed: {exc}") from exc

    return {"sent": True, "request": response.data[0] if response.data else None}


@router.post("/friends/requests/{request_id}/accept")
def accept_friend_request(request_id: str, request: Request, user_id: str | None = None):
    return resolve_friend_request(request_id, request, user_id, "accepted")


@router.post("/friends/requests/{request_id}/decline")
def decline_friend_request(request_id: str, request: Request, user_id: str | None = None):
    return resolve_friend_request(request_id, request, user_id, "declined")


def resolve_friend_request(request_id: str, request: Request, supplied_user_id: str | None, status: str):
    supabase = supabase_or_503()
    user_id = owned_user_or_demo(request, supplied_user_id)
    try:
        request_response = (
            supabase.table("friend_requests")
            .select("*")
            .eq("request_id", request_id)
            .eq("addressee_id", user_id)
            .eq("status", "pending")
            .single()
            .execute()
        )
        item = request_response.data
        response = supabase.table("friend_requests").update({
            "status": status,
            "responded_at": datetime.now(timezone.utc).isoformat(),
        }).eq("request_id", request_id).execute()
        if status == "accepted":
            supabase.table("friendships").upsert([
                {"user_id": str(item["requester_id"]), "friend_id": str(item["addressee_id"])},
                {"user_id": str(item["addressee_id"]), "friend_id": str(item["requester_id"])},
            ], on_conflict="user_id,friend_id").execute()
            supabase.table("notifications").insert({
                "user_id": str(item["requester_id"]),
                "type": "friend_accept",
                "title": "Friend request accepted",
                "body": "A commander accepted your friend request.",
                "metadata": {"friend_id": user_id},
            }).execute()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Friend request update failed: {exc}") from exc

    return {"updated": True, "status": status, "request": response.data[0] if response.data else None}


@router.post("/friends/{friend_id}/invite")
def invite_friend(friend_id: str, invite: FriendInviteCreate, request: Request):
    supabase = supabase_or_503()
    user_id = owned_user_or_demo(request, str(invite.user_id) if invite.user_id else None)
    try:
        friendship_response = (
            supabase.table("friendships")
            .select("friend_id")
            .eq("user_id", user_id)
            .eq("friend_id", friend_id)
            .limit(1)
            .execute()
        )
        if not friendship_response.data:
            raise HTTPException(status_code=403, detail="You can only invite friends.")
        response = supabase.table("notifications").insert({
            "user_id": friend_id,
            "type": "duel_invite",
            "title": "Duel invite",
            "body": "A friend invited you to a private Aether-Tactics lobby.",
            "metadata": {"from_user_id": user_id, "room_code": invite.room_code},
        }).execute()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invite failed: {exc}") from exc

    return {"sent": True, "notification": response.data[0] if response.data else None, "room_code": invite.room_code}


@router.post("/coach/analyze")
def analyze_match_with_coach(analysis: CoachAnalysisRequest):
    return analyze_replay(
        replay=analysis.replay,
        final_board=analysis.final_board or analysis.current_board,
        recent_moves=analysis.recent_moves,
        retry_context=analysis.retry_context,
        system_prompt=analysis.system_prompt,
        result=analysis.result,
        mode=analysis.mode,
        loadout=analysis.loadout,
    )


@router.post("/matches")
def record_match(match: MatchHistoryCreate, request: Request):
    supabase = supabase_or_503()
    owned_user_id = resolve_owned_user_id(request, str(match.user_id))
    payload = {
        "p_user_id": owned_user_id,
        "p_result": match.result,
        "p_game_mode": match.game_mode,
        "p_opponent_user_id": str(match.opponent_user_id) if match.opponent_user_id else None,
        "p_opponent_type": match.opponent_type,
        "p_ai_difficulty": match.ai_difficulty,
        "p_opponent_ai_level": match.opponent_ai_level,
        "p_faction_id": match.faction_id,
        "p_passive_id": match.passive_id,
        "p_ultimate_id": match.ultimate_id,
        "p_turns_count": match.turns_count,
        "p_captures_made": match.captures_made,
        "p_duration_seconds": match.duration_seconds,
        "p_replay": match.replay,
        "p_review_summary": match.review_summary,
        "p_mmr_delta": 0 if match.opponent_type == "AI" else match.mmr_delta,
        "p_base_exp": match.base_exp,
        "p_essence_reward": match.essence_reward,
        "p_shards_reward": match.shards_reward,
        "p_equipped_piece_skin": match.equipped_piece_skin,
        "p_equipped_board_skin": match.equipped_board_skin,
        "p_opponent_piece_skin": match.opponent_piece_skin,
        "p_opponent_board_skin": match.opponent_board_skin,
    }

    try:
        response = supabase.rpc("record_match_and_update_profile", payload).execute()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Match recording failed: {exc}") from exc

    match_id = response.data
    profile = None
    match_row = None
    try:
        profile_response = supabase.table("profiles").select("*").eq("user_id", owned_user_id).single().execute()
        profile = profile_response.data
        if match_id:
            match_response = supabase.table("match_history").select("*").eq("match_id", str(match_id)).single().execute()
            match_row = match_response.data
    except Exception:
        pass

    return {"saved": True, "match_id": match_id, "profile": profile, "match": match_row}


@router.get("/matches/{user_id}")
def get_match_history(user_id: str, request: Request, limit: int = Query(default=10, ge=1, le=100)):
    supabase = supabase_or_503()
    owned_user_id = resolve_owned_user_id(request, user_id)
    try:
        response = (
            supabase.table("match_history")
            .select("*")
            .eq("user_id", owned_user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Match history query failed: {exc}") from exc

    return {"matches": response.data or []}


@router.get("/campaign-progress/{user_id}/{faction_id}")
def get_campaign_progress(user_id: str, faction_id: str, request: Request):
    supabase = supabase_or_503()
    owned_user_id = resolve_owned_user_id(request, user_id)
    try:
        response = (
            supabase.table("campaign_progress")
            .select("*")
            .eq("user_id", owned_user_id)
            .eq("faction_id", faction_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Campaign progress query failed: {exc}") from exc

    progress = response.data[0] if response.data else {
        "user_id": owned_user_id,
        "faction_id": faction_id,
        "completed_levels": [],
        "current_level_id": None,
        "stars_earned": 0,
        "best_clear_turns": {},
    }
    return {"progress": progress}


@router.put("/campaign-progress/{user_id}/{faction_id}")
def save_campaign_progress(user_id: str, faction_id: str, progress: CampaignProgressUpsert, request: Request):
    supabase = supabase_or_503()
    owned_user_id = resolve_owned_user_id(request, user_id)
    row = {
        "user_id": owned_user_id,
        "faction_id": faction_id,
        **progress.model_dump(mode="json"),
    }
    try:
        response = (
            supabase.table("campaign_progress")
            .upsert(row, on_conflict="user_id,faction_id")
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Campaign progress save failed: {exc}") from exc

    return {"saved": True, "progress": response.data[0] if response.data else row}


@router.get("/vault/items")
def vault_items(request: Request, user_id: str | None = None):
    supabase = supabase_or_503()
    owned_user_id = optional_owned_user_id(request, user_id)
    try:
        items_response = supabase.table("cosmetics").select("*").order("price_shards").execute()
        profile = None
        owned_ids: set[str] = set()
        if owned_user_id:
            profile_response = supabase.table("profiles").select("unlocked_factions,shards").eq("user_id", owned_user_id).single().execute()
            profile = profile_response.data
            inventory_response = supabase.table("inventory_items").select("cosmetic_id").eq("user_id", owned_user_id).execute()
            owned_ids = {row["cosmetic_id"] for row in inventory_response.data or []}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Vault query failed: {exc}") from exc

    unlocked = set((profile or {}).get("unlocked_factions") or ["nomads"])
    rows = []
    for item in items_response.data or []:
        if is_leaderboard_badge_id(item.get("cosmetic_id")):
            continue
        target = item.get("target_faction_id")
        rows.append({
            **item,
            "is_owned": item["cosmetic_id"] in owned_ids,
            "is_locked": bool(target and target not in unlocked),
        })

    return {"items": rows, "shards": (profile or {}).get("shards")}


@router.post("/vault/purchase")
def purchase_vault_item(purchase: VaultPurchaseRequest, request: Request):
    supabase = supabase_or_503()
    user_id = resolve_owned_user_id(request, str(purchase.user_id))
    try:
        profile_response = supabase.table("profiles").select("shards,owned_cosmetics,unlocked_factions").eq("user_id", user_id).single().execute()
        item_response = supabase.table("cosmetics").select("*").eq("cosmetic_id", purchase.cosmetic_id).single().execute()
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Purchase target not found: {exc}") from exc

    profile = profile_response.data
    item = item_response.data
    if is_leaderboard_badge_id(purchase.cosmetic_id):
        raise HTTPException(status_code=403, detail="Champion badges are earned through leaderboard placement and cannot be purchased.")
    owned = set(profile.get("owned_cosmetics") or [])
    unlocked = set(profile.get("unlocked_factions") or [])
    price = int(item.get("price_shards") or 0)
    target = item.get("target_faction_id")

    if purchase.cosmetic_id in owned and purchase.cosmetic_id == "void_order_campaign_pass" and "void_order" not in unlocked:
        try:
            response = supabase.table("profiles").update({
                "unlocked_factions": sorted(unlocked | {"void_order"}),
            }).eq("user_id", user_id).execute()
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Unlock restore failed: {exc}") from exc
        return {"purchased": False, "restored": True, "profile": response.data[0] if response.data else None}
    if purchase.cosmetic_id in owned:
        raise HTTPException(status_code=409, detail="Item already owned.")
    if target and target not in unlocked:
        raise HTTPException(status_code=403, detail="Faction is locked for this item.")
    if int(profile.get("shards") or 0) < price:
        raise HTTPException(status_code=402, detail="Not enough Shards.")

    try:
        next_owned = list(owned | {purchase.cosmetic_id})
        profile_patch = {
            "shards": int(profile.get("shards") or 0) - price,
            "owned_cosmetics": next_owned,
        }
        if purchase.cosmetic_id == "void_order_campaign_pass":
            profile_patch["unlocked_factions"] = sorted(unlocked | {"void_order"})
        profile_update = supabase.table("profiles").update(profile_patch).eq("user_id", user_id).execute()
        inventory = supabase.table("inventory_items").insert({
            "user_id": user_id,
            "cosmetic_id": purchase.cosmetic_id,
            "is_equipped": False,
        }).execute()
        supabase.table("inventory_transactions").insert({
            "user_id": user_id,
            "source": "vault_purchase",
            "shards_delta": -price,
            "metadata": {"cosmetic_id": purchase.cosmetic_id},
        }).execute()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Purchase failed: {exc}") from exc

    return {
        "purchased": True,
        "profile": profile_update.data[0] if profile_update.data else None,
        "inventory_item": inventory.data[0] if inventory.data else None,
    }


@router.get("/inventory/{user_id}")
def get_inventory(user_id: str, request: Request):
    supabase = supabase_or_503()
    owned_user_id = resolve_owned_user_id(request, user_id)
    try:
        response = supabase.table("inventory_items").select("*,cosmetics(*)").eq("user_id", owned_user_id).order("purchased_at").execute()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Inventory query failed: {exc}") from exc

    return {"items": response.data or []}


@router.post("/inventory/grant")
def grant_inventory_item(grant_request: InventoryGrantRequest, request: Request):
    supabase = supabase_or_503()
    user_id = resolve_owned_user_id(request, str(grant_request.user_id))
    try:
        cosmetic_response = supabase.table("cosmetics").select("*").eq("cosmetic_id", grant_request.cosmetic_id).single().execute()
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Cosmetic not found: {exc}") from exc

    cosmetic = cosmetic_response.data
    if not cosmetic:
        raise HTTPException(status_code=404, detail="Cosmetic not found.")
    if is_leaderboard_badge_id(grant_request.cosmetic_id):
        raise HTTPException(status_code=403, detail="Champion badges are awarded only by leaderboard distribution.")

    try:
        existing_response = supabase.table("inventory_items").select("*,cosmetics(*)").eq("user_id", user_id).eq("cosmetic_id", grant_request.cosmetic_id).limit(1).execute()
        if existing_response.data:
            return {"granted": False, "already_owned": True, "inventory_item": existing_response.data[0]}

        profile_response = supabase.table("profiles").select("owned_cosmetics").eq("user_id", user_id).single().execute()
        owned = profile_response.data.get("owned_cosmetics") if profile_response.data else []
        owned_cosmetics = sorted(set((owned or []) + [grant_request.cosmetic_id]))
        profile_update = supabase.table("profiles").update({"owned_cosmetics": owned_cosmetics}).eq("user_id", user_id).execute()
        inventory = supabase.table("inventory_items").insert({
            "user_id": user_id,
            "cosmetic_id": grant_request.cosmetic_id,
            "is_equipped": False,
        }).execute()
        supabase.table("inventory_transactions").insert({
            "user_id": user_id,
            "source": grant_request.source,
            "essence_delta": 0,
            "shards_delta": 0,
            "metadata": {"cosmetic_id": grant_request.cosmetic_id},
        }).execute()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Grant failed: {exc}") from exc

    inventory_item = inventory.data[0] if inventory.data else None
    if inventory_item:
        inventory_item = {**inventory_item, "cosmetics": cosmetic}
    return {
        "granted": True,
        "profile": profile_update.data[0] if profile_update.data else None,
        "inventory_item": inventory_item,
    }


@router.post("/inventory/equip")
def equip_inventory_item(equip_request: InventoryEquipRequest, request: Request):
    supabase = supabase_or_503()
    user_id = resolve_owned_user_id(request, str(equip_request.user_id))
    try:
        inventory_response = supabase.table("inventory_items").select("*,cosmetics(*)").eq("inventory_item_id", str(equip_request.inventory_item_id)).eq("user_id", user_id).single().execute()
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Inventory item not found: {exc}") from exc

    item = inventory_response.data
    cosmetic = item.get("cosmetics") or {}
    kind = cosmetic.get("kind")

    try:
        all_items = supabase.table("inventory_items").select("inventory_item_id,cosmetics(kind,target_faction_id)").eq("user_id", user_id).execute()
        for row in all_items.data or []:
            row_cosmetic = row.get("cosmetics") or {}
            same_slot = row_cosmetic.get("kind") == kind
            if same_slot:
                supabase.table("inventory_items").update({
                    "is_equipped": False,
                    "equipped_at": None,
                }).eq("inventory_item_id", row["inventory_item_id"]).execute()
        response = supabase.table("inventory_items").update({
            "is_equipped": True,
            "equipped_at": datetime.now(timezone.utc).isoformat(),
        }).eq("inventory_item_id", str(equip_request.inventory_item_id)).execute()
        profile_skin_patch = {}
        if kind == "piece_skin":
            profile_skin_patch["equipped_piece_skin"] = item.get("cosmetic_id")
        if kind == "board_skin":
            profile_skin_patch["equipped_board_skin"] = item.get("cosmetic_id")
        profile_update = None
        if profile_skin_patch:
            profile_update = supabase.table("profiles").update(profile_skin_patch).eq("user_id", user_id).execute()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Equip failed: {exc}") from exc

    return {
        "equipped": True,
        "inventory_item": response.data[0] if response.data else item,
        "profile_skin_patch": profile_skin_patch,
        "profile": profile_update.data[0] if profile_update and profile_update.data else None,
    }


def require_admin_distribution_access(supabase, request: Request) -> str | None:
    if not is_supabase_configured():
        return None
    user_id = get_authenticated_user_id(request)
    try:
        response = supabase.table("profiles").select("is_admin").eq("user_id", user_id).single().execute()
    except Exception as exc:
        raise HTTPException(status_code=403, detail=f"Admin profile check failed: {exc}") from exc
    if not (response.data or {}).get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access is required to distribute leaderboard badges.")
    return user_id


def ensure_champion_badge_cosmetic(supabase, badge_id: str, city: str | None):
    try:
        supabase.table("cosmetics").upsert({
            "cosmetic_id": badge_id,
            "kind": "badge",
            "name": champion_badge_name(city),
            "rarity": "legendary" if (city or "Global").lower() == "global" else "epic",
            "price_essence": 0,
            "price_shards": 0,
            "target_faction_id": None,
            "preview_url": champion_badge_preview_url(city),
            "is_premium": True,
        }, on_conflict="cosmetic_id").execute()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Champion badge catalog update failed: {exc}") from exc


def grant_leaderboard_badge(supabase, user: dict, badge_id: str, scope: str) -> dict:
    user_id = str(user["user_id"])
    profile_response = supabase.table("profiles").select("owned_cosmetics,earned_badges").eq("user_id", user_id).single().execute()
    profile = profile_response.data or {}
    owned = set(profile.get("owned_cosmetics") or [])
    earned = set(profile.get("earned_badges") or [])
    already_owned = badge_id in owned or badge_id in earned
    owned.add(badge_id)
    earned.add(badge_id)
    profile_update = supabase.table("profiles").update({
        "owned_cosmetics": sorted(owned),
        "earned_badges": sorted(earned),
    }).eq("user_id", user_id).execute()
    inventory_item = None
    if not already_owned:
        inventory_response = supabase.table("inventory_items").upsert({
            "user_id": user_id,
            "cosmetic_id": badge_id,
            "is_equipped": False,
        }, on_conflict="user_id,cosmetic_id").execute()
        inventory_item = inventory_response.data[0] if inventory_response.data else None
        supabase.table("inventory_transactions").insert({
            "user_id": user_id,
            "source": "leaderboard_badge",
            "essence_delta": 0,
            "shards_delta": 0,
            "metadata": {"badge_id": badge_id, "scope": scope, "elo": pvp_elo(user)},
        }).execute()
        supabase.table("notifications").insert({
            "user_id": user_id,
            "type": "leaderboard_badge",
            "title": "Champion badge earned",
            "body": f"You earned the {champion_badge_name(scope)} for leading {scope}.",
            "metadata": {"badge_id": badge_id, "scope": scope, "elo": pvp_elo(user)},
        }).execute()
    return {
        "user_id": user_id,
        "username": user.get("username"),
        "city": user.get("city") or "Global",
        "elo": pvp_elo(user),
        "badge_id": badge_id,
        "scope": scope,
        "awarded": not already_owned,
        "profile": profile_update.data[0] if profile_update.data else None,
        "inventory_item": inventory_item,
    }


def cleanup_unearned_leaderboard_badges(supabase, profiles: list[dict], valid_badges_by_user: dict[str, set[str]]) -> list[dict]:
    cleaned = []
    for row in profiles:
        user_id = str(row.get("user_id"))
        allowed = valid_badges_by_user.get(user_id, set())
        owned = list(row.get("owned_cosmetics") or [])
        earned = list(row.get("earned_badges") or [])
        unearned = {
            item for item in owned + earned
            if is_leaderboard_badge_id(item) and item not in allowed
        }
        next_owned = sorted({item for item in owned if not is_leaderboard_badge_id(item) or item in allowed})
        next_earned = sorted({item for item in earned if not is_leaderboard_badge_id(item) or item in allowed})
        equipped_badge = row.get("equipped_badge")
        next_equipped_badge = equipped_badge if not equipped_badge or equipped_badge in next_earned else None
        if next_owned == owned and next_earned == earned and next_equipped_badge == equipped_badge:
            continue
        try:
            supabase.table("profiles").update({
                "owned_cosmetics": next_owned,
                "earned_badges": next_earned,
                "equipped_badge": next_equipped_badge,
            }).eq("user_id", user_id).execute()
            for badge_id in unearned:
                supabase.table("inventory_items").delete().eq("user_id", user_id).eq("cosmetic_id", badge_id).execute()
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Leaderboard badge cleanup failed: {exc}") from exc
        cleaned.append({
            "user_id": user_id,
            "removed_badges": sorted(unearned),
        })
    return cleaned


def distributeLeaderboardBadges(supabase, cities: list[str] | None = None) -> dict:
    try:
        response = supabase.table("profiles").select("user_id,username,city,pvp_stats,owned_cosmetics,earned_badges,equipped_badge").execute()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Leaderboard profile query failed: {exc}") from exc
    profiles = response.data or []
    ranked_players = [row for row in profiles if pvp_matches(row) > 0]
    if not ranked_players:
        cleaned = cleanup_unearned_leaderboard_badges(supabase, profiles, {})
        return {"distributed": [], "cleaned": cleaned, "skipped": "No ranked PvP players found."}
    award_candidates = []
    global_winner = max(ranked_players, key=pvp_elo)
    global_badge = city_badge_id("Global")
    ensure_champion_badge_cosmetic(supabase, global_badge, "Global")
    award_candidates.append({"user": global_winner, "badge_id": global_badge, "scope": "Global"})
    city_names = sorted(set(cities or KNOWN_CHAMPION_CITIES) | {row.get("city") for row in ranked_players if row.get("city")})
    for city in city_names:
        if not city or city == "Global":
            continue
        city_players = [row for row in ranked_players if str(row.get("city") or "").lower() == str(city).lower()]
        if not city_players:
            continue
        winner = max(city_players, key=pvp_elo)
        badge_id = city_badge_id(city)
        ensure_champion_badge_cosmetic(supabase, badge_id, city)
        award_candidates.append({"user": winner, "badge_id": badge_id, "scope": city})
    valid_badges_by_user: dict[str, set[str]] = {}
    for award in award_candidates:
        user_id = str(award["user"]["user_id"])
        valid_badges_by_user.setdefault(user_id, set()).add(award["badge_id"])
    cleaned = cleanup_unearned_leaderboard_badges(supabase, profiles, valid_badges_by_user)
    distributed = [
        grant_leaderboard_badge(supabase, award["user"], award["badge_id"], award["scope"])
        for award in award_candidates
    ]
    return {"distributed": distributed, "cleaned": cleaned}


@router.post("/leaderboard/distribute-badges")
def distribute_leaderboard_badges(request: Request):
    supabase = supabase_or_503()
    admin_user_id = require_admin_distribution_access(supabase, request)
    result = distributeLeaderboardBadges(supabase)
    return {"ok": True, "admin_user_id": admin_user_id, **result}


@router.get("/leaderboard/live")
def live_leaderboard(city: str = "Global", limit: int = Query(default=10, ge=1, le=100)):
    supabase = supabase_or_503()
    try:
        response = supabase.rpc("get_city_leaderboard", {"p_city": city, "p_limit": limit}).execute()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Leaderboard query failed: {exc}") from exc

    return {"city": city, "rows": response.data}


@router.post("/pro/interest")
def record_pro_interest(interest: ProInterestRequest, request: Request):
    supplied_user_id = str(interest.user_id) if interest.user_id else None
    owned_user_id = optional_owned_user_id(request, supplied_user_id)
    payload = {
        "user_id": owned_user_id,
        "source": interest.source,
        "selected_offer": interest.selected_offer,
        "metadata": interest.metadata,
    }
    if not is_supabase_configured():
        return {"ok": True, "stored": False, "interest": payload}
    supabase = supabase_or_503()
    try:
        response = supabase.table("pro_interest").insert(payload).execute()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Pro interest save failed: {exc}") from exc
    return {"ok": True, "stored": True, "interest": (response.data or [payload])[0]}
