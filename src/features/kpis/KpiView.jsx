import { useState, useMemo, useEffect } from "react";
import {
  buildKpiScopes,
  getAllKpiRowsForScope,
  getKpiReferenceSummary,
  buildKpiScorecard,
  formatKpiScorecardValue,
} from "../../results/kpi-scorecard.js";
import { isFiniteNumber, formatNumber } from "../../results/values.js";
import {
  buildKpiFamilyOptions,
  buildKpiDrilldownSections,
  formatToneLabel,
  formatKpiDrilldownValue,
} from "../../results/kpi-drilldown.js";
import { Table2, Search } from "lucide-react";
import { KpiScopeTree } from "./KpiScopeTree.jsx";
import { resolveKpiFamilyIcon } from "./icons.js";

function KpiView({ simulation }) {
  const kpis = simulation.kpis;
  const [selectedScopeId, setSelectedScopeId] = useState("community");
  const [kpiDrilldownOpen, setKpiDrilldownOpen] = useState(false);
  const [kpiSearch, setKpiSearch] = useState("");
  const [kpiFamilyFilter, setKpiFamilyFilter] = useState("all");
  const [showKpiNa, setShowKpiNa] = useState(false);
  const scopes = useMemo(() => (kpis ? buildKpiScopes(kpis) : []), [kpis]);
  const selectedScope = scopes.find((scope) => scope.id === selectedScopeId) || scopes[0] || null;
  const allScopeRows = useMemo(
    () => (kpis && selectedScope ? getAllKpiRowsForScope(kpis, selectedScope.column) : []),
    [kpis, selectedScope],
  );
  const scoreRows = useMemo(
    () => allScopeRows.filter((row) => isFiniteNumber(row.value)),
    [allScopeRows],
  );
  const referenceSummary = useMemo(() => getKpiReferenceSummary(allScopeRows), [allScopeRows]);
  const scorecard = useMemo(
    () => buildKpiScorecard(scoreRows, allScopeRows),
    [scoreRows, allScopeRows],
  );
  const kpiFamilyOptions = useMemo(() => buildKpiFamilyOptions(allScopeRows), [allScopeRows]);
  const kpiDrilldownSections = useMemo(
    () =>
      buildKpiDrilldownSections(allScopeRows, {
        familyFilter: kpiFamilyFilter,
        search: kpiSearch,
        showNa: showKpiNa,
        selectedScope,
      }),
    [allScopeRows, kpiFamilyFilter, kpiSearch, showKpiNa, selectedScope],
  );
  const visibleDrilldownCount = kpiDrilldownSections.reduce(
    (count, section) =>
      count + section.subfamilies.reduce((sum, subfamily) => sum + subfamily.rows.length, 0),
    0,
  );

  useEffect(() => {
    if (scopes.length > 0 && !scopes.some((scope) => scope.id === selectedScopeId)) {
      setSelectedScopeId(scopes[0].id);
    }
  }, [scopes, selectedScopeId]);

  if (!kpis) {
    return (
      <section className="empty-panel">
        <Table2 size={28} aria-hidden="true" />
        <h3>No KPI CSV file found</h3>
      </section>
    );
  }

  return (
    <section className="kpi-layout">
      <KpiScopeTree
        scopes={scopes}
        selectedScopeId={selectedScope?.id || "community"}
        onSelectScope={setSelectedScopeId}
      />

      <section className="kpi-main">
        <section className="kpi-priority-board panel">
          <header className="kpi-section-header">
            <div>
              <h3>Decision scorecard</h3>
              <small>{selectedScope?.label || "Community"}</small>
            </div>
            <span className="kpi-family-pill">{referenceSummary}</span>
          </header>

          <div className="kpi-priority-grid">
            {scorecard.prioritySignals.map((signal) => (
              <article
                className={`kpi-priority-tile${signal.reported ? "" : " is-missing"}`}
                key={signal.id}
              >
                <header>
                  <small>{signal.title}</small>
                </header>
                <strong>{formatKpiScorecardValue(signal)}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="kpi-focus-sections">
          <article className="panel kpi-focus-section">
            <header className="kpi-section-header">
              <div>
                <h3>Selected KPIs</h3>
              </div>
              <span className="kpi-family-pill">
                {scorecard.reportedCount}/{scorecard.selectedSignals.length} reported
              </span>
            </header>

            <div className="kpi-focus-list">
              {scorecard.selectedSignals.map((signal) => (
                <div
                  className={`kpi-focus-row is-compact${signal.reported ? "" : " is-missing"}`}
                  key={signal.id}
                >
                  <div className="kpi-focus-row-main">
                    <strong>{signal.title}</strong>
                  </div>
                  <div className="kpi-final-cell">
                    <strong>{formatKpiScorecardValue(signal)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className={`panel kpi-drilldown-panel${kpiDrilldownOpen ? " is-open" : ""}`}>
          <button
            type="button"
            className="kpi-drilldown-summary"
            aria-expanded={kpiDrilldownOpen}
            onClick={() => setKpiDrilldownOpen((open) => !open)}
          >
            <span>
              <strong>All KPI drill-down</strong>
            </span>
            <span className="kpi-family-pill">{visibleDrilldownCount} KPIs</span>
          </button>
          {kpiDrilldownOpen && (
            <div className="kpi-drilldown-body">
              <section className="kpi-toolbar kpi-drilldown-toolbar">
                <div className="kpi-toolbar-main">
                  <label className="kpi-filter">
                    <select
                      aria-label="Filter KPI family"
                      value={kpiFamilyFilter}
                      onChange={(event) => setKpiFamilyFilter(event.target.value)}
                    >
                      <option value="all">All families</option>
                      {kpiFamilyOptions.map((option) => (
                        <option key={option.family} value={option.family}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="checkbox-inline kpi-toggle-chip">
                    <input
                      type="checkbox"
                      checked={showKpiNa}
                      onChange={(event) => setShowKpiNa(event.target.checked)}
                    />
                    <span>Show N/A</span>
                  </label>
                </div>
                <label className="search-inline kpi-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    value={kpiSearch}
                    onChange={(event) => setKpiSearch(event.target.value)}
                    placeholder="Search KPI..."
                  />
                </label>
              </section>

              {kpiDrilldownSections.length === 0 ? (
                <section className="empty-panel compact">
                  <Table2 size={24} aria-hidden="true" />
                  <h3>No KPIs in selected scope</h3>
                </section>
              ) : (
                kpiDrilldownSections.map((familySection) => {
                  const FamilyIcon = resolveKpiFamilyIcon(familySection.family);
                  return (
                    <details className="kpi-family-panel" key={familySection.family}>
                      <summary className="kpi-family-summary">
                        <span className="kpi-family-heading">
                          <span className={`kpi-family-icon family-${familySection.family}`}>
                            <FamilyIcon size={14} aria-hidden="true" />
                          </span>
                          <span>
                            <strong>{familySection.label}</strong>
                          </span>
                        </span>
                        <span className="kpi-family-pill">{familySection.count} KPIs</span>
                      </summary>

                      <div className="kpi-family-body">
                        <div className="kpi-subfamily-stack">
                          {familySection.subfamilies.map((subfamily) => (
                            <details
                              className="kpi-subfamily-accordion"
                              key={`${familySection.family}:${subfamily.key}`}
                            >
                              <summary>
                                <strong>{subfamily.label}</strong>
                                <small>{subfamily.rows.length} KPI(s)</small>
                              </summary>
                              <KpiGroupTable rows={subfamily.rows} selectedScope={selectedScope} />
                            </details>
                          ))}
                        </div>
                      </div>
                    </details>
                  );
                })
              )}
            </div>
          )}
        </section>
      </section>
    </section>
  );
}

function KpiGroupTable({ rows, selectedScope }) {
  return (
    <div className="job-kpi-table-wrap kpi-list-wrap">
      <div className="table-scroll">
        <table className="kpi-reference-table">
          <thead>
            <tr>
              <th>KPI</th>
              <th>Control</th>
              <th>Reference</th>
              <th>Delta</th>
              <th>Delta %</th>
              <th>Primary</th>
              <th>Tone</th>
              <th>Unit</th>
              <th>Entity breakdown</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const toneLabel = formatToneLabel(row.tone);
              return (
                <tr className={row.reported ? "" : "kpi-row-na"} key={row.key}>
                  <td>
                    <span className="kpi-row-label">
                      <span>
                        {row.label}
                        <small className="kpi-row-meta">{row.sourceLabels.join(", ")}</small>
                      </span>
                    </span>
                  </td>
                  <td>{formatKpiDrilldownValue(row.control, row.unit)}</td>
                  <td>
                    <strong>{formatKpiDrilldownValue(row.reference, row.unit)}</strong>
                    <small className="job-compare-secondary">{row.referenceLabel}</small>
                  </td>
                  <td
                    className={
                      row.tone === "better"
                        ? "kpi-delta-better"
                        : row.tone === "worse"
                          ? "kpi-delta-worse"
                          : ""
                    }
                  >
                    {formatKpiDrilldownValue(row.delta, row.unit)}
                  </td>
                  <td
                    className={
                      row.tone === "better"
                        ? "kpi-delta-better"
                        : row.tone === "worse"
                          ? "kpi-delta-worse"
                          : ""
                    }
                  >
                    {isFiniteNumber(row.deltaPct) ? `${formatNumber(row.deltaPct)}%` : "N/A"}
                  </td>
                  <td>{formatKpiDrilldownValue(row.primary, row.unit)}</td>
                  <td>
                    {toneLabel ? (
                      <span className={`kpi-tone kpi-tone-${row.tone}`}>{toneLabel}</span>
                    ) : (
                      <span className="kpi-tone-empty">-</span>
                    )}
                    {!row.reported ? <span className="kpi-na-pill">N/A</span> : null}
                  </td>
                  <td>{row.unit || "-"}</td>
                  <td>
                    <div className="kpi-breakdown-inline">
                      {row.breakdown.length > 0 ? (
                        row.breakdown.map((entry) => (
                          <span key={`${row.key}:${entry.entity}`}>
                            {entry.entity}: {formatKpiDrilldownValue(entry.value, row.unit)}
                          </span>
                        ))
                      ) : (
                        <span>{selectedScope?.label || "Scope"}: N/A</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { KpiView };
