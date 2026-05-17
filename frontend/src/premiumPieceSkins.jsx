import { useId } from "react";

export const PREMIUM_2D_PIECE_SKINS = {
  pieces_elemental_2d: { id: "pieces_elemental_2d", name: "Elemental Rift", players: ["Inferno", "Glacier"] },
  pieces_cyber_grid_2d: { id: "pieces_cyber_grid_2d", name: "Cyber Grid", players: ["Cyan", "Magenta"] },
  pieces_zen_garden_2d: { id: "pieces_zen_garden_2d", name: "Zen Garden", players: ["Quartz", "Basalt"] },
};

export function isPremium2DPieceSkin(id) {
  return Boolean(PREMIUM_2D_PIECE_SKINS[id]);
}

export function PremiumPieceSkinPreview({ skinId }) {
  return (
    <span className="premium-piece-preview">
      <PremiumPieceSkin skinId={skinId} player="white" />
      <PremiumPieceSkin skinId={skinId} player="black" king />
    </span>
  );
}

export function PremiumPieceSkin({ skinId, player = "white", king = false, className = "" }) {
  if (skinId === "pieces_elemental_2d") return <ElementalPiece player={player} king={king} className={className} />;
  if (skinId === "pieces_cyber_grid_2d") return <CyberGridPiece player={player} king={king} className={className} />;
  if (skinId === "pieces_zen_garden_2d") return <ZenGardenPiece player={player} king={king} className={className} />;
  return null;
}

function svgIds(scope) {
  const id = useId().replace(/:/g, "");
  return (name) => `${scope}-${id}-${name}`;
}

function ElementalPiece({ player, king, className }) {
  const id = svgIds("elemental");
  const inferno = player === "white";
  return (
    <svg className={`premium-piece-svg ${className}`} viewBox="0 0 100 100" role="img" aria-label={`${inferno ? "Inferno" : "Glacier"} ${king ? "king" : "piece"}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id={id("body")} cx="34%" cy="26%" r="68%">
          {inferno ? <><stop offset="0" stopColor="#5a5148" /><stop offset="0.48" stopColor="#211a16" /><stop offset="1" stopColor="#050403" /></> : <><stop offset="0" stopColor="#99f6ff" /><stop offset="0.44" stopColor="#0f5ea8" /><stop offset="1" stopColor="#05152d" /></>}
        </radialGradient>
        <linearGradient id={id("edge")} x1="14" y1="10" x2="88" y2="92">
          {inferno ? <><stop stopColor="#ffb347" /><stop offset="0.42" stopColor="#ff5a1f" /><stop offset="1" stopColor="#4a1608" /></> : <><stop stopColor="#dffcff" /><stop offset="0.5" stopColor="#5dd6ff" /><stop offset="1" stopColor="#073763" /></>}
        </linearGradient>
        <filter id={id("glow")} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {king && <circle cx="50" cy="50" r="47" fill="none" stroke={inferno ? "#ff7a18" : "#8ff7ff"} strokeWidth="4" opacity="0.72" filter={`url(#${id("glow")})`} />}
      <circle cx="50" cy="52" r="39" fill={`url(#${id("edge")})`} opacity="0.98" />
      <circle cx="50" cy="48" r="35" fill={`url(#${id("body")})`} stroke={inferno ? "#2b1108" : "#9befff"} strokeWidth="2" />
      {inferno ? <g fill="none" stroke="#ff6b1a" strokeLinecap="round" filter={`url(#${id("glow")})`}><path d="M24 40c12 2 13 12 24 11s13-16 29-13" strokeWidth="3.2" /><path d="M37 20c4 12-4 17 1 27s16 8 17 23" strokeWidth="2.4" /><path d="M26 66c10-9 19-4 27-14" strokeWidth="2.1" /><path d="M62 29c-4 11 6 16 3 29" strokeWidth="2" /></g> : <g fill="none" stroke="#c9fbff" strokeLinecap="round" strokeLinejoin="round" opacity="0.88"><path d="M50 17v62M24 36l52 29M24 65l52-29" strokeWidth="2.2" /><path d="M50 26l-8 7m8-7 8 7M32 41l2 10m-2-10 10-2M68 41l-10-2m10 2-2 10M32 59l10 2m-10-2 2-10M68 59l-2-10m2 10-10 2M50 74l8-7m-8 7-8-7" strokeWidth="1.7" /></g>}
      <ellipse cx="39" cy="27" rx="13" ry="7" fill="#fff" opacity={inferno ? "0.12" : "0.28"} />
    </svg>
  );
}

function CyberGridPiece({ player, king, className }) {
  const id = svgIds("cyber");
  const cyan = player === "white";
  const primary = cyan ? "#00e5ff" : "#ff3df2";
  const deep = cyan ? "#032b3f" : "#33052f";
  return (
    <svg className={`premium-piece-svg ${className}`} viewBox="0 0 100 100" role="img" aria-label={`${cyan ? "Cyan" : "Magenta"} cyber ${king ? "king" : "piece"}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id={id("body")} cx="36%" cy="28%" r="70%"><stop stopColor="#ffffff" stopOpacity="0.45" /><stop offset="0.22" stopColor={primary} /><stop offset="0.62" stopColor={deep} /><stop offset="1" stopColor="#03040a" /></radialGradient>
        <pattern id={id("grid")} width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0v10" fill="none" stroke={primary} strokeWidth="0.9" opacity="0.48" /></pattern>
        <linearGradient id={id("scan")} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff" stopOpacity="0" /><stop offset="0.48" stopColor="#fff" stopOpacity="0.32" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <filter id={id("glow")} x="-45%" y="-45%" width="190%" height="190%"><feGaussianBlur stdDeviation="2.8" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {king && <g filter={`url(#${id("glow")})`}><circle cx="50" cy="50" r="46" fill="none" stroke={primary} strokeWidth="3.5" strokeDasharray="14 5 3 5" /><circle cx="50" cy="50" r="41" fill="none" stroke="#fff" strokeOpacity="0.48" strokeWidth="1.2" strokeDasharray="2 7" /></g>}
      <circle cx="50" cy="52" r="39" fill="#030611" stroke={primary} strokeWidth="2.4" filter={`url(#${id("glow")})`} />
      <circle cx="50" cy="48" r="34" fill={`url(#${id("body")})`} />
      <circle cx="50" cy="48" r="34" fill={`url(#${id("grid")})`} opacity="0.7" />
      <g stroke={primary} strokeWidth="2" fill="none" strokeLinecap="round"><path d="M22 48h16l7-11h16l8 11h9" /><path d="M26 62h15l5 7h24" /><path d="M30 32h11l5-7h24" /></g>
      <rect x="24" y="42" width="52" height="12" fill={`url(#${id("scan")})`} opacity="0.55" />
      <circle cx="39" cy="36" r="3" fill="#fff" opacity="0.85" />
      <circle cx="63" cy="62" r="2.6" fill={primary} />
    </svg>
  );
}

function ZenGardenPiece({ player, king, className }) {
  const id = svgIds("zen");
  const quartz = player === "white";
  return (
    <svg className={`premium-piece-svg ${className}`} viewBox="0 0 100 100" role="img" aria-label={`${quartz ? "Quartz" : "Basalt"} zen ${king ? "king" : "piece"}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id={id("body")} cx="34%" cy="25%" r="72%">{quartz ? <><stop stopColor="#ffffff" /><stop offset="0.42" stopColor="#e7e2d7" /><stop offset="1" stopColor="#a9a397" /></> : <><stop stopColor="#60646c" /><stop offset="0.44" stopColor="#1a1d22" /><stop offset="1" stopColor="#030405" /></>}</radialGradient>
        <filter id={id("soft")} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="0.8" /></filter>
      </defs>
      <circle cx="50" cy="53" r="39" fill={quartz ? "#b8b2a6" : "#020202"} opacity="0.48" />
      <circle cx="50" cy="48" r="36" fill={`url(#${id("body")})`} stroke={quartz ? "#f8f5ee" : "#545860"} strokeWidth="1.4" />
      <path d="M26 46c12-7 25-9 47-2M31 61c14 5 28 4 41-3M34 32c10 3 23 2 34-4" fill="none" stroke={quartz ? "#fffaf0" : "#777d86"} strokeWidth="1.1" opacity={quartz ? "0.38" : "0.22"} filter={`url(#${id("soft")})`} />
      <ellipse cx="38" cy="28" rx="12" ry="7" fill="#fff" opacity={quartz ? "0.34" : "0.08"} />
      {king && <YinYang quartz={quartz} />}
    </svg>
  );
}

function YinYang({ quartz }) {
  return (
    <g transform="translate(50 48) scale(0.42)">
      <circle r="42" fill={quartz ? "#f7f4eb" : "#090a0c"} stroke={quartz ? "#181818" : "#f6f1e7"} strokeWidth="4" />
      <path d="M0-42a42 42 0 0 1 0 84 21 21 0 0 1 0-42 21 21 0 0 0 0-42z" fill={quartz ? "#111" : "#f6f1e7"} />
      <circle cy="-21" r="6" fill={quartz ? "#111" : "#f6f1e7"} />
      <circle cy="21" r="6" fill={quartz ? "#f6f1e7" : "#111"} />
    </g>
  );
}
