import { AtButton, AtPageHeader, AtProgressBar } from "./components.jsx";

/* Play hub (redesign Phase 3.3). Presentational only: the nexus branch in
 * App.jsx prepares the hero + tiles (same data NexusCoreMenu received) and
 * passes them down. No game logic, no backend calls, no URL changes.
 */

export function PlayHub({
  isAuthenticated = false,
  hero = null,
  continueLabel = "Continue",
  onContinue,
  showAllCampaigns = false,
  onAllCampaigns,
  tiles = [],
  onTile,
  onLogin,
}) {
  return (
    <div className="at-root at-play">
      <AtPageHeader title="Play" />

      {hero && (
        <section className="at-hero-card" aria-label="Recommended next action">
          <span className="at-hero-card__art" aria-hidden="true">
            {hero.art ? <img src={hero.art} alt="" /> : <span className="at-hero-card__glyph">▶</span>}
          </span>
          <div className="at-hero-card__main">
            <span className="at-overline">{hero.eyebrow}</span>
            <h2 className="at-hero">{hero.title}</h2>
            {hero.subtitle && <p className="at-body">{hero.subtitle}</p>}
            {hero.segments > 1 && (
              <AtProgressBar
                variant="segmented"
                value={hero.progressValue}
                max={hero.segments}
                segments={hero.segments}
                ariaLabel={hero.meta || "Campaign progress"}
              />
            )}
            {hero.meta && <span className="at-caption">{hero.meta}</span>}
            <div className="at-hero-card__actions">
              <AtButton variant="primary" size="lg" onClick={onContinue}>
                {continueLabel}
              </AtButton>
              {showAllCampaigns && (
                <AtButton variant="secondary" size="lg" onClick={onAllCampaigns}>
                  All campaigns
                </AtButton>
              )}
              {!isAuthenticated && (
                <AtButton variant="secondary" size="lg" onClick={onLogin}>
                  Login / Register
                </AtButton>
              )}
            </div>
          </div>
        </section>
      )}

      <section aria-label="Game modes">
        <span className="at-overline">Modes</span>
        <div className="at-modes">
          {tiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              className="at-mode-tile"
              onClick={() => onTile?.(tile.id)}
              aria-label={`${tile.title}. ${tile.meta || ""}`}
            >
              <span className="at-mode-tile__art" aria-hidden="true">
                {tile.art ? <img src={tile.art} alt="" loading="lazy" /> : <span className="at-mode-tile__glyph">{tile.title.slice(0, 1)}</span>}
              </span>
              <span className="at-mode-tile__main">
                <strong className="at-card-title">{tile.title}</strong>
                {tile.meta && <span className="at-caption">{tile.meta}</span>}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export default PlayHub;
