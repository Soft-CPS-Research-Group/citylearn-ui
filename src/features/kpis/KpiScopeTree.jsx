import { Table2, Building2, Search } from "lucide-react";
import { useState } from "react";

function KpiScopeTree({ scopes, selectedScopeId, onSelectScope }) {
  const [query, setQuery] = useState("");
  const community = scopes.find((scope) => scope.id === "community");
  const buildings = scopes.filter(
    (scope) =>
      scope.id !== "community" &&
      `${scope.column} ${scope.label}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <aside className="result-tree-panel sim-tree-panel kpi-tree-panel">
      <header className="sim-tree-head">
        <div className="sim-tree-headline">
          <small>KPI scope</small>
        </div>
        {community && (
          <button
            type="button"
            className={
              selectedScopeId === community.id
                ? "sim-tree-context-btn is-active"
                : "sim-tree-context-btn"
            }
            onClick={() => onSelectScope(community.id)}
          >
            <Table2 size={14} aria-hidden="true" />
            <span className="sim-tree-context-label">{community.label}</span>
          </button>
        )}
        <label className="tree-search search-box">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            aria-label="Find KPI scope"
            placeholder="Find scope…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </header>
      <ul className="sim-tree-list">
        {buildings.map((scope) => (
          <li key={scope.id}>
            <div
              className={
                selectedScopeId === scope.id
                  ? "sim-tree-row is-selected is-root-level"
                  : "sim-tree-row is-root-level"
              }
            >
              <span className="sim-tree-toggle is-spacer" />
              <button
                className="sim-tree-label"
                type="button"
                title={scope.qualified ? scope.label : scope.column}
                onClick={() => onSelectScope(scope.id)}
              >
                <span className="sim-tree-icon">
                  <Building2 size={14} />
                </span>
                <span>{scope.label}</span>
              </button>
            </div>
          </li>
        ))}
        {query.trim() && !buildings.length && (
          <li className="tree-empty">No scopes match this search.</li>
        )}
      </ul>
    </aside>
  );
}

export { KpiScopeTree };
