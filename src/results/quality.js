import { toNumber, isFiniteNumber } from "./values.js";

export const SOURCE = Symbol("source-record");
export const EXCLUDED = Symbol("excluded-record");
export const SIGNAL_COVERAGE = Symbol("signal-coverage");
export const isExcluded = (row) => row[EXCLUDED] === true;
export const missingValue = (value) =>
  value == null ||
  (typeof value === "string" && /^(?:\s*|null|n\/?a|none|undefined)$/i.test(value.trim()));
export function numericValue(value) {
  return typeof value === "object" || typeof value === "boolean" ? null : toNumber(value);
}
export function valueState(value) {
  return missingValue(value)
    ? "missing"
    : isFiniteNumber(numericValue(value))
      ? "valid"
      : "invalid";
}
export function issue(code, file, message, impact, extra = {}) {
  return { code, file, severity: "warning", message, impact, count: 1, examples: [], ...extra };
}
export function sample(row, column, value) {
  return {
    file: row[SOURCE]?.file,
    path: row[SOURCE]?.path,
    record: row[SOURCE]?.record ?? null,
    column,
    value,
  };
}

// Group repeated cell issues, retaining exact totals and bounded examples.
// Every original row remains accessible in the source table.
export function analyzeTable(
  table,
  { file = "", path = null, timeKey = null, kpi = false, labelKey = null } = {},
) {
  const diagnostics = [...(table.diagnostics || [])],
    columns = [];
  const names = table.columns.map((column) => column.toLowerCase());
  const long = ["name", "cost_function", "value"].every((column) => names.includes(column));
  for (const column of table.columns) {
    if (
      column === timeKey ||
      column === labelKey ||
      (long &&
        ["name", "cost_function", "level", "unit", "community_id"].includes(column.toLowerCase()))
    )
      continue;
    const expected =
      (long && column.toLowerCase() === "value") ||
      kpi ||
      /kwh|(?:^|[_ -])kw(?:$|[^a-z])|soc|pricing|temperature|_ratio|_rate|_count|price|consumption|generation|charge|discharge/i.test(
        column,
      );
    const numeric = table.rows.some((row) => valueState(row[column]) === "valid");
    if (!numeric && !expected) continue; // Text/identity/additional columns are supported.
    const stats = {
      column,
      valid: 0,
      missing: 0,
      invalid: 0,
      excluded: 0,
      total: table.rows.length,
    };
    const examples = { missing: [], invalid: [] };
    for (const row of table.rows) {
      if (isExcluded(row)) {
        stats.excluded++;
        continue;
      }
      const state = valueState(row[column]);
      stats[state]++;
      if (state !== "valid" && examples[state].length < 5)
        examples[state].push(sample(row, column, row[column]));
    }
    for (const state of ["missing", "invalid"])
      if (stats[state])
        diagnostics.push(
          issue(
            state === "missing" ? "missing-value" : "invalid-number",
            file,
            `${column}: ${stats[state]} ${state === "missing" ? "missing/unknown" : "non-numeric or non-finite"} values.`,
            "Available values remain visible; affected aggregates are partial or unknown.",
            {
              severity: state === "missing" ? "info" : "warning",
              column,
              count: stats[state],
              examples: examples[state],
            },
          ),
        );
    columns.push(stats);
  }
  return {
    file,
    sourcePaths: table.sources
      ? table.sources.filter((s) => !s.incompatible).map((s) => s.entry.relativePath)
      : path
        ? [path]
        : [],
    records: table.rows.length,
    accepted: table.rows.filter((row) => !isExcluded(row)).length,
    excluded: table.rows.filter(isExcluded).length,
    columns,
    diagnostics,
    headerInvalid: table.headerInvalid || false,
    rawHeaders: table.rawHeaders,
    rawText: table.rawText,
  };
}

export function summarizeIssues(diagnostics = []) {
  return {
    groups: diagnostics.length,
    occurrences: diagnostics.reduce((n, d) => n + (d.count || 1), 0),
    warnings: diagnostics.filter((d) => d.severity !== "info").length,
  };
}
export function coverageStatus(valid, expected) {
  return valid === 0 ? "unknown" : valid < expected ? "partial" : "complete";
}

export function chartCoverage(
  rows,
  configs,
  { intervalMs = null, range = null, sourceIncomplete = false } = {},
) {
  const inRange = rows.filter(
    (row) => !range || (row.timestamp >= range[0] && row.timestamp <= range[1]),
  );
  const unique = new Set(inRange.map((row) => row.timestamp)).size;
  const origin = rows[0]?.timestamp;
  const offGrid = Boolean(
    intervalMs &&
    inRange.some(
      (row) =>
        Math.abs(
          (row.timestamp - origin) / intervalMs - Math.round((row.timestamp - origin) / intervalMs),
        ) > 1e-7,
    ),
  );
  const expected =
    intervalMs && range && origin !== undefined && !offGrid
      ? Math.max(
          0,
          Math.floor((range[1] - origin) / intervalMs + 1e-7) -
            Math.ceil((range[0] - origin) / intervalMs - 1e-7) +
            1,
        )
      : null;
  const fields = configs
    .filter((c) => c.field)
    .map((config) => {
      let valid = 0,
        missing = 0,
        invalid = 0;
      for (const row of inRange) {
        const dependencies = config.sourceFields;
        if (dependencies) {
          for (const key of dependencies) {
            const state = key ? valueState(row[key]) : "missing";
            if (state === "valid") valid++;
            else if (state === "missing") missing++;
            else invalid++;
          }
        } else {
          const value = config.derive ? config.derive(row) : numericValue(row[config.field]);
          const transformed =
            isFiniteNumber(value) && config.transform ? config.transform(value) : value;
          if (isFiniteNumber(transformed)) valid++;
          else if (!config.derive && !missingValue(row[config.field])) invalid++;
          else missing++;
        }
      }
      const inputs = config.sourceFields?.length || 1,
        total = inRange.length * inputs;
      return {
        field: config.field,
        label: config.label || config.field,
        valid,
        missing,
        invalid,
        total,
        expected: expected === null ? null : expected * inputs,
        status: coverageStatus(valid, Math.max(total, (expected || 0) * inputs)),
      };
    });
  const noValues = fields.length === 0 || fields.every((f) => f.valid === 0);
  return {
    status: noValues
      ? "unknown"
      : sourceIncomplete ||
          offGrid ||
          fields.some((f) => f.status !== "complete") ||
          (expected !== null && unique !== expected)
        ? "partial"
        : "complete",
    records: inRange.length,
    unique,
    expected,
    sourceIncomplete,
    fields,
    offGrid,
  };
}

export function declaredIntervalMs(timeline) {
  return ["utc", "local", "elapsed"].includes(timeline.mode) && timeline.secondsPerStep > 0
    ? timeline.secondsPerStep * 1000
    : null;
}
