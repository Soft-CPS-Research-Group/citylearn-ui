import { isExcluded, SOURCE, issue } from "./quality.js";
import { findTimeKey } from "./paths.js";
import { toNumber, isFiniteNumber, formatTimestampLabel } from "./values.js";

// Symbols keep internal clock/coverage evidence separate from imported columns.
export const GLOBAL_STEP = Symbol("global-step");
export const COVERAGE = Symbol("community-coverage");
const MINUTE = 60000;
const STEP = /^(?:global_(?:time_)?step|episode_time_step|time_step|timestep|step|index)$/i;
const GLOBAL = /^global_(?:time_)?step$/i;
const positive = (value) => isFiniteNumber(value) && value > 0;
const cache = new WeakMap();
const zoneFormatters = new Map();

// Use only exported temporal evidence. A schema date is a dataset origin;
// episode_start_time_step is an offset, not a replacement dataset origin.
export function temporalContext(metadata = {}, episode = "") {
  const m = metadata.manifest || {},
    c = m.comparison_context || {},
    s = m.effective_schema || {};
  const t = m.temporal_reproducibility || c.temporal || {};
  if (Number.isInteger(t.episode_index) && episode && episode !== `ep${t.episode_index}`) return {};
  const controlSeconds = toNumber(
    m.seconds_per_time_step ??
      c.seconds_per_time_step ??
      s.seconds_per_time_step ??
      t.control_seconds_per_time_step,
  );
  const datasetSeconds = toNumber(t.dataset_seconds_per_time_step);
  const seconds =
    t.clock_source === "canonical_calendar" && positive(datasetSeconds)
      ? datasetSeconds
      : controlSeconds;
  return {
    secondsPerStep: positive(seconds) ? seconds : null,
    controlSecondsPerStep: positive(controlSeconds) ? controlSeconds : null,
    clockConsistent: t.clock_consistent !== false,
    startDate: s.start_date ?? m.start_date ?? null,
    timezone: t.timezone ?? s.timezone ?? null,
    episodeStart: toNumber(m.episode_start_time_step ?? c.episode_start_time_step),
    indexOrigin: t.index_origin === "global" ? "global" : "episode",
    renderOriginOverride: t.render_origin_override === true,
  };
}

function wallParts(value) {
  const match = String(value ?? "")
    .trim()
    .match(
      /^(\d{4})-(\d\d)-(\d\d)(?:[T ](\d\d):(\d\d)(?::(\d\d)(?:\.(\d{1,9}))?)?)?(Z|[+-]\d\d:\d\d)?$/i,
    );
  if (!match) return null;
  const p = match.slice(1, 7).map((v) => Number(v || 0));
  const ms = Number((match[7] || "").padEnd(3, "0").slice(0, 3));
  const date = new Date(0);
  date.setUTCFullYear(p[0], p[1] - 1, p[2]);
  date.setUTCHours(p[3], p[4], p[5], ms);
  if (
    date.getUTCFullYear() !== p[0] ||
    date.getUTCMonth() + 1 !== p[1] ||
    date.getUTCDate() !== p[2] ||
    date.getUTCHours() !== p[3] ||
    date.getUTCMinutes() !== p[4] ||
    date.getUTCSeconds() !== p[5]
  )
    return null;
  return { wall: date.getTime(), parts: p, offset: match[8] || null };
}
function zoneFormatter(timezone) {
  if (!zoneFormatters.has(timezone))
    zoneFormatters.set(
      timezone,
      new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }),
    );
  return zoneFormatters.get(timezone);
}
function wallInZone(timestamp, formatter) {
  const p = Object.fromEntries(
    formatter.formatToParts(new Date(timestamp)).map((p) => [p.type, p.value]),
  );
  const date = new Date(0);
  date.setUTCFullYear(Number(p.year), Number(p.month) - 1, Number(p.day));
  date.setUTCHours(Number(p.hour), Number(p.minute), Number(p.second), 0);
  return date.getTime();
}
// Test candidate offsets either side of a DST transition. Ambiguous/nonexistent
// wall times have no unique instant and must not be silently assigned an offset.
export function parseCalendarTime(value, timezone = null) {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : { timestamp: value.getTime(), mode: "utc" };
  const p = wallParts(value);
  if (!p) return null;
  if (p.offset) {
    const timestamp = Date.parse(String(value).trim().replace(" ", "T"));
    return isFiniteNumber(timestamp) ? { timestamp, mode: "utc" } : null;
  }
  if (!timezone) return { timestamp: p.wall, mode: "local" };
  try {
    const formatter = zoneFormatter(timezone),
      offsets = new Set();
    for (const hours of [-36, -12, 0, 12, 36]) {
      const candidate = Math.floor((p.wall + hours * 3600000) / 1000) * 1000;
      offsets.add(wallInZone(candidate, formatter) - candidate);
    }
    const candidates = [...offsets]
      .map((offset) => p.wall - offset)
      .filter((candidate) => wallInZone(candidate, formatter) === Math.floor(p.wall / 1000) * 1000);
    return candidates.length === 1 ? { timestamp: candidates[0], mode: "utc" } : null;
  } catch {
    return null;
  }
}

export function inferIntervalMinutes(rows) {
  let smallest = Infinity,
    previous = null;
  const times = rows
    .map((r) => r.timestamp)
    .filter(isFiniteNumber)
    .sort((a, b) => a - b);
  for (const timestamp of times) {
    if (previous !== null && timestamp > previous)
      smallest = Math.min(smallest, timestamp - previous);
    previous = timestamp;
  }
  return isFiniteNumber(smallest) ? smallest / MINUTE : null;
}

export function formatTimelineValue(timeline, value, tooltip = false) {
  if (!isFiniteNumber(Number(value))) return "";
  value = Number(value);
  if (timeline.mode === "index" || timeline.mode === "elapsed" || timeline.mode === "row") {
    const step = value / timeline.coordinatePerStep;
    return `${timeline.mode === "row" ? "Row" : "Step"} ${Number(step.toFixed(6))}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds =
    date.getUTCSeconds() || date.getUTCMilliseconds() || (timeline.baseIntervalMinutes ?? 1) < 1;
  return (
    date
      .toISOString()
      .slice(0, seconds ? 23 : 16)
      .replace("T", " ") + (tooltip && timeline.mode === "utc" ? " UTC" : "")
  );
}

export function prepareTimeline(series) {
  const cacheKey = series;
  if (cache.has(series)) return cache.get(series);
  // Reconstructed series already have numeric coordinates and an explicit clock.
  if (series.timeline) {
    const result = { ...series.timeline, rows: series.rows };
    cache.set(series, result);
    return result;
  }
  const originalRows = series.rows;
  if (series.quality)
    series = {
      ...series,
      rows: originalRows.filter(
        (row) => !isExcluded(row) && !series.quality.clockExcludedRows?.has(row),
      ),
    };
  const context = series.temporal || {},
    key = series.timeKey || findTimeKey(series.columns || []);
  const seconds = positive(context.secondsPerStep) ? context.secondsPerStep : null;
  const warnings = [];
  if (context.clockConsistent === false)
    warnings.push(
      "The exported calendar is declared inconsistent. Numeric steps cannot establish an absolute calendar.",
    );
  if (
    positive(context.controlSecondsPerStep) &&
    seconds &&
    context.controlSecondsPerStep !== seconds
  )
    warnings.push(
      `Exported clock spacing is ${seconds} s; control duration is ${context.controlSecondsPerStep} s. Values are retained without resampling.`,
    );
  const clock =
    key && !STEP.test(key)
      ? series.rows.map((row) => parseCalendarTime(row[key], context.timezone))
      : [];
  const modes = new Set(clock.filter(Boolean).map((p) => p.mode));
  let mode, coordinates, coordinatePerStep, basis;
  const allCalendar = clock.length > 0 && clock.every(Boolean) && modes.size === 1;
  const suppliedSteps =
    STEP.test(key || "") && series.rows.every((row) => isFiniteNumber(toNumber(row[key])));
  const global = GLOBAL.test(key || "") || context.indexOrigin === "global";
  const episodeStart = isFiniteNumber(context.episodeStart) ? context.episodeStart : 0;
  const steps = series.rows.map((row, index) =>
    suppliedSteps ? toNumber(row[key]) + (global ? 0 : episodeStart) : index + episodeStart,
  );
  if (allCalendar) {
    mode = clock[0].mode;
    coordinates = clock.map((p) => p.timestamp);
    coordinatePerStep = seconds ? seconds * 1000 : null;
    basis = mode === "utc" ? "UTC" : "Exported local time · timezone not exported";
  } else {
    if (clock.length)
      warnings.push(
        "Calendar values are incomplete, ambiguous or use incompatible clocks. Rows are shown in source order; original values are retained.",
      );
    // A malformed calendar cannot safely be replaced by a supposedly correct
    // inferred calendar. Unlabelled row positions also cannot align members.
    const canUseOrigin =
      !clock.length &&
      seconds &&
      context.startDate &&
      !context.renderOriginOverride &&
      context.clockConsistent !== false;
    const origin = canUseOrigin ? parseCalendarTime(context.startDate, context.timezone) : null;
    if (origin && suppliedSteps) {
      mode = origin.mode;
      coordinatePerStep = seconds * 1000;
      coordinates = steps.map((step) => origin.timestamp + step * coordinatePerStep);
      basis =
        mode === "utc"
          ? "UTC · calendar reconstructed from exported origin and step"
          : "Exported calendar · timezone not exported";
    } else {
      mode = clock.length || !suppliedSteps ? "row" : seconds ? "elapsed" : "index";
      coordinatePerStep = mode === "elapsed" ? seconds * 1000 : MINUTE;
      coordinates = (
        mode === "row" ? series.rows.map((row, i) => (row[SOURCE]?.record ?? i + 1) - 1) : steps
      ).map((step) => step * coordinatePerStep);
      basis =
        mode === "row"
          ? "Source row index · no unambiguous calendar"
          : seconds
            ? `Relative time · ${seconds} s/step · calendar not exported`
            : "Exported step index · duration/calendar not exported";
    }
  }
  const anchor =
    seconds && context.startDate ? parseCalendarTime(context.startDate, context.timezone) : null;
  const globalStep = (coordinate) => {
    if (!anchor || anchor.mode !== mode || !seconds) return null;
    const step = (coordinate - anchor.timestamp) / (seconds * 1000);
    return Math.abs(step - Math.round(step)) < 1e-7 ? Math.round(step) : null;
  };
  const globalKey = (series.columns || []).find((column) => GLOBAL.test(column));
  const rows = series.rows
    .map((row, i) => ({
      ...row,
      timestamp: coordinates[i],
      [GLOBAL_STEP]: suppliedSteps
        ? steps[i]
        : globalKey
          ? toNumber(row[globalKey])
          : globalStep(coordinates[i]),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
  const inferred = inferIntervalMinutes(rows);
  const baseIntervalMinutes =
    mode === "index" || mode === "row" ? 1 : seconds ? seconds / 60 : inferred;
  const result = {
    mode,
    basis,
    sourceTimezone: context.timezone || null,
    coordinatePerStep,
    baseIntervalMinutes,
    secondsPerStep: seconds,
    indexOrigin: global ? "global" : isFiniteNumber(context.episodeStart) ? "global" : "episode",
    warnings,
    rows,
  };
  if (["utc", "local"].includes(mode) && !seconds && inferred === null)
    warnings.push("Sample duration is not exported and cannot be inferred from one timestamp.");
  if (new Set(coordinates).size !== coordinates.length)
    warnings.push("Repeated clock coordinates are retained; they cannot prove distinct intervals.");
  for (const row of rows)
    row.label = ["utc", "local"].includes(mode)
      ? formatTimestampLabel(row.timestamp)
      : formatTimelineValue(result, row.timestamp);
  cache.set(cacheKey, result);
  return result;
}

export function timeBounds(items) {
  const timelines = items.map((item) => prepareTimeline(item.series));
  const modes = new Set(timelines.map((t) => t.mode));
  const origins = new Set(
    timelines.filter((t) => ["index", "elapsed"].includes(t.mode)).map((t) => t.indexOrigin),
  );
  const resolutions = new Set(
    timelines.filter((t) => ["index", "elapsed"].includes(t.mode)).map((t) => t.coordinatePerStep),
  );
  const declaredDurations = new Set(timelines.map((t) => t.secondsPerStep).filter(positive));
  const compatible =
    (modes.size <= 1 &&
      origins.size <= 1 &&
      resolutions.size <= 1 &&
      declaredDurations.size <= 1 &&
      !timelines.some((t) => t.mode === "row")) ||
    timelines.length === 1;
  const first = timelines[0] || {
    mode: "row",
    basis: "No time data",
    coordinatePerStep: MINUTE,
    baseIntervalMinutes: 1,
  };
  let min = Infinity,
    max = -Infinity;
  for (const t of timelines)
    for (const row of t.rows) {
      min = Math.min(min, row.timestamp);
      max = Math.max(max, row.timestamp);
    }
  return {
    min: isFiniteNumber(min) ? min : null,
    max: isFiniteNumber(max) ? max : null,
    baseInterval:
      timelines
        .map((t) => t.baseIntervalMinutes)
        .filter(positive)
        .sort((a, b) => a - b)[0] ?? null,
    timeline: first,
    compatible,
  };
}

export function formatInterval(minutes, timeline = { mode: "utc" }) {
  if (["index", "row"].includes(timeline.mode))
    return `${minutes} ${minutes === 1 ? "step" : "steps"}`;
  const seconds = minutes * 60;
  if (seconds < 60) return `${Number(seconds.toFixed(6))}s`;
  if (minutes % 1440 === 0) return `${minutes / 1440}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${Number(minutes.toFixed(6))}m`;
}

export function inspectClock(series) {
  const key = series.timeKey,
    rows = series.rows.filter((row) => !isExcluded(row)),
    diagnostics = [],
    // Owned by this series; a Set preserves row identity across worker cloning.
    excluded = new Set();
  if (!key || !rows.length)
    return {
      diagnostics,
      clockExcludedRows: excluded,
      clockRejectedCount: 0,
      clockUncertain: !key,
    };
  const index = STEP.test(key),
    values = rows.map((row) =>
      index ? toNumber(row[key]) : parseCalendarTime(row[key], series.temporal?.timezone),
    );
  const good = values.filter((v) => (index ? isFiniteNumber(v) : v !== null)),
    kinds = new Set(good.map((v) => (index ? "index" : v.mode)));
  let rejected = 0;
  for (const [i, row] of rows.entries()) {
    const valid = index ? isFiniteNumber(values[i]) : values[i] !== null;
    if (!valid) {
      diagnostics.push(
        issue(
          "invalid-clock",
          row[SOURCE]?.file || series.fileName,
          "Clock value is missing, invalid or ambiguous.",
          good.length && kinds.size === 1
            ? "This record is retained in the source table but excluded from time-based calculations."
            : "There is no reliable calendar; source-row exploration remains available.",
          {
            path: row[SOURCE]?.path,
            record: row[SOURCE]?.record,
            column: key,
            examples: [{ record: row[SOURCE]?.record, column: key, value: row[key] }],
          },
        ),
      );
      if (good.length && kinds.size === 1) {
        excluded.add(row);
        rejected++;
      }
    }
  }
  const seen = new Map();
  for (const [i, value] of values.entries()) {
    if (index ? !isFiniteNumber(value) : !value) continue;
    const identity = index ? value : `${value.mode}:${value.timestamp}`;
    if (seen.has(identity))
      diagnostics.push(
        issue(
          "duplicate-clock",
          rows[i][SOURCE]?.file || series.fileName,
          "Repeated clock coordinate.",
          "Source records remain accessible. Their sum is not certified as distinct intervals.",
          {
            path: rows[i][SOURCE]?.path,
            record: rows[i][SOURCE]?.record,
            column: key,
            examples: [{ record: rows[i][SOURCE]?.record, column: key, value: rows[i][key] }],
          },
        ),
      );
    else seen.set(identity, i);
  }
  if (series.temporal?.secondsPerStep > 0 && good.length > 1 && kinds.size === 1) {
    const coordinates = good
      .map((value) => (index ? value * series.temporal.secondsPerStep * 1000 : value.timestamp))
      .sort((a, b) => a - b);
    const expected =
      Math.floor(
        (coordinates.at(-1) - coordinates[0]) / (series.temporal.secondsPerStep * 1000) + 1e-7,
      ) + 1;
    const missing = Math.max(0, expected - new Set(coordinates).size);
    if (missing)
      diagnostics.push(
        issue(
          "clock-gap",
          series.fileName,
          `${missing} unrepresented grid positions within the recorded span.`,
          "Membership or a partial export may explain these positions; they are not filled with measured zeros.",
          { severity: "info", count: missing, column: key },
        ),
      );
  }
  return {
    diagnostics,
    clockExcludedRows: excluded,
    clockRejectedCount: rejected,
    clockUncertain:
      good.length !== values.length ||
      kinds.size !== 1 ||
      diagnostics.some((d) => ["duplicate-clock", "clock-gap"].includes(d.code)),
  };
}
