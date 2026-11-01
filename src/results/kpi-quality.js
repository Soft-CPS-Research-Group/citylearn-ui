import { adaptKpis } from "./tabular.js";
import { isExcluded, issue, sample, SOURCE } from "./quality.js";

// Keep unambiguous identities; never average or silently select a duplicate.
export function recoverKpis(table, fileName) {
  const eligible = table.rows.filter((row) => !isExcluded(row));
  if (table.headerInvalid)
    return {
      kpis: null,
      diagnostics: [
        issue(
          "kpi-header",
          fileName,
          "KPI headers are ambiguous.",
          "The original table is retained without an automatic scorecard.",
        ),
      ],
    };
  try {
    return { kpis: adaptKpis({ ...table, rows: eligible }, fileName), diagnostics: [] };
  } catch (error) {
    const columns = table.columns,
      field = (name) => columns.find((c) => c.toLowerCase() === name);
    const long = field("name") && field("cost_function") && field("value");
    let labelKey;
    try {
      labelKey = adaptKpis({ ...table, rows: [] }, fileName).labelKey;
    } catch {
      return {
        kpis: null,
        diagnostics: [
          issue(
            "kpi-layout",
            fileName,
            error.message,
            "The table remains accessible without a guessed interpretation.",
          ),
        ],
      };
    }
    const identities = new Map(),
      levels = new Map(),
      badEntities = new Set();
    const key = (row) =>
      long
        ? JSON.stringify([row[field("name")], row[field("cost_function")]])
        : String(row[labelKey] ?? "").trim();
    for (const row of eligible) {
      const k = key(row);
      identities.set(k, (identities.get(k) || 0) + 1);
      if (long && field("level")) {
        const name = row[field("name")],
          level = row[field("level")];
        if (levels.has(name) && levels.get(name) !== level) badEntities.add(name);
        levels.set(name, level);
      }
    }
    const good = [],
      diagnostics = [];
    for (const row of eligible) {
      const invalid = long
        ? !String(row[field("name")] ?? "").trim() ||
          !String(row[field("cost_function")] ?? "").trim() ||
          badEntities.has(row[field("name")])
        : !key(row);
      if (invalid || identities.get(key(row)) > 1) {
        diagnostics.push(
          issue(
            "kpi-identity",
            fileName,
            "Duplicate, missing or conflicting KPI identity.",
            "All ambiguous occurrences are excluded; other distinct KPI identities remain usable.",
            {
              record: row[SOURCE]?.record,
              examples: [
                sample(
                  row,
                  long ? field("cost_function") : labelKey,
                  long ? row[field("cost_function")] : row[labelKey],
                ),
              ],
            },
          ),
        );
      } else good.push(row);
    }
    if (!good.length) return { kpis: null, diagnostics };
    return { kpis: adaptKpis({ ...table, rows: good }, fileName), diagnostics };
  }
}
