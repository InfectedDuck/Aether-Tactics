insert into public.factions (faction_id, name, lore, crest, unlock_label, unlock_requirement, required_level_to_unlock)
values
  ('nomads', 'Steppe Nomads', 'Win by tempo, escape routes, and sudden board control.', 'N', 'Free', '{"type":"free"}', 1),
  ('iron_guard', 'Iron Guard', 'Hold the center, survive attacks, and punish overextension.', 'G', 'Level 2', '{"type":"level","level":2}', 2),
  ('sun_court', 'Sun Court', 'Race for promotion and turn kings into pressure.', 'S', 'Level 4', '{"type":"level","level":4}', 4),
  ('void_order', 'Void Order', 'Disrupt lanes, mark mistakes, and bend board geometry.', 'V', 'Vault Pass', '{"type":"vault","price_shards":900,"item_id":"void_order_campaign_pass"}', 99)
on conflict (faction_id) do update set
  name = excluded.name,
  lore = excluded.lore,
  crest = excluded.crest,
  unlock_label = excluded.unlock_label,
  unlock_requirement = excluded.unlock_requirement,
  required_level_to_unlock = excluded.required_level_to_unlock;

insert into public.abilities (ability_id, faction_id, kind, name, icon, art_url, style, description, cost, interaction_multipliers)
values
  ('open_roads', 'nomads', 'passive', 'Open Roads', 'OR', '/assets/abilities/open_roads.png', 'mobility', 'If no capture is available, one normal piece may move one diagonal square backward.', null, '{"backward_quiet_moves_per_turn":1}'),
  ('dust_veil', 'nomads', 'passive', 'Dust Veil', 'DV', '/assets/abilities/dust_veil.png', 'defense', 'After a quiet move, the moved piece blocks the first normal capture against it.', null, '{"blocked_normal_captures":1,"duration_turns":1}'),
  ('dash', 'nomads', 'ultimate', 'Dash', 'DS', '/assets/abilities/dash.png', 'tempo', 'Move one normal piece exactly two diagonal empty squares. Dash cannot capture.', 2, '{"diagonal_range":2,"can_capture":false}'),
  ('sandstorm_corridor', 'nomads', 'ultimate', 'Sandstorm', 'SC', '/assets/abilities/sandstorm_corridor.png', 'board_control', 'Block two empty dark squares from enemy quiet landings for one enemy turn.', 2, '{"blocked_squares":2,"duration_turns":1}'),
  ('shield_wall', 'iron_guard', 'passive', 'Shield Wall', 'SW', '/assets/abilities/shield_wall.png', 'defense', 'The first allied piece that enters a highlighted playable center square becomes guarded for the enemy turn.', null, '{"guarded_center_entries":1}'),
  ('vengeance_ledger', 'iron_guard', 'passive', 'Vengeance Ledger', 'VL', '/assets/abilities/vengeance_ledger.png', 'comeback', 'After losing a piece, your next capture grants one extra Momentum.', null, '{"momentum_after_revenge_capture":1}'),
  ('fortify', 'iron_guard', 'ultimate', 'Fortify', 'FT', '/assets/abilities/fortify.png', 'protection', 'Choose one allied piece. For two enemy turns, that piece cannot be captured.', 2, '{"protected_pieces":1,"duration_turns":2}'),
  ('barricade', 'iron_guard', 'ultimate', 'Barricade', 'BR', '/assets/abilities/barricade.png', 'board_control', 'Place two temporary blockers on empty dark squares for one enemy turn.', 2, '{"blocked_squares":2,"duration_turns":1}'),
  ('royal_pressure', 'sun_court', 'passive', 'Royal Pressure', 'RP', '/assets/abilities/royal_pressure.png', 'promotion', 'The first normal piece that enters the enemy final three rows grants Momentum.', null, '{"momentum_on_promotion_lane":1}'),
  ('crown_tax', 'sun_court', 'passive', 'Crown Tax', 'CT', '/assets/abilities/crown_tax.png', 'comeback', 'The first time the opponent promotes a king, gain two Momentum.', null, '{"momentum_when_enemy_promotes":2}'),
  ('crown_surge', 'sun_court', 'ultimate', 'Crown Surge', 'CS', '/assets/abilities/crown_surge.png', 'promotion', 'Promote one normal piece in the middle rows immediately.', 2, '{"promoted_pieces":1,"allowed_rows":[3,4]}'),
  ('sun_lance', 'sun_court', 'ultimate', 'Sun Lance', 'SL', '/assets/abilities/sun_lance.png', 'capture', 'One normal piece strikes like a king for a diagonal capture this turn.', 2, '{"lance_capture_pieces":1,"duration_turns":1}'),
  ('pressure_field', 'void_order', 'passive', 'Pressure Field', 'PF', '/assets/abilities/pressure_field.png', 'comeback', 'Once per match, danger created by the opponent grants Momentum.', null, '{"momentum_on_threat":1,"uses_per_match":1}'),
  ('echo_mark', 'void_order', 'passive', 'Echo Mark', 'EM', '/assets/abilities/echo_mark.png', 'trap', 'The first enemy quiet move is marked. Capture it for Momentum.', null, '{"marked_enemy_moves":1,"momentum_on_mark_capture":1}'),
  ('phase_shift', 'void_order', 'ultimate', 'Phase Shift', 'PS', '/assets/abilities/phase_shift.png', 'reposition', 'Teleport one normal piece up to 3 squares to any empty dark square, ignoring blockers.', 2, '{"teleport_range":3,"must_land_dark":true,"ignores_blockers":true,"can_capture":false}'),
  ('collapse', 'void_order', 'ultimate', 'Collapse', 'CL', '/assets/abilities/collapse.png', 'board_control', 'Void one empty dark square so no piece may land there for one turn.', 2, '{"blocked_squares":1,"duration_turns":1}')
on conflict (ability_id) do update set
  faction_id = excluded.faction_id,
  kind = excluded.kind,
  name = excluded.name,
  icon = excluded.icon,
  art_url = excluded.art_url,
  style = excluded.style,
  description = excluded.description,
  cost = excluded.cost,
  interaction_multipliers = excluded.interaction_multipliers;

delete from public.cosmetics
where cosmetic_id in (
  'board_steppe_sunset',
  'pieces_azure_glass',
  'board_iron_bastion',
  'pieces_solar_crown',
  'board_void_grid',
  'emote_good_tempo'
);

insert into public.cosmetics (cosmetic_id, kind, name, rarity, price_essence, price_shards, target_faction_id, preview_url, is_premium)
values
  ('pieces_cosmos', 'piece_skin', 'Cosmos Relic Pieces', 'legendary', 0, 520, null, '/assets/cosmetics/pieces_cosmos_preview.png', true),
  ('pieces_ice', 'piece_skin', 'Cryo Prism Pieces', 'epic', 0, 380, null, '/assets/cosmetics/pieces_ice_preview.png', true),
  ('pieces_molten', 'piece_skin', 'Molten Core Pieces', 'epic', 0, 420, null, '/assets/cosmetics/pieces_molten_preview.png', true),
  ('pieces_elemental_2d', 'piece_skin', 'Elemental Rift 2D Pieces', 'legendary', 0, 360, null, '/assets/cosmetics/pieces_elemental_2d.png', true),
  ('pieces_cyber_grid_2d', 'piece_skin', 'Cyber Grid 2D Pieces', 'epic', 0, 300, null, '/assets/cosmetics/pieces_cyber_grid_2d.png', true),
  ('pieces_zen_garden_2d', 'piece_skin', 'Zen Garden 2D Pieces', 'rare', 0, 220, null, '/assets/cosmetics/pieces_zen_garden_2d.png', false),
  ('void_order_campaign_pass', 'badge', 'Void Order Campaign Pass', 'legendary', 0, 900, null, '/assets/cosmetics/vault_pro_bundle.png', true),
  ('badge_global_champion', 'badge', 'Global Champion Badge', 'legendary', 0, 0, null, '/assets/cosmetics/badge_global_champion.png', true),
  ('badge_almaty_champion', 'badge', 'Almaty Champion Badge', 'epic', 0, 0, null, '/assets/cosmetics/badge_almaty_champion.png', true),
  ('badge_astana_champion', 'badge', 'Astana Champion Badge', 'epic', 0, 0, null, '/assets/cosmetics/badge_astana_champion.png', true),
  ('badge_shymkent_champion', 'badge', 'Shymkent Champion Badge', 'epic', 0, 0, null, '/assets/cosmetics/badge_shymkent_champion.png', true),
  ('badge_aktobe_champion', 'badge', 'Aktobe Champion Badge', 'epic', 0, 0, null, '/assets/cosmetics/badge_aktobe_champion.png', true),
  ('badge_karaganda_champion', 'badge', 'Karaganda Champion Badge', 'epic', 0, 0, null, '/assets/cosmetics/badge_karaganda_champion.png', true),
  ('emote_good_tempo', 'emote', 'Good Tempo', 'common', 0, 60, null, '/assets/cosmetics/emote_good_tempo.png', false),
  ('emote_well_played', 'emote', 'Well Played', 'common', 0, 80, null, '/assets/cosmetics/emote_well_played.png', false),
  ('emote_close_call', 'emote', 'Close Call', 'common', 0, 80, null, '/assets/cosmetics/emote_close_call.png', false),
  ('emote_brilliant_jump', 'emote', 'Brilliant Jump', 'rare', 0, 100, null, '/assets/cosmetics/emote_brilliant_jump.png', false),
  ('emote_crown_rush', 'emote', 'Crown Rush', 'rare', 0, 110, 'sun_court', '/assets/cosmetics/emote_crown_rush.png', false),
  ('emote_fortified', 'emote', 'Fortified', 'rare', 0, 100, 'iron_guard', '/assets/cosmetics/emote_fortified.png', false),
  ('emote_void_glitch', 'emote', 'Void Glitch', 'epic', 0, 130, 'void_order', '/assets/cosmetics/emote_void_glitch.png', true),
  ('sticker_laugh_burst', 'emote', 'Laugh Burst Sticker', 'common', 0, 70, null, '/assets/cosmetics/sticker_laugh_burst.png', false),
  ('sticker_thumbs_up', 'emote', 'Thumbs Up Sticker', 'common', 0, 70, null, '/assets/cosmetics/sticker_thumbs_up.png', false),
  ('sticker_oops_trap', 'emote', 'Oops Trap Sticker', 'rare', 0, 95, null, '/assets/cosmetics/sticker_oops_trap.png', false),
  ('sticker_hype_flame', 'emote', 'Hype Flame Sticker', 'rare', 0, 105, null, '/assets/cosmetics/sticker_hype_flame.png', false)
on conflict (cosmetic_id) do update set
  kind = excluded.kind,
  name = excluded.name,
  rarity = excluded.rarity,
  price_essence = excluded.price_essence,
  price_shards = excluded.price_shards,
  target_faction_id = excluded.target_faction_id,
  preview_url = excluded.preview_url,
  is_premium = excluded.is_premium;

insert into public.quest_catalog (quest_id, title, description, reset_interval, target_count, reward_essence, reward_shards)
values
  ('daily_capture_5', 'Capture Chain', 'Capture 5 pieces in any mode.', 'daily', 5, 120, 0),
  ('daily_ai_win', 'Beat the Sparring Partner', 'Win 1 match against AI.', 'daily', 1, 180, 0),
  ('daily_campaign_clear', 'Trail Lesson', 'Clear 1 campaign puzzle.', 'daily', 1, 150, 0),
  ('weekly_city_duel', 'Represent Your City', 'Win 5 PvP games for your city leaderboard.', 'weekly', 5, 600, 25)
on conflict (quest_id) do update set
  title = excluded.title,
  description = excluded.description,
  reset_interval = excluded.reset_interval,
  target_count = excluded.target_count,
  reward_essence = excluded.reward_essence,
  reward_shards = excluded.reward_shards;
