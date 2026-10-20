import { useEffect, useState } from "react";
import { AtButton, AtPageHeader, AtTabs } from "./components.jsx";

/* Factions screen (redesign Phase 3.5). Presentational only: FactionsScreen in
 * App.jsx prepares the faction + ability view-model (same data TacticalLoadout
 * received) and a renderCodex closure for the existing Codex view. No game
 * logic, no backend calls, no URL changes.
 */

function AbilityCard({ ability, selected, current, locked, onSelect }) {
  return (
    <button
      type="button"
      className={`at-ability${selected ? " at-ability--selected" : ""}${current ? " at-ability--current" : ""}${locked ? " at-ability--locked" : ""}`}
      aria-pressed={selected}
      onClick={onSelect}
      aria-label={`${ability.name}. ${ability.costLabel}${locked ? `. ${ability.requirement}` : ""}${current ? ". Currently equipped" : ""}`}
    >
      <span className="at-ability__icon" aria-hidden="true">
        {ability.art ? <img src={ability.art} alt="" loading="lazy" /> : ability.icon || ability.name.slice(0, 2)}
      </span>
      <span className="at-ability__main">
        <strong>{ability.name}</strong>
        <small>{ability.costLabel}</small>
        <span className="at-caption">{locked ? ability.requirement : ability.description}</span>
      </span>
      {current && <b className="at-ability__flag">Equipped</b>}
      {locked && <b className="at-ability__flag at-ability__flag--lock">Locked</b>}
    </button>
  );
}

export function FactionsView({
  initialTab = "loadout",
  factions = [],
  loadout = {},
  message = "",
  setupSummary = null,
  hasPendingSetup = false,
  onSave,
  onInitialize,
  onLockedFaction,
  onVaultAction,
  onProgressionAction,
  renderCodex,
}) {
  const [tab, setTab] = useState(initialTab === "codex" ? "codex" : "loadout");
  const [draft, setDraft] = useState(() => ({
    factionId: loadout.factionId || factions[0]?.id || "nomads",
    passiveId: loadout.passiveId || "",
    ultimateId: loadout.ultimateId || "",
  }));

  useEffect(() => {
    setTab(initialTab === "codex" ? "codex" : "loadout");
  }, [initialTab]);

  const faction = factions.find((item) => item.id === draft.factionId) || factions[0];
  const activePassiveId = faction?.id === loadout.factionId ? loadout.passiveId : faction?.passives[0]?.id;
  const activeUltimateId = faction?.id === loadout.factionId ? loadout.ultimateId : faction?.ultimates[0]?.id;
  const draftPassive = faction?.passives.find((ability) => ability.id === (draft.passiveId || activePassiveId)) || faction?.passives[0];
  const draftUltimate = faction?.ultimates.find((ability) => ability.id === (draft.ultimateId || activeUltimateId)) || faction?.ultimates[0];
  const completeDraft = { factionId: faction?.id, passiveId: draftPassive?.id, ultimateId: draftUltimate?.id };
  const dirty =
    completeDraft.factionId !== loadout.factionId || completeDraft.passiveId !== loadout.passiveId || completeDraft.ultimateId !== loadout.ultimateId;

  function chooseFaction(factionId) {
    const next = factions.find((item) => item.id === factionId);
    if (!next) return;
    if (!next.unlocked) {
      onLockedFaction?.(factionId);
      return;
    }
    setDraft({
      factionId,
      passiveId: next.passives[0]?.id || "",
      ultimateId: next.ultimates[0]?.id || "",
    });
  }

  function chooseAbility(ability) {
    if (!faction?.unlocked) {
      onLockedFaction?.(faction.id);
      return;
    }
    setDraft((current) => ({
      ...current,
      factionId: faction.id,
      passiveId: ability.type === "passive" ? ability.id : current.passiveId || draftPassive?.id,
      ultimateId: ability.type === "ultimate" ? ability.id : current.ultimateId || draftUltimate?.id,
    }));
  }

  function resetDraft() {
    setDraft({
      factionId: loadout.factionId || factions[0]?.id || "nomads",
      passiveId: loadout.passiveId || "",
      ultimateId: loadout.ultimateId || "",
    });
  }

  return (
    <div className="at-root at-factions">
      <AtPageHeader title="Factions" />
      <AtTabs
        tabs={[
          { id: "loadout", label: "Loadout" },
          { id: "codex", label: "Codex" },
        ]}
        activeId={tab}
        onChange={setTab}
      />
      {message && <p className="at-caption">{message}</p>}

      {tab === "codex" && renderCodex?.()}

      {tab === "loadout" && faction && (
        <div className="at-factions__body">
          <aside className="at-faction-list" aria-label="Factions">
            {factions.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`at-faction-row${item.id === faction.id ? " at-faction-row--selected" : ""}`}
                aria-pressed={item.id === faction.id}
                onClick={() => chooseFaction(item.id)}
                aria-label={`${item.name}. ${item.statusLabel}`}
              >
                <span className="at-faction-row__portrait" aria-hidden="true">
                  {item.art ? <img src={item.art} alt="" loading="lazy" /> : item.crest}
                </span>
                <span className="at-faction-row__main">
                  <strong>{item.name}</strong>
                  <small>
                    {!item.unlocked && <span aria-hidden="true">🔒 </span>}
                    {item.statusLabel}
                  </small>
                </span>
              </button>
            ))}
          </aside>

          <div className="at-faction-main">
            <section className="at-faction-hero" aria-label={`${faction.name} hero`}>
              <span className="at-faction-hero__art" aria-hidden="true">
                {faction.art ? <img src={faction.art} alt="" /> : faction.crest}
              </span>
              <div className="at-faction-hero__main">
                <span className="at-overline">{faction.statusLabel}</span>
                <h2 className="at-section-title">{faction.name}</h2>
                <p className="at-body">{faction.lore}</p>
                <div className="at-faction-hero__tags">
                  <span className="at-reward-chip">{faction.passives.length + faction.ultimates.length} abilities</span>
                </div>
                <button type="button" className="at-link" onClick={() => setTab("codex")}>
                  Read the lore
                </button>
              </div>
            </section>

            {setupSummary && (
              <p className="at-caption">
                {setupSummary.mode} · {setupSummary.difficulty} · {setupSummary.rewards}
              </p>
            )}

            <section aria-label="Passive pair">
              <span className="at-overline">Passive pair</span>
              <div className="at-ability-pair">
                {faction.passives.map((ability) => (
                  <AbilityCard
                    key={ability.id}
                    ability={ability}
                    selected={draftPassive?.id === ability.id}
                    current={activePassiveId === ability.id && faction.id === loadout.factionId}
                    locked={!faction.unlocked}
                    onSelect={() => chooseAbility(ability)}
                  />
                ))}
              </div>
            </section>

            <section aria-label="Ultimate pair">
              <span className="at-overline">Ultimate pair</span>
              <div className="at-ability-pair">
                {faction.ultimates.map((ability) => (
                  <AbilityCard
                    key={ability.id}
                    ability={ability}
                    selected={draftUltimate?.id === ability.id}
                    current={activeUltimateId === ability.id && faction.id === loadout.factionId}
                    locked={!faction.unlocked}
                    onSelect={() => chooseAbility(ability)}
                  />
                ))}
              </div>
            </section>

            {!faction.unlocked && (
              <div className="at-faction-locked">
                <p className="at-caption">
                  {faction.id === "void_order" ? "Void Order is a Pro faction." : `Unlocks at ${faction.requirementLabel}.`}
                </p>
                {faction.id === "void_order" ? (
                  <AtButton variant="secondary" size="md" onClick={onVaultAction}>
                    Preview Pro
                  </AtButton>
                ) : (
                  <AtButton variant="secondary" size="md" onClick={onProgressionAction}>
                    View progression
                  </AtButton>
                )}
              </div>
            )}

            <div className="at-faction-actions">
              {hasPendingSetup ? (
                <AtButton variant="primary" size="lg" disabled={!faction.unlocked} onClick={() => onInitialize?.(completeDraft)}>
                  Save and initialize
                </AtButton>
              ) : (
                <AtButton variant="primary" size="lg" disabled={!faction.unlocked || !dirty} onClick={() => onSave?.(completeDraft)}>
                  Save loadout
                </AtButton>
              )}
              <AtButton variant="ghost" size="lg" onClick={resetDraft}>
                Reset
              </AtButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FactionsView;
