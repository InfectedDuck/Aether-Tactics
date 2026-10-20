/**
 * formatCompact(n) — compact currency/EXP display for the redesign.
 * 640 -> "640", 2480 -> "2,480", 99999 -> "99,999",
 * 100000 -> "100K", 999999 -> "999K", 1250000 -> "1.2M".
 * Pair with title={String(n)} for the full value tooltip.
 */
export function formatCompact(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return "0";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs < 1000) {
    return `${sign}${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  if (abs < 100000) {
    return `${sign}${Math.floor(abs).toLocaleString("en-US")}`;
  }
  if (abs < 1000000) {
    return `${sign}${Math.floor(abs / 1000)}K`;
  }
  const millions = abs / 1000000;
  const formatted = millions >= 100 ? String(Math.round(millions)) : String(Math.round(millions * 10) / 10);
  return `${sign}${formatted}M`;
}

export default formatCompact;
