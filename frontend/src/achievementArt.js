const achievementArt = {
  first_victory: new URL("./assets/achievements/first_victory.png", import.meta.url).href,
  capture_artist: new URL("./assets/achievements/capture_artist.png", import.meta.url).href,
  trail_runner: new URL("./assets/achievements/trail_runner.png", import.meta.url).href,
  city_banner: new URL("./assets/achievements/city_banner.png", import.meta.url).href,
  vault_collector: new URL("./assets/achievements/vault_collector.png", import.meta.url).href,
  daily_tactician: new URL("./assets/achievements/daily_tactician.png", import.meta.url).href,
  coach_student: new URL("./assets/achievements/coach_student.png", import.meta.url).href,
  faction_recruiter: new URL("./assets/achievements/faction_recruiter.png", import.meta.url).href,
};

export function achievementArtFor(achievement) {
  const id = typeof achievement === "string" ? achievement : achievement?.id;
  return (typeof achievement === "object" && (achievement.art_url || achievement.image)) || achievementArt[id] || "";
}

export { achievementArt };
