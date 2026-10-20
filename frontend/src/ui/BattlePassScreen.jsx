import { useEffect, useMemo, useRef, useState } from "react";
import { cosmeticArtFor } from "../cosmeticArt.js";
import {
  AtButton,
  AtMissionList,
  AtMissionRow,
  AtPageHeader,
  AtProgressBar,
  AtSegmented,
  AtTabs,
} from "./components.jsx";

/* Battle Pass screen (redesign Phase 3.1).
 * Presentational only: all data arrives via props prepared by ProgressionScreen
 * in App.jsx (same data the old BattlePassDashboard received). No game logic,
 * no backend calls, no URL changes.
 */

function tierCosmeticId(tier) {
  const reward = tier?.reward || {};
  return reward.cosmetic_id || (Array.isArray(reward.cosmetic_ids) ? reward.cosmetic_ids[0] : "") || "";
}

function isProTier(tier) {
  return Boolean(tierCosmeticId(tier));
}

function resetLabel(cadence, now = new Date()) {
  if (cadence === "weekly") {
    const next = new Date(now);
    const delta = (8 - now.getDay()) % 7 || 7;
    next.setDate(now.getDate() + delta);
    next.setHours(0, 0, 0, 0);
    const diffMs = Math.max(0, next - now);
    const days = Math.floor(diffMs / 86400000);
    const hours = Math.floor((diffMs % 86400000) / 3600000);
    return `Resets in ${days}d ${hours}h`;
  }
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diffMs = Math.max(0, midnight - now);
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  return `Resets in ${hours}h ${minutes}m`;
}

function TierArt({ tier }) {
  const cosmeticId = tierCosmeticId(tier);
  const art = cosmeticId ? cosmeticArtFor(cosmeticId) : "";
  if (art) {
    return <img src={art} alt="" loading="lazy" />;
  }
  const reward = tier?.reward || {};
  const glyph = reward.shards ? "◆" : reward.essence ? "●" : "★";
  return (
    <span className="at-track-cell__glyph" aria-hidden="true">
      {glyph}
    </span>
  );
}

export function BattlePassScreen({
  season = {},
  tiers = [],
  missions = [],
  xp = 0,
  unlockedTiers = [],
  currentTier = 0,
  nextTier = null,
  percent = 0,
  totalXp = 0,
  proActive = false,
  describeReward,
  onPro,
}) {
  const [tab, setTab] = useState("track");
  const [cadence, setCadence] = useState("daily");
  const [selectedTier, setSelectedTier] = useState(() => nextTier?.tier ?? currentTier ?? 1);
  const trackRef = useRef(null);

  const unlockedSet = useMemo(() => new Set(unlockedTiers), [unlockedTiers]);
  const completedMissions = missions.filter((m) => m.is_completed).length;
  const daily = missions.filter((m) => m.cadence === "daily");
  const weekly = missions.filter((m) => m.cadence === "weekly");
  const visibleMissions = cadence === "weekly" ? weekly : daily;

  const selected = tiers.find((t) => t.tier === selectedTier) || nextTier || tiers[0];
  const selectedUnlocked = selected ? unlockedSet.has(selected.tier) : false;
  const selectedProLocked = selected ? isProTier(selected) && !proActive && selectedUnlocked : false;

  useEffect(() => {
    const node = trackRef.current?.querySelector("[data-current='true']");
    if (node && typeof node.scrollIntoView === "function") {
      const reduceMotion =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      node.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest", inline: "center" });
    }
  }, []);

  function scrollTrack(direction) {
    trackRef.current?.scrollBy({ left: direction * 320, behavior: "smooth" });
  }

  function tierState(tier) {
    if (unlockedSet.has(tier.tier)) {
      return isProTier(tier) && !proActive ? "prolocked" : "claimed";
    }
    if (nextTier && tier.tier === nextTier.tier) {
      return "locked";
    }
    return "future";
  }

  const xpToNext = nextTier ? Math.max(0, nextTier.required_xp - xp) : 0;

  return (
    <div className="at-root at-battle-pass">
      <AtPageHeader title="Battle Pass" />

      <section className="at-bp-hero" aria-label="Season progress">
        <div className="at-bp-hero__main">
          <span className="at-overline">{season.name || "Battle Pass"}</span>
          <strong className="at-bp-hero__tier">
            Tier {currentTier} of {tiers.length || 10}
          </strong>
          <AtProgressBar variant="pass" value={xp} max={totalXp || 1} ariaLabel="Battle pass progress" />
          <span className="at-caption">
            {nextTier ? `${xpToNext} BP XP to Tier ${nextTier.tier}` : "Season complete — all tiers unlocked"}
          </span>
        </div>
        {!proActive && (
          <AtButton variant="primary" size="lg" onClick={onPro}>
            Get Pro
          </AtButton>
        )}
      </section>

      <AtTabs
        tabs={[
          { id: "track", label: "Track" },
          { id: "missions", label: "Missions", badge: `${completedMissions}/${missions.length}` },
        ]}
        activeId={tab}
        onChange={setTab}
      />

      {tab === "track" && (
        <section aria-label="Reward track">
          <div className="at-track-controls">
            <span className="at-overline">Free row on top · Pro row below</span>
            <div className="at-track-controls__btns">
              <button type="button" className="at-back" onClick={() => scrollTrack(-1)} aria-label="Scroll track left">
                ‹
              </button>
              <button type="button" className="at-back" onClick={() => scrollTrack(1)} aria-label="Scroll track right">
                ›
              </button>
            </div>
          </div>

          <div className="at-track-scroll" ref={trackRef}>
            <div className="at-track" role="listbox" aria-label="Reward tiers">
              {tiers.map((tier) => {
                const state = tierState(tier);
                const isCurrent = Boolean(nextTier && tier.tier === nextTier.tier);
                const freeReward = !isProTier(tier) ? tier.reward : null;
                const proReward = isProTier(tier) ? tier.reward : null;
                return (
                  <button
                    key={tier.tier}
                    type="button"
                    role="option"
                    aria-selected={selected?.tier === tier.tier}
                    data-current={isCurrent || undefined}
                    className={`at-track-col tn--${state}${selected?.tier === tier.tier ? " tn--selected" : ""}${
                      isCurrent ? " tn--current" : ""
                    }`}
                    onClick={() => setSelectedTier(tier.tier)}
                    aria-label={`Tier ${tier.tier}, ${tier.title}, ${state}`}
                  >
                    <span className="at-track-cell at-track-cell--free">
                      {freeReward ? <TierArt tier={tier} /> : <span className="at-track-cell__empty">—</span>}
                    </span>
                    <span className="at-track-cell__number">{tier.tier}</span>
                    <span className="at-track-cell at-track-cell--pro">
                      {proReward ? <TierArt tier={tier} /> : <span className="at-track-cell__empty">—</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {selected && (
            <article className="at-bp-preview" aria-live="polite" aria-label={`Tier ${selected.tier} details`}>
              <span className="at-bp-preview__art">
                <TierArt tier={selected} />
              </span>
              <div className="at-bp-preview__main">
                <span className={`at-rarity-tag ${isProTier(selected) ? "at-rarity-tag--epic" : "at-rarity-tag--common"}`}>
                  {isProTier(selected) ? "Pro reward" : "Free reward"}
                </span>
                <h3 className="at-section-title">
                  Tier {selected.tier} — {selected.title}
                </h3>
                <p className="at-body">{describeReward ? describeReward(selected.reward) : ""}</p>
                <span className="at-caption">
                  {selectedUnlocked
                    ? selectedProLocked
                      ? "Unlocked but waiting on Pro."
                      : "Obtained."
                    : nextTier && selected.tier === nextTier.tier
                      ? `${xpToNext} BP XP remaining.`
                      : `Unlocks at ${selected.required_xp} BP XP.`}
                </span>
              </div>
              <div className="at-bp-preview__action">
                {selectedProLocked && (
                  <AtButton variant="primary" size="md" onClick={onPro}>
                    Unlock with Pro
                  </AtButton>
                )}
              </div>
            </article>
          )}
        </section>
      )}

      {tab === "missions" && (
        <section aria-label="Missions">
          <div className="at-missions-bar">
            <AtSegmented
              ariaLabel="Mission cadence"
              value={cadence}
              onChange={setCadence}
              options={[
                {
                  id: "daily",
                  label: "Daily",
                  meta: `${daily.filter((m) => m.is_completed).length}/${daily.length}`,
                },
                {
                  id: "weekly",
                  label: "Weekly",
                  meta: `${weekly.filter((m) => m.is_completed).length}/${weekly.length}`,
                },
              ]}
            />
            <span className="at-caption">{resetLabel(cadence)}</span>
          </div>

          <AtMissionList>
            {visibleMissions.map((mission) => (
              <AtMissionRow
                key={mission.mission_id}
                title={mission.title}
                hint={mission.description}
                value={Math.min(mission.progress_count, mission.target_count)}
                max={mission.target_count}
                reward={`+${mission.battle_pass_xp} BP XP`}
                done={mission.is_completed}
              />
            ))}
          </AtMissionList>
          <p className="at-caption at-bp-footnote">BP XP is added automatically when you finish a mission.</p>
        </section>
      )}
    </div>
  );
}

export default BattlePassScreen;
