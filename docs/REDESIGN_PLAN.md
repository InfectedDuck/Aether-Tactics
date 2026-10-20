# Client Redesign — Implementation Plan

Source design: `docs/design/aether-tactics-client-redesign.pdf` (12 pages: app shell, Play, Battle Pass track + missions, Collection shop + inventory, Factions loadout, post-match, component sheet).

Goal: reskin and restructure the client UI to match the design **without changing game logic, backend calls, or URLs**. One clear primary action per screen, one navigation surface, no nested bordered boxes.

## Ground rules

- **Do not touch:** `src/game/checkers.js`, `Battlefield3DBoard`, `Board`, `BattlefieldMatch` gameplay logic, `src/api/client.js`, anything in `backend/` or `supabase/`.
- **Keep every existing URL and route id** (`routeFromPath`, `AUTH_REQUIRED_ROUTES`, `NEXUS_ROUTES` ids). Old URLs like `/vault`, `/inventory`, `/progression` must still open the right screen (redirect to the new tab).
- **Keep all props, handlers and data flow.** New components receive the same data the old screens did (`profile`, `battlePass`, `vaultItems`, `inventoryItems`, `onPurchase`, `onEquip`, `onClaim`, ...).
- `src/App.jsx` is ~12k lines. **Put new UI in new files** under `src/ui/` and import them; don't grow App.jsx.
- **New CSS goes in new files** (`src/styles/tokens.css`, `shell.css`, `components.css`, one file per screen), imported in `main.jsx` **after** `styles.css`. Scope new classes with a prefix (`at-`) so old styles can't leak in. Delete old CSS blocks only after the screen that used them is replaced.
- After every phase: `npm run build` passes, then check the page at 1440, 1024 and 390 px wide.

## Phase 0 — Tokens and fonts (do first)

1. `index.html`: replace Orbitron/Inter with **Manrope (400–800)** and **Audiowide**.
2. `src/styles/tokens.css` — copy exactly from the component sheet (page 12):
   - Surfaces: bg `#0A0D14`, panel `#0D111B`, surface `#121826`, raised `#182033`, hover `#222C42`, border `#1E2638`, inner group fill `#0F1420`
   - Text: `#ECEFF6` / `#A7B0C4` / `#7C869C` / disabled `#5C667D`
   - Gold `#FFB81C`, hover `#FFC94D`, pressed `#E6A00F`, tint `rgba(255,184,28,.12)`, on-gold `#1B1300`
   - Factions: Nomads `#E0A458`, Iron Guard `#8FB3D9`, Sun Court `#F59E3D`, Void Order `#A98BFA`
   - Rarity: common `#8C95A8`, rare `#4C9DFF`, epic `#9B6BFF`, legendary `#FFB81C`
   - Shards `#3CC8E0`, Essence `#F5A524`, online `#34D399`, in-match `#F59E0B`
   - Spacing 4/8/12/16/24/32/48/64; radii 8 (chips), 12 (buttons, tier nodes), 16 (cards), pill
   - Type: page title Audiowide 32; hero Manrope 800 40/1.1; section 700 20; card title 700 15; body 400 15/1.5; caption 13; overline 700 12 caps
   - Motion: 150 ms color/border transitions, 2 px hover lift, glow pulse for claimable; all disabled under `prefers-reduced-motion`
3. Add `formatCompact(n)` helper: `640`, `2,480`, `99,999`, then `100K`, `999K`, `1.2M`; full value in `title` tooltip.

## Phase 1 — Shared components (`src/ui/`)

Build these once, then use them everywhere:

| Component | Notes |
| --- | --- |
| `Button` | variants `primary`, `secondary`, `soft` (soft gold: Claim / Pro / Invite), `ghost`; sizes 48 / 44 / 32; sentence case |
| `Tabs` | page tabs with optional count badge (`Missions 4/10`) |
| `Segmented` | in-place list switch (`Daily · 2/5 | Weekly · 2/5`) |
| `FilterChips` | selected / default / disabled; horizontal scroll on mobile |
| `CurrencyPill` | Shards = crystal icon, Essence = drop icon, uses `formatCompact` |
| `RarityTag`, `RarityStrip` | 3 px strip on item cards |
| `ProgressBar` | variants: pass (10 px), segmented (campaign sectors), mission (gold in progress, green done) |
| `ItemCard` | 16:10 image, rarity strip, name, "rarity · type", price **or** Owned / Equipped |
| `TierNode` | 120×140 `<button>`; state classes `tn--claimed`, `tn--claimable`, `tn--locked`, `tn--prolocked`, `tn--future`, `tn--selected` |
| `MissionRow` | icon · title + hint · progress · reward chip; rows share one surface with 1 px dividers |
| `DetailPanel` | right side panel on desktop, bottom sheet on mobile (< 720 px) |
| `PageHeader` | top-level: title only. Second-level: back arrow + breadcrumb (`Play / Skirmish`) |

## Phase 2 — App shell (biggest win, do before any screen)

`src/ui/AppShell.jsx` wraps every top-level screen:

- **Top bar 64 px:** logo (goes to Play) · Essence + Shards pills · Friends (online count) · notification bell with count · avatar.
- **Primary nav, 5 items:** Play, Battle Pass (badge when a reward is claimable), Collection, Factions, Social. Settings pinned to bottom of the rail.
  - ≥ 1100 px: 232 px rail with labels. 720–1099: 80 px icon rail with tooltips. < 720: bottom tab bar (72 px).
- **Notifications popover** from the bell (invite → Join lobby / Dismiss, reward → Open Battle Pass, "Mark all read").
- **Profile menu** from the avatar: level + EXP bar, Profile & achievements, Settings, **Developer mode** toggle, Sign out.
- **Hide** ADMIN / SHOWCASE badges unless Developer mode is on; then show one small `Dev · Admin · Showcase` chip next to the logo.
- **Remove** `AppGlobalBackButton` (the floating BACK pill) and every duplicate `<` header button. Only second-level pages get the back arrow.
- Match screen (`BattlefieldMatch`) and post-match render **without** the rail (full-focus), top bar only.

Route → nav mapping:

| Nav item | Routes it owns |
| --- | --- |
| Play | `nexus`, `single`, `skirmish`, `campaign`, `daily-puzzle`, `multiplayer` |
| Battle Pass | `battle-pass` (tabs: Track, Missions) |
| Collection | `collection`, `vault` → Shop tab, `inventory` → Inventory tab |
| Factions | `loadout`, `factions`, `codex` (tabs: Loadout, Codex) |
| Social | friends, requests, player search, city leaderboard (moved out of the Nexus side column and the multiplayer screen) |
| Profile menu | `progression`, `progress`, profile, achievements |

## Phase 3 — Screens, in priority order

### 3.1 Battle Pass (pages 4–6) — replaces `BattlePassDashboard` + the BP part of `ProgressionScreen`
- Hero strip: season name + days left · "Tier 5 of 10" + single progress bar + "180 BP XP to Tier 6" · **Get Pro** (only primary button).
- Tabs: **Track** | **Missions (4/10)**.
- Track: Free row on top, tier number line in the middle (passed / current / ahead), Pro row below; horizontal scroll with ‹ › buttons; current tier scrolled into view on load. Clicking a node opens the preview panel below (image, rarity, description, status line, action: Claim / Unlock with Pro / nothing).
- Missions: Segmented Daily / Weekly, "Resets in …", MissionRow list, footnote "BP XP is added automatically when you finish a mission."
- **Remove** from this screen: Commander level card, "Next major unlock", "Claimable achievements", "Season status" table. Those live in the profile menu / Profile page.

### 3.2 Collection (pages 7–9) — replaces `CollectionScreen` / `VaultScreen` / `InventoryScreen`
- Tabs: **Shop** | **Inventory**.
- Shop: one featured banner (with rotation timer) → FilterChips → ItemCard grid → DetailPanel with price, "You have X", and one **Buy for N Shards** button. The featured item must **not** be repeated in a second "featured" grid.
- Inventory: "Equipped" strip of slots (Pieces 3D, Pieces 2D, Board, Badge, Emote, Sticker; empty slot shows "+"), note "Piece skins are visible to opponents. Board skins stay private.", chips + grid with Equipped/Owned, DetailPanel with **Equip** and "Replaces X in the Y slot."
- Rewrite item descriptions to one short line (e.g. "Styles your own pieces in live matches.") + a "Visible to opponents" / "Visible on your profile" line.
- Keep the 2D/3D view toggle and piece color controls from `InventoryScreen`, moved into an "Appearance" section under the Equipped strip.

### 3.3 Play hub (pages 2–3) — replaces `NexusCoreMenu`
- Hero card: one recommended next action (continue campaign → else Daily Challenge if ready → else Skirmish) with art, segmented progress, **Continue** + "All campaigns".
- "Modes" row: 4 image tiles (Skirmish, Campaign, Daily Challenge with Ready/streak, Multiplayer with friends online). 2×2 on mobile.
- Remove the "Portfolio showcase" card, the nested route list and the permanent friends column (friends → Social / top bar).

### 3.4 Post-match (page 11) — restyle `PostMatchSummary`
- Centered result (Victory/Defeat) + "6 captured · 2 lost · 24 turns".
- Rewards card: Shards, Essence, EXP with bar; mission-complete line with "View missions".
- AI Coach card: one-line summary + three columns: Best move, Work on, Ability impact.
- Actions: **Play again** (primary), Full coach review (secondary, opens existing replay/coach views), Back to Play (ghost).

### 3.5 Factions (page 10) — restyle `TacticalLoadout` + Codex
- Left: faction list (portrait, name, Unlocked / Free starter / Vault unlock with lock).
- Right: faction hero (art, tagline, tags, "Read the lore" → Codex tab) and Loadout: Passive pair + Ultimate pair as selectable cards, **Save loadout** + Reset.
- Locked ability cards must show the real unlock level from data (the design shows a placeholder `[N]`; do not ship that).

### 3.6 Second-level pages
Skirmish setup, Campaign map, Daily puzzle, Multiplayer queue/lobby, Settings, Profile: wrap in `PageHeader` with back arrow + breadcrumb and swap their buttons/cards to the shared components. No layout redesign needed here, just consistency.

## Fixes to the design itself (don't copy these)
- `Unlocks at Commander level [N]` placeholder → real value.
- Mobile Play hero is cut off at the bottom in the mock; on mobile show art, title, progress and **Continue** fully.
- Mobile Battle Pass: tier track must scroll horizontally inside its own container, never the page.
- Mission reward chip "+ 60 added" → "+60 BP XP ✓" for consistency with unfinished rows.

## Definition of done
- `npm run build` passes with no new warnings.
- No floating back pill, no duplicate back buttons, no ADMIN/SHOWCASE outside Developer mode.
- Every old URL still opens the right screen.
- No horizontal page scroll at 390 px.
- Demo Commander flow from the README still works: Explore as Demo → Campaign lesson → finish AI match → Coach review → Collection board switch.
- Re-capture README screenshots per `docs/SCREENSHOT_GUIDE.md`.

## Phase 3.6 — Done (2026-10-20)

Second-level consistency implemented, no layout redesign, no game-logic/backend/URL changes:

- New `src/ui/SecondLevel.jsx` (`AtSecondaryPage`): wraps legacy second-level screens in the shared `AtPageHeader` (one back arrow + breadcrumb per page, sentence-case `AtButton` actions).
- New `src/styles/second-level.css` (imported in `main.jsx` after `post-match.css`, `at-` prefixed): `.at-secondary` container, `overflow-x: clip` guards for 390 px, hides any leftover legacy `<` buttons inside the wrapper, `prefers-reduced-motion` support.
- Migrated in `src/App.jsx` (props, handlers, data flow unchanged):
  - Profile (`CommanderProfileScreen`, breadcrumb Play / Profile, `AtTabs` Profile/Account, save actions as `AtButton`), Settings (Play / Settings, Save + Test SFX/voice as `AtButton`), Progression tree (Profile / Progression).
  - Skirmish setup (Play / Skirmish), Campaign path + Campaign map (Play / Campaign), Daily Challenge hub (Play / Daily Challenge) — primary CTAs now `AtButton`.
  - Multiplayer operations (Play / Multiplayer, duplicate topbar removed, Join/Cancel as `AtButton`), Custom lobby (Play / Multiplayer / Lobby, Copy/Join/Ready as `AtButton`), Codex tab (`AtTabs` Lore/Stats, `AtButton` actions, duplicate currencies/avatar topbar removed), Versus intro (Deploy as `AtButton`), Guest-locked + Feature screens (duplicate topbars removed, `AtButton` actions).
- Removed dead `AppGlobalBackButton` (floating BACK pill). Remaining `<` buttons exist only in dead code (Vault/Inventory/TacticalLoadout screens kept per plan), the live match HUD exit, and the shell-less register gateway.
- Removed the `Showcase` pill from the multiplayer screen; dev visibility now comes only from the shell `Dev · Admin · Showcase` chip gated by Developer mode. `NEXUS_ROUTES`, `routeFromPath`, `AUTH_REQUIRED_ROUTES` untouched.
- Verified: `npm run build` passes (frontend, 12.2 s, no new warnings).
- Screenshots re-captured (2026-10-20) per `docs/SCREENSHOT_GUIDE.md`: all 14 files in `docs/screenshots/` refreshed at 1600×900 jpg q80 (50–152 KB each, under the 300 KB limit) via `capture.mjs` + `recapture.mjs` (temp dir, Demo Commander flow: `/login` → Explore as Demo Commander → one shot per route). Deleted shots (`05b`, `11-progress`, `03b`) stayed deleted. Spot-checked 01 (Play hub + shell), 03 (3D board), 11b (Battle Pass), 13 (Profile): new UI, demo data loaded, no empty/error states, no ADMIN/SHOWCASE badges outside Developer mode. Flaky-note: `networkidle` never settles right after visiting `/play/ai` (persistent connection from the 3D match screen), so retries use `domcontentloaded` + fixed waits.

## Follow-up fixes (2026-10-20, uncommitted with Phase 3.6)

- Play hub placeholder art: Daily tile/hero fell back to the "D" glyph on days whose puzzle id has no campaign art (`survival_net`, `ability_only`); Multiplayer tile always showed "M" (`art: ""`). Data-only fix in `playHubModel` (`src/App.jsx`): daily art falls back to `factionArtFor(puzzle.loadout?.factionId || "nomads")`, multiplayer tile uses `factionArtFor("void_order")` (matches the versus-intro opponent default). Re-captured `01-nexus-core-menu.jpg` — all four tiles now show art.
- 390 px audit (temp-dir scripts: `audit-390.mjs`, `diag-overflow*.mjs`, `shot-390.mjs`): first run failed everywhere with uniform `scrollWidth=466`, traced to `.at-topbar__actions` overflowing (logo word + 2 pills + 3 buttons don't fit 390 px). Fixed in `src/styles/shell.css` ≤719 px block: hide logo word, hide the Friends button (redundant with the Social tab-bar item; new `at-icon-btn--friends` class in `AppShell.jsx`), tighten gaps/padding, `min-width: 0` so flex children can shrink. `/admin` (demo-only) separately failed at 445 px via 4/5/3-column legacy grids; collapsed to 2/2/1 columns + `overflow-wrap` guard in `src/styles/second-level.css` mobile block. Re-audit: **19/19 routes PASS** (`scrollWidth=390`), verified visually with a 390 px `/menu` shot.
- `npm run build` still passes after these changes.
