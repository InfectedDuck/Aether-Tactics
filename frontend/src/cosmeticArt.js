const cosmeticArt = {
  pieces_cosmos: new URL("./assets/cosmetics/pieces_cosmos_preview.png", import.meta.url).href,
  pieces_ice: new URL("./assets/cosmetics/pieces_ice_preview.png", import.meta.url).href,
  pieces_molten: new URL("./assets/cosmetics/pieces_molten_preview.png", import.meta.url).href,
  pieces_elemental_2d: new URL("./assets/cosmetics/pieces_elemental_2d.png", import.meta.url).href,
  pieces_cyber_grid_2d: new URL("./assets/cosmetics/pieces_cyber_grid_2d.png", import.meta.url).href,
  pieces_zen_garden_2d: new URL("./assets/cosmetics/pieces_zen_garden_2d.png", import.meta.url).href,
  badge_global_champion: new URL("./assets/cosmetics/badge_global_champion.png", import.meta.url).href,
  badge_almaty_champion: new URL("./assets/cosmetics/badge_almaty_champion.png", import.meta.url).href,
  badge_astana_champion: new URL("./assets/cosmetics/badge_astana_champion.png", import.meta.url).href,
  badge_shymkent_champion: new URL("./assets/cosmetics/badge_shymkent_champion.png", import.meta.url).href,
  badge_aktobe_champion: new URL("./assets/cosmetics/badge_aktobe_champion.png", import.meta.url).href,
  badge_karaganda_champion: new URL("./assets/cosmetics/badge_karaganda_champion.png", import.meta.url).href,
  emote_good_tempo: new URL("./assets/cosmetics/emote_good_tempo.png", import.meta.url).href,
  emote_well_played: new URL("./assets/cosmetics/emote_well_played.png", import.meta.url).href,
  emote_close_call: new URL("./assets/cosmetics/emote_close_call.png", import.meta.url).href,
  emote_brilliant_jump: new URL("./assets/cosmetics/emote_brilliant_jump.png", import.meta.url).href,
  emote_crown_rush: new URL("./assets/cosmetics/emote_crown_rush.png", import.meta.url).href,
  emote_void_glitch: new URL("./assets/cosmetics/emote_void_glitch.png", import.meta.url).href,
  emote_fortified: new URL("./assets/cosmetics/emote_fortified.png", import.meta.url).href,
  sticker_laugh_burst: new URL("./assets/cosmetics/sticker_laugh_burst.png", import.meta.url).href,
  sticker_thumbs_up: new URL("./assets/cosmetics/sticker_thumbs_up.png", import.meta.url).href,
  sticker_oops_trap: new URL("./assets/cosmetics/sticker_oops_trap.png", import.meta.url).href,
  sticker_hype_flame: new URL("./assets/cosmetics/sticker_hype_flame.png", import.meta.url).href,
  vault_pro_bundle: new URL("./assets/cosmetics/vault_pro_bundle.png", import.meta.url).href,
};

export function cosmeticArtFor(cosmetic) {
  const id = typeof cosmetic === "string" ? cosmetic : cosmetic?.cosmetic_id || cosmetic?.id;
  return (typeof cosmetic === "object" && (cosmetic.preview_url || cosmetic.art_url || cosmetic.image)) || cosmeticArt[id] || "";
}

export { cosmeticArt };
