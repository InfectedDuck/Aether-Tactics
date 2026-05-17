create extension if not exists pgcrypto;

do $$ begin
  create type public.ability_kind as enum ('passive', 'ultimate');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.game_mode as enum ('classic', 'power', 'campaign', 'puzzle', 'sprint');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.match_result as enum ('win', 'loss', 'draw', 'abandoned');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.cosmetic_kind as enum ('board_skin', 'piece_skin', 'badge', 'emote');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.quest_interval as enum ('daily', 'weekly', 'campaign', 'seasonal');
exception when duplicate_object then null;
end $$;

create table if not exists public.factions (
  faction_id text primary key,
  name text not null,
  lore text not null,
  crest text not null,
  unlock_label text not null default 'Free',
  unlock_requirement jsonb not null default '{"type":"free"}'::jsonb,
  required_level_to_unlock integer not null default 1 check (required_level_to_unlock >= 1),
  created_at timestamptz not null default now()
);

create table if not exists public.abilities (
  ability_id text primary key,
  faction_id text not null references public.factions(faction_id) on delete cascade,
  kind public.ability_kind not null,
  name text not null,
  icon text not null,
  art_url text,
  style text not null,
  description text not null,
  cost integer,
  interaction_multipliers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ultimate_cost_required check ((kind = 'passive' and cost is null) or (kind = 'ultimate' and cost is not null and cost >= 0))
);

create table if not exists public.cosmetics (
  cosmetic_id text primary key,
  kind public.cosmetic_kind not null,
  name text not null,
  rarity text not null default 'common',
  price_essence integer not null default 0 check (price_essence >= 0),
  price_shards integer not null default 0 check (price_shards >= 0),
  target_faction_id text references public.factions(faction_id) on delete set null,
  preview_url text,
  is_premium boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.quest_catalog (
  quest_id text primary key,
  title text not null,
  description text not null,
  reset_interval public.quest_interval not null default 'daily',
  target_count integer not null check (target_count > 0),
  reward_essence integer not null default 0 check (reward_essence >= 0),
  reward_shards integer not null default 0 check (reward_shards >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  profile_picture_url text,
  bio text not null default '',
  city text not null default 'Almaty',
  current_exp integer not null default 0 check (current_exp >= 0),
  level integer not null default 1 check (level >= 1),
  essence integer not null default 0 check (essence >= 0),
  shards integer not null default 0 check (shards >= 0),
  is_admin boolean not null default false,
  is_pro boolean not null default false,
  pve_stats jsonb not null default '{
    "matches_played": 0,
    "wins": 0,
    "losses": 0,
    "highest_ai_defeated": "none"
  }'::jsonb,
  pvp_stats jsonb not null default '{
    "matches_played": 0,
    "wins": 0,
    "losses": 0,
    "current_win_streak": 0,
    "mmr_elo_rating": 1000
  }'::jsonb,
  unlocked_factions text[] not null default array['nomads']::text[],
  unlocked_abilities text[] not null default array['open_roads', 'dash']::text[],
  owned_cosmetics text[] not null default array[]::text[],
  earned_badges text[] not null default array[]::text[],
  achievements_claimed text[] not null default array[]::text[],
  equipped_piece_skin text,
  equipped_board_skin text,
  equipped_badge text,
  saved_loadouts jsonb not null default '[{
    "name": "Nomad Starter",
    "faction_id": "nomads",
    "passive_id": "open_roads",
    "ultimate_id": "dash",
    "is_active": true
  }]'::jsonb,
  active_quests jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{
    "masterVolume": 80,
    "musicVolume": 45,
    "sfxVolume": 70,
    "voiceVolume": 60,
    "musicEnabled": true,
    "sfxEnabled": true,
    "voiceEnabled": true,
    "reducedMotion": false,
    "theme": "dark",
    "musicTrack": "echoes_of_void",
    "onboardingCompleted": false
  }'::jsonb,
  streaks jsonb not null default '{
    "loginDays": 1,
    "dailyPuzzle": 0,
    "dailyWin": 0,
    "lastLoginDate": null
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz,
  constraint username_shape check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  constraint pve_stats_object check (jsonb_typeof(pve_stats) = 'object'),
  constraint pvp_stats_object check (jsonb_typeof(pvp_stats) = 'object'),
  constraint saved_loadouts_array check (jsonb_typeof(saved_loadouts) = 'array'),
  constraint active_quests_array check (jsonb_typeof(active_quests) = 'array'),
  constraint settings_object check (jsonb_typeof(settings) = 'object')
);

create table if not exists public.campaign_progress (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  faction_id text not null references public.factions(faction_id) on delete cascade,
  completed_levels text[] not null default array[]::text[],
  current_level_id text,
  stars_earned integer not null default 0 check (stars_earned >= 0),
  best_clear_turns jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, faction_id)
);

create table if not exists public.match_history (
  match_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  opponent_user_id uuid references public.profiles(user_id) on delete set null,
  opponent_type text not null default 'AI' check (opponent_type in ('AI', 'Player')),
  ai_difficulty text check (ai_difficulty in ('easy', 'medium', 'hard')),
  opponent_ai_level text,
  game_mode public.game_mode not null default 'classic',
  result public.match_result not null,
  faction_id text references public.factions(faction_id) on delete set null,
  passive_id text references public.abilities(ability_id) on delete set null,
  ultimate_id text references public.abilities(ability_id) on delete set null,
  turns_count integer not null default 0 check (turns_count >= 0),
  captures_made integer not null default 0 check (captures_made >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  exp_gained integer not null default 0 check (exp_gained >= 0),
  shards_gained integer not null default 0 check (shards_gained >= 0),
  equipped_piece_skin text,
  equipped_board_skin text,
  opponent_piece_skin text,
  opponent_board_skin text,
  replay jsonb not null default '[]'::jsonb,
  review_summary jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint opponent_not_self check (opponent_user_id is null or opponent_user_id <> user_id),
  constraint one_opponent_source check (not (opponent_user_id is not null and opponent_ai_level is not null)),
  constraint replay_array check (jsonb_typeof(replay) = 'array'),
  constraint review_array check (jsonb_typeof(review_summary) = 'array')
);

create table if not exists public.inventory_transactions (
  transaction_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  source text not null,
  essence_delta integer not null default 0,
  shards_delta integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  inventory_item_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  cosmetic_id text not null references public.cosmetics(cosmetic_id) on delete cascade,
  is_equipped boolean not null default false,
  purchased_at timestamptz not null default now(),
  equipped_at timestamptz,
  unique (user_id, cosmetic_id)
);

create table if not exists public.friend_requests (
  request_id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(user_id) on delete cascade,
  addressee_id uuid not null references public.profiles(user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_request_not_self check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);

create table if not exists public.friendships (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  friend_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  constraint friendship_not_self check (user_id <> friend_id)
);

create table if not exists public.notifications (
  notification_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.pro_interest (
  interest_id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(user_id) on delete set null,
  source text not null default 'pro_modal',
  selected_offer text not null default 'aether_pro',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.factions add column if not exists required_level_to_unlock integer not null default 1 check (required_level_to_unlock >= 1);
alter table public.abilities add column if not exists art_url text;
alter table public.cosmetics add column if not exists target_faction_id text references public.factions(faction_id) on delete set null;
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists current_exp integer not null default 0 check (current_exp >= 0);
alter table public.profiles add column if not exists level integer not null default 1 check (level >= 1);
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists is_pro boolean not null default false;
alter table public.profiles add column if not exists earned_badges text[] not null default array[]::text[];
alter table public.profiles add column if not exists equipped_badge text;
alter table public.profiles add column if not exists achievements_claimed text[] not null default array[]::text[];
alter table public.profiles add column if not exists equipped_piece_skin text;
alter table public.profiles add column if not exists equipped_board_skin text;
alter table public.profiles add column if not exists settings jsonb not null default '{
  "masterVolume": 80,
  "musicVolume": 45,
  "sfxVolume": 70,
  "voiceVolume": 60,
  "musicEnabled": true,
  "sfxEnabled": true,
  "voiceEnabled": true,
  "reducedMotion": false,
  "theme": "dark",
  "musicTrack": "echoes_of_void",
  "onboardingCompleted": false
}'::jsonb;
update public.profiles
set settings = settings || '{"musicTrack":"echoes_of_void"}'::jsonb
where not settings ? 'musicTrack';
update public.profiles
set settings = settings || '{"onboardingCompleted":false}'::jsonb
where not settings ? 'onboardingCompleted';
alter table public.profiles add column if not exists streaks jsonb not null default '{
  "loginDays": 1,
  "dailyPuzzle": 0,
  "dailyWin": 0,
  "lastLoginDate": null
}'::jsonb;
alter table public.match_history add column if not exists opponent_type text not null default 'AI' check (opponent_type in ('AI', 'Player'));
alter table public.match_history add column if not exists ai_difficulty text check (ai_difficulty in ('easy', 'medium', 'hard'));
alter table public.match_history add column if not exists exp_gained integer not null default 0 check (exp_gained >= 0);
alter table public.match_history add column if not exists shards_gained integer not null default 0 check (shards_gained >= 0);
alter table public.match_history add column if not exists equipped_piece_skin text;
alter table public.match_history add column if not exists equipped_board_skin text;
alter table public.match_history add column if not exists opponent_piece_skin text;
alter table public.match_history add column if not exists opponent_board_skin text;

create index if not exists profiles_city_idx on public.profiles(city);
create index if not exists profiles_pvp_mmr_idx on public.profiles (((pvp_stats->>'mmr_elo_rating')::integer) desc);
create index if not exists match_history_user_created_idx on public.match_history(user_id, created_at desc);
create index if not exists match_history_opponent_idx on public.match_history(opponent_user_id);
create index if not exists campaign_progress_user_idx on public.campaign_progress(user_id);
create index if not exists inventory_items_user_idx on public.inventory_items(user_id);
create index if not exists inventory_items_user_equipped_idx on public.inventory_items(user_id, is_equipped);
create index if not exists friend_requests_addressee_idx on public.friend_requests(addressee_id, status);
create index if not exists friend_requests_requester_idx on public.friend_requests(requester_id, status);
create index if not exists friendships_user_idx on public.friendships(user_id);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists pro_interest_user_created_idx on public.pro_interest(user_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists campaign_progress_touch_updated_at on public.campaign_progress;
create trigger campaign_progress_touch_updated_at
before update on public.campaign_progress
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_username text;
begin
  generated_username := coalesce(
    nullif(new.raw_user_meta_data->>'username', ''),
    regexp_replace(split_part(coalesce(new.email, 'player'), '@', 1), '[^A-Za-z0-9_]', '_', 'g')
  );
  generated_username := regexp_replace(generated_username, '[^A-Za-z0-9_]', '_', 'g');

  if length(generated_username) < 3 then
    generated_username := 'player_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  generated_username := left(generated_username, 15) || '_' || substr(replace(new.id::text, '-', ''), 1, 8);

  insert into public.profiles (user_id, username, profile_picture_url)
  values (
    new.id,
    generated_username,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.jsonb_int(source jsonb, key text)
returns integer
language sql
immutable
as $$
  select coalesce((source ->> key)::integer, 0);
$$;

create or replace function public.jsonb_set_int(source jsonb, key text, value integer)
returns jsonb
language sql
immutable
as $$
  select jsonb_set(coalesce(source, '{}'::jsonb), array[key], to_jsonb(value), true);
$$;

create or replace function public.ai_level_rank(level text)
returns integer
language sql
immutable
as $$
  select case lower(coalesce(level, 'none'))
    when 'beginner' then 1
    when 'smart' then 2
    when 'coach' then 3
    else 0
  end;
$$;

create or replace function public.exp_required_for_level(p_level integer)
returns integer
language sql
immutable
as $$
  select 120 + greatest(1, p_level) * 80;
$$;

create or replace function public.ai_difficulty_multiplier(p_difficulty text)
returns numeric
language sql
immutable
as $$
  select case lower(coalesce(p_difficulty, 'easy'))
    when 'hard' then 2.0
    when 'medium' then 1.5
    else 1.0
  end;
$$;

create or replace function public.get_city_leaderboard(p_city text default 'Global', p_limit integer default 10)
returns table (
  user_id uuid,
  username text,
  profile_picture_url text,
  city text,
  wins integer,
  losses integer,
  current_win_streak integer,
  mmr_elo_rating integer
)
language sql
security definer
set search_path = public
as $$
  select
    profiles.user_id,
    profiles.username,
    profiles.profile_picture_url,
    profiles.city,
    public.jsonb_int(profiles.pvp_stats, 'wins') as wins,
    public.jsonb_int(profiles.pvp_stats, 'losses') as losses,
    public.jsonb_int(profiles.pvp_stats, 'current_win_streak') as current_win_streak,
    public.jsonb_int(profiles.pvp_stats, 'mmr_elo_rating') as mmr_elo_rating
  from public.profiles
  where p_city = 'Global' or profiles.city = p_city
  order by
    public.jsonb_int(profiles.pvp_stats, 'mmr_elo_rating') desc,
    public.jsonb_int(profiles.pvp_stats, 'current_win_streak') desc,
    public.jsonb_int(profiles.pvp_stats, 'wins') desc
  limit greatest(1, least(p_limit, 100));
$$;

create or replace function public.record_match_and_update_profile(
  p_user_id uuid,
  p_result public.match_result,
  p_game_mode public.game_mode default 'classic',
  p_opponent_user_id uuid default null,
  p_opponent_type text default 'AI',
  p_ai_difficulty text default null,
  p_opponent_ai_level text default null,
  p_faction_id text default null,
  p_passive_id text default null,
  p_ultimate_id text default null,
  p_turns_count integer default 0,
  p_captures_made integer default 0,
  p_duration_seconds integer default 0,
  p_replay jsonb default '[]'::jsonb,
  p_review_summary jsonb default '[]'::jsonb,
  p_mmr_delta integer default 0,
  p_base_exp integer default 80,
  p_essence_reward integer default 0,
  p_shards_reward integer default 0,
  p_equipped_piece_skin text default null,
  p_equipped_board_skin text default null,
  p_opponent_piece_skin text default null,
  p_opponent_board_skin text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_match_id uuid;
  current_pve jsonb;
  current_pvp jsonb;
  next_pve jsonb;
  next_pvp jsonb;
  current_best_ai text;
  exp_reward integer;
  shard_reward integer;
  next_exp integer;
  next_level integer;
  unlock_ids text[];
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'Cannot record a match for another user';
  end if;

  insert into public.match_history (
    user_id,
    opponent_user_id,
    opponent_type,
    ai_difficulty,
    opponent_ai_level,
    game_mode,
    result,
    faction_id,
    passive_id,
    ultimate_id,
    turns_count,
    captures_made,
    duration_seconds,
    exp_gained,
    shards_gained,
    equipped_piece_skin,
    equipped_board_skin,
    opponent_piece_skin,
    opponent_board_skin,
    replay,
    review_summary
  )
  values (
    p_user_id,
    p_opponent_user_id,
    case when p_opponent_user_id is not null or p_opponent_type = 'Player' then 'Player' else 'AI' end,
    case when p_opponent_user_id is null then coalesce(p_ai_difficulty, case lower(coalesce(p_opponent_ai_level, 'beginner')) when 'coach' then 'hard' when 'smart' then 'medium' else 'easy' end) else null end,
    p_opponent_ai_level,
    p_game_mode,
    p_result,
    p_faction_id,
    p_passive_id,
    p_ultimate_id,
    greatest(0, p_turns_count),
    greatest(0, p_captures_made),
    greatest(0, p_duration_seconds),
    0,
    greatest(0, p_shards_reward),
    p_equipped_piece_skin,
    p_equipped_board_skin,
    p_opponent_piece_skin,
    p_opponent_board_skin,
    coalesce(p_replay, '[]'::jsonb),
    coalesce(p_review_summary, '[]'::jsonb)
  )
  returning match_id into inserted_match_id;

  select pve_stats, pvp_stats
  into current_pve, current_pvp
  from public.profiles
  where user_id = p_user_id
  for update;

  if p_opponent_user_id is not null or p_opponent_type = 'Player' then
    next_pvp := public.jsonb_set_int(current_pvp, 'matches_played', public.jsonb_int(current_pvp, 'matches_played') + 1);
    next_pvp := public.jsonb_set_int(next_pvp, 'wins', public.jsonb_int(current_pvp, 'wins') + case when p_result = 'win' then 1 else 0 end);
    next_pvp := public.jsonb_set_int(next_pvp, 'losses', public.jsonb_int(current_pvp, 'losses') + case when p_result = 'loss' then 1 else 0 end);
    next_pvp := public.jsonb_set_int(next_pvp, 'current_win_streak', case when p_result = 'win' then public.jsonb_int(current_pvp, 'current_win_streak') + 1 else 0 end);
    next_pvp := public.jsonb_set_int(next_pvp, 'mmr_elo_rating', greatest(100, public.jsonb_int(current_pvp, 'mmr_elo_rating') + p_mmr_delta));

    update public.profiles
    set
      pvp_stats = next_pvp,
      essence = essence + greatest(0, p_essence_reward),
      last_seen_at = now()
    where user_id = p_user_id;
  else
    current_best_ai := coalesce(current_pve->>'highest_ai_defeated', 'none');
    next_pve := public.jsonb_set_int(current_pve, 'matches_played', public.jsonb_int(current_pve, 'matches_played') + 1);
    next_pve := public.jsonb_set_int(next_pve, 'wins', public.jsonb_int(current_pve, 'wins') + case when p_result = 'win' then 1 else 0 end);
    next_pve := public.jsonb_set_int(next_pve, 'losses', public.jsonb_int(current_pve, 'losses') + case when p_result = 'loss' then 1 else 0 end);
    if p_result = 'win' and public.ai_level_rank(p_opponent_ai_level) > public.ai_level_rank(current_best_ai) then
      next_pve := jsonb_set(next_pve, '{highest_ai_defeated}', to_jsonb(p_opponent_ai_level), true);
    else
      next_pve := jsonb_set(next_pve, '{highest_ai_defeated}', to_jsonb(current_best_ai), true);
    end if;

    update public.profiles
    set
      pve_stats = next_pve,
      essence = essence + greatest(0, p_essence_reward),
      last_seen_at = now()
    where user_id = p_user_id;
  end if;

  exp_reward := floor(greatest(0, p_base_exp) * public.ai_difficulty_multiplier(coalesce(p_ai_difficulty, case lower(coalesce(p_opponent_ai_level, 'beginner')) when 'coach' then 'hard' when 'smart' then 'medium' else 'easy' end)))::integer
    + case when p_result = 'win' then 40 else 0 end;
  shard_reward := greatest(0, p_shards_reward) + case when p_result = 'win' then 35 else 12 end;

  select current_exp + exp_reward, level
  into next_exp, next_level
  from public.profiles
  where user_id = p_user_id
  for update;

  while next_exp >= public.exp_required_for_level(next_level) loop
    next_exp := next_exp - public.exp_required_for_level(next_level);
    next_level := next_level + 1;
  end loop;

  select coalesce(array_agg(faction_id), array[]::text[])
  into unlock_ids
  from public.factions
  where required_level_to_unlock <= next_level
    and faction_id <> 'void_order';

  update public.profiles
  set
    current_exp = next_exp,
    level = next_level,
    shards = shards + shard_reward,
    unlocked_factions = (
      select array(
        select distinct item
        from unnest(coalesce(unlocked_factions, array[]::text[]) || coalesce(unlock_ids, array[]::text[])) as item
      )
    ),
    last_seen_at = now()
  where user_id = p_user_id;

  update public.match_history
  set exp_gained = exp_reward, shards_gained = shard_reward
  where match_id = inserted_match_id;

  if p_essence_reward <> 0 or p_shards_reward <> 0 or exp_reward <> 0 or shard_reward <> 0 then
    insert into public.inventory_transactions (user_id, source, essence_delta, shards_delta, metadata)
    values (
      p_user_id,
      'match_reward',
      greatest(0, p_essence_reward),
      shard_reward,
      jsonb_build_object('match_id', inserted_match_id, 'exp_gained', exp_reward)
    );
  end if;

  return inserted_match_id;
end;
$$;

create or replace function public.unlock_profile_item(
  p_user_id uuid,
  p_kind text,
  p_item_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'Cannot unlock items for another user';
  end if;

  if p_kind = 'faction' then
    update public.profiles
    set unlocked_factions = case when p_item_id = any(unlocked_factions) then unlocked_factions else array_append(unlocked_factions, p_item_id) end
    where user_id = p_user_id;
  elsif p_kind = 'ability' then
    update public.profiles
    set unlocked_abilities = case when p_item_id = any(unlocked_abilities) then unlocked_abilities else array_append(unlocked_abilities, p_item_id) end
    where user_id = p_user_id;
  elsif p_kind = 'cosmetic' then
    if p_item_id ~ '^badge_.*_champion$' then
      raise exception 'Champion badges are awarded only by leaderboard distribution';
    end if;
    update public.profiles
    set owned_cosmetics = case when p_item_id = any(owned_cosmetics) then owned_cosmetics else array_append(owned_cosmetics, p_item_id) end
    where user_id = p_user_id;
  else
    raise exception 'Unknown unlock kind: %', p_kind;
  end if;
end;
$$;

alter table public.factions enable row level security;
alter table public.abilities enable row level security;
alter table public.cosmetics enable row level security;
alter table public.quest_catalog enable row level security;
alter table public.profiles enable row level security;
alter table public.campaign_progress enable row level security;
alter table public.match_history enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.inventory_items enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.notifications enable row level security;
alter table public.pro_interest enable row level security;

drop policy if exists "content factions readable" on public.factions;
create policy "content factions readable" on public.factions for select using (true);

drop policy if exists "content abilities readable" on public.abilities;
create policy "content abilities readable" on public.abilities for select using (true);

drop policy if exists "content cosmetics readable" on public.cosmetics;
create policy "content cosmetics readable" on public.cosmetics for select using (true);

drop policy if exists "content quests readable" on public.quest_catalog;
create policy "content quests readable" on public.quest_catalog for select using (true);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert with check (auth.uid() = user_id);

drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own" on public.profiles for select using (auth.uid() = user_id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "campaign progress own" on public.campaign_progress;
create policy "campaign progress own" on public.campaign_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "match history own" on public.match_history;
create policy "match history own" on public.match_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "inventory transactions own" on public.inventory_transactions;
create policy "inventory transactions own" on public.inventory_transactions for select using (auth.uid() = user_id);

drop policy if exists "inventory items own" on public.inventory_items;
create policy "inventory items own" on public.inventory_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "friend requests involved" on public.friend_requests;
create policy "friend requests involved" on public.friend_requests for all using (auth.uid() = requester_id or auth.uid() = addressee_id) with check (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "friendships own" on public.friendships;
create policy "friendships own" on public.friendships for select using (auth.uid() = user_id);

drop policy if exists "notifications own" on public.notifications;
create policy "notifications own" on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "pro interest insert own or anonymous" on public.pro_interest;
create policy "pro interest insert own or anonymous" on public.pro_interest for insert with check (user_id is null or auth.uid() = user_id);

drop policy if exists "pro interest read own" on public.pro_interest;
create policy "pro interest read own" on public.pro_interest for select using (auth.uid() = user_id);
