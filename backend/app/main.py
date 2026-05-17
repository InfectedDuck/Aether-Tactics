import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import database, game, multiplayer

app = FastAPI(
    title="Aether Tactics API",
    version="0.1.0",
    description="Backend API for Aether Tactics: factions, campaign data, leaderboard, and future auth/database integrations.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        *([os.getenv("FRONTEND_ORIGIN")] if os.getenv("FRONTEND_ORIGIN") else []),
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(game.router, prefix="/api", tags=["game"])
app.include_router(database.router, prefix="/api", tags=["database"])
app.include_router(multiplayer.router, prefix="/api", tags=["multiplayer"])


@app.get("/")
def root():
    return {
        "name": "Aether Tactics API",
        "status": "online",
        "docs": "/docs",
    }
