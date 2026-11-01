import { useState, useEffect, useRef } from "react";
import { SOURCE } from "../../results/quality.js";
import { metadataSummary } from "../../results/context.js";

export function DataTable({ table, initialIndex = 0, showLocations = false }) {
  const [page, setPage] = useState(Math.floor(initialIndex / 50)),
    size = 50,
    max = Math.max(0, Math.ceil(table.rows.length / size) - 1);
  const current = Math.min(page, max),
    container = useRef(null);
  useEffect(() => {
    if (!showLocations) return;
    const row = container.current?.querySelector(`[data-source-row="${initialIndex}"]`);
    if (row) {
      row.scrollIntoView({ block: "center", inline: "nearest" });
      row.focus({ preventScroll: true });
    }
  }, [showLocations, initialIndex]);
  const [pageInput, setPageInput] = useState(String(current + 1));
  useEffect(() => setPageInput(String(current + 1)), [current]);
  const jump = () => {
    const number = Number(pageInput);
    const next = Number.isFinite(number)
      ? Math.max(0, Math.min(max, Math.trunc(number) - 1))
      : current;
    setPage(next);
    setPageInput(String(next + 1));
  };
  const cell = (value) =>
    value === null || value === undefined || value === ""
      ? "—"
      : typeof value === "object"
        ? JSON.stringify(value, (_, v) => (typeof v === "bigint" ? String(v) : v))
        : String(value);
  return (
    <div className="import-data-table" ref={container}>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {showLocations && (
                <>
                  <th>Data record</th>
                  <th>Source file</th>
                </>
              )}
              {table.columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.slice(current * size, (current + 1) * size).map((row, i) => (
              <tr
                key={current * size + i}
                data-source-row={current * size + i}
                tabIndex={showLocations ? -1 : undefined}
              >
                {showLocations && (
                  <>
                    <td>{row[SOURCE]?.record ?? current * size + i + 1}</td>
                    <td>{row[SOURCE]?.path || row[SOURCE]?.file || table.fileName}</td>
                  </>
                )}
                {table.columns.map((c) => (
                  <td key={c}>
                    {cell(
                      Object.hasOwn(table.formatters || {}, c)
                        ? table.formatters[c](row[c])
                        : row[c],
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="import-table-pages">
        <span>
          {table.rows.length} rows · page {current + 1}/{max + 1}
        </span>
        <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>
          Previous rows
        </button>
        <button type="button" disabled={current === max} onClick={() => setPage(current + 1)}>
          Next rows
        </button>
        {max > 0 && (
          <>
            <label>
              Page{" "}
              <input
                aria-label="Table page"
                type="number"
                min="1"
                max={max + 1}
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value)}
                onBlur={jump}
                onKeyDown={(event) => {
                  if (event.key === "Enter") jump();
                }}
              />
            </label>
            <button type="button" disabled={current === max} onClick={() => setPage(max)}>
              Last rows
            </button>
          </>
        )}
      </div>
    </div>
  );
}
const show = (value) =>
  value === null || value === undefined
    ? "Not exported"
    : typeof value === "boolean"
      ? value
        ? "Yes"
        : "No"
      : String(value);

export function ImportContext({ simulation }) {
  const [open, setOpen] = useState(false),
    [raw, setRaw] = useState(false);
  const meta = simulation.metadata || {},
    summary = metadataSummary(meta),
    has = Boolean(meta.manifest || meta.service || meta.robustness);
  const fields = [
    ["Simulator version", summary.simulatorVersion],
    ["Time step (seconds)", summary.secondsPerStep],
    [
      "Observation window (global steps)",
      summary.startStep !== null && summary.endStep !== null
        ? `${summary.startStep}–${summary.endStep}`
        : null,
    ],
    ["Executed intervals", summary.completedIntervals],
    ["Timezone", summary.timezone],
    ["Random seed", summary.seed],
    ["BAU definition", summary.referenceDefinition],
    ["BAU evaluated", summary.referenceEvaluated],
    ["Observation interface", summary.observationInterface],
    ["Declared member catalogue", summary.declaredMembers],
    ["Appliance service definition", summary.serviceDefinition],
    ["Appliance service population", summary.servicePopulation],
    ["Robustness definition", summary.robustnessDefinition],
    ["Robustness coverage unit", summary.robustnessCoverageUnit],
  ];
  return (
    <details
      className="panel import-context"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        Export context{" "}
        <span>
          {has ? "Metadata available" : "Metadata not exported"} ·{" "}
          {(simulation.formats || ["csv"]).join(", ")}
        </span>
      </summary>
      {open && (
        <div className="import-context-body">
          <p>
            Context is reported by the imported files. Missing metadata does not prevent inspection.
          </p>
          <dl>
            {fields.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{show(value)}</dd>
              </div>
            ))}
          </dl>
          {summary.sourceFingerprint && (
            <p>
              Source fingerprint: <code>{summary.sourceFingerprint}</code>
            </p>
          )}
          {summary.finalInventory && (
            <details>
              <summary>Final inventory ({summary.finalInventory.length} entries)</summary>
              <DataTable
                table={{
                  rows: summary.finalInventory,
                  columns: [...new Set(summary.finalInventory.flatMap(Object.keys))],
                }}
              />
              <p>Final stored energy is an outcome; it is not an automatic monetary credit.</p>
            </details>
          )}
          {summary.serviceDistrict && (
            <details>
              <summary>Appliance service counts and coverage</summary>
              <pre>{JSON.stringify(summary.serviceDistrict, null, 2)}</pre>
            </details>
          )}
          {summary.robustnessDistrict && (
            <details>
              <summary>Robustness counts and coverage</summary>
              <pre>
                {JSON.stringify(
                  {
                    district: summary.robustnessDistrict,
                    executed_intervals: summary.robustnessExecuted,
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
          )}
          {summary.observationContract && (
            <details>
              <summary>Observation access contract</summary>
              <pre>{JSON.stringify(summary.observationContract, null, 2)}</pre>
            </details>
          )}
          {simulation.warnings?.length > 0 && (
            <div role="status">
              <strong>Import notes</strong>
              <ul>
                {simulation.warnings.slice(0, 20).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
              {simulation.warnings.length > 20 && (
                <p>Further issues are available in Data quality.</p>
              )}
            </div>
          )}
          {simulation.kpis && (
            <details>
              <summary>Imported KPI values</summary>
              <DataTable table={simulation.kpis} />
            </details>
          )}
          {simulation.tables?.map((t, i) => (
            <details key={i}>
              <summary>{t.label}</summary>
              <DataTable table={t} />
            </details>
          ))}
          {has && (
            <details onToggle={(event) => setRaw(event.currentTarget.open)}>
              <summary>Imported metadata details</summary>
              {raw && <pre>{JSON.stringify(meta, null, 2)}</pre>}
            </details>
          )}
        </div>
      )}
    </details>
  );
}
export function ComparisonContext({ assessment }) {
  const labels = {
    matched: "Exported context matches",
    different: "Context differences found",
    unknown: "Context is not fully documented",
  };
  return (
    <section className="panel comparison-context" data-comparison-status={assessment.status}>
      <strong>{labels[assessment.status]}</strong>
      <p>
        {assessment.status === "matched"
          ? "The supplied pairing fields match. Read each metric with service and final inventory."
          : "Values and numerical differences remain available. They do not establish a paired improvement."}
      </p>
      <details>
        <summary>Comparison context details</summary>
        {assessment.pairs.map((pair, i) => (
          <div key={i}>
            <strong>
              {pair.left} / {pair.right}
            </strong>
            {pair.differences.length > 0 && <p>Differences: {pair.differences.join(", ")}.</p>}
            {pair.missing.length > 0 && <p>Not fully documented: {pair.missing.join(", ")}.</p>}
            {!pair.differences.length && !pair.missing.length && (
              <p>Declared pairing fields match.</p>
            )}
          </div>
        ))}
      </details>
    </section>
  );
}
