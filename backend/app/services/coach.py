from typing import Any


FILES = "abcdefgh"
BOARD_SIZE = 8
CENTER_SQUARES = {"d4", "e4", "d5", "e5"}
COACH_SYSTEM_PROMPT = (
    "You are an expert Checkers coach for Aether Tactics. Analyze only the supplied board state, "
    "replay, recent moves, mode, result, and loadout. Give concise tactical advice about forced "
    "captures, multi-jumps, center control, promotion lanes, king activity, piece safety, and faction "
    "abilities. Do not invent moves that are not supported by the supplied context. Prefer concrete "
    "move references like c3xd4 when available. For retry moments, give encouraging tactical guidance "
    "that tells the player what pattern to look for, not random flavor text."
)


def analyze_replay(
    replay: list[dict[str, Any]],
    final_board: list[list[dict[str, Any] | None]] | None = None,
    recent_moves: list[dict[str, Any] | str] | None = None,
    retry_context: dict[str, Any] | None = None,
    system_prompt: str | None = None,
    result: str = "loss",
    mode: str = "ai",
    loadout: dict[str, Any] | None = None,
) -> dict[str, Any]:
    board = final_board or []
    recent = recent_moves or []
    context = build_coach_context(replay, board, recent, retry_context or {}, result, mode, loadout or {})
    review = build_review(context)
    retry_moment = build_retry_moment(context)
    return {
        "review": review[:5],
        "retry_moment": retry_moment,
        "coach_context": {
            "system_prompt": system_prompt or COACH_SYSTEM_PROMPT,
            "material": context["material"],
            "themes": context["themes"],
            "recent_moves": context["recent_moves"][:6],
        },
    }


def build_coach_context(
    replay: list[dict[str, Any]],
    board: list[list[dict[str, Any] | None]],
    recent_moves: list[dict[str, Any] | str],
    retry_context: dict[str, Any],
    result: str,
    mode: str,
    loadout: dict[str, Any],
) -> dict[str, Any]:
    white_moves = [move for move in replay if move.get("player") == "white"]
    captures = [move for move in replay if move.get("captured")]
    white_captures = [move for move in white_moves if move.get("captured")]
    missed_captures = [move for move in white_moves if as_int(move.get("captureOptions")) > 0 and not move.get("captured")]
    unsafe_moves = [move for move in white_moves if as_int(move.get("unsafeReplyCaptures")) > 0]
    chain_moments = [move for move in replay if as_int(move.get("chainOptions")) > 0]
    white_promotions = [move for move in white_moves if move.get("promoted")]
    king_moves = [move for move in white_moves if moved_piece_was_king(move)]
    center_entries = [move for move in white_moves if square_name(move.get("to")) in CENTER_SQUARES]
    board_stats = board_statistics(board)
    themes = []
    if missed_captures:
        themes.append("missed_capture")
    if chain_moments:
        themes.append("multi_capture")
    if unsafe_moves:
        themes.append("piece_safety")
    if white_promotions or board_stats["white_kings"]:
        themes.append("king_activity")
    if center_entries or board_stats["white_center"] != board_stats["black_center"]:
        themes.append("center_control")
    if not themes:
        themes.append("tempo")
    return {
        "replay": replay,
        "board": board,
        "recent_moves": normalize_recent_moves(recent_moves, replay),
        "retry_context": retry_context,
        "result": result,
        "mode": mode,
        "loadout": loadout,
        "material": board_stats,
        "white_moves": white_moves,
        "captures": captures,
        "white_captures": white_captures,
        "missed_captures": missed_captures,
        "unsafe_moves": unsafe_moves,
        "chain_moments": chain_moments,
        "white_promotions": white_promotions,
        "king_moves": king_moves,
        "center_entries": center_entries,
        "themes": themes,
    }


def build_review(context: dict[str, Any]) -> list[str]:
    material = context["material"]
    result = context["result"]
    lines: list[str] = []
    if result == "win":
        lines.append(
            f"Strong finish: you ended with {material['white_total']} Azure piece(s) against {material['black_total']} Amber piece(s), so the plan converted into material control."
        )
    else:
        lines.append(
            f"The loss came from tempo and material: final count was Azure {material['white_total']} vs Amber {material['black_total']}. Stabilize before chasing quiet moves."
        )

    if context["missed_captures"]:
        move = context["missed_captures"][0]
        lines.append(
            f"Move {move_label(move)}: a forced capture existed before {move_path(move)}. In checkers, scan every jump first, including backward captures."
        )
    elif context["chain_moments"]:
        move = context["chain_moments"][0]
        lines.append(
            f"Move {move_label(move)}: your jump opened {as_int(move.get('chainOptions'))} continuation(s). Keep the same piece moving until the capture chain is exhausted."
        )
    elif context["white_captures"]:
        lines.append(
            f"You landed {len(context['white_captures'])} capture(s). The next layer is arranging pieces so one capture becomes a double jump."
        )
    else:
        lines.append("You never forced a capture. Use paired diagonals to create contact, then attack the landing square behind the enemy piece.")

    if context["unsafe_moves"]:
        move = context["unsafe_moves"][0]
        lines.append(
            f"Safety warning at move {move_label(move)}: {move_path(move)} allowed {as_int(move.get('unsafeReplyCaptures'))} immediate reply capture(s). Choose landings that stay protected by a neighboring piece."
        )
    elif material["white_center"] >= material["black_center"]:
        lines.append("Center control was healthy: your pieces contested the d/e files, which reduces the opponent's safe diagonals.")
    else:
        lines.append("Amber owned more central squares. Re-enter the center with connected pieces instead of sending one piece alone to the edge.")

    if context["white_promotions"]:
        move = context["white_promotions"][0]
        lines.append(f"Promotion note: {move_path(move)} created a king. Once crowned, use long diagonals to attack from distance and defend both flanks.")
    elif material["white_kings"]:
        lines.append(f"You had {material['white_kings']} king(s). Kings should patrol long diagonals and threaten captures without standing next to enemy pieces.")
    else:
        lines.append("No Azure king appeared. Aim one runner at the promotion lane while the rest of the formation controls capture squares.")

    passive = context["loadout"].get("passiveId") or context["loadout"].get("passive_id")
    ultimate = context["loadout"].get("ultimateId") or context["loadout"].get("ultimate_id")
    if passive or ultimate:
        lines.append(loadout_advice(passive, ultimate, context))
    else:
        lines.append(f"Mode reviewed: {context['mode']}. Recent moves analyzed: {len(context['recent_moves'])}.")
    return lines


def build_retry_moment(context: dict[str, Any]) -> dict[str, Any] | None:
    retry_context = context["retry_context"]
    if retry_context.get("board"):
        return normalize_retry_context(retry_context, context)
    if context["missed_captures"]:
        move = context["missed_captures"][0]
        return retry_payload(
            move,
            "Find The Forced Capture",
            f"At move {move_label(move)}, {move_path(move)} skipped a mandatory jump. Replay the position and look two diagonal squares past an Amber piece.",
            "Capture the exposed Amber piece first; if another jump appears, keep the same piece moving.",
            "capture",
            "A correct retry starts with a capture. Nice find if the move lands beyond an enemy piece.",
            context,
        )
    if context["chain_moments"]:
        move = context["chain_moments"][0]
        return retry_payload(
            move,
            "Complete The Chain",
            f"After {move_path(move)}, the same piece still had a jump. Replay the board and continue the capture chain.",
            "Stay with the jumping piece. Multi-captures win material and remove counterplay.",
            "chain",
            "Better: continue the forced multi-capture instead of switching plans.",
            context,
        )
    if context["unsafe_moves"]:
        move = context["unsafe_moves"][0]
        return retry_payload(
            move,
            "Choose The Safe Landing",
            f"Move {move_label(move)} let Amber answer with {as_int(move.get('unsafeReplyCaptures'))} capture threat(s). Find a landing that cannot be jumped immediately.",
            "A safe retry either captures, moves into a protected diagonal, or leaves Amber with no immediate jump.",
            "safe",
            "Better moves leave no instant Amber capture. Use nearby Azure pieces as guards.",
            context,
        )
    if context["white_promotions"]:
        move = context["white_promotions"][0]
        return retry_payload(
            move,
            "Use The New King",
            f"{move_path(move)} promoted a king. Replay the position and choose a long diagonal plan that pressures two lanes.",
            "After promotion, avoid short passive moves. Make the king control a long diagonal.",
            "king_activity",
            "Good king play attacks from distance and keeps escape squares open.",
            context,
        )
    candidate = context["white_moves"][-1] if context["white_moves"] else None
    if not candidate:
        return None
    return retry_payload(
        candidate,
        "Improve The Formation",
        "Replay this position and find a move that improves center control or creates a future capture threat.",
        "Look for connected pieces near d4, e4, d5, or e5. Center control makes double jumps easier to set up.",
        "center",
        "A useful retry either occupies the center, protects a piece, or prepares a capture threat.",
        context,
    )


def retry_payload(move: dict[str, Any], title: str, prompt: str, tactical_tip: str, expected: str, better_hint: str, context: dict[str, Any]) -> dict[str, Any]:
    return {
        "moveIndex": move.get("turnIndex"),
        "title": title,
        "prompt": prompt,
        "betterHint": better_hint,
        "tacticalTip": tactical_tip,
        "expected": expected,
        "board": move.get("beforeBoard") or context["board"],
        "originalMove": {"from": move.get("from"), "to": move.get("to"), "captured": move.get("captured")},
        "focusAbilityId": context["loadout"].get("ultimateId") or context["loadout"].get("ultimate_id") or context["loadout"].get("passiveId") or "dash",
        "successCriteria": success_criteria(expected),
    }


def normalize_retry_context(retry_context: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    expected = retry_context.get("expected") or retry_context.get("theme") or "safe"
    return {
        "moveIndex": retry_context.get("moveIndex"),
        "title": retry_context.get("title") or "Retry The Turning Point",
        "prompt": retry_context.get("prompt") or "Replay the turning point and choose the most tactical move.",
        "betterHint": retry_context.get("betterHint") or "Use forcing moves first: captures, king pressure, then safe center control.",
        "tacticalTip": retry_context.get("tacticalTip") or "A better retry should improve material, safety, or center control.",
        "expected": expected,
        "board": retry_context.get("board"),
        "originalMove": retry_context.get("originalMove") or {},
        "focusAbilityId": retry_context.get("focusAbilityId") or context["loadout"].get("ultimateId") or "dash",
        "successCriteria": retry_context.get("successCriteria") or success_criteria(expected),
    }


def success_criteria(expected: str) -> list[str]:
    if expected == "capture":
        return ["must_capture"]
    if expected == "chain":
        return ["must_capture", "look_for_next_capture"]
    if expected == "king_activity":
        return ["use_king_or_promote", "control_long_diagonal"]
    if expected == "center":
        return ["improve_center", "avoid_reply_capture"]
    return ["avoid_reply_capture"]


def board_statistics(board: list[list[dict[str, Any] | None]]) -> dict[str, int]:
    stats = {
        "white_total": 0,
        "black_total": 0,
        "white_kings": 0,
        "black_kings": 0,
        "white_center": 0,
        "black_center": 0,
        "white_promotion_lanes": 0,
        "black_promotion_lanes": 0,
    }
    for row_index, row in enumerate(board or []):
        for col_index, piece in enumerate(row or []):
            if not piece:
                continue
            player = piece.get("player")
            if player not in {"white", "black"}:
                continue
            square = coord_to_square(row_index, col_index)
            stats[f"{player}_total"] += 1
            if piece.get("king"):
                stats[f"{player}_kings"] += 1
            if square in CENTER_SQUARES:
                stats[f"{player}_center"] += 1
            if player == "white" and row_index <= 2 and not piece.get("king"):
                stats["white_promotion_lanes"] += 1
            if player == "black" and row_index >= 5 and not piece.get("king"):
                stats["black_promotion_lanes"] += 1
    return stats


def normalize_recent_moves(recent_moves: list[dict[str, Any] | str], replay: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if recent_moves:
        normalized = []
        for index, move in enumerate(recent_moves):
            if isinstance(move, dict):
                normalized.append(move)
            else:
                normalized.append({"turnIndex": index + 1, "notation": str(move)})
        return normalized
    return [
        {
            "turnIndex": move.get("turnIndex"),
            "player": move.get("player"),
            "move": move_path(move),
            "captured": move.get("captured"),
            "promoted": bool(move.get("promoted")),
        }
        for move in replay[-8:]
    ]


def loadout_advice(passive: str | None, ultimate: str | None, context: dict[str, Any]) -> str:
    if ultimate == "dash":
        return "Loadout tip: Dash is strongest when it enters a square that threatens an immediate capture chain, not when it only moves faster."
    if ultimate in {"sandstorm_corridor", "barricade", "collapse"}:
        return "Loadout tip: board blockers should close landing squares after you create a capture threat, forcing Amber into bad tempo."
    if ultimate == "crown_surge":
        return "Loadout tip: Crown Surge should create a long-diagonal king that attacks and defends on the same move cycle."
    if ultimate == "phase_shift":
        return "Loadout tip: Phase Shift is best as a safety tool: leave a threatened diagonal and keep a counter-capture lined up."
    if passive == "open_roads":
        return "Loadout tip: Open Roads is a comeback passive. Use the backward move to reconnect pieces before the next forced capture."
    return f"Mode reviewed: {context['mode']}. Tie your passive and ultimate to one plan: center first, forced captures second, promotion third."


def moved_piece_was_king(move: dict[str, Any]) -> bool:
    board = move.get("beforeBoard") or []
    square = parse_square(move.get("from"))
    if not square:
        return False
    row, col = square
    piece = board[row][col] if row < len(board) and col < len(board[row]) else None
    return bool(piece and piece.get("king"))


def move_label(move: dict[str, Any]) -> str:
    return str(move.get("turnIndex") or "?")


def move_path(move: dict[str, Any]) -> str:
    separator = "x" if move.get("captured") else "-"
    return f"{move.get('from', '?')}{separator}{move.get('to', '?')}"


def square_name(value: Any) -> str:
    if isinstance(value, str):
        return value.lower()
    if isinstance(value, dict) and "row" in value and "col" in value:
        return coord_to_square(value["row"], value["col"])
    return ""


def parse_square(value: Any) -> tuple[int, int] | None:
    if not isinstance(value, str) or len(value) < 2:
        return None
    file_index = FILES.find(value[0].lower())
    try:
        rank = int(value[1:])
    except ValueError:
        return None
    row = BOARD_SIZE - rank
    if file_index < 0 or row < 0 or row >= BOARD_SIZE:
        return None
    return row, file_index


def coord_to_square(row: int, col: int) -> str:
    if col < 0 or col >= BOARD_SIZE:
        return ""
    return f"{FILES[col]}{BOARD_SIZE - row}"


def as_int(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0
