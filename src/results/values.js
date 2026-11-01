export function resolveField(columns, aliases) {
  const lowerMap = new Map(columns.map((column) => [column.toLowerCase(), column]));
  for (const alias of aliases) {
    const exact = lowerMap.get(String(alias).toLowerCase());
    if (exact) return exact;
  }

  return (
    columns.find((column) => {
      const normalized = normalizeColumnName(column);
      return aliases.some((alias) => normalized === normalizeColumnName(alias));
    }) || null
  );
}

export function normalizeColumnName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function normalizePercent(value) {
  if (!isFiniteNumber(value)) return null;
  return Math.abs(value) <= 1 ? value * 100 : value;
}

export function normalizeVisiblePercent(value) {
  const percent = normalizePercent(value);
  if (!isFiniteNumber(percent) || percent < 0 || percent > 100) return null;
  return percent;
}

export function numericOrZero(value) {
  const numeric = toNumber(value);
  return isFiniteNumber(numeric) ? numeric : 0;
}

export function chargerEnergyValue(value) {
  const numeric = toNumber(value);
  if (!isFiniteNumber(numeric) || Math.abs(numeric + 1) < 1e-9) return 0;
  return numeric;
}

export function positiveValue(value) {
  const numeric = toNumber(value);
  if (!isFiniteNumber(numeric) || numeric <= 0) return null;
  return numeric;
}

export function negativeValue(value) {
  const numeric = toNumber(value);
  if (!isFiniteNumber(numeric) || numeric >= 0) return null;
  return numeric;
}

export function stripEpisodeFromKey(key) {
  return String(key || "").replace(/_ep(?:isode)?_?\d+$/i, "");
}

export function formatTimestampLabel(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  let cleaned = raw.replace(/\s/g, "").replace("%", "");
  if (/^-?\d+,\d+$/.test(cleaned)) {
    cleaned = cleaned.replace(",", ".");
  } else {
    cleaned = cleaned.replace(/,/g, "");
  }

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

export function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatNumber(value) {
  if (!isFiniteNumber(value)) return "-";

  const absolute = Math.abs(value);
  if (absolute >= 1000000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 1, notation: "compact" });
  }

  if (absolute >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }

  if (absolute > 0 && absolute < 0.001) {
    return value.toExponential(2);
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}
