import { FolderOpen, Upload, Database, Search, X, GitCompareArrows } from "lucide-react";
import { useMemo } from "react";

function EmptyState({ onImport, isParsing, error }) {
  return (
    <main className="empty-state">
      <div className="empty-visual" aria-hidden="true">
        <FolderOpen size={58} />
      </div>
      <div className="empty-copy">
        <span className="eyebrow">No simulations loaded</span>
        <h2>Import CityLearn simulation folders</h2>
        <p>For a quick test, choose the repo folder sample-results.</p>
      </div>
      <button
        className="button button-primary button-large"
        type="button"
        onClick={onImport}
        disabled={isParsing}
      >
        <Upload size={18} aria-hidden="true" />
        {isParsing ? "Importing" : "Choose folders"}
      </button>
      {error && <p className="inline-error">{error}</p>}
    </main>
  );
}

function Sidebar({
  simulations,
  activeId,
  setActiveId,
  query,
  setQuery,
  onImport,
  onRemove,
  isParsing,
  importError,
  view,
  onEnterCompare,
  onExitCompare,
  compareReturnLabel,
  compareIds,
  setCompareIds,
}) {
  const filteredSimulations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return simulations;

    return simulations.filter((simulation) => {
      return (
        simulation.name.toLowerCase().includes(normalizedQuery) ||
        simulation.path.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [simulations, query]);

  const totals = useMemo(() => {
    return simulations.reduce(
      (current, simulation) => ({
        series: current.series + simulation.series.length,
        kpis: current.kpis + (simulation.kpis?.rows.length || 0),
        files: current.files + simulation.fileCount,
      }),
      { series: 0, kpis: 0, files: 0 },
    );
  }, [simulations]);

  const toggleCompareId = (id) => {
    setCompareIds((current) => {
      if (current.includes(id)) return current.filter((currentId) => currentId !== id);
      return [...current, id];
    });
  };

  return (
    <aside className="sidebar">
      <section className="import-panel">
        <div className="panel-title-row">
          <div>
            <span className="eyebrow">Imported</span>
            <h2>{simulations.length} simulations</h2>
          </div>
          <Database size={22} aria-hidden="true" />
        </div>
        <div className="mini-stats">
          <Metric label="Data files" value={totals.files} />
          <Metric label="Series" value={totals.series} />
          <Metric label="KPI rows" value={totals.kpis} />
        </div>
        <button
          className="button button-secondary full-width"
          type="button"
          onClick={onImport}
          disabled={isParsing}
        >
          <Upload size={16} aria-hidden="true" />
          {isParsing ? "Importing" : "Add folders"}
        </button>
        {importError && <p className="inline-error">{importError}</p>}
      </section>

      <section className="sidebar-section">
        <label className="search-box">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search simulations"
          />
        </label>

        <div className="simulation-list" role="list">
          {filteredSimulations.map((simulation) => (
            <div
              key={simulation.id}
              className={[
                "simulation-row",
                view === "compare" ? "is-compare-mode" : "",
                view !== "compare" && simulation.id === activeId ? "is-active" : "",
                view === "compare" && compareIds.includes(simulation.id)
                  ? "is-compare-selected"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              role="listitem"
            >
              <button
                className="simulation-select"
                type="button"
                aria-pressed={view === "compare" ? compareIds.includes(simulation.id) : undefined}
                onClick={() => {
                  if (view === "compare") {
                    toggleCompareId(simulation.id);
                    return;
                  }
                  setActiveId(simulation.id);
                }}
              >
                {view === "compare" && <span className="compare-check-dot" aria-hidden="true" />}
                <span className="simulation-row-main">
                  <span className="simulation-name">{simulation.name}</span>
                  <span className="simulation-meta">
                    {simulation.series.length} series / {simulation.kpis?.rows.length || 0} KPIs
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="icon-hit"
                title={`Remove ${simulation.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(simulation.id);
                }}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="sidebar-section compare-sidebar">
        <div className="panel-title-row">
          <div>
            <span className="eyebrow">Compare</span>
            <h2>{compareIds.length} selected</h2>
          </div>
          <GitCompareArrows size={20} aria-hidden="true" />
        </div>
        <button
          className={
            view === "compare"
              ? "button button-primary full-width"
              : "button button-secondary full-width"
          }
          type="button"
          onClick={view === "compare" ? onExitCompare : onEnterCompare}
          disabled={view !== "compare" && simulations.length < 2}
        >
          {view === "compare" ? (
            <X size={16} aria-hidden="true" />
          ) : (
            <GitCompareArrows size={16} aria-hidden="true" />
          )}
          {view === "compare" ? `Back to ${compareReturnLabel}` : "Compare simulations"}
        </button>
      </section>
    </aside>
  );
}

function Metric({ label, value }) {
  return (
    <span>
      <strong>{value}</strong>
      <small>{label}</small>
    </span>
  );
}

export { EmptyState, Sidebar };
