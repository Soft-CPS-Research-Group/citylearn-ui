import { chartOverview } from "../../results/chart-overview.js";
import {
  isFiniteNumber,
  toNumber,
  numericOrZero,
  normalizeVisiblePercent,
} from "../../results/values.js";
import { prepareTimeline, formatTimelineValue } from "../../results/temporal.js";

const EMPTY_CHARGER_OVERLAY = {
  events: [],
  intervals: [],
};

function getEquipmentBarSize(rowCount, barCount, chartWidth) {
  if (barCount <= 0) return 0;
  const fallbackWidth = 900;
  const plotWidth = Math.max(280, (chartWidth || fallbackWidth) - 120);
  const slotWidth = plotWidth / Math.max(rowCount, 1);
  const naturalWidth = (slotWidth / Math.max(barCount, 1)) * 0.9;
  const minimumWidth =
    rowCount <= 72
      ? 4.5
      : rowCount <= 220
        ? 2.6
        : rowCount <= 520
          ? 1.8
          : rowCount <= 1200
            ? 1.2
            : 0.8;
  const maximumWidth = rowCount <= 72 ? 9 : rowCount <= 220 ? 4.2 : rowCount <= 520 ? 3 : 2;

  return Math.min(maximumWidth, Math.max(minimumWidth, naturalWidth));
}

function getEquipmentXDomain(rows, intervalMinutes) {
  if (!rows.length) return ["dataMin", "dataMax"];
  const first = rows[0]?.timestamp;
  const last = rows[rows.length - 1]?.timestamp;
  if (!isFiniteNumber(first) || !isFiniteNumber(last)) return ["dataMin", "dataMax"];
  const intervalMs = Math.max(Number.EPSILON, Number(intervalMinutes) || 60) * 60 * 1000;
  const padding = intervalMs * 0.5;
  return [first - padding, last + padding];
}

function deriveChargerActivityOverlay(rows, chartConfig, range, intervalMinutes) {
  const fields = chartConfig.activityFields || {};
  const samples = rows
    .filter((row) => isFiniteNumber(row.timestamp))
    .map((row) => ({
      timestamp: row.timestamp,
      connected: isChargerConnected(row, fields),
    }));

  if (samples.length === 0 || samples.every((sample) => !sample.connected)) {
    return EMPTY_CHARGER_OVERLAY;
  }

  const events = [];
  const intervals = [];
  const intervalMs = Math.max(Number.EPSILON, Number(intervalMinutes) || 60) * 60 * 1000;
  let previousConnected = false;
  let connectedStart = null;

  samples.forEach((sample) => {
    if (!previousConnected && sample.connected) {
      connectedStart = sample.timestamp;
      events.push({ type: "connect", timestamp: sample.timestamp });
    }

    if (previousConnected && !sample.connected) {
      const end = sample.timestamp;
      if (connectedStart !== null && end > connectedStart) {
        intervals.push({ start: connectedStart, end });
      }
      events.push({ type: "disconnect", timestamp: end });
      connectedStart = null;
    }

    previousConnected = sample.connected;
  });

  if (previousConnected && connectedStart !== null) {
    const lastTimestamp = samples[samples.length - 1].timestamp;
    const end = range?.[1] && range[1] > connectedStart ? range[1] : lastTimestamp + intervalMs;
    intervals.push({ start: connectedStart, end });
  }

  const rangeStart = Array.isArray(range) ? range[0] : null;
  const rangeEnd = Array.isArray(range) ? range[1] : null;
  const isInRange = (timestamp) => {
    if (isFiniteNumber(rangeStart) && timestamp < rangeStart) return false;
    if (isFiniteNumber(rangeEnd) && timestamp > rangeEnd) return false;
    return true;
  };

  const clippedIntervals = intervals
    .map((interval) => ({
      start: isFiniteNumber(rangeStart) ? Math.max(interval.start, rangeStart) : interval.start,
      end: isFiniteNumber(rangeEnd) ? Math.min(interval.end, rangeEnd) : interval.end,
    }))
    .filter((interval) => interval.end > interval.start);

  return {
    events: events.filter((event) => isInRange(event.timestamp)),
    intervals: clippedIntervals,
  };
}

function isChargerConnected(row, fields) {
  if (fields.state) {
    const state = toNumber(row[fields.state]);
    if (isFiniteNumber(state)) return Math.round(state) === 1;
  }

  const consumption = numericOrZero(row[fields.consumption]);
  const production = numericOrZero(row[fields.production]);
  const arrival = normalizeVisiblePercent(toNumber(row[fields.arrival]));
  const required = normalizeVisiblePercent(toNumber(row[fields.required]));
  const soc = normalizeVisiblePercent(toNumber(row[fields.soc]));

  return (
    Math.abs(consumption) > 0.000001 ||
    Math.abs(production) > 0.000001 ||
    isFiniteNumber(arrival) ||
    isFiniteNumber(required) ||
    isFiniteNumber(soc)
  );
}

function formatDateInput(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function parseDateInput(value, fallback) {
  const parsed = new Date(`${value}T00:00:00Z`).getTime();
  return Number.isNaN(parsed) ? fallback : parsed;
}

function endOfDay(timestamp) {
  const date = new Date(timestamp);
  date.setUTCHours(23, 59, 59, 999);
  return date.getTime();
}

function getActiveQuickRange(range, minTimestamp, maxTimestamp) {
  if (!isFiniteNumber(minTimestamp) || !isFiniteNumber(maxTimestamp)) return "";
  const [start, end] = range;
  const toleranceMs = 0.001;
  if (Math.abs(start - minTimestamp) > toleranceMs) return "";
  if (Math.abs(end - maxTimestamp) <= toleranceMs) return "all";

  for (const days of [1, 7, 10]) {
    const expectedEnd = Math.min(maxTimestamp, minTimestamp + days * 24 * 60 * 60 * 1000);
    if (Math.abs(end - expectedEnd) <= toleranceMs) return String(days);
  }

  return "";
}

function buildChartData(series, metric, maxPoints = 900) {
  if (!series || !metric) return [];

  const clock = prepareTimeline(series);
  const rawRows = clock.rows
    .map((row, index) => {
      const value = toNumber(row[metric]);
      if (!isFiniteNumber(value)) return null;

      return {
        label: formatTimelineValue(clock, row.timestamp),
        index,
        value,
      };
    })
    .filter(Boolean);

  return chartOverview(rawRows, [{ field: "value" }], maxPoints).rows;
}

function compactNumber(value) {
  if (!isFiniteNumber(value)) return "";
  return value.toLocaleString(undefined, { maximumFractionDigits: 1, notation: "compact" });
}

export {
  EMPTY_CHARGER_OVERLAY,
  getEquipmentBarSize,
  getEquipmentXDomain,
  deriveChargerActivityOverlay,
  formatDateInput,
  parseDateInput,
  endOfDay,
  getActiveQuickRange,
  buildChartData,
  compactNumber,
};
