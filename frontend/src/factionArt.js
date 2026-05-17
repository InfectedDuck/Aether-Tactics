const factionArt = {
  nomads: new URL("./assets/factions/nomads.png", import.meta.url).href,
  steppe_nomads: new URL("./assets/factions/nomads.png", import.meta.url).href,
  nomad_raiders: new URL("./assets/factions/nomads.png", import.meta.url).href,
  iron_guard: new URL("./assets/factions/iron_guard.png", import.meta.url).href,
  sun_court: new URL("./assets/factions/sun_court.png", import.meta.url).href,
  void_order: new URL("./assets/factions/void_order.png", import.meta.url).href,
  void_monks: new URL("./assets/factions/void_order.png", import.meta.url).href,
};

export function factionArtFor(faction) {
  const id = typeof faction === "string" ? faction : faction?.id || faction?.favorite_faction || faction?.faction;
  const normalized = String(id || "nomads").toLowerCase().replace(/\s+/g, "_");
  return faction?.art_url || faction?.image || factionArt[normalized] || "";
}

export { factionArt };
