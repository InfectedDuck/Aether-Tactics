import { AtPageHeader } from "./components.jsx";

/* Redesign Phase 3.6 — second-level consistency wrapper.
 * Presentational only: wraps legacy second-level screens (Skirmish setup,
 * Campaign map, Daily puzzle, Multiplayer queue/lobby, Settings, Profile,
 * Guest/Feature/Versus/Codex) in the shared AtPageHeader so every
 * second-level page gets exactly one back arrow + breadcrumb from the app
 * shell. No game logic, backend calls, or URL changes here.
 */

export function AtSecondaryPage({ title, breadcrumb = [], onBack, actions, className = "", children }) {
  return (
    <div className={`at-secondary ${className}`.trim()}>
      <AtPageHeader title={title} breadcrumb={breadcrumb} onBack={onBack} actions={actions} />
      <div className="at-secondary__body">{children}</div>
    </div>
  );
}

export default AtSecondaryPage;
