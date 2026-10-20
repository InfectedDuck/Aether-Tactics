import { useEffect, useMemo, useState } from "react";
import { cosmeticArtFor } from "../cosmeticArt.js";
import { formatCompact } from "./format.js";
import {
  AtButton,
  AtDetailPanel,
  AtFilterChips,
  AtItemCard,
  AtPageHeader,
  AtRarityTag,
  AtSegmented,
  AtTabs,
} from "./components.jsx";

/* Collection screen (redesign Phase 3.2). Presentational only: CollectionScreen
 * in App.jsx prepares normalized items + flags (same data the old VaultScreen /
 * InventoryScreen received) and passes them down. No game logic, no backend
 * calls, no URL changes. Old /vault and /inventory URLs still land here via
 * initialTab.
 */

function artFor(cosmetic) {
  return cosmetic?.preview_url || cosmeticArtFor(cosmetic) || "";
}

function kindKey(cosmetic) {
  if (!cosmetic) return "cosmetic";
  if (cosmetic.kind === "piece_skin") return "piece";
  if (cosmetic.kind === "board_skin") return "board";
  if (cosmetic.kind === "badge") return "badge";
  if (cosmetic.kind === "emote") {
    return String(cosmetic.cosmetic_id || "").startsWith("sticker_") ? "sticker" : "emote";
  }
  return "cosmetic";
}

const KIND_LABEL = {
  piece: "Piece skin",
  board: "Board skin",
  emote: "Emote",
  sticker: "Sticker",
  badge: "Badge",
};

function typeLabel(cosmetic) {
  if (cosmetic?.cosmetic_id === "void_order_campaign_pass") return "Pass";
  return KIND_LABEL[kindKey(cosmetic)] || "Cosmetic";
}

function oneLineFor(cosmetic) {
  if (!cosmetic) return "Universal cosmetic.";
  const key = kindKey(cosmetic);
  if (cosmetic.cosmetic_id === "void_order_campaign_pass") {
    return "Unlocks the Void Order faction and its first campaign trial.";
  }
  if (key === "piece") {
    return cosmetic.model_url ? "Styles your own pieces in live matches." : "Styles your own pieces on the 2D board.";
  }
  if (key === "board") return "Restyles your board background.";
  if (key === "emote") return "Sends from the match chat wheel.";
  if (key === "sticker") return "Sticks onto match chat.";
  if (key === "badge") return "Marks your commander identity.";
  return "Universal cosmetic.";
}

function visibilityFor(cosmetic) {
  const key = kindKey(cosmetic);
  if (key === "board") return "Board skins stay private.";
  if (key === "badge") return "Visible on your profile.";
  return "Visible to opponents.";
}

function msToMidnight(now = new Date()) {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.max(0, midnight - now);
}

function countdownLabel(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `New pick in ${hours}h ${minutes}m`;
}

function ShopDetail({ item, shards, busy, onPurchase, onClose }) {
  const cosmetic = item?.cosmetic;
  if (!cosmetic) return null;
  return (
    <div className="at-detail-content">
      <span className="at-detail-content__art">{artFor(cosmetic) ? <img src={artFor(cosmetic)} alt="" /> : "◆"}</span>
      <AtRarityTag rarity={cosmetic.rarity} />
      <h3 className="at-section-title">{cosmetic.name}</h3>
      <p className="at-caption">
        {cosmetic.rarity} · {typeLabel(cosmetic)}
      </p>
      <p className="at-body">{oneLineFor(cosmetic)}</p>
      <p className="at-caption">{visibilityFor(cosmetic)}</p>
      {item.locked && <p className="at-caption at-detail-content__warn">Unlocks with the {item.factionName} faction.</p>}
      <div className="at-detail-content__price">
        <strong>
          {formatCompact(cosmetic.price_shards)} Shards
        </strong>
        <span className="at-caption" title={String(shards)}>
          You have {Number(shards || 0).toLocaleString("en-US")} Shards
        </span>
      </div>
      <AtButton
        variant="primary"
        size="md"
        disabled={busy || item.owned}
        onClick={() => onPurchase(cosmetic)}
      >
        {busy ? "Purchasing…" : item.owned ? "Owned" : `Buy for ${formatCompact(cosmetic.price_shards)} Shards`}
      </AtButton>
    </div>
  );
}

function InventoryDetail({ entry, onEquip, onClose }) {
  const cosmetic = entry?.cosmetic;
  if (!cosmetic) return null;
  const canEquip = !entry.busy && !entry.equipped && entry.compatible;
  return (
    <div className="at-detail-content">
      <span className="at-detail-content__art">{artFor(cosmetic) ? <img src={artFor(cosmetic)} alt="" /> : "◆"}</span>
      <AtRarityTag rarity={cosmetic.rarity} />
      <h3 className="at-section-title">{cosmetic.name}</h3>
      <p className="at-caption">
        {cosmetic.rarity} · {typeLabel(cosmetic)}
      </p>
      <p className="at-body">{oneLineFor(cosmetic)}</p>
      <p className="at-caption">{visibilityFor(cosmetic)}</p>
      {!entry.compatible && <p className="at-caption at-detail-content__warn">{entry.incompatibleNote}</p>}
      <p className="at-caption">Replaces {entry.occupantName} in the {entry.slotLabel}.</p>
      <AtButton
        variant="primary"
        size="md"
        disabled={!canEquip}
        onClick={() => onEquip(entry)}
      >
        {entry.busy ? "Equipping…" : entry.equipped ? "Equipped" : "Equip"}
      </AtButton>
    </div>
  );
}

export function CollectionView({
  initialTab = "shop",
  shards = 0,
  message = "",
  featured = null,
  shopItems = [],
  onPurchase,
  invEntries = [],
  equippedSlots = [],
  appearance = null,
  onViewMode,
  onPieceColor,
  onSaveAppearance,
  onEquipEntry,
}) {
  const [tab, setTab] = useState(initialTab === "inventory" ? "inventory" : "shop");
  const [shopFilter, setShopFilter] = useState("all");
  const [invFilter, setInvFilter] = useState("all");
  const [selectedShopId, setSelectedShopId] = useState("");
  const [selectedInvKey, setSelectedInvKey] = useState("");

  useEffect(() => {
    setTab(initialTab === "inventory" ? "inventory" : "shop");
  }, [initialTab]);

  const shopChips = useMemo(() => {
    const present = new Set(shopItems.map((item) => kindKey(item.cosmetic)));
    const chips = [{ id: "all", label: "All" }];
    ["piece", "board", "emote", "sticker", "badge"].forEach((key) => {
      if (present.has(key)) {
        chips.push({ id: key, label: `${KIND_LABEL[key]}s` });
      }
    });
    return chips;
  }, [shopItems]);

  const visibleShop = shopFilter === "all" ? shopItems : shopItems.filter((item) => kindKey(item.cosmetic) === shopFilter);
  const selectedShop = shopItems.find((item) => item.cosmetic.cosmetic_id === selectedShopId) || null;

  const invChips = useMemo(() => {
    const present = new Set(invEntries.map((entry) => kindKey(entry.cosmetic)));
    const chips = [{ id: "all", label: "All" }];
    ["piece", "board", "emote", "sticker", "badge"].forEach((key) => {
      if (present.has(key)) {
        chips.push({ id: key, label: `${KIND_LABEL[key]}s` });
      }
    });
    return chips;
  }, [invEntries]);

  const visibleInv = invFilter === "all" ? invEntries : invEntries.filter((entry) => kindKey(entry.cosmetic) === invFilter);
  const selectedInv = invEntries.find((entry) => entry.key === selectedInvKey) || null;

  return (
    <div className="at-root at-collection">
      <AtPageHeader title="Collection" />
      <AtTabs
        tabs={[
          { id: "shop", label: "Shop" },
          { id: "inventory", label: "Inventory" },
        ]}
        activeId={tab}
        onChange={(next) => {
          setTab(next);
          setSelectedShopId("");
          setSelectedInvKey("");
        }}
      />
      {message && <p className="at-caption">{message}</p>}

      {tab === "shop" && (
        <section aria-label="Shop">
          {featured ? (
            <button
              type="button"
              className="at-featured"
              onClick={() => setSelectedShopId(featured.cosmetic_id)}
              aria-label={`Featured: ${featured.name}. View details.`}
            >
              <span className="at-featured__art">{artFor(featured) ? <img src={artFor(featured)} alt="" /> : "◆"}</span>
              <span className="at-featured__main">
                <span className="at-overline">Featured rotation · {countdownLabel(msToMidnight())}</span>
                <strong className="at-section-title">{featured.name}</strong>
                <span className="at-caption">
                  {featured.rarity} · {typeLabel(featured)} · {formatCompact(featured.price_shards)} Shards
                </span>
              </span>
              <span className="at-featured__cta">View</span>
            </button>
          ) : (
            <p className="at-caption">Vault offline — no items were returned. Check backend and Supabase seed data.</p>
          )}

          <AtFilterChips chips={shopChips} value={shopFilter} onChange={setShopFilter} />

          <div className="at-grid">
            {visibleShop.map((item) => {
              const cosmetic = item.cosmetic;
              return (
                <AtItemCard
                  key={cosmetic.cosmetic_id}
                  image={artFor(cosmetic)}
                  name={cosmetic.name}
                  rarity={cosmetic.rarity}
                  type={typeLabel(cosmetic)}
                  price={cosmetic.price_shards}
                  unit="Shards"
                  owned={item.owned}
                  equipped={false}
                  selected={selectedShopId === cosmetic.cosmetic_id}
                  onClick={() => setSelectedShopId(cosmetic.cosmetic_id)}
                />
              );
            })}
          </div>
          {visibleShop.length === 0 && shopItems.length > 0 && <p className="at-caption">Nothing in this filter yet.</p>}

          <AtDetailPanel open={Boolean(selectedShop)} onClose={() => setSelectedShopId("")} title={selectedShop?.cosmetic.name || "Details"}>
            <ShopDetail item={selectedShop} shards={shards} busy={selectedShop?.busy} onPurchase={onPurchase} onClose={() => setSelectedShopId("")} />
          </AtDetailPanel>
        </section>
      )}

      {tab === "inventory" && (
        <section aria-label="Inventory">
          <span className="at-overline">Equipped</span>
          <div className="at-slots" role="list" aria-label="Equipped slots">
            {equippedSlots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                role="listitem"
                className={`at-slot${slot.cosmetic ? " at-slot--filled" : ""}`}
                disabled={!slot.cosmetic}
                onClick={() => slot.entryKey && setSelectedInvKey(slot.entryKey)}
                aria-label={slot.cosmetic ? `${slot.label}: ${slot.cosmetic.name}` : `${slot.label}: empty`}
                title={slot.cosmetic ? slot.cosmetic.name : `${slot.label} (empty)`}
              >
                <span className="at-slot__art">{slot.cosmetic && artFor(slot.cosmetic) ? <img src={artFor(slot.cosmetic)} alt="" /> : "+"}</span>
                <span className="at-slot__label">{slot.label}</span>
              </button>
            ))}
          </div>
          <p className="at-caption">Piece skins are visible to opponents. Board skins stay private.</p>

          {appearance && (
            <section className="at-appearance" aria-label="Appearance">
              <span className="at-overline">Appearance</span>
              <div className="at-appearance__row">
                <AtSegmented
                  ariaLabel="Board renderer"
                  value={appearance.viewMode}
                  onChange={onViewMode}
                  options={[
                    { id: "3d", label: "3D" },
                    { id: "2d", label: "2D" },
                  ]}
                />
                <AtButton variant="secondary" size="md" onClick={onSaveAppearance}>
                  Save match look
                </AtButton>
              </div>
              <div className="at-appearance__colors">
                {[
                  { player: "white", label: "Your basic disks", current: appearance.white },
                  { player: "black", label: "AI basic disks", current: appearance.black },
                ].map((row) => (
                  <label key={row.player} className="at-field">
                    <span className="at-caption">{row.label}</span>
                    <span className="at-field__controls">
                      <select
                        value={row.current.option}
                        onChange={(event) => {
                          const next = appearance.palette.find((item) => item.id === event.target.value);
                          if (next) onPieceColor?.(row.player, next.hex);
                        }}
                        aria-label={`${row.label} palette`}
                      >
                        {appearance.palette.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                        <option value="custom">Custom</option>
                      </select>
                      <input
                        type="color"
                        value={row.current.value}
                        onChange={(event) => onPieceColor?.(row.player, event.target.value)}
                        aria-label={`${row.label} custom color`}
                      />
                    </span>
                  </label>
                ))}
              </div>
              <p className="at-caption">Basic disks can be recolored. 3D models work only in 3D; premium SVG skins work only in 2D.</p>
            </section>
          )}

          <AtFilterChips chips={invChips} value={invFilter} onChange={setInvFilter} />

          <div className="at-grid">
            {visibleInv.map((entry) => (
              <AtItemCard
                key={entry.key}
                image={artFor(entry.cosmetic)}
                name={entry.cosmetic.name}
                rarity={entry.cosmetic.rarity}
                type={typeLabel(entry.cosmetic)}
                owned
                equipped={entry.equipped}
                selected={selectedInvKey === entry.key}
                onClick={() => setSelectedInvKey(entry.key)}
              />
            ))}
          </div>
          {visibleInv.length === 0 && <p className="at-caption">No items owned yet — open the Shop and buy a cosmetic with Shards.</p>}

          <AtDetailPanel open={Boolean(selectedInv)} onClose={() => setSelectedInvKey("")} title={selectedInv?.cosmetic.name || "Details"}>
            <InventoryDetail entry={selectedInv} onEquip={onEquipEntry} onClose={() => setSelectedInvKey("")} />
          </AtDetailPanel>
        </section>
      )}
    </div>
  );
}

export default CollectionView;
