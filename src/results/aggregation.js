import { SIGNAL_COVERAGE, chartCoverage } from "./quality.js";
import { COVERAGE } from "./temporal.js";
import { toNumber, isFiniteNumber, formatTimestampLabel } from "./values.js";

export function aggregateRowsForChart(rows, intervalMinutes, seriesConfigs, options = {}) {
  if (!rows.length) return [];
  const width = intervalMinutes * 60000;
  if (!isFiniteNumber(width) || width <= 0) return [];
  const sorted = [...rows]
    .filter((row) => isFiniteNumber(row.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (!sorted.length) return [];
  const origin = isFiniteNumber(options.origin) ? options.origin : sorted[0].timestamp;
  options = { ...options, bucketWidthMs: width };
  const result = [];
  let bucket = null,
    group = [];
  for (const row of sorted) {
    const next = Math.floor((row.timestamp - origin) / width + 1e-10);
    if (bucket !== null && bucket !== next) {
      result.push(aggregateChartGroup(origin + bucket * width, group, seriesConfigs, options));
      group = [];
    }
    bucket = next;
    group.push(row);
  }
  if (group.length)
    result.push(aggregateChartGroup(origin + bucket * width, group, seriesConfigs, options));
  return result;
}

export function aggregateChartGroup(timestamp, rows, seriesConfigs, options = {}) {
  const output = {
    timestamp,
    label: formatTimestampLabel(timestamp),
  };

  seriesConfigs.forEach((config) => {
    if (!config.field) return;
    const values = rows
      .map((row) => {
        const rawValue = config.derive ? config.derive(row) : toNumber(row[config.field]);
        if (!isFiniteNumber(rawValue)) return null;
        return config.transform ? config.transform(rawValue) : rawValue;
      })
      .filter(isFiniteNumber)
      .filter(isFiniteNumber);

    if (values.length === 0) {
      output[config.field] = null;
      return;
    }

    output[config.field] =
      config.strategy === "last"
        ? values[values.length - 1]
        : config.strategy === "avg"
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : values.reduce((sum, value) => sum + value, 0);
  });

  const coverage = rows.map((row) => row[COVERAGE]).filter(Boolean);
  if (coverage.length)
    output[COVERAGE] = {
      partial: coverage.some((c) => c.partial),
      intervals: coverage.length,
      observed: coverage.reduce((n, c) => n + c.observed, 0),
      expected: coverage.reduce((n, c) => n + c.expected, 0),
      missing: coverage.reduce((n, c) => n + c.missing, 0),
      unknown: coverage.reduce((n, c) => n + c.unknown, 0),
    };
  output[SIGNAL_COVERAGE] = chartCoverage(rows, seriesConfigs, {
    intervalMs: options.sampleIntervalMs,
    range: options.sampleIntervalMs
      ? [
          Math.max(timestamp, options.selectedStart ?? timestamp),
          Math.min(
            timestamp + (options.bucketWidthMs || Infinity) - options.sampleIntervalMs,
            options.selectedEnd ?? rows.at(-1).timestamp,
          ),
        ]
      : null,
    sourceIncomplete: options.sourceIncomplete,
  });
  return output;
}

// Unit/quantity declarations take precedence. Rates and stocks must be checked
// before energy units: EUR/kWh is a price and capacity_kwh is not interval energy.
export function inferAggregation(column, metadata = {}) {
  if (["sum", "avg", "last"].includes(metadata.aggregation)) return metadata.aggregation;
  const name = String(column).toLowerCase();
  const quantity = String(metadata.quantity || "").toLowerCase();
  if (["stock", "cumulative", "state"].includes(quantity)) return "last";
  if (["power", "price", "ratio", "temperature"].includes(quantity)) return "avg";
  if (quantity === "interval_energy") return "sum";
  const unit = String(metadata.unit || "").toLowerCase();
  if (unit && !["wh", "kwh", "mwh", "j", "kj", "mj"].includes(unit)) return "avg";
  if (/capacity|stored[ _-]*energy|energy[ _-]*stored|cumulative|state|status|connected/.test(name))
    return "last";
  if (
    /price|pricing|tariff|intensity|(?:^|[^a-z])(?:ratio|percent|soc)(?:$|[^a-z])|%|\/|_per_/.test(
      name,
    )
  )
    return "avg";
  if (
    ["wh", "kwh", "mwh", "j", "kj", "mj"].includes(unit) ||
    /(?:^|[^a-z])(?:mwh|kwh|wh)(?:$|[^a-z])/.test(name)
  )
    return "sum";
  if (
    [
      "electricity_consumption",
      "net_electricity_consumption",
      "solar_generation",
      "pv_generation",
      "ev_generation",
      "battery_charge",
      "battery_discharge",
      "charger_consumption",
      "charger_production",
    ].includes(name)
  )
    return "sum";
  return "avg";
}
