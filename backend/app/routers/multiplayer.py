import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect

from app.schemas.database import MultiplayerRoomCreate
from app.services.auth import get_authenticated_user_id
from app.services.supabase_client import get_supabase_service_client, is_supabase_configured

router = APIRouter()

rooms: dict[str, dict[str, Any]] = {}
connections: dict[str, list[WebSocket]] = {}
connection_meta: dict[int, dict[str, str]] = {}
challenge_connections: dict[str, list[WebSocket]] = {}
pending_challenges: dict[str, dict[str, Any]] = {}
queues: dict[str, list[dict[str, Any]]] = {"fast": [], "ranked": []}
matchmaking_tickets: dict[str, dict[str, Any]] = {}


def resolve_multiplayer_user_id(request: Request, supplied_user_id: str | None = None) -> str:
    authenticated_user_id = get_authenticated_user_id(request)
    if authenticated_user_id:
        if supplied_user_id and str(supplied_user_id) != authenticated_user_id:
            raise HTTPException(status_code=403, detail="Cannot join multiplayer as another commander.")
        return authenticated_user_id
    if not supplied_user_id:
        raise HTTPException(status_code=401, detail="A multiplayer user id is required.")
    return str(supplied_user_id)


def make_room_code() -> str:
    while True:
        code = secrets.token_hex(3).upper()
        if code not in rooms:
            return code


def normalize_game_variant(value: str | None = "power") -> str:
    normalized = str(value or "power").strip().lower()
    return "classic" if normalized in {"basic", "classic", "standard"} else "power"


def normalize_queue_loadout(loadout: Any) -> dict[str, str]:
    if not isinstance(loadout, dict):
        loadout = {}
    return {
        "factionId": str(loadout.get("factionId") or loadout.get("faction_id") or "nomads"),
        "passiveId": str(loadout.get("passiveId") or loadout.get("passive_id") or "open_roads"),
        "ultimateId": str(loadout.get("ultimateId") or loadout.get("ultimate_id") or "dash"),
    }


def matchmaking_player_payload(user_id: str, role: str, loadout: dict[str, str], profile: dict[str, Any] | None = None, skin_ids: dict[str, Any] | None = None) -> dict[str, Any]:
    profile = profile or {}
    return {
        "user_id": str(user_id),
        "role": role,
        "username": profile.get("username") or profile.get("name") or ("Host" if role == "host" else "Guest"),
        "avatar": profile.get("avatar") or "",
        "profile_picture_url": profile.get("profile_picture_url") or "",
        "city": profile.get("city") or "Global",
        "level": profile.get("level") or 1,
        "bio": profile.get("bio") or "",
        "loadout": loadout,
        "skinIds": skin_ids or {},
        "ready": True,
        "connected": True,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/multiplayer/rooms")
def create_room(room_request: MultiplayerRoomCreate, request: Request):
    user_id = resolve_multiplayer_user_id(request, str(room_request.user_id))
    room_code = make_room_code()
    game_variant = normalize_game_variant(room_request.game_variant)
    loadout = normalize_queue_loadout(room_request.loadout)
    rooms[room_code] = {
        "room_code": room_code,
        "mode": room_request.mode,
        "game_variant": game_variant,
        "loadout": loadout,
        "host_user_id": user_id,
        "guest_user_id": None,
        "status": "waiting",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_state": None,
        "lobby_players": {
            "host": matchmaking_player_payload(user_id, "host", loadout),
        },
    }
    return {"room": rooms[room_code]}


@router.get("/multiplayer/rooms/{room_code}")
def get_room(room_code: str):
    room = rooms.get(room_code.upper())
    if not room:
        return {"room": None}
    return {"room": room}


@router.post("/multiplayer/queue/{queue_mode}")
def join_queue(queue_mode: str, room_request: MultiplayerRoomCreate, request: Request):
    mode = queue_mode if queue_mode in queues else "fast"
    user_id = resolve_multiplayer_user_id(request, str(room_request.user_id))
    game_variant = normalize_game_variant(room_request.game_variant)
    loadout = normalize_queue_loadout(room_request.loadout)
    previous_ticket = matchmaking_tickets.get(user_id)
    if previous_ticket and previous_ticket.get("status") == "matched":
        room = rooms.get(previous_ticket.get("room_code", ""))
        if room:
            return {"status": "matched", "role": previous_ticket.get("role", "host"), "ticket": previous_ticket, "room": room}
    queues[mode] = [ticket for ticket in queues[mode] if ticket["user_id"] != user_id and matchmaking_tickets.get(ticket["user_id"], {}).get("status") == "searching"]
    deferred: list[dict[str, Any]] = []
    while queues[mode]:
        opponent = queues[mode].pop(0)
        if opponent["user_id"] == user_id:
            continue
        opponent_ticket = matchmaking_tickets.get(opponent["user_id"])
        if not opponent_ticket or opponent_ticket.get("status") != "searching":
            continue
        if normalize_game_variant(opponent_ticket.get("game_variant")) != game_variant:
            deferred.append(opponent)
            continue
        room_code = opponent["room_code"]
        room = rooms.get(room_code)
        if not room or room.get("status") not in {"waiting", "searching"}:
            continue
        queues[mode] = deferred + queues[mode]
        opponent_loadout = normalize_queue_loadout(opponent_ticket.get("loadout") or opponent.get("loadout"))
        room["guest_user_id"] = user_id
        room["status"] = "ready"
        room["players"] = [opponent["user_id"], user_id]
        room["game_variant"] = game_variant
        room["loadout"] = opponent_loadout
        room["guest_loadout"] = loadout
        room["lobby_players"] = {
            "host": matchmaking_player_payload(opponent["user_id"], "host", opponent_loadout),
            "guest": matchmaking_player_payload(user_id, "guest", loadout),
        }
        room["updated_at"] = datetime.now(timezone.utc).isoformat()
        opponent_ticket.update({"status": "matched", "role": "host", "room_code": room_code, "matched_user_id": user_id, "matched_at": room["updated_at"], "game_variant": game_variant, "loadout": opponent_loadout})
        guest_ticket = {"user_id": user_id, "mode": mode, "game_variant": game_variant, "loadout": loadout, "room_code": room_code, "status": "matched", "role": "guest", "matched_user_id": opponent["user_id"], "queued_at": datetime.now(timezone.utc).isoformat(), "matched_at": room["updated_at"]}
        matchmaking_tickets[user_id] = guest_ticket
        return {"status": "matched", "role": "guest", "ticket": guest_ticket, "room": room}
    queues[mode] = deferred + queues[mode]
    room_code = make_room_code()
    rooms[room_code] = {
        "room_code": room_code,
        "mode": mode,
        "game_variant": game_variant,
        "loadout": loadout,
        "host_user_id": user_id,
        "guest_user_id": None,
        "status": "searching",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_state": None,
        "players": [user_id],
        "lobby_players": {
            "host": matchmaking_player_payload(user_id, "host", loadout),
        },
    }
    ticket = {"user_id": user_id, "mode": mode, "game_variant": game_variant, "loadout": loadout, "room_code": room_code, "status": "searching", "role": "host", "queued_at": datetime.now(timezone.utc).isoformat()}
    matchmaking_tickets[user_id] = ticket
    queues[mode].append(ticket)
    return {"status": "searching", "role": "host", "ticket": ticket, "room": rooms[room_code]}


@router.get("/multiplayer/queue/status")
def queue_status(user_id: str, request: Request, mode: str = "fast", room_code: str | None = None):
    owned_user_id = resolve_multiplayer_user_id(request, user_id)
    ticket = matchmaking_tickets.get(owned_user_id)
    if not ticket or (mode in queues and ticket.get("mode") != mode):
        room = rooms.get((room_code or "").upper()) if room_code else None
        if room and owned_user_id in {str(room.get("host_user_id")), str(room.get("guest_user_id"))}:
            role = "host" if str(room.get("host_user_id")) == owned_user_id else "guest"
            status = "matched" if room.get("guest_user_id") else room.get("status", "searching")
            return {"status": status, "role": role, "ticket": None, "room": room}
        return {"status": "idle", "ticket": None, "room": None}
    room = rooms.get(ticket.get("room_code", ""))
    if not room:
        ticket["status"] = "expired"
        return {"status": "expired", "ticket": ticket, "room": None}
    if room.get("guest_user_id") and ticket.get("status") == "searching":
        ticket["status"] = "matched"
        ticket["role"] = "host" if str(room.get("host_user_id")) == owned_user_id else "guest"
        ticket["matched_at"] = room.get("updated_at") or datetime.now(timezone.utc).isoformat()
    return {"status": ticket.get("status", room.get("status", "searching")), "role": ticket.get("role", "host"), "ticket": ticket, "room": room}


@router.delete("/multiplayer/queue")
def cancel_queue(user_id: str, request: Request):
    owned_user_id = resolve_multiplayer_user_id(request, user_id)
    removed = 0
    for mode in queues:
        before = len(queues[mode])
        queues[mode] = [ticket for ticket in queues[mode] if ticket["user_id"] != owned_user_id]
        removed += before - len(queues[mode])
    if owned_user_id in matchmaking_tickets:
        matchmaking_tickets[owned_user_id]["status"] = "cancelled"
    for room in rooms.values():
        if room.get("host_user_id") == owned_user_id and room.get("status") in {"waiting", "searching"} and not room.get("guest_user_id"):
            room["status"] = "abandoned"
    return {"cancelled": removed > 0}


@router.websocket("/ws/rooms/{room_code}")
async def room_socket(websocket: WebSocket, room_code: str, user_id: str, role: str = "guest", token: str | None = None, piece_skin: str | None = None, board_skin: str | None = None, phase: str = "match"):
    code = room_code.upper()
    await websocket.accept()
    if is_supabase_configured() and token:
        try:
            user_response = get_supabase_service_client().auth.get_user(token or "")
            auth_user_id = str(user_response.user.id)
        except Exception:
            await websocket.close(code=1008, reason="Invalid Supabase session.")
            return
        if auth_user_id != str(user_id):
            await websocket.close(code=1008, reason="User id does not match Supabase token.")
            return
    room = rooms.setdefault(code, {
        "room_code": code,
        "mode": "private",
        "game_variant": "power",
        "loadout": normalize_queue_loadout({}),
        "host_user_id": user_id if role == "host" else None,
        "guest_user_id": None,
        "status": "waiting",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_state": None,
        "player_skin_ids": {},
        "lobby_players": {},
    })
    if role == "host":
        room["host_user_id"] = user_id
    if role != "host" and not room.get("guest_user_id"):
        room["guest_user_id"] = user_id
        room["status"] = "ready"
    room.setdefault("player_skin_ids", {})[str(user_id)] = {
        "piece": piece_skin or "",
        "board": board_skin or "",
    }
    connections.setdefault(code, []).append(websocket)
    connection_meta[id(websocket)] = {"user_id": str(user_id), "role": role, "phase": phase, "room_code": code}
    upsert_lobby_player(room, str(user_id), role, {
        "profile": {"user_id": str(user_id), "username": "Host" if role == "host" else "Guest"},
        "skinIds": {"piece": piece_skin or "", "board": board_skin or ""},
    }, connected=True)
    if phase == "match" and room.get("host_user_id") and room.get("guest_user_id") and room.get("status") != "finished":
        room["status"] = "in_match"
        room["updated_at"] = datetime.now(timezone.utc).isoformat()
    await broadcast(code, {"type": "room_state", "room": public_room_payload(room)})
    await broadcast_room_updated(code, room)
    if room.get("last_state"):
        await websocket.send_json({"type": "relay", "from": "server", "payload": {"type": "board_state", "state": room["last_state"]}})
    try:
        while True:
            payload = await websocket.receive_json()
            if payload.get("type") in {"join_room", "lobby_join", "lobby_update"}:
                payload_ready = payload.get("ready")
                if payload_ready is None and isinstance(payload.get("profile"), dict):
                    payload_ready = payload["profile"].get("ready")
                ready_value = bool(payload_ready) if payload_ready is not None else None
                upsert_lobby_player(room, str(user_id), payload.get("role") or role, payload, connected=True, ready=ready_value)
                await broadcast_room_updated(code, room)
                continue
            if payload.get("type") == "player_ready":
                upsert_lobby_player(room, str(user_id), payload.get("role") or role, payload, connected=True, ready=bool(payload.get("ready")))
                await broadcast_room_updated(code, room)
                if lobby_ready_to_start(room):
                    room["status"] = "starting"
                    room["updated_at"] = datetime.now(timezone.utc).isoformat()
                    await broadcast_room_updated(code, room)
                    await broadcast(code, {"type": "match_start", "room": public_room_payload(room), "players": lobby_players_list(room)})
                continue
            if payload.get("type") in {"leave_room", "lobby_leave"}:
                if room.get("status") == "in_match" or room.get("last_state"):
                    await finish_room_by_forfeit(code, room, str(user_id), str(payload.get("reason") or "disconnect"))
                else:
                    slot = mark_lobby_player_left(room, str(user_id), payload.get("role") or role)
                    await broadcast(code, {"type": "player_left", "user_id": str(user_id), "role": slot, "room": public_room_payload(room), "players": lobby_players_list(room), "message": "Commander left the room."})
                    await broadcast_room_updated(code, room)
                continue
            if payload.get("type") == "forfeit":
                await finish_room_by_forfeit(code, room, str(user_id), str(payload.get("reason") or "forfeit"))
                continue
            if payload.get("type") == "sync_request":
                upsert_lobby_player(room, str(user_id), payload.get("role") or role, payload, connected=True)
                if payload.get("skinIds"):
                    room.setdefault("player_skin_ids", {})[str(user_id)] = payload.get("skinIds") or {}
                await broadcast(code, {"type": "room_state", "room": public_room_payload(room)})
                if room.get("last_state"):
                    await websocket.send_json({"type": "relay", "from": "server", "payload": {"type": "board_state", "state": room["last_state"]}})
                continue
            if payload.get("type") == "board_state":
                state = payload.get("state") or {}
                if state.get("skinIds"):
                    room.setdefault("player_skin_ids", {})[str(user_id)] = state.get("skinIds") or {}
                if state.get("loadout"):
                    upsert_lobby_player(room, str(user_id), payload.get("role") or role, {
                        "loadout": state.get("loadout"),
                        "skinIds": state.get("skinIds") or {},
                    }, connected=True)
                expected = expected_user_for_turn(room)
                if payload.get("reason") in {"move", "finish"} and expected and expected != str(user_id):
                    await websocket.send_json({"type": "move_rejected", "reason": "It is not your turn in this room."})
                    continue
                if payload.get("reason") == "move" and not validate_move_payload(room, str(user_id), payload):
                    await websocket.send_json({"type": "move_rejected", "reason": "Server rejected an invalid board transition."})
                    continue
                room["last_state"] = payload.get("state")
                if payload.get("reason") == "move":
                    room["status"] = "in_match"
                if payload.get("reason") not in {"finish"} and room.get("status") == "starting":
                    room["status"] = "in_match"
                if payload.get("reason") == "finish":
                    room["status"] = "finished"
            await broadcast(code, {"type": "relay", "from": user_id, "payload": payload})
    except WebSocketDisconnect:
        connections[code] = [item for item in connections.get(code, []) if item is not websocket]
        connection_meta.pop(id(websocket), None)
        if has_active_room_connection(code, str(user_id), "match" if phase == "match" else None):
            await broadcast_room_updated(code, room)
            return
        slot = lobby_slot_for(room, str(user_id), role)
        if phase == "match" and (room.get("status") == "in_match" or (room.get("last_state") and room.get("status") not in {"finished"})):
            await finish_room_by_forfeit(code, room, str(user_id), "disconnect")
            return
        if room.get("status") not in {"starting", "finished"} and room.get("lobby_players", {}).get(slot):
            mark_lobby_player_left(room, str(user_id), role)
            await broadcast(code, {"type": "player_left", "user_id": str(user_id), "role": slot, "room": public_room_payload(room), "players": lobby_players_list(room), "message": "Commander left the room."})
        if not connections[code]:
            if room.get("status") not in {"finished", "starting", "in_match"}:
                room["status"] = "abandoned" if room.get("last_state") else "waiting"
        await broadcast(code, {"type": "room_state", "room": room})
        await broadcast_room_updated(code, room)


@router.websocket("/ws/challenges")
async def challenge_socket(websocket: WebSocket, user_id: str, token: str | None = None):
    await websocket.accept()
    if is_supabase_configured() and token:
        try:
            user_response = get_supabase_service_client().auth.get_user(token or "")
            auth_user_id = str(user_response.user.id)
        except Exception:
            await websocket.close(code=1008, reason="Invalid Supabase session.")
            return
        if auth_user_id != str(user_id):
            await websocket.close(code=1008, reason="User id does not match Supabase token.")
            return
    challenge_connections.setdefault(str(user_id), []).append(websocket)
    await websocket.send_json({"type": "challenge_connected", "user_id": str(user_id)})
    try:
        while True:
            payload = await websocket.receive_json()
            event_type = payload.get("type")
            if event_type == "challenge_send":
                await handle_challenge_send(str(user_id), payload)
                continue
            if event_type == "challenge_decline":
                await handle_challenge_decline(str(user_id), payload)
                continue
            if event_type == "challenge_accept":
                await handle_challenge_accept(str(user_id), payload)
                continue
    except WebSocketDisconnect:
        challenge_connections[str(user_id)] = [item for item in challenge_connections.get(str(user_id), []) if item is not websocket]


async def handle_challenge_send(sender_id: str, payload: dict[str, Any]):
    target_id = str(payload.get("target_user_id") or "")
    if not target_id or target_id == sender_id:
        await send_challenge_event(sender_id, {"type": "challenge_unavailable", "reason": "Invalid duel target."})
        return
    challenge_id = secrets.token_hex(8)
    challenge = {
        "challenge_id": challenge_id,
        "from_user_id": sender_id,
        "target_user_id": target_id,
        "from_profile": payload.get("from_profile") or {},
        "target_profile": payload.get("target_profile") or {},
        "loadout": payload.get("loadout") or {},
        "skinIds": payload.get("skinIds") or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
    }
    pending_challenges[challenge_id] = challenge
    if not challenge_connections.get(target_id):
        pending_challenges.pop(challenge_id, None)
        await send_challenge_event(sender_id, {"type": "challenge_unavailable", "challenge": challenge, "reason": "Commander is not online."})
        return
    await send_challenge_event(sender_id, {"type": "challenge_waiting", "challenge": challenge})
    await send_challenge_event(target_id, {"type": "challenge_received", "challenge": challenge})


async def handle_challenge_decline(user_id: str, payload: dict[str, Any]):
    challenge_id = str(payload.get("challenge_id") or "")
    challenge = pending_challenges.pop(challenge_id, None)
    if not challenge:
        await send_challenge_event(user_id, {"type": "challenge_cleared", "reason": "Challenge expired."})
        return
    if user_id not in {str(challenge.get("target_user_id")), str(challenge.get("from_user_id"))}:
        return
    challenge["status"] = "declined"
    await send_challenge_event(str(challenge["from_user_id"]), {"type": "challenge_declined", "challenge": challenge})
    await send_challenge_event(str(challenge["target_user_id"]), {"type": "challenge_cleared", "challenge": challenge})


async def handle_challenge_accept(user_id: str, payload: dict[str, Any]):
    challenge_id = str(payload.get("challenge_id") or "")
    challenge = pending_challenges.pop(challenge_id, None)
    if not challenge:
        await send_challenge_event(user_id, {"type": "challenge_cleared", "reason": "Challenge expired."})
        return
    if user_id != str(challenge.get("target_user_id")):
        return
    room_code = make_room_code()
    host_id = str(challenge["from_user_id"])
    guest_id = str(challenge["target_user_id"])
    host_loadout = normalize_queue_loadout(challenge.get("loadout"))
    guest_loadout = normalize_queue_loadout(payload.get("loadout"))
    host_skin_ids = challenge.get("skinIds") or {}
    guest_skin_ids = payload.get("skinIds") or {}
    rooms[room_code] = {
        "room_code": room_code,
        "mode": "private",
        "game_variant": "power",
        "loadout": host_loadout,
        "guest_loadout": guest_loadout,
        "host_user_id": host_id,
        "guest_user_id": guest_id,
        "status": "ready",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_state": None,
        "players": [host_id, guest_id],
        "challenge_id": challenge_id,
        "player_skin_ids": {
            host_id: host_skin_ids,
            guest_id: guest_skin_ids,
        },
        "lobby_players": {
            "host": matchmaking_player_payload(host_id, "host", host_loadout, challenge.get("from_profile") or {}, host_skin_ids),
            "guest": matchmaking_player_payload(guest_id, "guest", guest_loadout, payload.get("target_profile") or challenge.get("target_profile") or {}, guest_skin_ids),
        },
    }
    start_payload = {
        "type": "challenge_start",
        "challenge": {**challenge, "status": "accepted"},
        "room": rooms[room_code],
        "room_code": room_code,
        "room_url": f"/lobby/{room_code}",
    }
    await send_challenge_event(host_id, {**start_payload, "role": "host"})
    await send_challenge_event(guest_id, {**start_payload, "role": "guest", "target_profile": payload.get("target_profile") or {}})


async def send_challenge_event(user_id: str, payload: dict[str, Any]):
    stale: list[WebSocket] = []
    for connection in challenge_connections.get(str(user_id), []):
        try:
            await connection.send_json(payload)
        except Exception:
            stale.append(connection)
    if stale:
        challenge_connections[str(user_id)] = [item for item in challenge_connections.get(str(user_id), []) if item not in stale]


def upsert_lobby_player(room: dict[str, Any], user_id: str, role: str, payload: dict[str, Any], connected: bool = True, ready: bool | None = None):
    players = room.setdefault("lobby_players", {})
    slot = "host" if role == "host" else "guest"
    previous = players.get(slot, {})
    if not previous:
        legacy = players.pop(str(user_id), None)
        previous = legacy or {}
    profile = payload.get("profile") or payload.get("player") or previous
    loadout = normalize_queue_loadout(payload.get("loadout") or profile.get("loadout") or previous.get("loadout") or {})
    skin_ids = payload.get("skinIds") or payload.get("skin_ids") or profile.get("skinIds") or previous.get("skinIds") or {}
    variant = payload.get("gameVariant") or payload.get("game_variant")
    if variant:
        room["game_variant"] = normalize_game_variant(variant)
    if slot == "host":
        room["host_user_id"] = str(user_id)
        room["loadout"] = loadout
    elif not room.get("guest_user_id") or room.get("guest_user_id") == str(user_id) or players.get("guest", {}).get("user_id") == str(user_id) or not players.get("guest", {}).get("connected", True):
        room["guest_user_id"] = str(user_id)
        room["guest_loadout"] = loadout
    elif slot == "guest":
        room["guest_loadout"] = loadout
    room.setdefault("player_skin_ids", {})[str(user_id)] = skin_ids
    players[slot] = {
        **previous,
        "user_id": str(user_id),
        "role": slot,
        "username": profile.get("username") or profile.get("name") or previous.get("username") or ("Host" if slot == "host" else "Guest"),
        "avatar": profile.get("avatar") or previous.get("avatar") or "",
        "profile_picture_url": profile.get("profile_picture_url") or previous.get("profile_picture_url") or "",
        "city": profile.get("city") or previous.get("city") or "Global",
        "level": profile.get("level") or previous.get("level") or 1,
        "bio": profile.get("bio") or previous.get("bio") or "",
        "loadout": loadout,
        "skinIds": skin_ids,
        "ready": previous.get("ready", False) if ready is None else ready,
        "connected": connected,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    if connected and room.get("status") == "abandoned":
        if slot == "host":
            room["status"] = "waiting"
        elif players.get("host", {}).get("connected"):
            room["status"] = "configuring"
    host_ready = players.get("host", {}).get("ready", False)
    guest_ready = players.get("guest", {}).get("ready", False)
    if room.get("guest_user_id") and room.get("status") in {"waiting", "ready"}:
        room["status"] = "configuring"
    if host_ready and guest_ready and room.get("guest_user_id") and room.get("status") not in {"in_match", "finished"}:
        room["status"] = "starting"
    room["updated_at"] = datetime.now(timezone.utc).isoformat()


def lobby_players_list(room: dict[str, Any]) -> list[dict[str, Any]]:
    players = list((room.get("lobby_players") or {}).values())
    order = {"host": 0, "guest": 1}
    return sorted(players, key=lambda player: (order.get(player.get("role"), 9), player.get("joined_at") or player.get("updatedAt") or ""))


def public_room_payload(room: dict[str, Any]) -> dict[str, Any]:
    return {
        "room_code": room.get("room_code"),
        "mode": room.get("mode", "private"),
        "game_variant": normalize_game_variant(room.get("game_variant")),
        "loadout": normalize_queue_loadout(room.get("loadout")),
        "guest_loadout": normalize_queue_loadout(room.get("guest_loadout")) if room.get("guest_loadout") else None,
        "host_user_id": room.get("host_user_id"),
        "guest_user_id": room.get("guest_user_id"),
        "status": room.get("status"),
        "created_at": room.get("created_at"),
        "updated_at": room.get("updated_at"),
        "players": room.get("players") or [],
        "player_skin_ids": room.get("player_skin_ids") or {},
        "lobby_players": room.get("lobby_players") or {},
        "forfeit": room.get("forfeit"),
    }


async def broadcast_room_updated(room_code: str, room: dict[str, Any]):
    await broadcast(room_code, {"type": "room_updated", "room": public_room_payload(room), "players": lobby_players_list(room)})


def lobby_ready_to_start(room: dict[str, Any]) -> bool:
    players = room.get("lobby_players") or {}
    host = players.get("host")
    guest = players.get("guest")
    return bool(host and guest and host.get("connected") and guest.get("connected") and host.get("ready") and guest.get("ready"))


def lobby_slot_for(room: dict[str, Any], user_id: str, role_hint: str | None = None) -> str:
    normalized_user_id = str(user_id)
    if str(room.get("host_user_id") or "") == normalized_user_id:
        return "host"
    if str(room.get("guest_user_id") or "") == normalized_user_id:
        return "guest"
    players = room.get("lobby_players") or {}
    for slot in ("host", "guest"):
        if str(players.get(slot, {}).get("user_id") or "") == normalized_user_id:
            return slot
    return "host" if role_hint == "host" else "guest"


def mark_lobby_player_left(room: dict[str, Any], user_id: str, role_hint: str | None = None) -> str:
    slot = lobby_slot_for(room, user_id, role_hint)
    players = room.setdefault("lobby_players", {})
    if players.get(slot):
        players[slot]["connected"] = False
        players[slot]["ready"] = False
        players[slot]["updatedAt"] = datetime.now(timezone.utc).isoformat()
    if room.get("status") not in {"starting", "in_match", "finished"}:
        room["status"] = "abandoned" if slot == "host" else "waiting"
    room["updated_at"] = datetime.now(timezone.utc).isoformat()
    return slot


def build_forfeit_payload(room: dict[str, Any], loser_user_id: str, reason: str = "forfeit") -> dict[str, Any] | None:
    loser_slot = lobby_slot_for(room, loser_user_id)
    winner_slot = "guest" if loser_slot == "host" else "host"
    winner_user_id = str(room.get(f"{winner_slot}_user_id") or "")
    if not winner_user_id:
        return None
    loser_color = "white" if loser_slot == "host" else "black"
    winner_color = "white" if winner_slot == "host" else "black"
    message = "Opponent resigned. You win by forfeit." if reason == "forfeit" else "Opponent left the room. You win by forfeit."
    room["status"] = "finished"
    room["forfeit"] = {
        "reason": reason,
        "loser_user_id": str(loser_user_id),
        "winner_user_id": winner_user_id,
        "loser_color": loser_color,
        "winner_color": winner_color,
        "finished_at": datetime.now(timezone.utc).isoformat(),
    }
    previous_state = room.get("last_state") or {}
    room["last_state"] = {
        **previous_state,
        "winner": winner_color,
        "resultLabel": "Forfeit",
        "message": message,
    }
    room["updated_at"] = datetime.now(timezone.utc).isoformat()
    return {
        "reason": reason,
        "loser_user_id": str(loser_user_id),
        "winner_user_id": winner_user_id,
        "loser_color": loser_color,
        "winner_color": winner_color,
        "state": room.get("last_state") or {},
        "room": public_room_payload(room),
        "message": message,
    }


async def finish_room_by_forfeit(room_code: str, room: dict[str, Any], loser_user_id: str, reason: str = "forfeit"):
    payload = build_forfeit_payload(room, loser_user_id, reason)
    if not payload:
        slot = mark_lobby_player_left(room, loser_user_id)
        await broadcast(room_code, {"type": "player_left", "user_id": str(loser_user_id), "role": slot, "room": public_room_payload(room), "message": "Commander left the room."})
        await broadcast_room_updated(room_code, room)
        return
    mark_lobby_player_left(room, loser_user_id)
    room["status"] = "finished"
    await broadcast(room_code, {"type": "match_forfeit", **payload})
    await broadcast_room_updated(room_code, room)


def has_active_room_connection(room_code: str, user_id: str, phase: str | None = None) -> bool:
    for connection in connections.get(room_code, []):
        meta = connection_meta.get(id(connection)) or {}
        if meta.get("user_id") == str(user_id) and (phase is None or meta.get("phase") == phase):
            return True
    return False


async def broadcast(room_code: str, payload: dict[str, Any]):
    stale: list[WebSocket] = []
    for connection in connections.get(room_code, []):
        try:
            await connection.send_json(payload)
        except RuntimeError:
            stale.append(connection)
    if stale:
        connections[room_code] = [item for item in connections.get(room_code, []) if item not in stale]
        for connection in stale:
            connection_meta.pop(id(connection), None)


def expected_user_for_turn(room: dict[str, Any]) -> str | None:
    state = room.get("last_state") or {}
    turn = state.get("turn", "white")
    if turn == "white":
        return room.get("host_user_id")
    return room.get("guest_user_id")


def validate_move_payload(room: dict[str, Any], user_id: str, payload: dict[str, Any]) -> bool:
    previous = room.get("last_state")
    state = payload.get("state") or {}
    action_type = get_action_type(payload)
    if not previous or not previous.get("board"):
        if normalize_game_variant(room.get("game_variant")) != "power":
            replay = state.get("moveReplay") or []
            move = replay[-1] if replay else None
            if action_type == "ability_cast" or (move and (move.get("powerId") or move.get("passiveId"))):
                return False
        return True
    previous_replay = previous.get("moveReplay") or []
    replay = state.get("moveReplay") or []
    if normalize_game_variant(room.get("game_variant")) != "power":
        if action_type == "ability_cast":
            return False
        move = replay[-1] if len(replay) == len(previous_replay) + 1 and replay else None
        if move and (move.get("powerId") or move.get("passiveId")):
            return False
    if action_type == "ability_cast":
        return validate_ability_payload(room, user_id, payload)
    if len(replay) != len(previous_replay) + 1:
        return False
    move = replay[-1]
    expected_player = "white" if room.get("host_user_id") == user_id else "black"
    if move.get("player") != expected_player:
        return False
    try:
        return is_legal_transition(previous.get("board"), state.get("board"), move, previous.get("turn", "white"), previous)
    except Exception:
        return False


def get_action_type(payload: dict[str, Any]) -> str:
    state = payload.get("state") or {}
    return str(payload.get("actionType") or payload.get("action_type") or state.get("actionType") or state.get("action_type") or "standard_move")


def validate_ability_payload(room: dict[str, Any], user_id: str, payload: dict[str, Any]) -> bool:
    previous = room.get("last_state") or {}
    state = payload.get("state") or {}
    previous_board = previous.get("board")
    next_board = state.get("board")
    if not previous_board or not next_board:
        return False
    expected_player = "white" if room.get("host_user_id") == user_id else "black"
    turn = previous.get("turn", "white")
    if expected_player != turn:
        return False
    action = payload.get("action") or state.get("abilityAction") or {}
    replay = state.get("moveReplay") or []
    previous_replay = previous.get("moveReplay") or []
    move = replay[-1] if len(replay) == len(previous_replay) + 1 and replay else None
    ability_id = str(action.get("abilityId") or action.get("ability_id") or (move or {}).get("powerId") or (move or {}).get("passiveId") or "")
    if not ability_id:
        return False
    if move:
        if move.get("player") != expected_player:
            return False
        return validate_ability_move_transition(previous_board, next_board, move, turn, ability_id, previous)
    if replay != previous_replay:
        return False
    if ability_id == "crown_surge":
        return validate_crown_surge(previous_board, next_board, action, turn)
    if ability_id == "fortify":
        return validate_fortify(previous_board, next_board, state, action, turn)
    if ability_id in {"sandstorm_corridor", "barricade", "collapse"}:
        return validate_board_control_ability(previous_board, next_board, state, action, ability_id)
    return False


def validate_ability_move_transition(previous_board: list[list[Any]], next_board: list[list[Any]], move: dict[str, Any], turn: str, ability_id: str, previous_state: dict[str, Any] | None = None) -> bool:
    if ability_id == "dash":
        return validate_dash_transition(previous_board, next_board, move, turn)
    if ability_id == "phase_shift":
        return validate_phase_shift_transition(previous_board, next_board, move, turn)
    if ability_id == "open_roads":
        return validate_open_roads_transition(previous_board, next_board, move, turn)
    if ability_id == "sun_lance":
        return validate_sun_lance_transition(previous_board, next_board, move, turn, previous_state)
    return False


def validate_sun_lance_transition(previous_board: list[list[Any]], next_board: list[list[Any]], move: dict[str, Any], turn: str, previous_state: dict[str, Any] | None = None) -> bool:
    from_square = coord_to_square(move.get("from"))
    to_square = coord_to_square(move.get("to"))
    captured_square = coord_to_square(move.get("captured")) if move.get("captured") else None
    if not from_square or not to_square or not captured_square:
        return False
    from_row, from_col = from_square
    to_row, to_col = to_square
    piece = previous_board[from_row][from_col]
    if not piece or piece.get("player") != turn or piece.get("king") or previous_board[to_row][to_col]:
        return False
    row_delta = to_row - from_row
    col_delta = to_col - from_col
    if abs(row_delta) != abs(col_delta) or abs(row_delta) < 2:
        return False
    if not is_square_between(from_square, to_square, captured_square):
        return False
    if not diagonal_path_clear(previous_board, from_square, to_square, captured_square):
        return False
    captured_row, captured_col = captured_square
    captured = previous_board[captured_row][captured_col]
    if not captured or captured.get("player") == turn:
        return False
    if is_protected_capture_target(captured_square, captured, previous_state):
        return False
    if next_board[captured_row][captured_col] is not None or next_board[from_row][from_col] is not None:
        return False
    moved_piece = next_board[to_row][to_col]
    return bool(moved_piece and moved_piece.get("id") == piece.get("id"))


def validate_dash_transition(previous_board: list[list[Any]], next_board: list[list[Any]], move: dict[str, Any], turn: str) -> bool:
    from_square = coord_to_square(move.get("from"))
    to_square = coord_to_square(move.get("to"))
    if not from_square or not to_square or move.get("captured"):
        return False
    from_row, from_col = from_square
    to_row, to_col = to_square
    piece = previous_board[from_row][from_col]
    if not piece or piece.get("player") != turn or piece.get("king") or previous_board[to_row][to_col]:
        return False
    if abs(to_row - from_row) != 2 or abs(to_col - from_col) != 2:
        return False
    return moved_piece_matches(previous_board, next_board, from_square, to_square)


def validate_phase_shift_transition(previous_board: list[list[Any]], next_board: list[list[Any]], move: dict[str, Any], turn: str) -> bool:
    from_square = coord_to_square(move.get("from"))
    to_square = coord_to_square(move.get("to"))
    if not from_square or not to_square or move.get("captured"):
        return False
    from_row, from_col = from_square
    to_row, to_col = to_square
    piece = previous_board[from_row][from_col]
    if not piece or piece.get("player") != turn or piece.get("king") or previous_board[to_row][to_col] or not is_dark_square(to_row, to_col):
        return False
    if max(abs(to_row - from_row), abs(to_col - from_col)) > 3:
        return False
    if to_row == from_row and to_col == from_col:
        return False
    return moved_piece_matches(previous_board, next_board, from_square, to_square)


def validate_open_roads_transition(previous_board: list[list[Any]], next_board: list[list[Any]], move: dict[str, Any], turn: str) -> bool:
    from_square = coord_to_square(move.get("from"))
    to_square = coord_to_square(move.get("to"))
    if not from_square or not to_square or move.get("captured"):
        return False
    from_row, from_col = from_square
    to_row, to_col = to_square
    piece = previous_board[from_row][from_col]
    if not piece or piece.get("player") != turn or piece.get("king") or previous_board[to_row][to_col]:
        return False
    direction = -1 if turn == "white" else 1
    if to_row - from_row != -direction or abs(to_col - from_col) != 1:
        return False
    return moved_piece_matches(previous_board, next_board, from_square, to_square)


def validate_crown_surge(previous_board: list[list[Any]], next_board: list[list[Any]], action: dict[str, Any], turn: str) -> bool:
    target = first_action_square(action)
    if not target:
        return False
    row, col = target
    piece = previous_board[row][col]
    next_piece = next_board[row][col]
    if not piece or piece.get("player") != turn or piece.get("king") or row < 2 or row > 5:
        return False
    if not next_piece or next_piece.get("id") != piece.get("id") or next_piece.get("player") != turn or not next_piece.get("king"):
        return False
    return all_unchanged_except(previous_board, next_board, {target})


def validate_fortify(previous_board: list[list[Any]], next_board: list[list[Any]], state: dict[str, Any], action: dict[str, Any], turn: str) -> bool:
    target = first_action_square(action)
    if not target or not boards_equal(previous_board, next_board):
        return False
    row, col = target
    piece = previous_board[row][col]
    if not piece or piece.get("player") != turn:
        return False
    protected = state.get("protectedSquares") or state.get("protected_squares") or []
    return any(coord_to_square(item.get("coord") if isinstance(item, dict) else item) == target or (isinstance(item, dict) and item.get("row") == row and item.get("col") == col) for item in protected)


def validate_board_control_ability(previous_board: list[list[Any]], next_board: list[list[Any]], state: dict[str, Any], action: dict[str, Any], ability_id: str) -> bool:
    if not boards_equal(previous_board, next_board):
        return False
    targets = action_squares(action)
    needed = 1 if ability_id == "collapse" else 2
    if len(targets) != needed:
        return False
    blocked = state.get("blockedSquares") or state.get("blocked_squares") or []
    blocked_squares = {square_from_any(item) for item in blocked}
    for target in targets:
        row, col = target
        if not is_dark_square(row, col) or previous_board[row][col] is not None or target not in blocked_squares:
            return False
    return True


def moved_piece_matches(previous_board: list[list[Any]], next_board: list[list[Any]], from_square: tuple[int, int], to_square: tuple[int, int]) -> bool:
    from_row, from_col = from_square
    to_row, to_col = to_square
    piece = previous_board[from_row][from_col]
    if next_board[from_row][from_col] is not None:
        return False
    moved_piece = next_board[to_row][to_col]
    if not moved_piece or moved_piece.get("id") != piece.get("id"):
        return False
    return all_unchanged_except(previous_board, next_board, {from_square, to_square})


def all_unchanged_except(previous_board: list[list[Any]], next_board: list[list[Any]], changed: set[tuple[int, int]]) -> bool:
    for row in range(8):
        for col in range(8):
            if (row, col) in changed:
                continue
            if previous_board[row][col] != next_board[row][col]:
                return False
    return True


def boards_equal(left: list[list[Any]], right: list[list[Any]]) -> bool:
    return left == right


def first_action_square(action: dict[str, Any]) -> tuple[int, int] | None:
    squares = action_squares(action)
    return squares[0] if squares else None


def action_squares(action: dict[str, Any]) -> list[tuple[int, int]]:
    raw_targets = action.get("targets") or action.get("targetSquares") or action.get("target_squares")
    if raw_targets is None:
        raw_targets = [action.get("target") or action.get("square")]
    return [square for square in (square_from_any(item) for item in raw_targets) if square]


def square_from_any(value: Any) -> tuple[int, int] | None:
    if isinstance(value, str):
        return coord_to_square(value)
    if isinstance(value, dict):
        if "coord" in value:
            return coord_to_square(value.get("coord"))
        if "row" in value and "col" in value:
            try:
                row = int(value.get("row"))
                col = int(value.get("col"))
            except (TypeError, ValueError):
                return None
            if 0 <= row <= 7 and 0 <= col <= 7:
                return row, col
    return None


def is_legal_transition(previous_board: list[list[Any]], next_board: list[list[Any]], move: dict[str, Any], turn: str, previous_state: dict[str, Any] | None = None) -> bool:
    from_square = coord_to_square(move.get("from"))
    to_square = coord_to_square(move.get("to"))
    if not from_square or not to_square:
        return False
    from_row, from_col = from_square
    to_row, to_col = to_square
    piece = previous_board[from_row][from_col]
    if not piece or piece.get("player") != turn:
        return False
    if previous_board[to_row][to_col]:
        return False
    row_delta = to_row - from_row
    col_delta = to_col - from_col
    is_king = bool(piece.get("king"))
    captured_square = coord_to_square(move.get("captured")) if move.get("captured") else None
    if captured_square:
        if abs(row_delta) != abs(col_delta) or abs(row_delta) < 2:
            return False
        if not is_square_between((from_row, from_col), (to_row, to_col), captured_square):
            return False
        mid_row, mid_col = captured_square
        if not is_king:
            if abs(row_delta) != 2 or abs(col_delta) != 2:
                return False
            if (from_row + sign(row_delta), from_col + sign(col_delta)) != captured_square:
                return False
        elif not diagonal_path_clear(previous_board, (from_row, from_col), (to_row, to_col), captured_square):
            return False
        captured = previous_board[mid_row][mid_col]
        if not captured or captured.get("player") == turn:
            return False
        if is_protected_capture_target(captured_square, captured, previous_state):
            return False
        if next_board[mid_row][mid_col] is not None:
            return False
    elif move.get("powerId") in {"dash"}:
        if abs(row_delta) != 2 or abs(col_delta) != 2:
            return False
    elif move.get("powerId") in {"phase_shift"}:
        if max(abs(row_delta), abs(col_delta)) > 3 or (row_delta == 0 and col_delta == 0):
            return False
    else:
        direction = -1 if turn == "white" else 1
        if is_king:
            if abs(row_delta) != abs(col_delta) or abs(row_delta) < 1:
                return False
            if not diagonal_path_clear(previous_board, (from_row, from_col), (to_row, to_col)):
                return False
        elif abs(col_delta) != 1 or row_delta != direction:
            return False
    if next_board[from_row][from_col] is not None:
        return False
    moved_piece = next_board[to_row][to_col]
    return bool(moved_piece and moved_piece.get("id") == piece.get("id"))


def is_protected_capture_target(square: tuple[int, int], piece: dict[str, Any], previous_state: dict[str, Any] | None = None) -> bool:
    protected = (previous_state or {}).get("protectedSquares") or (previous_state or {}).get("protected_squares") or []
    row, col = square
    piece_id = piece.get("id")
    for item in protected:
        if isinstance(item, dict):
            if item.get("pieceId") and item.get("pieceId") == piece_id:
                return True
            if not item.get("pieceId") and item.get("row") == row and item.get("col") == col:
                return True
            if not item.get("pieceId") and coord_to_square(item.get("coord")) == square:
                return True
        elif coord_to_square(item) == square:
            return True
    return False


def sign(value: int) -> int:
    return 1 if value > 0 else -1


def is_square_between(start: tuple[int, int], end: tuple[int, int], square: tuple[int, int]) -> bool:
    start_row, start_col = start
    end_row, end_col = end
    row, col = square
    row_delta = end_row - start_row
    col_delta = end_col - start_col
    if abs(row_delta) != abs(col_delta) or row_delta == 0:
        return False
    if abs(row - start_row) != abs(col - start_col):
        return False
    return sign(row_delta) == sign(row - start_row) and sign(col_delta) == sign(col - start_col) and 0 < abs(row - start_row) < abs(row_delta)


def diagonal_path_clear(board: list[list[Any]], start: tuple[int, int], end: tuple[int, int], ignored: tuple[int, int] | None = None) -> bool:
    start_row, start_col = start
    end_row, end_col = end
    row_delta = end_row - start_row
    col_delta = end_col - start_col
    if abs(row_delta) != abs(col_delta) or row_delta == 0:
        return False
    row_step = sign(row_delta)
    col_step = sign(col_delta)
    row = start_row + row_step
    col = start_col + col_step
    while (row, col) != (end_row, end_col):
        if (row, col) != ignored and board[row][col] is not None:
            return False
        row += row_step
        col += col_step
    return True


def coord_to_square(coord: str | None) -> tuple[int, int] | None:
    if not coord or len(coord) < 2:
        return None
    files = "abcdefgh"
    file_index = files.find(coord[0].lower())
    try:
        rank = int(coord[1:])
    except ValueError:
        return None
    row = 8 - rank
    if file_index < 0 or row < 0 or row > 7:
        return None
    return row, file_index


def is_dark_square(row: int, col: int) -> bool:
    return (row + col) % 2 == 1
