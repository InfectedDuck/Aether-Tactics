import { useEffect, useRef, useState } from "react";
import { AtCurrencyPill, AtProgressBar } from "./components.jsx";

/* App shell — one navigation surface for the redesign.
 * Wraps every top-level screen. Game logic, backend calls and URLs untouched.
 */

export const AT_NAV_ITEMS = [
  { id: "play", label: "Play", icon: "▶" },
  { id: "battle-pass", label: "Battle Pass", icon: "◈" },
  { id: "collection", label: "Collection", icon: "▦" },
  { id: "factions", label: "Factions", icon: "⚔" },
  { id: "social", label: "Social", icon: "◉" },
];

/* Route (App.jsx view id) -> nav mapping. Old URLs keep working; they just
 * highlight the new nav item. vault/inventory redirect to collection tabs. */
export function navForView(view) {
  switch (view) {
    case "nexus":
    case "single":
    case "skirmish-config":
    case "campaign-select":
    case "campaign-map":
    case "daily-puzzle":
    case "multiplayer":
    case "lobby":
    case "versus-intro":
    case "game":
    case "battlefield":
      return "play";
    case "battle-pass":
    case "progress":
    case "progression":
      return "battle-pass";
    case "collection":
    case "vault":
    case "inventory":
      return "collection";
    case "loadout":
    case "factions":
    case "codex":
      return "factions";
    case "social":
    case "friends":
      return "social";
    default:
      return "play";
  }
}

function initialsFor(profile) {
  const name = profile?.username || profile?.name || "C";
  return name.slice(0, 2).toUpperCase();
}

export function AppShell({
  view = "nexus",
  profile = {},
  battlePassClaimable = false,
  battlePassBadgeCount = 0,
  friendsOnlineCount = 0,
  notifications = [],
  onNotificationOpen,
  onNotificationAction,
  onMarkAllRead,
  onNavigate,
  onLogo,
  onOpenProfile,
  onOpenSettings,
  onSignOut,
  developerMode = false,
  onToggleDeveloper,
  fullFocus = false,
  children,
}) {
  const activeNav = navForView(view);
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const bellRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") {
        setBellOpen(false);
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const unread = notifications.length;
  const level = profile?.level ?? 1;
  const exp = profile?.current_exp ?? profile?.exp ?? 0;
  const nextExp = 200;
  const showDevChip = developerMode && (profile?.is_admin || true);

  function go(navId) {
    setBellOpen(false);
    setMenuOpen(false);
    onNavigate?.(navId);
  }

  return (
    <div className={`at-root at-shell${fullFocus ? " at-shell--focus" : ""}`}>
      <header className="at-topbar">
        <button type="button" className="at-logo" onClick={() => (onLogo ? onLogo() : go("play"))} aria-label="Go to Play">
          <span className="at-logo__mark" aria-hidden="true">
            <img src="/assets/brand/aether-tactics-logo.svg" alt="" />
          </span>
          <span className="at-logo__word">Aether Tactics</span>
          {showDevChip && <span className="at-dev-chip">Dev · Admin · Showcase</span>}
        </button>

        <div className="at-topbar__currencies">
          <AtCurrencyPill kind="essence" amount={profile?.essence ?? 0} />
          <AtCurrencyPill kind="shards" amount={profile?.shards ?? 0} />
        </div>

        <div className="at-topbar__actions">
          <button
            type="button"
            className="at-icon-btn at-icon-btn--friends"
            aria-label={`Friends, ${friendsOnlineCount} online`}
            title={`${friendsOnlineCount} friends online`}
            onClick={() => go("social")}
          >
            <span aria-hidden="true">◉</span>
            {friendsOnlineCount > 0 && <i className="at-count">{friendsOnlineCount}</i>}
          </button>

          <span className="at-popover-anchor" ref={bellRef}>
            <button
              type="button"
              className="at-icon-btn"
              aria-label={`Notifications, ${unread} unread`}
              aria-expanded={bellOpen}
              onClick={() => {
                const next = !bellOpen;
                setBellOpen(next);
                setMenuOpen(false);
                if (next) onNotificationOpen?.();
              }}
            >
              <span aria-hidden="true">🔔</span>
              {unread > 0 && <i className="at-count">{unread > 9 ? "9+" : unread}</i>}
            </button>
            {bellOpen && (
              <div className="at-popover at-notifs" role="dialog" aria-label="Notifications">
                <div className="at-popover__head">
                  <strong>Notifications</strong>
                  <button type="button" className="at-link" onClick={() => onMarkAllRead?.()}>
                    Mark all read
                  </button>
                </div>
                {notifications.length === 0 && <p className="at-caption">No notifications yet.</p>}
                {notifications.slice(0, 8).map((n) => (
                  <div key={n.id} className="at-notif">
                    <div className="at-notif__main">
                      <strong>{n.title}</strong>
                      <span className="at-caption">{n.body}</span>
                    </div>
                    <div className="at-notif__actions">
                      {n.kind === "invite" ? (
                        <>
                          <button type="button" className="at-link" onClick={() => onNotificationAction?.("join", n)}>
                            Join lobby
                          </button>
                          <button type="button" className="at-link at-link--muted" onClick={() => onNotificationAction?.("dismiss", n)}>
                            Dismiss
                          </button>
                        </>
                      ) : n.kind === "reward" ? (
                        <button type="button" className="at-link" onClick={() => onNotificationAction?.("open-pass", n)}>
                          Open Battle Pass
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </span>

          <span className="at-popover-anchor" ref={menuRef}>
            <button
              type="button"
              className="at-avatar"
              aria-label="Open profile menu"
              aria-expanded={menuOpen}
              onClick={() => {
                setMenuOpen((v) => !v);
                setBellOpen(false);
              }}
            >
              {initialsFor(profile)}
            </button>
            {menuOpen && (
              <div className="at-popover at-profile-menu" role="menu" aria-label="Profile">
                <div className="at-profile-menu__head">
                  <strong>{profile?.username || profile?.name || "Commander"}</strong>
                  <span className="at-caption">Level {level}</span>
                  <AtProgressBar variant="pass" value={exp} max={nextExp} ariaLabel="Level progress" />
                </div>
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onOpenProfile?.(); }}>
                  Profile &amp; achievements
                </button>
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onOpenSettings?.(); }}>
                  Settings
                </button>
                <label className="at-dev-toggle">
                  <input type="checkbox" checked={developerMode} onChange={(e) => onToggleDeveloper?.(e.target.checked)} />
                  Developer mode
                </label>
                <button type="button" role="menuitem" className="at-profile-menu__signout" onClick={() => { setMenuOpen(false); onSignOut?.(); }}>
                  Sign out
                </button>
              </div>
            )}
          </span>
        </div>
      </header>

      <div className="at-shell__body">
        {!fullFocus && (
          <nav className="at-rail" aria-label="Primary">
            <div className="at-rail__items">
              {AT_NAV_ITEMS.map((item) => {
                const active = item.id === activeNav;
                const showBadge = item.id === "battle-pass" && (battlePassClaimable || battlePassBadgeCount > 0);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`at-rail__btn${active ? " at-rail__btn--active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    title={item.label}
                    onClick={() => go(item.id)}
                  >
                    <span className="at-rail__icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="at-rail__label">{item.label}</span>
                    {showBadge && (
                      <span className="at-rail__dot" aria-label={battlePassBadgeCount > 0 ? `${battlePassBadgeCount} rewards claimable` : "Reward claimable"} />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="at-rail__foot">
              <button
                type="button"
                className={`at-rail__btn${view === "settings" ? " at-rail__btn--active" : ""}`}
                title="Settings"
                onClick={() => {
                  setBellOpen(false);
                  setMenuOpen(false);
                  onOpenSettings?.();
                }}
              >
                <span className="at-rail__icon" aria-hidden="true">⚙</span>
                <span className="at-rail__label">Settings</span>
              </button>
            </div>
          </nav>
        )}

        <div className="at-shell__main">
          <div className="at-shell__content">{children}</div>
        </div>
      </div>

      {!fullFocus && (
        <nav className="at-tabbar" aria-label="Primary">
          {AT_NAV_ITEMS.map((item) => {
            const active = item.id === activeNav;
            const showBadge = item.id === "battle-pass" && (battlePassClaimable || battlePassBadgeCount > 0);
            return (
              <button
                key={item.id}
                type="button"
                className={`at-tabbar__btn${active ? " at-tabbar__btn--active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => go(item.id)}
              >
                <span className="at-tabbar__icon" aria-hidden="true">
                  {item.icon}
                  {showBadge && <span className="at-rail__dot" />}
                </span>
                <span className="at-tabbar__label">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

export default AppShell;
