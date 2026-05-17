from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.content import get_campaign, get_campaigns, get_factions, get_seed_leaderboard

router = APIRouter()


class LeaderboardResult(BaseModel):
    player_name: str = Field(min_length=1, max_length=24)
    city: str = Field(min_length=1, max_length=32)
    wins: int = 0
    losses: int = 0
    captures: int = 0
    puzzles: int = 0


leaderboard_overrides: list[dict] = []


@router.get("/health")
def health():
    return {"ok": True}


@router.get("/factions")
def factions():
    return {"factions": get_factions()["factions"]}


@router.get("/campaigns/nomads")
def nomads_campaign():
    return get_campaign("nomads")


@router.get("/campaigns/{campaign_id}")
def faction_campaign(campaign_id: str):
    return get_campaign(campaign_id)


@router.get("/leaderboard")
def leaderboard(city: str = "Almaty"):
    rows = [*get_seed_leaderboard(), *leaderboard_overrides]
    if city != "Global":
        rows = [row for row in rows if row["city"] == city]
    rows.sort(key=lambda row: score(row), reverse=True)
    return {"city": city, "rows": rows[:10]}


@router.post("/leaderboard")
def save_result(result: LeaderboardResult):
    entry = {
        "id": f"local-{result.city.lower()}-{result.player_name.lower()}",
        "name": result.player_name,
        "city": result.city,
        "wins": result.wins,
        "losses": result.losses,
        "captures": result.captures,
        "puzzles": result.puzzles,
    }
    leaderboard_overrides.append(entry)
    return {"saved": True, "entry": entry}


@router.get("/bootstrap")
def bootstrap(city: str = "Almaty"):
    rows = [*get_seed_leaderboard(), *leaderboard_overrides]
    if city != "Global":
        rows = [row for row in rows if row["city"] == city]
    rows.sort(key=lambda row: score(row), reverse=True)
    return {
        "factions": get_factions()["factions"],
        "campaign": get_campaign("nomads"),
        "campaigns": get_campaigns(),
        "leaderboard": rows[:10],
    }


def score(row: dict) -> int:
    return (
        int(row.get("wins", 0)) * 30
        + int(row.get("puzzles", 0)) * 12
        + int(row.get("captures", 0)) * 2
        - int(row.get("losses", 0)) * 5
    )
