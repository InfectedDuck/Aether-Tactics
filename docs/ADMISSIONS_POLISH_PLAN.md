# Admissions Polish Plan — Aether Tactics

Goal: make the project **look as beautiful as possible in screenshots** for an admissions office.
Not a launch plan. No popularizing, no scaling, no monetization work.

Success = an admissions reader opens the README, sees 6–8 stunning screenshots,
understands what was built in 60 seconds, and clicks the live demo with a curated path.

Saved: 2026-10-19. Branch: `cleanup/nav-simplify`. Scope is frontend visuals + README + screenshots only.

## Non-Goals (explicitly out of scope)

- No Redis / Supabase Realtime migration for multiplayer.
- No auth hardening, no payments, no analytics, no SEO/marketing.
- No new game modes, no new factions, no balance changes.
- No `App.jsx` full refactor — only visual-safe extractions if needed for polish.
- Backend changes only if a screen shows an error/offline state in a screenshot.

## Demo Story (what admissions will see, in order)

Admissions won't explore randomly. The README + screenshots tell one path:

1. Gateway (`/login`) — premium first impression.
2. Nexus Core (`/menu`) — "this is a real product, not a board."
3. 3D Battlefield (`/play/ai`) — wow shot.
4. Campaign (`/campaign`) — depth / design thinking.
5. Coach Report (`/match/summary`) — "AI coaching" differentiator.
6. Collection (`/collection`) — art + systems thinking.
7. Battle Pass (`/battle-pass`) — retention / product thinking.
8. Codex (`/codex`) — world-building / craft.

Every phase below serves this 8-shot story. If a change doesn't improve one of these shots or the README, skip it.

---

## Phase 0 — Curated Demo State (0.5 day)

Why first: ugly screenshots are usually bad data, not bad CSS. Lock the demo account before polishing CSS.

- [x] Define `ADMIN_CORE` canonical state: Level 30, 999999 Shards, all factions unlocked, 1 equipped premium 3D skin (Cosmos Relic), 1 premium board (Obsidian & Gold or Neon), completed Nomads trail with 3 stars, 1 finished AI match with full coach report, Battle Pass at tier 4–5 with 2 claimable rewards visible, 3 achievements unlocked, city = Almaty.
- [x] Remove/hide anything that photographs badly: "Backend offline" banner, empty leaderboards, `16-admin-dashboard` from public README (keep file, drop from story), debug text, `ECONNREFUSED` fallbacks.
- [x] Decide backend for captures: run local backend + frontend per `docs/SCREENSHOT_GUIDE.md` so no 503 fallback UI appears in shots.
- [x] Freeze shot list + filenames (keep current 17 files, README shows only the best 8 above).

Acceptance: opening `/menu` as `ADMIN_CORE` shows zero empty states, zero error banners.

## Phase 1 — Visual Polish (2–3 days, biggest impact)

Work in `frontend/src/App.jsx` + `frontend/src/styles.css` only. No logic changes.

### 1A. Global art direction (half day, affects all shots)
- [x] Lock palette + type scale: 1 accent (Azure), 1 warm (Amber), 1 bg gradient, consistent card radius/shadow. Remove one-off colors.
- [x] Fix spacing rhythm: shared page max-width, shared header (`profile-topbar`) padding, shared footer (`FooterPlayer`) on all 8 story screens.
- [x] Typography pass: screen titles (Collection, Coach Report, Codex) same size/weight; body text contrast check on dark boards.
- [x] Button consistency: primary / secondary / ghost styles identical on Gateway, Skirmish, Multiplayer.

### 1B. Hero screens (1–1.5 days)
- [x] Gateway `/login`: center logo, tighten hero copy to 2 lines, make `Admin Demo Access` look intentional (not a debug button).
- [x] Nexus Core `/menu`: Play / Collection / Progress / System groups with icons aligned; remove dead links; ensure hover states read at 1600×900.
- [x] 3D Battlefield `/play/ai`: default camera angle + Cosmos skins + Obsidian board as default for captures; stronger selected-move / capture hints; vignette + bloom-feel via lighting (no new deps); hide WebGL fallback text unless WebGL truly fails.
- [x] Coach Report `/match/summary`: the "smart" shot — best-move diagram, focus + ability impact side-by-side, Retry Moment CTA prominent. This screen sells "AI coaching" so it must look designed, not like a log dump.

### 1C. Supporting screens (1 day)
- [x] Campaign `/campaign` + `/campaign/nomads`: sector cards with art visible without scrolling at 1600×900; star states crisp.
- [x] Collection `/collection`: Shop|Equip tabs obvious; equipped badge + price + preview aligned; no clipped art.
- [x] Battle Pass `/battle-pass`: free/pro lanes readable; current tier highlighted; reward icons not pixelated.
- [x] Codex `/codex`: faction art at full bleed, ability icons in a grid — this is the craft shot.
- [x] Profile `/profile` + Settings `/settings`: keep clean but they are NOT in top-8; timebox to 1 hour total.

Acceptance: each of the 8 story screens looks intentional at 1600×900 with no scrolling needed to understand it.

## Phase 2 — Screenshots + README for Admissions (1–1.5 days)

### 2A. Re-capture
- [x] Follow `docs/SCREENSHOT_GUIDE.md` (backend first, then Vite, Playwright + Chrome, 1600×900, `.jpg` q80, `<300KB`).
- [x] Re-shoot all 8 story shots + keep `02-skirmish-config`, `06-daily-tactic`, `12-multiplayer`, `13-profile` as secondary.
- [ ] (skipped — optional, not needed for 60-second read) Optional wow extras (only if cheap): 1 short GIF of a 3D capture chain, 1 GIF of Phase Shift. No video editing.
- [x] Delete or move blurry/duplicate shots (`03b-battlefield-shell`, `05b-campaign-map`, `11-progress` if redundant).

### 2B. README rewrite (admissions-first)
New order — hook first, setup last:

1. Title + one-line hook: "Asymmetrical checkers with faction powers, AI coaching, and collectible board identity."
2. 8-shot grid (story order above) with 1-line captions explaining *what each proves*.
3. "Try this in 2 minutes" — 4 steps using live Vercel link + Admin Demo.
4. "What I built" — engine, 3D/2D renderers, AI coach, multiplayer MVP, Vault economy, Battle Pass. 1 bullet each, no jargon walls.
5. "What I learned" — 3–4 lines (state sync, server validation, economy atomicity with `purchase_cosmetic` RPC, graceful offline fallback). Admissions love reflection.
6. Architecture diagram (keep existing mermaid) + tech stack badges.
7. Live links + run-locally collapsed to bottom (`<details>`).

- [x] Keep `Future Production Hardening` but rename to `If I kept going` — 3 bullets max, shows awareness without pretending to launch.
- [x] Proofread for admissions tone: confident, no "MVP", no "honest fallback", no backend error talk.

Acceptance: a non-technical reader gets the project in 60 seconds from README screenshots + headers alone.

## Phase 3 — Final QA (half day)

- [x] Fresh-clone check: `npm install` + `npm run build` passes, Vercel link opens `/menu`, backend `/api/health` + `/docs` respond.
- [x] Click-through of 8-shot story on the deployed link (not just localhost).
- [x] `git status` clean, screenshots under size limit, filenames stable, `legacy-prototype/` untouched.
- [x] Merge `cleanup/nav-simplify` → `master` or leave branch with PR description = admissions summary.

---

## Shot List Map (filename → story role)

| File | Route | Story role | Polish priority |
| --- | --- | --- | --- |
| `01-nexus-core-menu.jpg` | `/menu` | Product breadth | P0 |
| `03-battlefield-3d.jpg` | `/play/ai` | Wow / craft | P0 |
| `07-coach-report.jpg` | `/match/summary` | Differentiator | P0 |
| `09-collection-shop.jpg` | `/collection` | Systems + art | P0 |
| `11b-battle-pass.jpg` | `/battle-pass` | Product thinking | P1 |
| `05-campaign-trails.jpg` | `/campaign` | Depth | P1 |
| `15-codex-factions.jpg` | `/codex` | World-building | P1 |
| `00-gateway-login.jpg` | `/login` | First impression | P1 |
| `02-skirmish-config.jpg` | `/skirmish` | Secondary | P2 |
| `06-daily-tactic.jpg` | `/daily` | Secondary | P2 |

## Risks / Notes

- `App.jsx` is ~12k lines, `styles.css` ~12k lines — keep edits CSS-first to avoid breaking game logic before screenshots.
- 3D shots depend on GPU — capture on the strongest machine available; keep 2D fallback clean as backup wow shot.
- Do not chase multiplayer beauty — admissions will not test 2-account sync; one clean `12-multiplayer.jpg` is enough.
