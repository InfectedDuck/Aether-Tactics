-- Phase 2 hardening: atomic Vault purchase.
-- Replaces the 3 round-trip flow (profiles.update + inventory_items.insert +
-- inventory_transactions.insert) which could double-spend under concurrent clicks
-- or leave shards deducted with no item on partial failure.
--
-- Run in the Supabase SQL Editor after schema.sql / seed.sql.
-- The backend tries this RPC first and falls back to the stepped flow when the
-- function does not exist yet (older DBs), so the migration is safe to apply late.

create or replace function public.purchase_cosmetic(p_user_id uuid, p_cosmetic_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_item public.cosmetics%rowtype;
  v_owned text[];
  v_unlocked text[];
  v_price integer;
  v_inventory public.inventory_items%rowtype;
begin
  select * into v_profile from public.profiles where user_id = p_user_id for update;
  if not found then
    raise exception 'Profile not found for user %', p_user_id using errcode = 'P0002';
  end if;

  select * into v_item from public.cosmetics where cosmetic_id = p_cosmetic_id;
  if not found then
    raise exception 'Cosmetic % not found', p_cosmetic_id using errcode = 'P0002';
  end if;

  if v_item.cosmetic_id like 'badge\_%\_champion' then
    raise exception 'Champion badges are earned through leaderboard placement and cannot be purchased.' using errcode = 'P0001';
  end if;

  v_owned := coalesce(v_profile.owned_cosmetics, '{}');
  v_unlocked := coalesce(v_profile.unlocked_factions, '{nomads}');
  v_price := coalesce(v_item.price_shards, 0);

  if v_item.cosmetic_id = any (v_owned) then
    raise exception 'Item already owned.' using errcode = 'P0001';
  end if;

  if v_item.target_faction_id is not null and not (v_item.target_faction_id = any (v_unlocked)) then
    raise exception 'Faction is locked for this item.' using errcode = 'P0001';
  end if;

  if coalesce(v_profile.shards, 0) < v_price then
    raise exception 'Not enough Shards.' using errcode = 'P0001';
  end if;

  if v_item.cosmetic_id = 'void_order_campaign_pass' then
    v_unlocked := array(select distinct unnest(v_unlocked || array['void_order']));
  end if;
  v_owned := array(select distinct unnest(v_owned || array[v_item.cosmetic_id]));

  update public.profiles
    set shards = coalesce(shards, 0) - v_price,
        owned_cosmetics = v_owned,
        unlocked_factions = v_unlocked
    where user_id = p_user_id;

  -- Unique (user_id, cosmetic_id) makes double-clicks safe: the second call
  -- raises unique_violation instead of double-spending.
  insert into public.inventory_items (user_id, cosmetic_id, is_equipped)
    values (p_user_id, v_item.cosmetic_id, false)
    returning * into v_inventory;

  insert into public.inventory_transactions (user_id, source, shards_delta, metadata)
    values (p_user_id, 'vault_purchase', -v_price, jsonb_build_object('cosmetic_id', v_item.cosmetic_id));

  return jsonb_build_object(
    'purchased', true,
    'shards_spent', v_price,
    'inventory_item_id', v_inventory.inventory_item_id
  );
exception
  when unique_violation then
    raise exception 'Item already owned.' using errcode = 'P0001';
end;
$$;
