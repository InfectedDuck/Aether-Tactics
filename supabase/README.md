# Supabase Setup

This folder contains the production database foundation for Aether Tactics.

## 1. Create Project

Create a Supabase project, then open **SQL Editor**.

Run these files in order:

```text
supabase/schema.sql
supabase/seed.sql
```

`schema.sql` creates tables, functions, triggers, and Row Level Security policies. `seed.sql` inserts the current factions, abilities, cosmetics, and quest catalog.

## 2. Environment Variables

Copy `.env.example` into your local backend/frontend env files and fill in the values from Supabase project settings.

Backend:

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
```

Frontend, only when direct Supabase Auth is enabled:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code.

## 3. Core Tables

- `profiles`: user profile, currencies, PvE/PvP stat blocks, unlock arrays, saved loadouts, active quests.
- `match_history`: one row per completed match, including AI level or opponent user, mode, result, replay, and coach summary.
- `campaign_progress`: campaign completion per faction.
- `inventory_transactions`: economy audit log for match rewards, purchases, and quest rewards.
- `factions`, `abilities`, `cosmetics`, `quest_catalog`: content tables that drive the product layer.

## 4. Useful RPCs

- `get_city_leaderboard(city, limit)`: returns public leaderboard-safe profile data.
- `record_match_and_update_profile(...)`: inserts match history and updates split PvE/PvP stats plus currency rewards.
- `unlock_profile_item(user_id, kind, item_id)`: safely appends faction, ability, or cosmetic unlocks.
