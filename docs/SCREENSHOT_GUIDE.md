# Screenshot Guide

All screenshots in `docs/screenshots/` are captured from the real app running
locally, logged in with the showcase **Demo Commander** account (all factions + 999999 Shards, mid-season Battle Pass, seeded coach report). They are `.jpg` (quality 80, 1600×900) to keep the repo light.

## Regenerate (Windows PowerShell)

You need Node 20+, the repo's `frontend/node_modules`, and Playwright +
Chrome. The capture script lives outside the repo so it never pollutes it:

```powershell
# 1. one-time setup (temp dir, not committed)
New-Item -ItemType Directory -Path "$env:LOCALAPPDATA\Temp\opencode\shots" -Force
cd "$env:LOCALAPPDATA\Temp\opencode\shots"
npm init -y
npm install playwright@1.64.1
# uses your installed Google Chrome, no browser download needed
```

```powershell
# 2. start backend + frontend (two processes)
$api = Start-Process -FilePath "py" -ArgumentList "-3.12","-m","uvicorn","app.main:app","--port","8000" `
  -WorkingDirectory "C:\Users\ASUS\Desktop\checkeras\backend" -PassThru
$vite = Start-Process -FilePath "C:\Programming\node.js\node.exe" `
  -ArgumentList "node_modules\vite\bin\vite.js","--host","127.0.0.1","--port","5173" `
  -WorkingDirectory "C:\Users\ASUS\Desktop\checkeras\frontend" -PassThru
```

```powershell
# 3. run captures (see capture.mjs: /login -> "Explore as Demo Commander" click,
#    then one screenshot per route into docs/screenshots/)
& "C:\Programming\node.js\node.exe" "$env:LOCALAPPDATA\Temp\opencode\shots\capture.mjs"
```

```powershell
# 4. stop servers
Stop-Process -Id $vite.Id -Force
Stop-Process -Id $api.Id -Force
```

## Why the terminal shows `[vite] http proxy error: ECONNREFUSED`

`frontend/vite.config.js` proxies `/api/*` to `http://localhost:8000`.
If the backend isn't running you get `ECONNREFUSED` lines and the app falls
back to local demo content (plus an honest "Backend offline" notice since
Phase 2). **Always start the backend first** (step 2) before capturing or
developing. Without Supabase keys, DB-backed routes return 503 and the UI
shows local content — expected for screenshots.

## Shot list

| File | Route | Shows |
| --- | --- | --- |
| `00-gateway-login.jpg` | `/login` | Gateway + Explore as Demo Commander |
| `01-nexus-core-menu.jpg` | `/menu` | Nexus Core hub, Play/Collection/Progress/System groups |
| `02-skirmish-config.jpg` | `/skirmish` | Classic vs Power, AI difficulties, loadout |
| `03-battlefield-3d.jpg` | `/play/ai` | 3D board mid-match, Cosmos skins, hints |
| `05-campaign-trails.jpg` | `/campaign` | Faction campaign paths |
| `06-daily-tactic.jpg` | `/daily` | Daily puzzle, streak |
| `07-coach-report.jpg` | `/match/summary` | Post-match coach report |
| `09-collection-shop.jpg` | `/collection` | Merged Vault shop + Equip tabs |
| `11b-battle-pass.jpg` | `/battle-pass` | Founder season lanes/tiers |
| `12-multiplayer.jpg` | `/multiplayer` | Single queue (Fast/Ranked), private lobbies, leaderboard |
| `13-profile.jpg` | `/profile` | Commander profile |
| `14-settings.jpg` | `/settings` | Audio/music/theme/motion settings |
| `15-codex-factions.jpg` | `/codex` | Faction lore + abilities |
| `16-admin-dashboard.jpg` | `/admin` | Admin QA dashboard (demo only) |

## Conventions

- Viewport 1600×900, Demo Commander session (showcase progress preloaded).
- Re-capture after any nav/visual change; keep filenames stable.
- Prefer `.jpg` quality 80; keep each file under ~300 KB.
