import { useState } from "react";
import { AtButton, AtProgressBar } from "./components.jsx";

/* Post-match screen (redesign Phase 3.4). Presentational only: PostMatchSummary
 * in App.jsx prepares the numbers (same data the old screen received) and
 * passes a renderDetails closure for the existing replay/coach views. No game
 * logic, no backend calls, no URL changes.
 */

export function PostMatchView({
  isVictory = true,
  captured = 0,
  lost = 0,
  turns = 0,
  shards = 0,
  essence = 0,
  exp = 0,
  expProgress = 0,
  levelLabel = "",
  expLabel = "",
  missionLine = "",
  onViewMissions,
  coachSummary = "",
  bestMove = "",
  workOn = "",
  abilityImpact = "",
  playAgainLabel = "Play again",
  onPlayAgain,
  onBackToPlay,
  renderDetails,
}) {
  const [showReview, setShowReview] = useState(false);

  return (
    <div className="at-root at-postmatch">
      <section className="at-result" aria-label={isVictory ? "Victory" : "Defeat"}>
        <h1 className={`at-result__title ${isVictory ? "at-result__title--victory" : "at-result__title--defeat"}`}>
          {isVictory ? "Victory" : "Defeat"}
        </h1>
        <p className="at-body">
          {captured} captured · {lost} lost · {turns} turns
        </p>
      </section>

      <section className="at-card" aria-label="Rewards">
        <span className="at-overline">Rewards</span>
        <dl className="at-rewards">
          <div>
            <dt>Shards</dt>
            <dd>+{shards}</dd>
          </div>
          <div>
            <dt>Essence</dt>
            <dd>+{essence}</dd>
          </div>
          <div>
            <dt>EXP</dt>
            <dd>+{exp}</dd>
          </div>
        </dl>
        <AtProgressBar variant="pass" value={expProgress} max={100} ariaLabel="Experience progress" />
        <div className="at-rewards__meta">
          {levelLabel && <span className="at-caption">{levelLabel}</span>}
          {expLabel && <span className="at-caption">{expLabel}</span>}
        </div>
        {missionLine && (
          <p className="at-caption at-rewards__missions">
            {missionLine} ·{" "}
            <button type="button" className="at-link" onClick={onViewMissions}>
              View missions
            </button>
          </p>
        )}
      </section>

      <section className="at-card" aria-label="AI coach">
        <span className="at-overline">AI Coach</span>
        {coachSummary && <p className="at-body">{coachSummary}</p>}
        <div className="at-coach-cols">
          <div>
            <span className="at-overline">Best move</span>
            <p className="at-body">{bestMove}</p>
          </div>
          <div>
            <span className="at-overline">Work on</span>
            <p className="at-body">{workOn}</p>
          </div>
          <div>
            <span className="at-overline">Ability impact</span>
            <p className="at-body">{abilityImpact}</p>
          </div>
        </div>
      </section>

      <div className="at-postmatch__actions">
        <AtButton variant="primary" size="lg" onClick={onPlayAgain}>
          {playAgainLabel}
        </AtButton>
        <AtButton variant="secondary" size="lg" onClick={() => setShowReview((open) => !open)} aria-expanded={showReview}>
          {showReview ? "Hide full review" : "Full coach review"}
        </AtButton>
        <AtButton variant="ghost" size="lg" onClick={onBackToPlay}>
          Back to Play
        </AtButton>
      </div>

      {showReview && renderDetails?.()}
    </div>
  );
}

export default PostMatchView;
