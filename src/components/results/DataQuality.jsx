import { useMemo, useState } from "react";
import { DataTable } from "./ImportContext.jsx";
import {
  SOURCE,
  chartCoverage,
  summarizeIssues,
  declaredIntervalMs,
} from "../../results/quality.js";

const NO_DIAGNOSTICS = [];

function sourceFor(simulation, diagnostic) {
  const targetPath = diagnostic.path || diagnostic.examples?.[0]?.path;
  const target =
    diagnostic.examples?.find(
      (e) => e.record === (diagnostic.record || diagnostic.examples?.[0]?.record),
    )?.file || diagnostic.file;
  const candidates = [
    ...(simulation.series || []),
    ...(simulation.tables || []),
    ...(simulation.kpis ? [simulation.kpis] : []),
  ];
  for (const table of candidates) {
    const rows = table.rows.filter((row) =>
      targetPath ? row[SOURCE]?.path === targetPath : row[SOURCE]?.file === target,
    );
    if (rows.length) return { ...table, rows };
    if (
      targetPath &&
      (table.quality?.sourcePaths?.includes(targetPath) ||
        table.sources?.some((s) => s.entry.relativePath === targetPath))
    )
      return { ...table, rows: [] };
    if (!targetPath && table.fileName === target) return table;
  }
  return null;
}
const display = (value) =>
  value === undefined
    ? "(not present)"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
export function QualityPanel({ simulation }) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState(null);
  const select = (diagnostic) =>
    setSelected((previous) => ({ ...diagnostic, selection: (previous?.selection || 0) + 1 }));
  const all = simulation.quality?.diagnostics || NO_DIAGNOSTICS,
    summary = useMemo(() => summarizeIssues(all), [all]);
  const filtered = useMemo(() => {
    if (!query) return all;
    const needle = query.toLowerCase();
    return all.filter((d) =>
      `${d.file} ${d.path || ""} ${(d.examples || []).map((e) => e.path || e.file || "").join(" ")} ${d.code} ${d.column || ""} ${d.message}`
        .toLowerCase()
        .includes(needle),
    );
  }, [all, query]);
  const max = Math.max(0, Math.ceil(filtered.length / 30) - 1),
    current = Math.min(page, max);
  const table = useMemo(
    () => (selected ? sourceFor(simulation, selected) : null),
    [simulation, selected],
  );
  const initialIndex =
    table && selected
      ? Math.max(
          0,
          table.rows.findIndex(
            (row) => row[SOURCE]?.record === (selected.record || selected.examples?.[0]?.record),
          ),
        )
      : 0;
  return (
    <details
      className="panel data-quality"
      data-import-quality={summary.warnings ? "review" : "reported"}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        Data quality{" "}
        <span>
          {summary.warnings
            ? `${summary.warnings} warning/error groups`
            : `${summary.groups} information groups`}{" "}
          · source data remains accessible
        </span>
      </summary>
      {open && (
        <div className="data-quality-body">
          <p>
            Issues are local to the named file, record or signal. Missing values are not measured
            zero. Record numbers count data records after the header; quoted multiline cells are one
            record.
          </p>
          <label>
            Filter quality issues{" "}
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
            />
          </label>
          {all.length === 0 ? (
            <p>
              No import defects detected. This does not certify an unexported population or physical
              completeness.
            </p>
          ) : (
            <>
              <div className="table-scroll">
                <table className="quality-issues">
                  <thead>
                    <tr>
                      <th>File / source</th>
                      <th>Issue</th>
                      <th>Impact</th>
                      <th>Occurrences</th>
                      <th>Inspect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(current * 30, (current + 1) * 30).map((d, i) => (
                      <tr key={current * 30 + i}>
                        <td>
                          {d.path || d.file}
                          <br />
                          {d.record
                            ? `Record ${d.record}`
                            : d.column
                              ? `Column: ${d.column}`
                              : "File/table scope"}
                        </td>
                        <td>
                          {d.message}
                          {d.examples?.length > 0 && (
                            <small>
                              Examples:{" "}
                              {d.examples.map((e, j) => (
                                <span key={j}>
                                  {" "}
                                  {e.path || e.file || d.file} ·{" "}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      select({
                                        ...d,
                                        file: e.file || d.file,
                                        path: e.path || d.path,
                                        record: e.record,
                                        examples: [e],
                                      })
                                    }
                                  >
                                    Record {e.record ?? "?"}
                                  </button>
                                  {e.column ? ` / ${e.column}` : ""}:{" "}
                                  <code>{display(e.value)}</code>;{" "}
                                </span>
                              ))}
                            </small>
                          )}
                        </td>
                        <td>{d.impact}</td>
                        <td>{d.count || 1}</td>
                        <td>
                          <button type="button" onClick={() => select(d)}>
                            Inspect source
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="import-table-pages">
                <span>
                  {filtered.length} issue groups · page {current + 1}/{max + 1}
                </span>
                <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>
                  Previous issues
                </button>
                <button
                  type="button"
                  disabled={current === max}
                  onClick={() => setPage(current + 1)}
                >
                  Next issues
                </button>
              </div>
            </>
          )}
          {selected && (
            <section className="quality-source">
              <h4>Source: {selected.path || selected.examples?.[0]?.path || selected.file}</h4>
              <p>
                {selected.message} {selected.impact}
              </p>
              {table ? (
                <>
                  <DataTable
                    key={`${selected.file}:${selected.record || selected.examples?.[0]?.record || 0}:${selected.selection}`}
                    table={table}
                    initialIndex={initialIndex}
                    showLocations
                  />
                  {(table.quality?.rawText || table.rawText) && (
                    <details>
                      <summary>Original CSV text</summary>
                      <pre>{table.quality?.rawText || table.rawText}</pre>
                    </details>
                  )}
                </>
              ) : (
                <>
                  <p>
                    No decoded records are available for this file. Its original bytes have not been
                    changed.
                  </p>
                  {selected.rawText && (
                    <details>
                      <summary>Original metadata text</summary>
                      <pre>{selected.rawText}</pre>
                    </details>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      )}
    </details>
  );
}

export function ChartQuality({ series, rows, configs, range, timeline }) {
  const sourceIncomplete = Boolean(
    series.quality?.excluded ||
    series.quality?.clockUncertain ||
    series.aggregationEvidence?.partialIntervals ||
    series.aggregationEvidence?.sourceIncomplete,
  );
  const coverage = useMemo(
    () =>
      chartCoverage(rows, configs, {
        intervalMs: declaredIntervalMs(timeline),
        range,
        sourceIncomplete,
      }),
    [rows, configs, range, timeline, sourceIncomplete],
  );
  const labels = {
    complete: "Complete values for supplied samples",
    partial: "Partial data",
    unknown: "Unknown — no usable selected values",
  };
  return (
    <details className="chart-quality" data-quality-status={coverage.status}>
      <summary>
        {labels[coverage.status]} · {coverage.unique} observed coordinates
        {coverage.expected === null
          ? " · interval population unknown"
          : ` / ${coverage.expected} expected grid samples in selected span`}
      </summary>
      <p>
        Sums use known values; partial sums are subtotals. Averages use available values. Coverage
        describes the selected span, not proof that the entire experiment was exported.
      </p>
      {coverage.offGrid && (
        <p>
          Coordinates do not share the declared sampling grid. Interval coverage remains unknown.
        </p>
      )}
      {sourceIncomplete && (
        <p>
          File, clock or membership coverage is incomplete or unverified. Available source data is
          retained for review.
        </p>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Signal</th>
              <th>Usable inputs</th>
              <th>Missing</th>
              <th>Invalid/filtered</th>
              <th>Grid inputs expected</th>
              <th>Availability</th>
            </tr>
          </thead>
          <tbody>
            {coverage.fields.map((f) => (
              <tr key={f.field}>
                <td>{f.label}</td>
                <td>
                  {f.valid}/{f.total}
                </td>
                <td>{f.missing}</td>
                <td>{f.invalid}</td>
                <td>{f.expected ?? "Unknown"}</td>
                <td>{f.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
