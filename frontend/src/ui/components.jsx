import { formatCompact } from "./format.js";

/* Shared redesigned primitives. All classNames use the at- prefix.
 * Sentence case labels are the caller's responsibility. */

export function AtButton({ variant = "primary", size = "md", children, className = "", ...rest }) {
  const sizeClass = size === "lg" ? "at-btn--lg" : size === "sm" ? "at-btn--sm" : "at-btn--md";
  return (
    <button type="button" className={`at-btn at-btn--${variant} ${sizeClass} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}

export function AtTabs({ tabs = [], activeId, onChange }) {
  return (
    <div className="at-tabs" role="tablist" aria-label="Page sections">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            disabled={tab.disabled}
            type="button"
            className={`at-tab${active ? " at-tab--active" : ""}`}
            onClick={() => onChange?.(tab.id)}
          >
            <span>{tab.label}</span>
            {tab.badge != null && tab.badge !== "" && <span className="at-tab__badge">{tab.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function AtSegmented({ options = [], value, onChange, ariaLabel = "View" }) {
  return (
    <div className="at-segmented" role="tablist" aria-label={ariaLabel}>
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            role="tab"
            aria-selected={active}
            type="button"
            className={`at-segmented__opt${active ? " at-segmented__opt--active" : ""}`}
            onClick={() => onChange?.(opt.id)}
          >
            <span>{opt.label}</span>
            {opt.meta && <span className="at-segmented__meta">{opt.meta}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function AtFilterChips({ chips = [], value, onChange, multi = false, values = [] }) {
  return (
    <div className="at-chips" role="toolbar" aria-label="Filters">
      {chips.map((chip) => {
        const selected = multi ? values.includes(chip.id) : value === chip.id;
        return (
          <button
            key={chip.id}
            type="button"
            disabled={chip.disabled}
            aria-pressed={selected}
            className={`at-chip${selected ? " at-chip--selected" : ""}`}
            onClick={() => onChange?.(chip.id)}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}

export function AtCurrencyPill({ kind = "shards", amount = 0 }) {
  const isShards = kind === "shards";
  return (
    <span className={`at-currency at-currency--${kind}`} title={String(amount)}>
      <span className="at-currency__icon" aria-hidden="true">
        {isShards ? "◆" : "●"}
      </span>
      <span className="at-currency__value">{formatCompact(amount)}</span>
      <span className="at-sr-only">{isShards ? "Shards" : "Essence"}: {amount}</span>
    </span>
  );
}

export function AtRarityTag({ rarity = "common" }) {
  return <span className={`at-rarity-tag at-rarity-tag--${rarity}`}>{rarity}</span>;
}

export function AtRarityStrip({ rarity = "common" }) {
  return <span className={`at-rarity-strip at-rarity-strip--${rarity}`} aria-hidden="true" />;
}

export function AtProgressBar({ variant = "pass", value = 0, max = 100, segments = 0, status = "active", ariaLabel = "Progress" }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  if (variant === "segmented" && segments > 1) {
    const filled = Math.round((value / max) * segments);
    return (
      <div className="at-progress at-progress--segmented" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={ariaLabel}>
        {Array.from({ length: segments }).map((_, i) => (
          <span key={i} className={`at-progress__seg${i < filled ? " at-progress__seg--filled" : ""}`} />
        ))}
      </div>
    );
  }
  return (
    <div
      className={`at-progress at-progress--${variant} at-progress--${status}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={ariaLabel}
    >
      <span className="at-progress__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function AtItemCard({ image, name, rarity = "common", type = "", price, unit = "", owned = false, equipped = false, selected = false, onClick }) {
  const status = equipped ? "Equipped" : owned ? "Owned" : price != null ? `${formatCompact(price)}${unit ? ` ${unit}` : ""}` : "";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`at-item-card${selected ? " at-item-card--selected" : ""}${equipped ? " at-item-card--equipped" : ""}`}
    >
      <span className="at-item-card__media">
        {image ? <img src={image} alt="" loading="lazy" /> : <span className="at-item-card__placeholder" aria-hidden="true" />}
        <AtRarityStrip rarity={rarity} />
      </span>
      <span className="at-item-card__body">
        <span className="at-card-title at-item-card__name">{name}</span>
        <span className="at-caption at-item-card__meta">
          {rarity} · {type}
        </span>
        <span className={`at-item-card__status${equipped ? " at-item-card__status--equipped" : ""}`}>{status}</span>
      </span>
    </button>
  );
}

const TIER_STATE_LABEL = {
  claimed: "Claimed",
  claimable: "Claim",
  locked: "Locked",
  prolocked: "Pro",
  future: "Locked",
};

export function AtTierNode({ tier, state = "locked", selected = false, isCurrent = false, onSelect, children }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Tier ${tier}, ${TIER_STATE_LABEL[state] || state}${isCurrent ? ", current" : ""}`}
      className={`at-tier-node tn--${state}${selected ? " tn--selected" : ""}${isCurrent ? " tn--current" : ""}${state === "claimable" ? " at-claimable-glow" : ""}`}
    >
      <span className="at-tier-node__tier">Tier {tier}</span>
      <span className="at-tier-node__art">{children}</span>
      <span className="at-tier-node__state">{TIER_STATE_LABEL[state] || state}</span>
    </button>
  );
}

export function AtMissionRow({ icon, title, hint, value = 0, max = 1, reward = "", done = false, claimable = false, onClaim }) {
  return (
    <div className={`at-mission${done ? " at-mission--done" : ""}`}>
      <span className="at-mission__icon" aria-hidden="true">
        {icon || (done ? "✓" : "◆")}
      </span>
      <span className="at-mission__main">
        <span className="at-mission__title">{title}</span>
        {hint && <span className="at-caption at-mission__hint">{hint}</span>}
        <AtProgressBar variant="mission" value={value} max={max} status={done ? "done" : "active"} ariaLabel={title} />
        <span className="at-caption at-mission__progress">
          {value}/{max}
        </span>
      </span>
      <span className="at-mission__side">
        {reward && <span className="at-reward-chip">{done ? `${reward} ✓` : reward}</span>}
        {claimable && !done && (
          <AtButton variant="soft" size="sm" onClick={onClaim}>
            Claim
          </AtButton>
        )}
      </span>
    </div>
  );
}

export function AtMissionList({ children }) {
  return <div className="at-mission-list">{children}</div>;
}

export function AtDetailPanel({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="at-detail__backdrop" onClick={onClose}>
      <aside
        className="at-detail"
        role="dialog"
        aria-modal="true"
        aria-label={title || "Details"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="at-detail__head">
          <span className="at-card-title">{title}</span>
          <button type="button" className="at-detail__close" onClick={onClose} aria-label="Close details">
            ×
          </button>
        </div>
        <div className="at-detail__body">{children}</div>
      </aside>
    </div>
  );
}

export function AtPageHeader({ title, breadcrumb = [], onBack, actions }) {
  const secondLevel = breadcrumb.length > 0 || onBack;
  return (
    <header className="at-page-header">
      {secondLevel ? (
        <div className="at-page-header__row">
          {onBack && (
            <button type="button" className="at-back" onClick={onBack} aria-label="Go back">
              ←
            </button>
          )}
          {breadcrumb.length > 0 && (
            <nav className="at-breadcrumb" aria-label="Breadcrumb">
              {breadcrumb.map((crumb, i) => (
                <span key={i} className="at-breadcrumb__item">
                  {i > 0 && <span aria-hidden="true"> / </span>}
                  <span className={i === breadcrumb.length - 1 ? "at-breadcrumb__current" : ""}>{crumb}</span>
                </span>
              ))}
            </nav>
          )}
        </div>
      ) : null}
      <div className="at-page-header__main">
        <h1 className="at-page-title">{title}</h1>
        {actions && <div className="at-page-header__actions">{actions}</div>}
      </div>
    </header>
  );
}
