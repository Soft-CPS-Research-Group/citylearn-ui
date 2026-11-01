import { useState, useMemo, useEffect } from "react";
import {
  buildKpiScopes,
  getAllKpiRowsForScope,
  getKpiReferenceSummary,
  buildKpiScorecard,
  resolveKpiComparison,
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
import { EvServiceEvidence } from "./EvServiceEvidence.jsx";
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
              <small>
                {selectedScope?.label || "Community"} - cost, EV service, battery behaviour, grid
                safety and solar use
              </small>
            </div>
            <span className="kpi-family-pill">{referenceSummary}</span>
          </header>

          <div className="kpi-priority-grid">
            {scorecard.prioritySignals.map((signal) => {
              const comparison = resolveKpiComparison(signal);
              const showComparisonContext = signal.referenceMode !== "none";
              const toneLabel = formatToneLabel(comparison.tone);
              return (
                <article
                  className={`kpi-priority-tile tone-${comparison.tone}${signal.reported ? "" : " is-missing"}`}
                  key={signal.id}
                >
                  <header>
                    <small>{signal.title}</small>
                    {toneLabel && (
                      <span className={`kpi-tone kpi-tone-${comparison.tone}`}>{toneLabel}</span>
                    )}
                  </header>
                  <strong>{formatKpiScorecardValue(signal)}</strong>
                  {showComparisonContext && (
                    <dl className="kpi-priority-context">
                      <div>
                        <dt>{comparison.policyLabel}</dt>
                        <dd>{comparison.policy}</dd>
                      </div>
                      <div className={comparison.hasReference ? "" : "is-missing"}>
                        <dt>{comparison.referenceLabel}</dt>
                        <dd>{comparison.reference}</dd>
                      </div>
                    </dl>
                  )}
                  <p>{signal.description}</p>
                  <EvServiceEvidence signal={signal} />
                </article>
              );
            })}
          </div>
        </section>

        <section className="kpi-focus-sections">
          <article className="panel kpi-focus-section">
            <header className="kpi-section-header">
              <div>
                <h3>Selected KPIs</h3>
                <small>
                  Expanded scorecard for cost, EV service, grid safety, battery throughput, V2G,
                  solar and grid shape.
                </small>
              </div>
              <span className="kpi-family-pill">
                {scorecard.reportedCount}/{scorecard.selectedSignals.length} reported
              </span>
            </header>

            <div className="kpi-focus-list">
              {scorecard.selectedSignals.map((signal) => {
                const comparison = resolveKpiComparison(signal);
                const showComparisonContext = signal.referenceMode !== "none";
                const toneLabel = formatToneLabel(comparison.tone);
                return (
                  <div
                    className={`kpi-focus-row tone-${comparison.tone}${showComparisonContext ? "" : " is-absolute"}${signal.reported ? "" : " is-missing"}`}
                    key={signal.id}
                  >
                    <div className="kpi-focus-row-main">
                      <strong>{signal.title}</strong>
                      <small>{signal.description}</small>
                      <EvServiceEvidence signal={signal} />
                    </div>
                    {showComparisonContext ? (
                      <>
                        <div className="kpi-compare-cell">
                          <small>{comparison.policyLabel}</small>
                          <strong>{comparison.policy}</strong>
                        </div>
                        <div
                          className={`kpi-compare-cell ${comparison.hasReference ? "" : "is-missing"}`}
                        >
                          <small>{comparison.referenceLabel}</small>
                          <strong>{comparison.reference}</strong>
                        </div>
                        <div className="kpi-compare-cell">
                          <small>{comparison.deltaLabel}</small>
                          <strong>{comparison.delta}</strong>
                        </div>
                      </>
                    ) : (
                      <div className="kpi-compare-cell kpi-final-cell">
                        <small>Value</small>
                        <strong>{formatKpiScorecardValue(signal)}</strong>
                      </div>
                    )}
                    <div className="kpi-focus-row-value">
                      {toneLabel ? (
                        <span className={`kpi-tone kpi-tone-${comparison.tone}`}>{toneLabel}</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
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
              <small>Complete grouped KPI table for the selected scope.</small>
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
                            <small>{familySection.subfamilies.length} subfamily group(s)</small>
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
