const abilityArt = {
  open_roads: new URL("./assets/abilities/open_roads.png", import.meta.url).href,
  dust_veil: new URL("./assets/abilities/dust_veil.png", import.meta.url).href,
  dash: new URL("./assets/abilities/dash.png", import.meta.url).href,
  sandstorm_corridor: new URL("./assets/abilities/sandstorm_corridor.png", import.meta.url).href,
  shield_wall: new URL("./assets/abilities/shield_wall.png", import.meta.url).href,
  vengeance_ledger: new URL("./assets/abilities/vengeance_ledger.png", import.meta.url).href,
  fortify: new URL("./assets/abilities/fortify.png", import.meta.url).href,
  barricade: new URL("./assets/abilities/barricade.png", import.meta.url).href,
  royal_pressure: new URL("./assets/abilities/royal_pressure.png", import.meta.url).href,
  crown_tax: new URL("./assets/abilities/crown_tax.png", import.meta.url).href,
  crown_surge: new URL("./assets/abilities/crown_surge.png", import.meta.url).href,
  sun_lance: new URL("./assets/abilities/sun_lance.png", import.meta.url).href,
  pressure_field: new URL("./assets/abilities/pressure_field.png", import.meta.url).href,
  echo_mark: new URL("./assets/abilities/echo_mark.png", import.meta.url).href,
  phase_shift: new URL("./assets/abilities/phase_shift.png", import.meta.url).href,
  collapse: new URL("./assets/abilities/collapse.png", import.meta.url).href,
};

export function abilityArtFor(ability) {
  const id = typeof ability === "string" ? ability : ability?.id;
  return (typeof ability === "object" && (ability.art_url || ability.image)) || abilityArt[id] || "";
}

export { abilityArt };
