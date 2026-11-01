import { isFiniteNumber } from "./values.js";

// Drawing is a selection of actual interval aggregates, never a replacement
// dataset. Full-span totals/coverage and source rows do not use this selection.
export function chartOverview(rows, configs, maxPoints = 800) {
  const fields = [...new Map(configs.filter((c) => c.field).map((c) => [c.field, c])).values()];
  const stats = fields.map((config) => {
    let min = null,
      max = null,
      total = 0,
      valid = 0;
    for (const row of rows) {
      const value = row[config.field];
      if (!isFiniteNumber(value)) continue;
      valid++;
      min = min === null ? value : Math.min(min, value);
      max = max === null ? value : Math.max(max, value);
      total += value;
    }
    return {
      field: config.field,
      label: config.label || config.field,
      min,
      max,
      valid,
      total: config.strategy === "sum" && valid ? total : null,
    };
  });
  if (!maxPoints || rows.length <= maxPoints)
    return { rows, stats, totalRows: rows.length, reduced: false };
  const budget = Math.max(maxPoints, fields.length * 4 + 4),
    perBucket = fields.length * 4 + 2;
  const buckets = Math.max(1, Math.floor((budget - 2) / perBucket)),
    size = Math.ceil(rows.length / buckets),
    keep = new Set([0, rows.length - 1]);
  for (let start = 0; start < rows.length; start += size) {
    const end = Math.min(rows.length, start + size);
    keep.add(start);
    keep.add(end - 1);
    for (const { field } of fields) {
      let lo = -1,
        hi = -1,
        firstNull = -1,
        lastNull = -1;
      for (let i = start; i < end; i++) {
        const value = rows[i][field];
        if (!isFiniteNumber(value)) {
          if (firstNull < 0) firstNull = i;
          lastNull = i;
          continue;
        }
        if (lo < 0 || value < rows[lo][field]) lo = i;
        if (hi < 0 || value > rows[hi][field]) hi = i;
      }
      for (const i of [lo, hi, firstNull, lastNull]) if (i >= 0) keep.add(i);
    }
  }
  return {
    rows: [...keep].sort((a, b) => a - b).map((i) => rows[i]),
    stats,
    totalRows: rows.length,
    reduced: true,
  };
}

export function overlayOverview(overlay, maxItems = 160) {
  function sample(items) {
    if (items.length <= maxItems) return items;
    const ids = new Set([0, items.length - 1]);
    for (let i = 0; i < maxItems; i++)
      ids.add(Math.round((i * (items.length - 1)) / (maxItems - 1)));
    return [...ids].sort((a, b) => a - b).map((i) => items[i]);
  }
  return {
    events: sample(overlay.events),
    intervals: sample(overlay.intervals),
    totalEvents: overlay.events.length,
    totalIntervals: overlay.intervals.length,
    reduced: overlay.events.length > maxItems || overlay.intervals.length > maxItems,
  };
}
