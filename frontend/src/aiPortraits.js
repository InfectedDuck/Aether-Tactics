const aiPortraits = {
  recruit: new URL("./assets/ai/recruit_ai.png", import.meta.url).href,
  recruit_ai: new URL("./assets/ai/recruit_ai.png", import.meta.url).href,
  beginner: new URL("./assets/ai/recruit_ai.png", import.meta.url).href,
  tactician: new URL("./assets/ai/tactician_ai.png", import.meta.url).href,
  tactician_ai: new URL("./assets/ai/tactician_ai.png", import.meta.url).href,
  smart: new URL("./assets/ai/tactician_ai.png", import.meta.url).href,
  veteran: new URL("./assets/ai/veteran_ai.png", import.meta.url).href,
  veteran_ai: new URL("./assets/ai/veteran_ai.png", import.meta.url).href,
  coach: new URL("./assets/ai/nexus_prime_ai.png", import.meta.url).href,
  nexus_prime: new URL("./assets/ai/nexus_prime_ai.png", import.meta.url).href,
  nexus_prime_ai: new URL("./assets/ai/nexus_prime_ai.png", import.meta.url).href,
  campaign: new URL("./assets/ai/veteran_ai.png", import.meta.url).href,
  puzzle: new URL("./assets/ai/tactician_ai.png", import.meta.url).href,
};

export function aiPortraitFor(profile) {
  const id = typeof profile === "string" ? profile : profile?.aiProfileId || profile?.id || profile?.engineLevel || profile?.difficulty;
  const normalized = String(id || "smart").toLowerCase().replace(/\s+/g, "_");
  return (typeof profile === "object" && (profile.portrait_url || profile.image || profile.avatar_url)) || aiPortraits[normalized] || "";
}

export { aiPortraits };
