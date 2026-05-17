const proArt = {
  premium_vault_skins: new URL("./assets/pro/premium_vault_skins.png", import.meta.url).href,
  unlimited_ai_coach: new URL("./assets/pro/unlimited_ai_coach.png", import.meta.url).href,
  ranked_identity_badges: new URL("./assets/pro/ranked_identity_badges.png", import.meta.url).href,
};

export function proArtFor(key) {
  return proArt[key] || "";
}

export { proArt };
