import { useState, useMemo, useEffect } from "react";
import { assessComparison } from "../../results/context.js";
import {
  buildCompareKpiScopes,
  buildCompareScorecardRows,
  buildCompareKpiMatrixRows,
  buildCompareKpiFamilyOptions,
  getCompareSimulationReferenceSummary,
  formatCompareSignalDelta,
  formatCompareMatrixValue,
} from "../../results/kpi-comparison.js";
import { GitCompareArrows, Table2, Search } from "lucide-react";
import { KpiScopeTree } from "../kpis/KpiScopeTree.jsx";
import { ComparisonContext } from "../../components/results/ImportContext.jsx";
import { formatKpiScorecardValue } from "../../results/kpi-scorecard.js";
import { isFiniteNumber } from "../../results/values.js";

function CompareView({ simulations, compareIds }) {
  const [selectedScopeId, setSelectedScopeId] = useState("community");
  const [showUnion, setShowUnion] = useState(true);
  const [showKpiNa, setShowKpiNa] = useState(false);
  const [kpiSearch, setKpiSearch] = useState("");
  const [kpiFamilyFilter, setKpiFamilyFilter] = useState("all");
  const [kpiDrilldownOpen, setKpiDrilldownOpen] = useState(false);
  const selectedSimulations = useMemo(
    () => simulations.filter((simulation) => compareIds.includes(simulation.id)),
    [simulations, compareIds],
  );
  const selectedKpiSimulations = useMemo(
    () => selectedSimulations.filter((simulation) => simulation.kpis),
    [selectedSimulations],
  );
  const assessment = useMemo(
    () => assessComparison(selectedKpiSimulations),
    [selectedKpiSimulations],
  );
  const scopes = useMemo(
    () => buildCompareKpiScopes(selectedKpiSimulations),
    [selectedKpiSimulations],
  );
  const selectedScope = scopes.find((scope) => scope.id === selectedScopeId) || scopes[0] || null;
  const scorecardRows = useMemo(
    () => (selectedScope ? buildCompareScorecardRows(selectedKpiSimulations, selectedScope) : []),
    [selectedKpiSimulations, selectedScope],
  );
  const matrixRows = useMemo(
    () =>
      selectedScope
        ? buildCompareKpiMatrixRows(selectedKpiSimulations, selectedScope, showUnion)
        : [],
    [selectedKpiSimulations, selectedScope, showUnion],
  );
  const kpiFamilyOptions = useMemo(() => buildCompareKpiFamilyOptions(matrixRows), [matrixRows]);
  const visibleMatrixRows = useMemo(() => {
    const query = kpiSearch.trim().toLowerCase();
    return matrixRows.filter((row) => {
      if (kpiFamilyFilter !== "all" && row.family !== kpiFamilyFilter) return false;
      if (!showKpiNa && row.reportedCount === 0) return false;
      if (!query) return true;
      return `${row.label} ${row.sourceLabels.join(" ")} ${row.family} ${row.subfamily.label}`
        .toLowerCase()
        .includes(query);
    });
  }, [kpiFamilyFilter, kpiSearch, matrixRows, showKpiNa]);

  useEffect(() => {
    if (scopes.length > 0 && !scopes.some((scope) => scope.id === selectedScopeId)) {
      setSelectedScopeId(scopes[0].id);
    }
  }, [scopes, selectedScopeId]);

  useEffect(() => {
    if (
      kpiFamilyFilter !== "all" &&
      !kpiFamilyOptions.some((option) => option.family === kpiFamilyFilter)
    ) {
      setKpiFamilyFilter("all");
    }
  }, [kpiFamilyFilter, kpiFamilyOptions]);

  if (simulations.length < 2) {
    return (
      <section className="empty-panel">
        <GitCompareArrows size={28} aria-hidden="true" />
        <h3>Import at least two simulations to compare</h3>
      </section>
    );
  }

  if (selectedKpiSimulations.length < 2) {
    return (
      <section className="empty-panel">
        <Table2 size={28} aria-hidden="true" />
        <h3>Select at least two simulations with KPI files</h3>
      </section>
    );
  }

  return (
    <section className="kpi-layout compare-kpi-layout">
      <KpiScopeTree
        scopes={scopes}
        selectedScopeId={selectedScope?.id || "community"}
        onSelectScope={setSelectedScopeId}
      />

      <section className="kpi-main compare-kpi-main">
        <ComparisonContext assessment={assessment} />
        <section className="panel compare-kpi-header">
          <div className="compare-kpi-jobs">
            {selectedKpiSimulations.map((simulation, index) => (
              <article className="compare-kpi-job" key={simulation.id}>
                <small>{index === 0 ? "Compare baseline" : `Simulation ${index + 1}`}</small>
                <strong title={simulation.name}>{simulation.name}</strong>
                <span>
                  {simulation.series.length} series / {simulation.kpis?.rows.length || 0} KPI rows
                </span>
                <em>{getCompareSimulationReferenceSummary(simulation, selectedScope)}</em>
              </article>
            ))}
          </div>

          <div className="compare-kpi-options">
            <label className="checkbox-inline kpi-toggle-chip">
              <input
                type="checkbox"
                checked={showUnion}
                onChange={(event) => setShowUnion(event.target.checked)}
              />
              <span>Show all KPIs (union)</span>
            </label>
            <small>Simulations are selected from the imported list on the left.</small>
          </div>
        </section>

        <section className="panel compare-scorecard-panel">
          <header className="kpi-section-header">
            <div>
              <h3>Selected KPIs</h3>
              <small>
                {selectedScope?.label || "Selected scope"} - scorecard comparison across selected
                simulations
              </small>
            </div>
            <span className="kpi-family-pill">{scorecardRows.length} KPIs</span>
          </header>

          <div className="compare-scorecard-scroll">
            <div
              className="compare-scorecard-list"
              style={{ "--compare-columns": selectedKpiSimulations.length }}
            >
              {scorecardRows.map((row) => (
                <article className="compare-score-row" key={row.id}>
                  <div className="compare-score-main">
                    <strong>{row.title}</strong>
                    <span>
                      {row.reportedCount}/{selectedKpiSimulations.length} reported
                    </span>
                  </div>

                  {selectedKpiSimulations.map((simulation, index) => {
                    const signal = row.signalsBySimulationId[simulation.id];
                    const baselineSignal = row.signalsBySimulationId[selectedKpiSimulations[0].id];
                    const reportedExtreme = row.bestSimulationIds.includes(simulation.id);
                    const best = assessment.status === "matched" && reportedExtreme;
                    const delta =
                      index === 0
                        ? null
                        : formatCompareSignalDelta(signal, baselineSignal, row.definition);
                    return (
                      <div
                        className={[
                          "compare-score-cell",
                          signal?.reported ? "" : "is-missing",
                          best ? "is-best" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        key={`${row.id}:${simulation.id}`}
                      >
                        <small title={simulation.name}>
                          {index === 0 ? "Baseline" : simulation.name}
                        </small>
                        <strong>{signal ? formatKpiScorecardValue(signal) : "Not reported"}</strong>
                        {row.mixedMeasures && <small>{signal?.title}</small>}
                        <span className="compare-score-cell-meta">
                          {best && (
                            <em>
                              {signal?.kind === "ev-service" ? "Highest reported rate" : "Best"}
                            </em>
                          )}
                          {assessment.status === "unknown" && reportedExtreme && (
                            <em data-reported-extreme="true">
                              {signal?.kind === "ev-service"
                                ? "Highest reported rate"
                                : signal?.comparisonDirection === "lower-is-better"
                                  ? "Lowest reported value"
                                  : signal?.comparisonDirection === "closer-to-zero"
                                    ? "Reported value closest to zero"
                                    : "Highest reported value"}
                            </em>
                          )}
                          {delta && (
                            <em
                              className={
                                assessment.status === "matched"
                                  ? delta.tone === "better"
                                    ? "kpi-delta-better"
                                    : delta.tone === "worse"
                                      ? "kpi-delta-worse"
                                      : ""
                                  : ""
                              }
                            >
                              {delta.label}
                            </em>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={`panel kpi-drilldown-panel${kpiDrilldownOpen ? " is-open" : ""}`}>
          <button
            type="button"
            className="kpi-drilldown-summary"
            aria-expanded={kpiDrilldownOpen}
            onClick={() => setKpiDrilldownOpen((open) => !open)}
          >
            <span>
              <strong>All reported KPIs</strong>
              <small>Complete KPI matrix for the selected scope.</small>
            </span>
            <span className="kpi-family-pill">
              {visibleMatrixRows.length}/{matrixRows.length} KPIs
            </span>
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

              {visibleMatrixRows.length === 0 ? (
                <section className="empty-panel compact">
                  <Table2 size={24} aria-hidden="true" />
                  <h3>No KPIs in selected scope</h3>
                </section>
              ) : (
                <CompareKpiMatrixTable
                  rows={visibleMatrixRows}
                  simulations={selectedKpiSimulations}
                />
              )}
            </div>
          )}
        </section>
      </section>
    </section>
  );
}

function CompareKpiMatrixTable({ rows, simulations }) {
  return (
    <div className="job-kpi-table-wrap compare-kpi-table-wrap">
      <div className="table-scroll">
        <table className="kpi-reference-table compare-kpi-table">
          <thead>
            <tr>
              <th>KPI</th>
              {simulations.map((simulation, index) => (
                <th key={simulation.id}>
                  <span className="compare-column-heading">
                    <strong>{simulation.name}</strong>
                    <small>{index === 0 ? "Baseline" : `Simulation ${index + 1}`}</small>
                  </span>
                </th>
              ))}
              <th>Reported</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>
                  <span className="kpi-row-label">
                    <span>
                      {row.label}
                      <small className="kpi-row-meta">{row.subfamily.label}</small>
                      <small className="job-compare-secondary">{row.sourceLabels.join(", ")}</small>
                    </span>
                  </span>
                </td>
                {simulations.map((simulation) => {
                  const entry = row.valuesBySimulationId[simulation.id] || null;
                  return (
                    <td
                      className={!entry?.reported ? "kpi-row-na" : ""}
                      key={`${row.key}:${simulation.id}`}
                    >
                      <strong>{formatCompareMatrixValue(entry, row)}</strong>
                      {entry?.reported &&
                      (isFiniteNumber(entry.reference) || isFiniteNumber(entry.delta)) ? (
                        <small className="job-compare-secondary">
                          {isFiniteNumber(entry.reference)
                            ? `${entry.referenceLabel}: ${formatCompareMatrixValue({ ...entry, primary: entry.reference }, row)}`
                            : "Reference: N/A"}
                          {isFiniteNumber(entry.delta)
                            ? ` · Delta: ${formatCompareMatrixValue({ ...entry, primary: entry.delta }, row)}`
                            : ""}
                        </small>
                      ) : null}
                    </td>
                  );
                })}
                <td>
                  {row.reportedCount}/{simulations.length}
                </td>
                <td>{row.unit || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { CompareView };
