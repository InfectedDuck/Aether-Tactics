import json
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


@lru_cache(maxsize=8)
def read_json(name: str) -> dict:
    with (DATA_DIR / name).open("r", encoding="utf-8") as file:
        return json.load(file)


def get_factions() -> dict:
    return read_json("factions.json")


def get_campaign(campaign_id: str) -> dict:
    campaigns = read_json("campaigns.json")
    return campaigns[campaign_id]


def get_campaigns() -> dict:
    return read_json("campaigns.json")


def get_seed_leaderboard() -> list[dict]:
    return read_json("leaderboard.json")["rows"]
