const campaignArt = {
  nomad_comeback: new URL("./assets/campaign/nomad_comeback.png", import.meta.url).href,
  road_behind: new URL("./assets/campaign/nomad_comeback.png", import.meta.url).href,
  verdant_breach: new URL("./assets/campaign/nomad_comeback.png", import.meta.url).href,
  capture_chain: new URL("./assets/campaign/capture_chain.png", import.meta.url).href,
  dust_trap: new URL("./assets/campaign/capture_chain.png", import.meta.url).href,
  white_signal: new URL("./assets/campaign/capture_chain.png", import.meta.url).href,
  promotion_race: new URL("./assets/campaign/promotion_race.png", import.meta.url).href,
  salt_road_sprint: new URL("./assets/campaign/promotion_race.png", import.meta.url).href,
  ashen_crossing: new URL("./assets/campaign/promotion_race.png", import.meta.url).href,
  survival_puzzle: new URL("./assets/campaign/survival_puzzle.png", import.meta.url).href,
  storm_gate: new URL("./assets/campaign/survival_puzzle.png", import.meta.url).href,
  final_nexus_gate: new URL("./assets/campaign/final_nexus_gate.png", import.meta.url).href,
  black_archive: new URL("./assets/campaign/final_nexus_gate.png", import.meta.url).href,
  iron_trial: new URL("./assets/campaign/iron_trial.png", import.meta.url).href,
  iron_first_wall: new URL("./assets/campaign/iron_trial.png", import.meta.url).href,
  sun_trial: new URL("./assets/campaign/sun_trial.png", import.meta.url).href,
  solar_crown_engine: new URL("./assets/campaign/sun_trial.png", import.meta.url).href,
  void_trial: new URL("./assets/campaign/void_trial.png", import.meta.url).href,
  void_first_shift: new URL("./assets/campaign/void_trial.png", import.meta.url).href,
};

export function campaignArtFor(node) {
  const id = typeof node === "string" ? node : node?.id || node?.level_id;
  return (typeof node === "object" && (node.art_url || node.image)) || campaignArt[id] || "";
}

export { campaignArt };
