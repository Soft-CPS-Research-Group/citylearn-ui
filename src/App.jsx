import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  BarChart3,
  BatteryCharging,
  Building2,
  Car,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Database,
  Factory,
  FileSpreadsheet,
  FolderOpen,
  GitCompareArrows,
  PlugZap,
  Search,
  Sun,
  Table2,
  Upload,
  X
} from "lucide-react";

const CHART_COLORS = [
  "#0f766e",
  "#2563eb",
  "#d97706",
  "#be123c",
  "#6d28d9",
  "#4d7c0f",
  "#b45309",
  "#0e7490"
];

const VIEW_TABS = [
  { id: "timeseries", label: "Timeseries", icon: BarChart3 },
  { id: "kpis", label: "KPIs", icon: Table2 }
];

const EMPTY_CHARGER_OVERLAY = {
  events: [],
  intervals: []
};

function App() {
  const fileInputRef = useRef(null);
  const [simulations, setSimulations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [view, setView] = useState("timeseries");
  const [lastResultView, setLastResultView] = useState("timeseries");
  const [isParsing, setIsParsing] = useState(false);
  const [importError, setImportError] = useState("");
  const [simulationQuery, setSimulationQuery] = useState("");
  const [selectedSeriesId, setSelectedSeriesId] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [compareIds, setCompareIds] = useState([]);
  const [selectedEpisodeBySimulation, setSelectedEpisodeBySimulation] = useState({});
  const [selectedResultItem, setSelectedResultItem] = useState(null);

  const activeSimulation = useMemo(
    () => simulations.find((simulation) => simulation.id === activeId) || null,
    [simulations, activeId]
  );

  const selectedSeries = useMemo(() => {
    if (!activeSimulation) return null;
    return (
      activeSimulation.series.find((series) => series.id === selectedSeriesId) ||
      activeSimulation.series[0] ||
      null
    );
  }, [activeSimulation, selectedSeriesId]);

  useEffect(() => {
    if (simulations.length === 0) {
      setActiveId(null);
      return;
    }

    if (!simulations.some((simulation) => simulation.id === activeId)) {
      setActiveId(simulations[0].id);
    }
  }, [simulations, activeId]);

  useEffect(() => {
    setCompareIds((current) => {
      const validIds = new Set(simulations.map((simulation) => simulation.id));
      const next = current.filter((id) => validIds.has(id));
      return sameArray(current, next) ? current : next;
    });
  }, [simulations]);

  useEffect(() => {
    if (!activeSimulation) {
      setSelectedSeriesId(null);
      return;
    }

    if (activeSimulation.series.length === 0) {
      setSelectedSeriesId(null);
      return;
    }

    if (!activeSimulation.series.some((series) => series.id === selectedSeriesId)) {
      setSelectedSeriesId(activeSimulation.series[0].id);
    }
  }, [activeSimulation, selectedSeriesId]);

  useEffect(() => {
    if (!selectedSeries) {
      setSelectedMetric(null);
      return;
    }

    if (!selectedSeries.numericColumns.includes(selectedMetric)) {
      setSelectedMetric(selectedSeries.numericColumns[0] || null);
    }
  }, [selectedSeries, selectedMetric]);

  const setFolderInputRef = (node) => {
    fileInputRef.current = node;
    if (node) {
      node.setAttribute("webkitdirectory", "");
      node.setAttribute("directory", "");
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFolderUpload = async (event) => {
    const { files } = event.target;
    await importFiles(files);
    event.target.value = "";
  };

  const importFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    setIsParsing(true);
    setImportError("");

    try {
      const folders = groupFilesBySimulation(files);

      if (folders.length === 0) {
        throw new Error("No CSV files were found in the selected folder.");
      }

      const parsedSimulations = await Promise.all(folders.map(parseSimulationFolder));
      const validSimulations = parsedSimulations.filter(Boolean);

      if (validSimulations.length === 0) {
        throw new Error("No simulations could be parsed from the selected files.");
      }

      setSimulations((current) => mergeSimulations(current, validSimulations));
      setActiveId(validSimulations[0].id);
      setCompareIds((current) => {
        const merged = unique([...current, ...validSimulations.map((simulation) => simulation.id)]);
        return merged.slice(0, 4);
      });
    } catch (error) {
      setImportError(error.message || "The selected folder could not be imported.");
    } finally {
      setIsParsing(false);
    }
  };

  const removeSimulation = (id) => {
    setSimulations((current) => current.filter((simulation) => simulation.id !== id));
    setCompareIds((current) => current.filter((compareId) => compareId !== id));
  };

  const switchResultView = (nextView) => {
    setLastResultView(nextView);
    setView(nextView);
  };

  const enterCompareMode = () => {
    if (view !== "compare") {
      setLastResultView(view);
    }
    setView("compare");
  };

  const exitCompareMode = () => {
    setView(lastResultView || "timeseries");
  };

  return (
    <div className="app-shell">
      <input
        ref={setFolderInputRef}
        className="hidden-input"
        type="file"
        multiple
        onChange={handleFolderUpload}
        aria-label="Upload simulation folders"
      />

      <header className="app-header">
        <div className="brand-lockup">
          <a
            className="brand-link"
            href="https://github.com/citylearn-project/CityLearn"
            target="_blank"
            rel="noreferrer"
            aria-label="Open CityLearn on GitHub"
          >
            <img className="brand-mark" src="/citylearn-logo.svg" alt="CityLearn" />
          </a>
        </div>
        <div className="header-actions">
          <a
            className="github-link"
            href="https://github.com/Soft-CPS-Research-Group/citylearn-ui"
            target="_blank"
            rel="noreferrer"
            aria-label="Open CityLearn UI on GitHub"
          >
            <GitHubMark size={20} aria-hidden="true" />
            <span>CityLearn UI</span>
          </a>
        </div>
      </header>

      {simulations.length === 0 ? (
        <EmptyState onImport={openFilePicker} isParsing={isParsing} error={importError} />
      ) : (
        <div className="app-body">
          <Sidebar
            simulations={simulations}
            activeId={activeId}
            setActiveId={setActiveId}
            query={simulationQuery}
            setQuery={setSimulationQuery}
            onImport={openFilePicker}
            onRemove={removeSimulation}
            isParsing={isParsing}
            importError={importError}
            view={view}
            onEnterCompare={enterCompareMode}
            onExitCompare={exitCompareMode}
            compareReturnLabel={lastResultView === "kpis" ? "KPIs" : "Timeseries"}
            compareIds={compareIds}
            setCompareIds={setCompareIds}
          />

          <main className="workspace">
            <section className="workspace-toolbar" aria-label="Current simulation">
              <div className="simulation-heading">
                <span className="eyebrow">{view === "compare" ? "KPI comparison" : "Selected simulation"}</span>
                <h2>
                  {view === "compare"
                    ? `${compareIds.length} simulations selected`
                    : activeSimulation?.name || "No simulation selected"}
                </h2>
              </div>

              <div className="segmented-control" role="tablist" aria-label="Result views">
                {VIEW_TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      className={view === tab.id ? "segment is-active" : "segment"}
                      type="button"
                      onClick={() => switchResultView(tab.id)}
                      role="tab"
                      aria-selected={view === tab.id}
                    >
                      <Icon size={16} aria-hidden="true" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {view === "timeseries" && activeSimulation && (
              <TimeseriesView
                simulation={activeSimulation}
                selectedEpisodeBySimulation={selectedEpisodeBySimulation}
                setSelectedEpisodeBySimulation={setSelectedEpisodeBySimulation}
                selectedResultItem={selectedResultItem}
                setSelectedResultItem={setSelectedResultItem}
              />
            )}

            {view === "kpis" && activeSimulation && <KpiView simulation={activeSimulation} />}

            {view === "compare" && (
              <CompareView
                simulations={simulations}
                compareIds={compareIds}
              />
            )}
          </main>
        </div>
      )}

      <Footer />
    </div>
  );
}

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
      <button className="button button-primary button-large" type="button" onClick={onImport} disabled={isParsing}>
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
  setCompareIds
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
        files: current.files + simulation.fileCount
      }),
      { series: 0, kpis: 0, files: 0 }
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
          <Metric label="CSV" value={totals.files} />
          <Metric label="Series" value={totals.series} />
          <Metric label="KPI rows" value={totals.kpis} />
        </div>
        <button className="button button-secondary full-width" type="button" onClick={onImport} disabled={isParsing}>
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
                view === "compare" && compareIds.includes(simulation.id) ? "is-compare-selected" : ""
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
          className={view === "compare" ? "button button-primary full-width" : "button button-secondary full-width"}
          type="button"
          onClick={view === "compare" ? onExitCompare : onEnterCompare}
          disabled={view !== "compare" && simulations.length < 2}
        >
          {view === "compare" ? <X size={16} aria-hidden="true" /> : <GitCompareArrows size={16} aria-hidden="true" />}
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

function TimeseriesView({
  simulation,
  selectedEpisodeBySimulation,
  setSelectedEpisodeBySimulation,
  selectedResultItem,
  setSelectedResultItem
}) {
  const episodes = useMemo(() => getSimulationEpisodes(simulation), [simulation]);
  const selectedEpisode = selectedEpisodeBySimulation[simulation.id] || episodes[0] || "";
  const tree = useMemo(() => buildTimeseriesTree(simulation, selectedEpisode), [simulation, selectedEpisode]);
  const communityItem = useMemo(() => createCommunityResultItem(tree, simulation, selectedEpisode), [tree, simulation, selectedEpisode]);
  const flatItems = useMemo(() => flattenTreeItems(tree), [tree]);
  const selectedItem = useMemo(() => {
    if (selectedResultItem?.simulationId !== simulation.id) return communityItem;
    if (selectedResultItem.id === communityItem?.id) return communityItem;
    return flatItems.find((item) => item.id === selectedResultItem.id) || communityItem || flatItems[0] || null;
  }, [communityItem, flatItems, selectedResultItem, simulation.id]);
  const [expandedNodes, setExpandedNodes] = useState(() => new Set());
  const [selectedBuildingIds, setSelectedBuildingIds] = useState([]);
  const [timeInterval, setTimeInterval] = useState(60);
  const [range, setRange] = useState([0, 0]);
  const isCommunityActive = selectedItem?.id === communityItem?.id;

  useEffect(() => {
    if (episodes.length > 0 && !selectedEpisodeBySimulation[simulation.id]) {
      setSelectedEpisodeBySimulation((current) => ({
        ...current,
        [simulation.id]: episodes[0]
      }));
    }
  }, [episodes, selectedEpisodeBySimulation, setSelectedEpisodeBySimulation, simulation.id]);

  useEffect(() => {
    if (communityItem && (!selectedResultItem || selectedResultItem.simulationId !== simulation.id)) {
      setSelectedResultItem({ ...communityItem, simulationId: simulation.id });
    }
  }, [communityItem, selectedResultItem, setSelectedResultItem, simulation.id]);

  const displayItems = useMemo(() => {
    if (!selectedItem) return [];
    if (isCommunityActive) return selectedItem ? [selectedItem] : [];
    if (selectedBuildingIds.length > 1) {
      const targetType = selectedItem.type === "production" ? "production" : "consumption";
      const compareItems = selectedBuildingIds
        .map((buildingId) => {
          const building = tree.buildings.find((entry) => entry.id === buildingId);
          return (
            building?.items.find((item) => item.type === targetType) ||
            building?.items.find((item) => item.type === "consumption") ||
            building?.items[0] ||
            null
          );
        })
        .filter(Boolean);
      return compareItems.length > 0 ? compareItems : [selectedItem];
    }
    return [selectedItem];
  }, [isCommunityActive, selectedBuildingIds, selectedItem, tree.buildings]);

  const displayBounds = useMemo(() => getItemsTimeBounds(displayItems), [displayItems]);
  const displayKey = displayItems.map((item) => item.id).join("|");

  useEffect(() => {
    if (!isFiniteNumber(displayBounds.min) || !isFiniteNumber(displayBounds.max)) return;
    const baseInterval = displayBounds.baseInterval || 60;
    const end = Math.min(displayBounds.max, displayBounds.min + 7 * 24 * 60 * 60 * 1000);
    setRange([displayBounds.min, end]);
    setTimeInterval(baseInterval);
  }, [displayKey, displayBounds.min, displayBounds.max, displayBounds.baseInterval]);

  const selectCommunity = () => {
    if (!communityItem) return;
    setSelectedBuildingIds([]);
    setSelectedResultItem({ ...communityItem, simulationId: simulation.id });
  };

  const toggleNode = (id) => {
    setExpandedNodes((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectBuilding = (buildingId, additive) => {
    const building = tree.buildings.find((entry) => entry.id === buildingId);
    const defaultItem = building?.items.find((item) => item.type === "consumption") || building?.items[0];
    if (!defaultItem) return;

    setSelectedResultItem({ ...defaultItem, simulationId: simulation.id });
    setSelectedBuildingIds((current) => {
      if (!additive) return [buildingId];
      if (current.includes(buildingId)) {
        const next = current.filter((id) => id !== buildingId);
        return next.length > 0 ? next : [buildingId];
      }
      if (current.length === 0) return [buildingId];
      if (current.length === 1) return sortBuildingIds([...current, buildingId], tree.buildings);
      return sortBuildingIds([current[1], buildingId], tree.buildings);
    });
  };

  const selectItem = (item) => {
    setSelectedBuildingIds(item.buildingId ? [item.buildingId] : []);
    setSelectedResultItem({ ...item, simulationId: simulation.id });
  };

  if (simulation.series.length === 0) {
    return (
      <section className="empty-panel">
        <FolderOpen size={28} aria-hidden="true" />
        <h3>No result CSV files found</h3>
      </section>
    );
  }

  return (
    <section className="timeseries-workspace">
      <TimeseriesToolbar
        range={range}
        setRange={setRange}
        minTimestamp={displayBounds.min}
        maxTimestamp={displayBounds.max}
        timeInterval={timeInterval}
        setTimeInterval={setTimeInterval}
        baseIntervalMinutes={displayBounds.baseInterval || 60}
      />

      <div className="results-layout">
        <SimulationTree
          tree={tree}
          communityItem={communityItem}
          communityLabel="Community"
          isCommunityActive={isCommunityActive}
          selectedItem={selectedItem}
          selectedBuildingIds={new Set(selectedBuildingIds)}
          expanded={expandedNodes}
          onSelectCommunity={selectCommunity}
          onSelectBuilding={selectBuilding}
          onSelectItem={selectItem}
          onToggle={toggleNode}
          episodes={episodes}
          selectedEpisode={selectedEpisode}
          onEpisodeChange={(episode) => {
            setSelectedEpisodeBySimulation((current) => ({
              ...current,
              [simulation.id]: episode
            }));
            setSelectedBuildingIds([]);
            setSelectedResultItem(null);
          }}
        />

        <section className="result-detail-panel">
        {displayItems.length > 0 ? (
          <div className={displayItems.length > 1 ? "sim-chart-grid is-compare" : "sim-chart-grid"}>
            {displayItems.map((item) => (
              <EquipmentChart
                key={item.id}
                item={item}
                controls={{
                  range,
                  setRange,
                  timeInterval,
                  setTimeInterval
                }}
              />
            ))}
          </div>
        ) : (
          <section className="empty-panel compact">
            <BarChart3 size={26} aria-hidden="true" />
            <h3>Select a result from the tree</h3>
          </section>
        )}
      </section>
      </div>
    </section>
  );
}

function TimeseriesToolbar({
  range,
  setRange,
  minTimestamp,
  maxTimestamp,
  timeInterval,
  setTimeInterval,
  baseIntervalMinutes
}) {
  const setWindowDays = (days) => {
    if (!isFiniteNumber(minTimestamp) || !isFiniteNumber(maxTimestamp)) return;
    const nextEnd = Math.min(maxTimestamp, minTimestamp + days * 24 * 60 * 60 * 1000);
    setRange([minTimestamp, nextEnd]);
  };
  const intervalOptions = unique([baseIntervalMinutes, 60, 180, 360, 1440])
    .filter((value) => value >= baseIntervalMinutes)
    .sort((a, b) => a - b);
  const activeQuickRange = getActiveQuickRange(range, minTimestamp, maxTimestamp);
  const quickRangeOptions = [
    { id: "1", label: "1 day", days: 1 },
    { id: "7", label: "7 days", days: 7 },
    { id: "10", label: "10 days", days: 10 },
    { id: "all", label: "All", days: null }
  ];

  return (
    <section className="timeseries-toolbar">
      <div className="timeseries-toolbar-left">
        <div className="segmented-row">
          <span className="timeseries-granularity-label">Granularity</span>
          {intervalOptions.map((minutes) => (
            <button
              key={minutes}
              type="button"
              className={timeInterval === minutes ? "segment-btn is-active" : "segment-btn"}
              onClick={() => setTimeInterval(minutes)}
            >
              {formatIntervalLabel(minutes)}
            </button>
          ))}
        </div>
      </div>

      <div className="timeseries-toolbar-right">
        <div className="timeseries-date-row">
          <label className="timeseries-date-field">
            <span>From</span>
            <input
              type="date"
              value={formatDateInput(range[0])}
              min={formatDateInput(minTimestamp)}
              max={formatDateInput(maxTimestamp)}
              onChange={(event) => {
                const next = parseDateInput(event.target.value, range[0]);
                setRange([Math.min(next, range[1]), range[1]]);
              }}
            />
          </label>
          <label className="timeseries-date-field">
            <span>To</span>
            <input
              type="date"
              value={formatDateInput(range[1])}
              min={formatDateInput(minTimestamp)}
              max={formatDateInput(maxTimestamp)}
              onChange={(event) => {
                const next = endOfDay(parseDateInput(event.target.value, range[1]));
                setRange([range[0], Math.max(next, range[0])]);
              }}
            />
          </label>
        </div>
        <div className="quick-range top">
          {quickRangeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={activeQuickRange === option.id ? "is-active" : ""}
              onClick={() => {
                if (option.days === null) setRange([minTimestamp, maxTimestamp]);
                else setWindowDays(option.days);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function SimulationTree({
  tree,
  communityItem,
  communityLabel,
  isCommunityActive,
  selectedItem,
  selectedBuildingIds,
  expanded,
  onSelectCommunity,
  onSelectBuilding,
  onSelectItem,
  onToggle,
  episodes,
  selectedEpisode,
  onEpisodeChange
}) {
  return (
    <aside className="result-tree-panel sim-tree-panel">
      <header className="sim-tree-head">
        <label className="select-field compact tree-episode-select">
          <span>Episode</span>
          <select value={selectedEpisode} onChange={(event) => onEpisodeChange(event.target.value)}>
            {episodes.map((episode) => (
              <option key={episode} value={episode}>
                {episode ? `Episode ${episode.replace(/ep/i, "")}` : "All data"}
              </option>
            ))}
          </select>
        </label>
        <div className="sim-tree-headline">
          <small>Community</small>
          <span className="sim-tree-help" title="Ctrl/Cmd or Shift + click buildings to compare side by side.">?</span>
        </div>
        <button
          type="button"
          className={isCommunityActive ? "sim-tree-context-btn is-active" : "sim-tree-context-btn"}
          onClick={onSelectCommunity}
          title="Show community charts"
        >
          <Building2 size={14} aria-hidden="true" />
          <span className="sim-tree-context-label">{communityItem?.label || communityLabel}</span>
        </button>
      </header>
      <ul className="sim-tree-list">
      {tree.buildings.map((building) => (
        <TreeBuildingNode
          key={building.id}
          building={building}
          selectedItem={selectedItem}
          selectedBuildingIds={selectedBuildingIds}
          expanded={expanded}
          onSelectBuilding={onSelectBuilding}
          onSelectItem={onSelectItem}
          onToggle={onToggle}
        />
      ))}
      {tree.vehicles.length > 0 && (
        <TreeGroupNode
          id="vehicles"
          label="Electric vehicles"
          icon={Car}
          items={tree.vehicles}
          selectedItem={selectedItem}
          expanded={expanded}
          onSelectItem={onSelectItem}
          onToggle={onToggle}
        />
      )}
      {tree.pricing.length > 0 && (
        <TreeGroupNode
          id="pricing"
          label="Pricing"
          icon={CircleDollarSign}
          items={tree.pricing}
          selectedItem={selectedItem}
          expanded={expanded}
          onSelectItem={onSelectItem}
          onToggle={onToggle}
        />
      )}
      {tree.other.length > 0 && (
        <TreeGroupNode
          id="other"
          label="Other"
          icon={FileSpreadsheet}
          items={tree.other}
          selectedItem={selectedItem}
          expanded={expanded}
          onSelectItem={onSelectItem}
          onToggle={onToggle}
        />
      )}
      </ul>
    </aside>
  );
}

function TreeBuildingNode({
  building,
  selectedItem,
  selectedBuildingIds,
  expanded,
  onSelectBuilding,
  onSelectItem,
  onToggle
}) {
  const isExpanded = expanded.has(building.id);
  const isCompared = selectedBuildingIds.has(building.id);
  const isSelected = selectedItem?.buildingId === building.id || isCompared;

  return (
    <li>
      <div className={`sim-tree-row is-root-level ${isSelected ? "is-selected" : ""} ${isCompared ? "is-compared" : ""}`}>
        <button
          type="button"
          className="sim-tree-toggle"
          onClick={() => onToggle(building.id)}
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <button
          type="button"
          className="sim-tree-label"
          onClick={(event) => onSelectBuilding(building.id, event.ctrlKey || event.metaKey || event.shiftKey)}
          title={building.label}
        >
          <span className="sim-tree-icon"><Building2 size={14} /></span>
          <span>{building.label}</span>
        </button>
      </div>

      {isExpanded ? (
        <ul className="sim-tree-list">
          {building.items.map((item) => (
            <TreeLeaf key={item.id} item={item} selectedItem={selectedItem} onSelect={onSelectItem} />
          ))}
          {building.chargers.map((item) => (
            <TreeLeaf key={item.id} item={item} selectedItem={selectedItem} onSelect={onSelectItem} />
          ))}
          {building.batteries.map((item) => (
            <TreeLeaf key={item.id} item={item} selectedItem={selectedItem} onSelect={onSelectItem} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function TreeGroupNode({
  id,
  label,
  icon: Icon,
  items,
  selectedItem,
  expanded,
  onSelectItem,
  onToggle
}) {
  const isOpen = expanded.has(id);

  return (
    <li>
      <div className="sim-tree-row is-group">
        <button className="sim-tree-toggle" type="button" onClick={() => onToggle(id)}>
          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <button className="sim-tree-label" type="button" onClick={() => onToggle(id)}>
          <span className="sim-tree-icon"><Icon size={14} /></span>
          <span>{label}</span>
        </button>
      </div>
      {isOpen && (
        <ul className="sim-tree-list">
          {items.map((item) => (
            <TreeLeaf key={item.id} item={item} selectedItem={selectedItem} onSelect={onSelectItem} />
          ))}
        </ul>
      )}
    </li>
  );
}

function TreeLeaf({ item, selectedItem, onSelect }) {
  const Icon = item.icon;
  return (
    <li>
      <div className={selectedItem?.id === item.id ? "sim-tree-row is-selected" : "sim-tree-row"}>
        <span className="sim-tree-toggle is-spacer" />
        <button
          className="sim-tree-label"
          type="button"
          onClick={() => onSelect(item)}
          title={item.series.relativePath}
        >
          <span className="sim-tree-icon"><Icon size={14} /></span>
          <span>{item.label}</span>
        </button>
      </div>
    </li>
  );
}

function EquipmentChart({ item, controls = null }) {
  const chartFrameRef = useRef(null);
  const [chartFrameWidth, setChartFrameWidth] = useState(0);
  const chartConfig = useMemo(() => getEquipmentChartConfig(item), [item]);
  const {
    rows,
    preparedRows,
    range,
    timeInterval,
    fallbackMetric
  } = useEquipmentChartData(item.series, chartConfig, controls);
  const chargerOverlay = useMemo(() => (
    item.type === "charger"
      ? deriveChargerActivityOverlay(preparedRows, chartConfig, range, timeInterval)
      : EMPTY_CHARGER_OVERLAY
  ), [chartConfig, item.type, preparedRows, range, timeInterval]);
  const visibleDefaults = useMemo(
    () => Object.fromEntries(chartConfig.series.map((series) => [series.key, true])),
    [chartConfig]
  );
  const [visibleSeries, setVisibleSeries] = useState(visibleDefaults);

  useEffect(() => {
    setVisibleSeries(visibleDefaults);
  }, [visibleDefaults]);

  const activeSeries = chartConfig.series.filter((series) => visibleSeries[series.key] && series.field);
  const activeBarCount = activeSeries.filter((series) => series.chart !== "line").length;
  const barSize = getEquipmentBarSize(rows.length, activeBarCount, chartFrameWidth);
  const xDomain = useMemo(() => getEquipmentXDomain(rows, timeInterval), [rows, timeInterval]);

  useEffect(() => {
    const node = chartFrameRef.current;
    if (!node) return undefined;

    const updateWidth = () => setChartFrameWidth(node.getBoundingClientRect().width || 0);
    updateWidth();

    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <article className={item.type === "community" ? "equipment-card sim-chart is-primary" : "equipment-card sim-chart"}>
      <header className="equipment-header">
        <div>
          <span className="eyebrow">{chartConfig.kind}</span>
          <h3>{item.title}</h3>
          <p>{item.series.fileName}</p>
        </div>
      </header>

      <div className="sim-chart-legend">
        {chartConfig.series.map((series, index) => {
          const active = Boolean(visibleSeries[series.key]);
          return (
            <button
              className={active ? "sim-legend-item is-active" : "sim-legend-item"}
              key={series.key}
              type="button"
              disabled={!series.field}
              onClick={() =>
                setVisibleSeries((current) => ({
                  ...current,
                  [series.key]: !current[series.key]
                }))
              }
            >
              <span
                className="metric-color"
                style={{ background: series.color || CHART_COLORS[index % CHART_COLORS.length] }}
              />
              <span>{series.label}</span>
            </button>
          );
        })}
      </div>

      {activeSeries.length > 0 && rows.length > 0 ? (
        <div className="equipment-chart-frame sim-chart-canvas" ref={chartFrameRef}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={rows}
              stackOffset="sign"
              margin={{ top: 12, right: 24, left: 6, bottom: 10 }}
              barCategoryGap="24%"
              barGap={2}
            >
              <CartesianGrid stroke="#e4e8ec" strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="timestamp"
                scale="time"
                domain={xDomain}
                allowDataOverflow={false}
                tick={{ fontSize: 12 }}
                tickFormatter={formatTimestampLabel}
                minTickGap={42}
              />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} width={68} tickFormatter={compactNumber} />
              {chartConfig.hasRightAxis && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={chartConfig.rightDomain}
                  tick={{ fontSize: 12 }}
                  width={56}
                  tickFormatter={chartConfig.rightFormatter || compactNumber}
                />
              )}
              {chartConfig.showZeroLine && (
                <ReferenceLine yAxisId="left" y={0} stroke="#9aa5b1" strokeDasharray="4 4" strokeWidth={1} />
              )}
              {chargerOverlay.intervals.map((interval, index) => (
                <ReferenceArea
                  key={`charger-interval-${index}-${interval.start}-${interval.end}`}
                  xAxisId={0}
                  yAxisId="left"
                  x1={interval.start}
                  x2={interval.end}
                  fill="#0f766e"
                  fillOpacity={0.1}
                  strokeOpacity={0}
                  ifOverflow="extendDomain"
                />
              ))}
              <Tooltip
                labelFormatter={(label) => formatTimestampLabel(Number(label))}
                formatter={(value, name) => [formatNumber(value), name]}
              />
              <Legend />
              {activeSeries.map((series, index) =>
                series.chart === "line" ? (
                  <Line
                    key={series.key}
                    yAxisId={series.axis || "left"}
                    type={series.curve || "monotone"}
                    dataKey={series.field}
                    name={series.label}
                    stroke={series.color || CHART_COLORS[index % CHART_COLORS.length]}
                    strokeWidth={2}
                    strokeDasharray={series.dashArray}
                    dot={false}
                    connectNulls={Boolean(series.connectNulls)}
                  />
                ) : (
                  <Bar
                    key={series.key}
                    yAxisId={series.axis || "left"}
                    dataKey={series.field}
                    name={series.label}
                    stackId={series.stackId}
                    barSize={barSize}
                    stroke={series.color || CHART_COLORS[index % CHART_COLORS.length]}
                    strokeWidth={0.35}
                    fill={series.color || CHART_COLORS[index % CHART_COLORS.length]}
                    fillOpacity={0.82}
                    radius={[3, 3, 0, 0]}
                    shape={(props) => <EquipmentBarShape {...props} minWidth={barSize} />}
                    isAnimationActive={false}
                  />
                )
              )}
              {chargerOverlay.events.map((event, index) => (
                <ReferenceLine
                  key={`charger-${event.type}-${index}-${event.timestamp}`}
                  xAxisId={0}
                  yAxisId="left"
                  x={event.timestamp}
                  stroke={event.type === "connect" ? "#0f766e" : "#be123c"}
                  strokeDasharray="5 4"
                  strokeWidth={2}
                  ifOverflow="extendDomain"
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <GenericSeriesFallback series={item.series} metric={fallbackMetric} />
      )}
    </article>
  );
}

function GenericSeriesFallback({ series, metric }) {
  const rows = useMemo(() => buildChartData(series, metric, 900), [series, metric]);

  if (!metric || rows.length === 0) {
    return (
      <section className="empty-panel compact">
        <BarChart3 size={26} aria-hidden="true" />
        <h3>No matching Energaize chart columns found</h3>
      </section>
    );
  }

  return (
    <div className="equipment-chart-frame">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 12, right: 24, left: 6, bottom: 10 }}>
          <CartesianGrid stroke="#e4e8ec" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={28} />
          <YAxis tick={{ fontSize: 12 }} width={68} tickFormatter={compactNumber} />
          <Tooltip formatter={(value) => formatNumber(value)} />
          <Legend />
          <Line type="monotone" dataKey="value" name={metric} stroke="#0f766e" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function EquipmentBarShape({ x, y, width, height, fill, stroke, fillOpacity, minWidth }) {
  const numericX = Number(x);
  const numericY = Number(y);
  const numericWidth = Number(width);
  const numericHeight = Number(height);
  const minimumWidth = Number(minWidth);

  if (
    !Number.isFinite(numericX) ||
    !Number.isFinite(numericY) ||
    !Number.isFinite(numericWidth) ||
    !Number.isFinite(numericHeight) ||
    numericHeight === 0
  ) {
    return null;
  }

  const rawWidth = Math.abs(numericWidth);
  const rawX = numericWidth < 0 ? numericX + numericWidth : numericX;
  const resolvedWidth = Math.max(rawWidth, Number.isFinite(minimumWidth) ? minimumWidth : 1);
  const adjustedX = rawX + rawWidth / 2 - resolvedWidth / 2;
  const resolvedY = numericHeight < 0 ? numericY + numericHeight : numericY;
  const resolvedHeight = Math.abs(numericHeight);

  return (
    <rect
      x={adjustedX}
      y={resolvedY}
      width={resolvedWidth}
      height={resolvedHeight}
      fill={fill}
      fillOpacity={fillOpacity ?? 0.9}
      stroke={stroke || fill}
      strokeWidth={0.45}
    />
  );
}

function getSimulationEpisodes(simulation) {
  const episodes = unique(simulation.series.map((series) => series.episode).filter(Boolean)).sort(compareNatural);
  return episodes.length > 0 ? episodes : [""];
}

function buildTimeseriesTree(simulation, selectedEpisode) {
  const tree = {
    buildings: [],
    vehicles: [],
    pricing: [],
    other: []
  };
  const buildingMap = new Map();

  const getBuilding = (buildingNumber) => {
    const id = `building_${buildingNumber}`;
    if (!buildingMap.has(id)) {
      buildingMap.set(id, {
        id,
        label: `Building ${buildingNumber}`,
        items: [],
        chargers: [],
        batteries: []
      });
    }
    return buildingMap.get(id);
  };

  const episodeSeries = simulation.series.filter((series) => {
    return !selectedEpisode || !series.episode || series.episode === selectedEpisode;
  });

  episodeSeries.forEach((series) => {
    const baseKey = stripEpisodeFromKey(series.resultKey || series.matchKey);
    const chargerMatch = baseKey.match(/^building_(\d+)_charger_\d+_(\d+)$/i);
    const batteryMatch = baseKey.match(/^building_(\d+)_battery/i);
    const buildingMatch = baseKey.match(/^building_(\d+)(?:$|_)/i);

    if (baseKey === "community") {
      return;
    }

    if (chargerMatch) {
      getBuilding(chargerMatch[1]).chargers.push(
        createResultItem({
          type: "charger",
          label: `Charger ${chargerMatch[2]}`,
          title: `Building ${chargerMatch[1]} - Charger ${chargerMatch[2]} Data`,
          icon: PlugZap,
          series,
          buildingId: `building_${chargerMatch[1]}`
        })
      );
      return;
    }

    if (batteryMatch) {
      getBuilding(batteryMatch[1]).batteries.push(
        createResultItem({
          type: "battery",
          label: "Battery",
          title: `Building ${batteryMatch[1]} - Battery Data`,
          icon: BatteryCharging,
          series,
          buildingId: `building_${batteryMatch[1]}`
        })
      );
      return;
    }

    if (buildingMatch && baseKey.includes("pv")) {
      getBuilding(buildingMatch[1]).items.push(
        createResultItem({
          type: "pv",
          label: "PV",
          title: `Building ${buildingMatch[1]} - PV Data`,
          icon: Sun,
          series,
          buildingId: `building_${buildingMatch[1]}`
        })
      );
      return;
    }

    if (buildingMatch && /^building_\d+$/i.test(baseKey)) {
      const building = getBuilding(buildingMatch[1]);
      building.items.push(
        createResultItem({
          type: "production",
          label: "Production",
          title: `Building ${buildingMatch[1]} Production`,
          icon: Factory,
          series,
          buildingId: `building_${buildingMatch[1]}`
        }),
        createResultItem({
          type: "consumption",
          label: "Consumption",
          title: `Building ${buildingMatch[1]} Consumption`,
          icon: PlugZap,
          series,
          buildingId: `building_${buildingMatch[1]}`
        })
      );
      return;
    }

    if (baseKey.includes("electric_vehicle")) {
      tree.vehicles.push(
        createResultItem({
          type: "ev",
          label: formatSeriesLabel(baseKey),
          title: `${formatSeriesLabel(baseKey)} Data`,
          icon: Car,
          series
        })
      );
      return;
    }

    if (baseKey.startsWith("pricing") || baseKey.includes("price")) {
      tree.pricing.push(
        createResultItem({
          type: "pricing",
          label: "Pricing Data",
          title: "Pricing Info",
          icon: CircleDollarSign,
          series
        })
      );
      return;
    }

    tree.other.push(
      createResultItem({
        type: "generic",
        label: series.label,
        title: series.label,
        icon: FileSpreadsheet,
        series
      })
    );
  });

  tree.buildings = [...buildingMap.values()].sort((a, b) => compareNatural(a.id, b.id));
  tree.buildings.forEach((building) => {
    building.items.sort((a, b) => compareNatural(a.label, b.label));
    building.chargers.sort((a, b) => compareNatural(a.label, b.label));
    building.batteries.sort((a, b) => compareNatural(a.label, b.label));
  });
  tree.vehicles.sort((a, b) => compareNatural(a.label, b.label));
  tree.pricing.sort((a, b) => compareNatural(a.label, b.label));
  tree.other.sort((a, b) => compareNatural(a.label, b.label));

  return tree;
}

function createResultItem({ type, label, title, icon, series, buildingId = null }) {
  return {
    id: `${series.id}-${type}`,
    type,
    label,
    title,
    icon,
    series,
    buildingId
  };
}

function flattenTreeItems(tree) {
  return [
    ...tree.buildings.flatMap((building) => [...building.items, ...building.chargers, ...building.batteries]),
    ...tree.vehicles,
    ...tree.pricing,
    ...tree.other
  ];
}

function createCommunityResultItem(tree, simulation, selectedEpisode) {
  const explicitCommunitySeries = simulation.series.find((series) => {
    const baseKey = stripEpisodeFromKey(series.resultKey || series.matchKey);
    return baseKey === "community" && (!selectedEpisode || !series.episode || series.episode === selectedEpisode);
  });

  if (explicitCommunitySeries) {
    return createResultItem({
      type: "community",
      label: "Community",
      title: "Community Overview",
      icon: Building2,
      series: explicitCommunitySeries
    });
  }

  const buildingSeries = tree.buildings
    .map((building) => {
      return (
        building.items.find((item) => item.type === "consumption") ||
        building.items.find((item) => item.type === "production") ||
        null
      );
    })
    .filter(Boolean)
    .map((item) => item.series);

  if (buildingSeries.length === 0) return null;

  const rowsByIndex = new Map();
  const maxRows = Math.max(...buildingSeries.map((series) => series.rows.length));
  const aliases = {
    nonShiftable: ["Non-shiftable Load-kWh", "electricity_consumption", "load", "non_shiftable_load"],
    net: ["Net Electricity Consumption-kWh", "net_electricity_consumption", "net_consumption"],
    pv: ["Energy Production from PV-kWh", "solar_generation", "pv_generation", "PV Production-kWh"],
    ev: ["Energy Production From EV-kWh", "Energy Production from EV-kWh", "ev_generation"]
  };

  for (let index = 0; index < maxRows; index += 1) {
    const row = {
      timestamp: null,
      time_step: index,
      "Non-shiftable Load-kWh": 0,
      "Net Electricity Consumption-kWh": 0,
      "Energy Production from PV-kWh": 0,
      "Energy Production From EV-kWh": 0
    };

    buildingSeries.forEach((series) => {
      const source = series.rows[index];
      if (!source) return;
      if (!row.timestamp && series.timeKey) row.timestamp = source[series.timeKey];
      row["Non-shiftable Load-kWh"] += valueFromAliases(source, series.columns, aliases.nonShiftable);
      row["Net Electricity Consumption-kWh"] += valueFromAliases(source, series.columns, aliases.net);
      row["Energy Production from PV-kWh"] += valueFromAliases(source, series.columns, aliases.pv);
      row["Energy Production From EV-kWh"] += valueFromAliases(source, series.columns, aliases.ev);
    });

    rowsByIndex.set(index, row);
  }

  const columns = [
    "timestamp",
    "time_step",
    "Non-shiftable Load-kWh",
    "Net Electricity Consumption-kWh",
    "Energy Production from PV-kWh",
    "Energy Production From EV-kWh"
  ];
  const series = {
    id: `community-${simulation.id}-${selectedEpisode || "all"}`,
    fileName: "community aggregate",
    relativePath: "community aggregate",
    resultKey: "community",
    matchKey: "community",
    label: "Community",
    category: "Buildings",
    episode: selectedEpisode,
    rows: [...rowsByIndex.values()],
    columns,
    numericColumns: columns.filter((column) => column !== "timestamp"),
    timeKey: "timestamp"
  };

  return createResultItem({
    type: "community",
    label: "Community",
    title: "Community Overview",
    icon: Building2,
    series
  });
}

function valueFromAliases(row, columns, aliases) {
  const field = resolveField(columns, aliases);
  const value = field ? toNumber(row[field]) : null;
  return isFiniteNumber(value) ? value : 0;
}

function getItemsTimeBounds(items) {
  const rows = items.flatMap((item) => prepareTimestampRows(item.series));
  if (rows.length === 0) return { min: null, max: null, baseInterval: 60 };
  const timestamps = rows.map((row) => row.timestamp).filter(isFiniteNumber).sort((a, b) => a - b);
  return {
    min: timestamps[0],
    max: timestamps[timestamps.length - 1],
    baseInterval: getBaseIntervalMinutes(rows)
  };
}

function getEquipmentBarSize(rowCount, barCount, chartWidth) {
  if (barCount <= 0) return 0;
  const fallbackWidth = 900;
  const plotWidth = Math.max(280, (chartWidth || fallbackWidth) - 120);
  const slotWidth = plotWidth / Math.max(rowCount, 1);
  const naturalWidth = (slotWidth / Math.max(barCount, 1)) * 0.9;
  const minimumWidth =
    rowCount <= 72 ? 4.5 :
    rowCount <= 220 ? 2.6 :
    rowCount <= 520 ? 1.8 :
    rowCount <= 1200 ? 1.2 :
    0.8;
  const maximumWidth =
    rowCount <= 72 ? 9 :
    rowCount <= 220 ? 4.2 :
    rowCount <= 520 ? 3 :
    2;

  return Math.min(maximumWidth, Math.max(minimumWidth, naturalWidth));
}

function getEquipmentXDomain(rows, intervalMinutes) {
  if (!rows.length) return ["dataMin", "dataMax"];
  const first = rows[0]?.timestamp;
  const last = rows[rows.length - 1]?.timestamp;
  if (!isFiniteNumber(first) || !isFiniteNumber(last)) return ["dataMin", "dataMax"];
  const intervalMs = Math.max(1, Number(intervalMinutes) || 60) * 60 * 1000;
  const padding = Math.max(10 * 60 * 1000, intervalMs * 0.5);
  return [first - padding, last + padding];
}

function sortBuildingIds(ids, buildings) {
  const order = new Map(buildings.map((building, index) => [building.id, index]));
  return [...ids].sort((left, right) => (order.get(left) ?? 9999) - (order.get(right) ?? 9999));
}

function formatIntervalLabel(minutes) {
  if (minutes >= 1440) return `${Math.round(minutes / 1440)}d`;
  if (minutes >= 60) return `${Math.round(minutes / 60)}h`;
  return `${minutes}m`;
}

function getEquipmentChartConfig(item) {
  const field = (aliases) => resolveField(item.series.columns, aliases);
  const percentFormatter = (value) => `${formatNumber(value)}%`;
  const batteryEnergyField = field(["Battery (Dis)Charge-kWh", "battery_charge", "battery_discharge"]);
  const chargerConsumptionField = field(["Charger Consumption-kWh", "charger_consumption"]);
  const chargerProductionField = field(["Charger Production-kWh", "charger_production"]);
  const chargerArrivalField = field(["EV Estimated SOC Arrival-%", "electric_vehicle_estimated_soc_arrival"]);
  const chargerRequiredField = field(["EV Required SOC Departure-%", "electric_vehicle_required_soc_departure"]);
  const chargerSocField = field(["EV SOC-%", "electric_vehicle_soc"]);
  const chargerStateField = field(["EV Charger State", "electric_vehicle_charger_state", "charger_state"]);

  const configs = {
    community: {
      kind: "Community",
      unit: "kWh",
      series: [
        {
          key: "community-net-consumption",
          label: "Net Electricity Consumption-kWh",
          field: field(["Net Electricity Consumption-kWh"]),
          chart: "bar",
          strategy: "sum",
          color: "#d97706"
        },
        {
          key: "community-non-shiftable",
          label: "Non-shiftable Load-kWh",
          field: field(["Non-shiftable Load-kWh"]),
          chart: "bar",
          strategy: "sum",
          color: "#2563eb"
        },
        {
          key: "community-pv",
          label: "Energy Production from PV-kWh",
          field: field(["Energy Production from PV-kWh", "Total Solar Generation-kWh", "solar_generation", "pv_generation"]),
          chart: "bar",
          strategy: "sum",
          color: "#6d28d9"
        },
        {
          key: "community-ev",
          label: "Energy Production From EV-kWh",
          field: field(["Energy Production From EV-kWh"]),
          chart: "bar",
          strategy: "sum",
          color: "#0f766e"
        }
      ]
    },
    production: {
      kind: "Production",
      unit: "kWh",
      series: [
        {
          key: "pv-production",
          label: "Energy Production from PV-kWh",
          field: field(["Energy Production from PV-kWh", "solar_generation", "pv_generation", "PV Production-kWh"]),
          chart: "bar",
          strategy: "sum",
          color: "#6d28d9"
        },
        {
          key: "ev-production",
          label: "Energy Production from EV-kWh",
          field: field(["Energy Production From EV-kWh", "Energy Production from EV-kWh", "ev_generation"]),
          chart: "bar",
          strategy: "sum",
          color: "#0f766e"
        }
      ]
    },
    consumption: {
      kind: "Consumption",
      unit: "kWh",
      series: [
        {
          key: "non-shiftable",
          label: "Non-shiftable Load-kWh",
          field: field(["Non-shiftable Load-kWh", "electricity_consumption", "load", "non_shiftable_load"]),
          chart: "bar",
          strategy: "sum",
          color: "#2563eb"
        },
        {
          key: "net-consumption",
          label: "Net Electricity Consumption-kWh",
          field: field(["Net Electricity Consumption-kWh", "net_electricity_consumption", "net_consumption"]),
          chart: "bar",
          strategy: "sum",
          color: "#d97706"
        }
      ]
    },
    battery: {
      kind: "Battery",
      unit: "kWh / %",
      hasRightAxis: true,
      rightDomain: [0, 100],
      rightFormatter: percentFormatter,
      showZeroLine: true,
      series: [
        {
          key: "battery-charge",
          label: "Battery Charge-kWh",
          field: batteryEnergyField ? "__battery_charge" : null,
          derive: (row) => positiveValue(row[batteryEnergyField]),
          chart: "bar",
          strategy: "sum",
          stackId: "battery",
          color: "#2563eb"
        },
        {
          key: "battery-discharge",
          label: "Battery Discharge-kWh",
          field: batteryEnergyField ? "__battery_discharge" : null,
          derive: (row) => negativeValue(row[batteryEnergyField]),
          chart: "bar",
          strategy: "sum",
          stackId: "battery",
          color: "#d97706"
        },
        {
          key: "battery-soc",
          label: "Battery Soc-%",
          field: field(["Battery Soc-%", "battery_soc", "soc"]),
          chart: "line",
          strategy: "avg",
          axis: "right",
          transform: normalizePercent,
          color: "#be123c"
        }
      ]
    },
    charger: {
      kind: "Charger",
      unit: "kWh / %",
      hasRightAxis: true,
      rightDomain: [0, 100],
      rightFormatter: percentFormatter,
      showZeroLine: true,
      activityFields: {
        consumption: chargerConsumptionField,
        production: chargerProductionField,
        arrival: chargerArrivalField,
        required: chargerRequiredField,
        soc: chargerSocField,
        state: chargerStateField
      },
      series: [
        {
          key: "charger-net",
          label: "Charger Net-kWh",
          field: chargerConsumptionField || chargerProductionField ? "__charger_net" : null,
          derive: (row) => chargerEnergyValue(row[chargerConsumptionField]) - chargerEnergyValue(row[chargerProductionField]),
          chart: "bar",
          strategy: "sum",
          color: "#2563eb"
        },
        {
          key: "charger-arrival",
          label: "EV Estimated SOC Arrival-%",
          field: chargerArrivalField,
          chart: "line",
          strategy: "avg",
          axis: "right",
          transform: normalizeVisiblePercent,
          curve: "stepAfter",
          dashArray: "5 4",
          color: "#6d28d9"
        },
        {
          key: "charger-required",
          label: "EV Required SOC Departure-%",
          field: chargerRequiredField,
          chart: "line",
          strategy: "avg",
          axis: "right",
          transform: normalizeVisiblePercent,
          curve: "stepAfter",
          dashArray: "5 4",
          color: "#d97706"
        },
        {
          key: "charger-soc",
          label: "EV SOC-%",
          field: chargerSocField,
          chart: "line",
          strategy: "avg",
          axis: "right",
          transform: normalizeVisiblePercent,
          color: "#172033"
        }
      ]
    },
    ev: {
      kind: "Electric Vehicle",
      unit: "%",
      hasRightAxis: false,
      series: [
        {
          key: "estimated-arrival",
          label: "Estimated SOC Arrival",
          field: field(["electric_vehicle_estimated_soc_arrival", "EV Estimated SOC Arrival-%"]),
          chart: "line",
          strategy: "avg",
          transform: normalizePercent,
          color: "#6d28d9"
        },
        {
          key: "required-departure",
          label: "Required SOC Departure",
          field: field(["electric_vehicle_required_soc_departure", "EV Required SOC Departure-%"]),
          chart: "line",
          strategy: "avg",
          transform: normalizePercent,
          color: "#d97706"
        },
        {
          key: "ev-soc",
          label: "EV SOC",
          field: field(["electric_vehicle_soc", "EV SOC-%"]),
          chart: "line",
          strategy: "avg",
          transform: normalizePercent,
          color: "#0f766e"
        }
      ]
    },
    pv: {
      kind: "PV",
      unit: "",
      series: [
        { key: "pv", label: "PV", field: field(["pv", "PV", "solar_generation"]), chart: "bar", strategy: "sum", color: "#6d28d9" },
        { key: "uv", label: "UV", field: field(["uv", "UV"]), chart: "bar", strategy: "sum", color: "#2563eb" },
        { key: "amt", label: "AMT", field: field(["amt", "AMT"]), chart: "bar", strategy: "sum", color: "#d97706" }
      ]
    },
    pricing: {
      kind: "Pricing",
      unit: "$/kWh",
      series: [
        {
          key: "price",
          label: "electricity_pricing-$/kWh",
          field: field(["electricity_pricing-$/kWh", "electricity_pricing", "price"]),
          chart: "line",
          strategy: "avg",
          color: "#d97706"
        },
        {
          key: "price-1",
          label: "electricity_pricing_predicted_1-$/kWh",
          field: field(["electricity_pricing_predicted_1-$/kWh", "electricity_pricing_predicted_1"]),
          chart: "line",
          strategy: "avg",
          color: "#6d28d9"
        },
        {
          key: "price-2",
          label: "electricity_pricing_predicted_2-$/kWh",
          field: field(["electricity_pricing_predicted_2-$/kWh", "electricity_pricing_predicted_2"]),
          chart: "line",
          strategy: "avg",
          color: "#0f766e"
        },
        {
          key: "carbon",
          label: "carbon_intensity",
          field: field(["carbon_intensity", "carbon_intensity_predicted"]),
          chart: "line",
          strategy: "avg",
          color: "#be123c"
        }
      ]
    }
  };

  return configs[item.type] || {
    kind: "Timeseries",
    unit: "",
    series: item.series.numericColumns.slice(0, 4).map((column, index) => ({
      key: column,
      label: column,
      field: column,
      chart: "line",
      strategy: "avg",
      color: CHART_COLORS[index % CHART_COLORS.length]
    }))
  };
}

function useEquipmentChartData(series, chartConfig, controls = null) {
  const preparedRows = useMemo(() => prepareTimestampRows(series), [series]);
  const minTimestamp = preparedRows[0]?.timestamp ?? 0;
  const maxTimestamp = preparedRows[preparedRows.length - 1]?.timestamp ?? minTimestamp;
  const baseIntervalMinutes = useMemo(() => getBaseIntervalMinutes(preparedRows), [preparedRows]);
  const defaultEnd = Math.min(maxTimestamp, minTimestamp + 10 * 24 * 60 * 60 * 1000);
  const [localRange, setLocalRange] = useState([minTimestamp, defaultEnd || maxTimestamp]);
  const [localTimeInterval, setLocalTimeInterval] = useState(baseIntervalMinutes);
  const range = controls?.range || localRange;
  const timeInterval = controls?.timeInterval || localTimeInterval;

  useEffect(() => {
    if (controls) return;
    setLocalRange([minTimestamp, defaultEnd || maxTimestamp]);
    setLocalTimeInterval(baseIntervalMinutes);
  }, [controls, series.id, minTimestamp, defaultEnd, maxTimestamp, baseIntervalMinutes]);

  const rows = useMemo(() => {
    const filtered = preparedRows.filter((row) => row.timestamp >= range[0] && row.timestamp <= range[1]);
    return aggregateRowsForChart(filtered, timeInterval, chartConfig.series);
  }, [preparedRows, range, timeInterval, chartConfig]);

  const fallbackMetric = series.numericColumns[0] || null;

  return {
    rows,
    preparedRows,
    range,
    timeInterval,
    fallbackMetric
  };
}

function prepareTimestampRows(series) {
  const baseDate = Date.UTC(2026, 0, 1, 0, 0, 0, 0);
  return series.rows
    .map((row, index) => {
      const timestamp = getRowTimestamp(row, series.timeKey, index, baseDate);
      return {
        ...row,
        timestamp,
        label: formatTimestampLabel(timestamp)
      };
    })
    .filter((row) => isFiniteNumber(row.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function getRowTimestamp(row, timeKey, index, baseDate) {
  const rawTime = timeKey ? row[timeKey] : row.timestamp;
  const numericTime = toNumber(rawTime);

  if (typeof rawTime === "string" && Number.isNaN(Date.parse(rawTime)) === false && !/^\d+(\.\d+)?$/.test(rawTime.trim())) {
    return new Date(rawTime).getTime();
  }

  if (isFiniteNumber(numericTime)) {
    return baseDate + numericTime * 60 * 60 * 1000;
  }

  return baseDate + index * 60 * 60 * 1000;
}

function getBaseIntervalMinutes(rows) {
  if (rows.length < 2) return 60;
  const diff = Math.max(1, Math.round((rows[1].timestamp - rows[0].timestamp) / (60 * 1000)));
  return Math.min(Math.max(diff, 1), 1440);
}

function aggregateRowsForChart(rows, intervalMinutes, seriesConfigs) {
  if (!rows.length) return [];

  const result = [];
  let groupStart = rows[0].timestamp;
  let group = [];

  rows.forEach((row) => {
    if (row.timestamp - groupStart < intervalMinutes * 60 * 1000 || group.length === 0) {
      group.push(row);
      return;
    }

    result.push(aggregateChartGroup(groupStart, group, seriesConfigs));
    groupStart = row.timestamp;
    group = [row];
  });

  if (group.length > 0) {
    result.push(aggregateChartGroup(groupStart, group, seriesConfigs));
  }

  return result;
}

function aggregateChartGroup(timestamp, rows, seriesConfigs) {
  const output = {
    timestamp,
    label: formatTimestampLabel(timestamp)
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
      config.strategy === "avg"
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : values.reduce((sum, value) => sum + value, 0);
  });

  return output;
}

function deriveChargerActivityOverlay(rows, chartConfig, range, intervalMinutes) {
  const fields = chartConfig.activityFields || {};
  const samples = rows
    .filter((row) => isFiniteNumber(row.timestamp))
    .map((row) => ({
      timestamp: row.timestamp,
      connected: isChargerConnected(row, fields)
    }));

  if (samples.length === 0 || samples.every((sample) => !sample.connected)) {
    return EMPTY_CHARGER_OVERLAY;
  }

  const events = [];
  const intervals = [];
  const intervalMs = Math.max(1, Number(intervalMinutes) || 60) * 60 * 1000;
  let previousConnected = false;
  let connectedStart = null;

  samples.forEach((sample) => {
    if (!previousConnected && sample.connected) {
      connectedStart = sample.timestamp;
      events.push({ type: "connect", timestamp: sample.timestamp });
    }

    if (previousConnected && !sample.connected) {
      const end = sample.timestamp;
      if (connectedStart !== null && end > connectedStart) {
        intervals.push({ start: connectedStart, end });
      }
      events.push({ type: "disconnect", timestamp: end });
      connectedStart = null;
    }

    previousConnected = sample.connected;
  });

  if (previousConnected && connectedStart !== null) {
    const lastTimestamp = samples[samples.length - 1].timestamp;
    const end = range?.[1] && range[1] > connectedStart ? range[1] : lastTimestamp + intervalMs;
    intervals.push({ start: connectedStart, end });
  }

  const rangeStart = Array.isArray(range) ? range[0] : null;
  const rangeEnd = Array.isArray(range) ? range[1] : null;
  const isInRange = (timestamp) => {
    if (isFiniteNumber(rangeStart) && timestamp < rangeStart) return false;
    if (isFiniteNumber(rangeEnd) && timestamp > rangeEnd) return false;
    return true;
  };

  const clippedIntervals = intervals
    .map((interval) => ({
      start: isFiniteNumber(rangeStart) ? Math.max(interval.start, rangeStart) : interval.start,
      end: isFiniteNumber(rangeEnd) ? Math.min(interval.end, rangeEnd) : interval.end
    }))
    .filter((interval) => interval.end > interval.start);

  return {
    events: events.filter((event) => isInRange(event.timestamp)),
    intervals: clippedIntervals
  };
}

function isChargerConnected(row, fields) {
  if (fields.state) {
    const state = toNumber(row[fields.state]);
    if (isFiniteNumber(state)) return Math.round(state) === 1;
  }

  const consumption = numericOrZero(row[fields.consumption]);
  const production = numericOrZero(row[fields.production]);
  const arrival = normalizeVisiblePercent(toNumber(row[fields.arrival]));
  const required = normalizeVisiblePercent(toNumber(row[fields.required]));
  const soc = normalizeVisiblePercent(toNumber(row[fields.soc]));

  return (
    Math.abs(consumption) > 0.000001 ||
    Math.abs(production) > 0.000001 ||
    isFiniteNumber(arrival) ||
    isFiniteNumber(required) ||
    isFiniteNumber(soc)
  );
}

function resolveField(columns, aliases) {
  const lowerMap = new Map(columns.map((column) => [column.toLowerCase(), column]));
  for (const alias of aliases) {
    const exact = lowerMap.get(String(alias).toLowerCase());
    if (exact) return exact;
  }

  return columns.find((column) => {
    const normalized = normalizeColumnName(column);
    return aliases.some((alias) => normalized === normalizeColumnName(alias));
  }) || null;
}

function normalizeColumnName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizePercent(value) {
  if (!isFiniteNumber(value)) return null;
  return Math.abs(value) <= 1 ? value * 100 : value;
}

function normalizeVisiblePercent(value) {
  const percent = normalizePercent(value);
  if (!isFiniteNumber(percent) || percent < 0 || percent > 100) return null;
  return percent;
}

function numericOrZero(value) {
  const numeric = toNumber(value);
  return isFiniteNumber(numeric) ? numeric : 0;
}

function chargerEnergyValue(value) {
  const numeric = toNumber(value);
  if (!isFiniteNumber(numeric) || Math.abs(numeric + 1) < 1e-9) return 0;
  return numeric;
}

function positiveValue(value) {
  const numeric = toNumber(value);
  if (!isFiniteNumber(numeric) || numeric <= 0) return null;
  return numeric;
}

function negativeValue(value) {
  const numeric = toNumber(value);
  if (!isFiniteNumber(numeric) || numeric >= 0) return null;
  return numeric;
}

function negativeAbsValue(value) {
  const numeric = toNumber(value);
  if (!isFiniteNumber(numeric) || numeric <= 0) return null;
  return -Math.abs(numeric);
}

function stripEpisodeFromKey(key) {
  return String(key || "").replace(/_ep(?:isode)?_?\d+$/i, "");
}

function formatTimestampLabel(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function formatDateInput(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function parseDateInput(value, fallback) {
  const parsed = new Date(`${value}T00:00:00Z`).getTime();
  return Number.isNaN(parsed) ? fallback : parsed;
}

function endOfDay(timestamp) {
  const date = new Date(timestamp);
  date.setUTCHours(23, 59, 59, 999);
  return date.getTime();
}

function getActiveQuickRange(range, minTimestamp, maxTimestamp) {
  if (!isFiniteNumber(minTimestamp) || !isFiniteNumber(maxTimestamp)) return "";
  const [start, end] = range;
  const toleranceMs = 60 * 1000;
  if (Math.abs(start - minTimestamp) > toleranceMs) return "";
  if (Math.abs(end - maxTimestamp) <= toleranceMs) return "all";

  for (const days of [1, 7, 10]) {
    const expectedEnd = Math.min(maxTimestamp, minTimestamp + days * 24 * 60 * 60 * 1000);
    if (Math.abs(end - expectedEnd) <= toleranceMs) return String(days);
  }

  return "";
}

function MetricSelector({ series, selectedMetric, setSelectedMetric }) {
  if (!series || series.numericColumns.length === 0) {
    return (
      <label className="select-field is-disabled">
        <span>Metric</span>
        <select disabled>
          <option>No metrics</option>
        </select>
      </label>
    );
  }

  return (
    <label className="select-field">
      <span>Metric</span>
      <select value={selectedMetric || ""} onChange={(event) => setSelectedMetric(event.target.value)}>
        {series.numericColumns.map((column) => (
          <option key={column} value={column}>
            {column}
          </option>
        ))}
      </select>
    </label>
  );
}

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
    [kpis, selectedScope]
  );
  const scoreRows = useMemo(
    () => allScopeRows.filter((row) => isFiniteNumber(row.value)),
    [allScopeRows]
  );
  const referenceSummary = useMemo(() => getKpiReferenceSummary(allScopeRows), [allScopeRows]);
  const scorecard = useMemo(() => buildKpiScorecard(scoreRows), [scoreRows]);
  const kpiFamilyOptions = useMemo(() => buildKpiFamilyOptions(allScopeRows), [allScopeRows]);
  const kpiDrilldownSections = useMemo(
    () =>
      buildKpiDrilldownSections(allScopeRows, {
        familyFilter: kpiFamilyFilter,
        search: kpiSearch,
        showNa: showKpiNa,
        selectedScope
      }),
    [allScopeRows, kpiFamilyFilter, kpiSearch, showKpiNa, selectedScope]
  );
  const visibleDrilldownCount = kpiDrilldownSections.reduce(
    (count, section) => count + section.subfamilies.reduce((sum, subfamily) => sum + subfamily.rows.length, 0),
    0
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
                {selectedScope?.label || "Community"} - cost, EV service, battery behaviour, grid safety and solar use
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
                    {toneLabel && <span className={`kpi-tone kpi-tone-${comparison.tone}`}>{toneLabel}</span>}
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
                <small>Expanded scorecard for cost, EV service, grid safety, battery throughput, V2G, solar and grid shape.</small>
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
                    </div>
                    {showComparisonContext ? (
                      <>
                        <div className="kpi-compare-cell">
                          <small>{comparison.policyLabel}</small>
                          <strong>{comparison.policy}</strong>
                        </div>
                        <div className={`kpi-compare-cell ${comparison.hasReference ? "" : "is-missing"}`}>
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
                      {toneLabel ? <span className={`kpi-tone kpi-tone-${comparison.tone}`}>{toneLabel}</span> : null}
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
                            <details className="kpi-subfamily-accordion" key={`${familySection.family}:${subfamily.key}`}>
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

function KpiScopeTree({ scopes, selectedScopeId, onSelectScope }) {
  const community = scopes.find((scope) => scope.id === "community") || scopes[0];
  const buildings = scopes.filter((scope) => scope.id !== "community");

  return (
    <aside className="result-tree-panel sim-tree-panel kpi-tree-panel">
      <header className="sim-tree-head">
        <div className="sim-tree-headline">
          <small>KPI scope</small>
        </div>
        {community && (
          <button
            type="button"
            className={selectedScopeId === community.id ? "sim-tree-context-btn is-active" : "sim-tree-context-btn"}
            onClick={() => onSelectScope(community.id)}
          >
            <Table2 size={14} aria-hidden="true" />
            <span className="sim-tree-context-label">{community.label}</span>
          </button>
        )}
      </header>
      <ul className="sim-tree-list">
        {buildings.map((scope) => (
          <li key={scope.id}>
            <div className={selectedScopeId === scope.id ? "sim-tree-row is-selected is-root-level" : "sim-tree-row is-root-level"}>
              <span className="sim-tree-toggle is-spacer" />
              <button className="sim-tree-label" type="button" onClick={() => onSelectScope(scope.id)}>
                <span className="sim-tree-icon"><Building2 size={14} /></span>
                <span>{scope.label}</span>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function KpiTable({ kpis }) {
  const columns = orderKpiColumns(kpis);

  return (
    <div className="kpi-table-shell">
      <div className="table-scroll">
        <table className="kpi-reference-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {kpis.rows.map((row, rowIndex) => (
              <tr key={`${getKpiLabel(row, kpis)}-${rowIndex}`}>
                {columns.map((column) => (
                  <td key={column}>{formatCell(row[column])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiScopedTable({ rows, selectedScope }) {
  return (
    <div className="kpi-table-shell">
      <div className="table-scroll">
        <table className="kpi-reference-table">
          <thead>
            <tr>
              <th>KPI</th>
              <th>{selectedScope?.label || "Value"}</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{formatKpiDisplayLabel(row.label)}</td>
                <td>{formatNumber(row.value)}</td>
                <td>{row.sourceColumn}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
                  <td className={row.tone === "better" ? "kpi-delta-better" : row.tone === "worse" ? "kpi-delta-worse" : ""}>
                    {formatKpiDrilldownValue(row.delta, row.unit)}
                  </td>
                  <td className={row.tone === "better" ? "kpi-delta-better" : row.tone === "worse" ? "kpi-delta-worse" : ""}>
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

function CompareView({ simulations, compareIds }) {
  const [selectedScopeId, setSelectedScopeId] = useState("community");
  const [showUnion, setShowUnion] = useState(true);
  const [showKpiNa, setShowKpiNa] = useState(false);
  const [kpiSearch, setKpiSearch] = useState("");
  const [kpiFamilyFilter, setKpiFamilyFilter] = useState("all");
  const [kpiDrilldownOpen, setKpiDrilldownOpen] = useState(false);
  const selectedSimulations = useMemo(
    () => simulations.filter((simulation) => compareIds.includes(simulation.id)),
    [simulations, compareIds]
  );
  const selectedKpiSimulations = useMemo(
    () => selectedSimulations.filter((simulation) => simulation.kpis),
    [selectedSimulations]
  );
  const scopes = useMemo(() => buildCompareKpiScopes(selectedKpiSimulations), [selectedKpiSimulations]);
  const selectedScope = scopes.find((scope) => scope.id === selectedScopeId) || scopes[0] || null;
  const scorecardRows = useMemo(
    () => (selectedScope ? buildCompareScorecardRows(selectedKpiSimulations, selectedScope) : []),
    [selectedKpiSimulations, selectedScope]
  );
  const matrixRows = useMemo(
    () => (selectedScope ? buildCompareKpiMatrixRows(selectedKpiSimulations, selectedScope, showUnion) : []),
    [selectedKpiSimulations, selectedScope, showUnion]
  );
  const kpiFamilyOptions = useMemo(() => buildCompareKpiFamilyOptions(matrixRows), [matrixRows]);
  const visibleMatrixRows = useMemo(() => {
    const query = kpiSearch.trim().toLowerCase();
    return matrixRows.filter((row) => {
      if (kpiFamilyFilter !== "all" && row.family !== kpiFamilyFilter) return false;
      if (!showKpiNa && row.reportedCount === 0) return false;
      if (!query) return true;
      return `${row.label} ${row.sourceLabels.join(" ")} ${row.family} ${row.subfamily.label}`.toLowerCase().includes(query);
    });
  }, [kpiFamilyFilter, kpiSearch, matrixRows, showKpiNa]);

  useEffect(() => {
    if (scopes.length > 0 && !scopes.some((scope) => scope.id === selectedScopeId)) {
      setSelectedScopeId(scopes[0].id);
    }
  }, [scopes, selectedScopeId]);

  useEffect(() => {
    if (kpiFamilyFilter !== "all" && !kpiFamilyOptions.some((option) => option.family === kpiFamilyFilter)) {
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
                {selectedScope?.label || "Selected scope"} - scorecard comparison across selected simulations
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
                    <small>{row.description}</small>
                    <span>{row.reportedCount}/{selectedKpiSimulations.length} reported</span>
                  </div>

                  {selectedKpiSimulations.map((simulation, index) => {
                    const signal = row.signalsBySimulationId[simulation.id];
                    const baselineSignal = row.signalsBySimulationId[selectedKpiSimulations[0].id];
                    const best = row.bestSimulationIds.includes(simulation.id);
                    const delta = index === 0 ? null : formatCompareSignalDelta(signal, baselineSignal, row.definition);
                    return (
                      <div
                        className={[
                          "compare-score-cell",
                          signal?.reported ? "" : "is-missing",
                          best ? "is-best" : ""
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        key={`${row.id}:${simulation.id}`}
                      >
                        <small title={simulation.name}>
                          {index === 0 ? "Baseline" : simulation.name}
                        </small>
                        <strong>{signal ? formatKpiScorecardValue(signal) : "Not reported"}</strong>
                        <span className="compare-score-cell-meta">
                          {best && <em>Best</em>}
                          {delta && (
                            <em className={delta.tone === "better" ? "kpi-delta-better" : delta.tone === "worse" ? "kpi-delta-worse" : ""}>
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
                <CompareKpiMatrixTable rows={visibleMatrixRows} simulations={selectedKpiSimulations} />
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
                    <td className={!entry?.reported ? "kpi-row-na" : ""} key={`${row.key}:${simulation.id}`}>
                      <strong>{formatCompareMatrixValue(entry, row)}</strong>
                      {entry?.reported && (isFiniteNumber(entry.reference) || isFiniteNumber(entry.delta)) ? (
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
                <td>{row.reportedCount}/{simulations.length}</td>
                <td>{row.unit || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Footer() {
  const logos = [
    {
      href: "https://www2.isep.ipp.pt/softcps/",
      label: "SoftCPS",
      src: "/logos/softcps.png",
      className: "footer-logo-softcps"
    },
    {
      href: "https://www.isep.ipp.pt/",
      label: "ISEP",
      src: "/logos/ISEP-light.png",
      className: "footer-logo-isep"
    },
    {
      href: "https://www.portugal.gov.pt/pt/gc25",
      label: "Portuguese Republic",
      src: "/logos/Digital_RP_4C.svg",
      className: "footer-logo-digital"
    },
    {
      href: "https://www.fct.pt/",
      label: "FCT",
      src: "/logos/fct_light.jpg",
      className: "footer-logo-fct"
    },
    {
      href: "https://portugal2030.pt/",
      label: "Portugal 2030",
      src: "/logos/PRD_PDQI(1).png",
      className: "footer-logo-prd"
    },
    {
      href: "https://www.i-charging.pt/",
      label: "i-charging",
      src: "/logos/logo_i_charging_dark.png",
      className: "footer-logo-icharging"
    }
  ];

  return (
    <footer className="institutional-footer" aria-label="Institutional partners">
      <div className="institutional-copy">
        <p>
          Developed by <strong>Tiago Fonseca</strong>.
        </p>
        <p>
          Funded by DEMFLEX, supported by FCT - Fundacao para a Ciencia e a Tecnologia under
          grant 2024.00855.BD.
        </p>
      </div>

      <div className="institutional-logos">
        {logos.map((logo) => (
          <a key={logo.label} href={logo.href} target="_blank" rel="noreferrer" aria-label={logo.label}>
            <img className={`institutional-logo ${logo.className}`} src={logo.src} alt="" aria-hidden="true" />
          </a>
        ))}
      </div>
    </footer>
  );
}

function GitHubMark({ size = 20, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      focusable="false"
      {...props}
    >
      <path d="M12 .5A11.5 11.5 0 0 0 8.36 22.9c.58.1.79-.25.79-.56v-2c-3.22.7-3.9-1.38-3.9-1.38-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.78 2.73 1.27 3.4.97.1-.76.41-1.27.74-1.56-2.57-.29-5.27-1.29-5.27-5.73 0-1.27.45-2.3 1.2-3.11-.12-.29-.52-1.48.11-3.07 0 0 .98-.31 3.2 1.19a11.1 11.1 0 0 1 5.82 0c2.22-1.5 3.2-1.19 3.2-1.19.63 1.59.23 2.78.11 3.07.75.81 1.2 1.84 1.2 3.11 0 4.45-2.71 5.43-5.29 5.72.42.36.8 1.08.8 2.18v3.24c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

function groupFilesBySimulation(files) {
  const entries = files
    .map((file) => {
      const relativePath = normalizePath(file.webkitRelativePath || file.name);
      const parts = relativePath.split("/").filter(Boolean);
      const fileName = parts[parts.length - 1] || file.name;
      const directory = parts.length > 1 ? parts.slice(0, -1).join("/") : "selected-files";

      return {
        file,
        relativePath,
        fileName,
        directory
      };
    })
    .filter((entry) => entry.fileName.toLowerCase().endsWith(".csv"));

  const directoryMap = new Map();
  entries.forEach((entry) => {
    if (!directoryMap.has(entry.directory)) {
      directoryMap.set(entry.directory, []);
    }
    directoryMap.get(entry.directory).push(entry);
  });

  const recognizedDirectories = [...directoryMap.entries()]
    .filter(([, directoryEntries]) => directoryEntries.some((entry) => isRecognizedResultFile(entry.fileName)))
    .map(([directory]) => directory)
    .sort((a, b) => b.length - a.length);

  const candidateDirectories =
    recognizedDirectories.length > 0
      ? recognizedDirectories
      : [...directoryMap.keys()].sort((a, b) => b.length - a.length);

  const groups = new Map();

  entries.forEach((entry) => {
    const match = candidateDirectories.find(
      (directory) => entry.directory === directory || entry.directory.startsWith(`${directory}/`)
    );
    const groupPath = match || entry.directory || "selected-files";

    if (!groups.has(groupPath)) {
      groups.set(groupPath, {
        path: groupPath,
        name: baseName(groupPath),
        entries: []
      });
    }

    groups.get(groupPath).entries.push(entry);
  });

  const usedNames = new Map();
  return [...groups.values()].map((group) => {
    const count = usedNames.get(group.name) || 0;
    usedNames.set(group.name, count + 1);

    return {
      ...group,
      name: count === 0 ? group.name : `${group.name} ${count + 1}`
    };
  });
}

async function parseSimulationFolder(group) {
  const csvEntries = group.entries.filter((entry) => entry.fileName.toLowerCase().endsWith(".csv"));
  const kpiEntries = csvEntries.filter((entry) => isKpiFile(entry.fileName));
  const kpiEntry =
    kpiEntries.find((entry) => entry.fileName.toLowerCase() === "exported_kpis.csv") ||
    kpiEntries[0];
  const seriesEntries = csvEntries.filter((entry) => !isKpiFile(entry.fileName));
  const warnings = [];
  const fingerprint = csvEntries
    .map((entry) => `${entry.relativePath}:${entry.file.size}:${entry.file.lastModified}`)
    .sort()
    .join("|");

  let kpis = null;
  if (kpiEntry) {
    const parsedKpis = await parseCsvEntry(kpiEntry);
    warnings.push(...parsedKpis.warnings);
    kpis = {
      fileName: kpiEntry.fileName,
      rows: parsedKpis.rows,
      columns: parsedKpis.columns,
      labelKey: findKpiLabelKey(parsedKpis.rows, parsedKpis.columns)
    };
  } else {
    warnings.push("No KPI file found.");
  }

  const parsedSeries = await Promise.all(
    seriesEntries.map(async (entry) => {
      const parsed = await parseCsvEntry(entry);
      warnings.push(...parsed.warnings);
      return normalizeSeries(entry, group.path, parsed);
    })
  );

  const id = `${slugify(group.name)}-${hashText(fingerprint || group.path)}`;

  return {
    id,
    name: group.name,
    path: group.path,
    importedAt: new Date().toISOString(),
    fileCount: csvEntries.length,
    kpis,
    series: parsedSeries.sort((a, b) => a.label.localeCompare(b.label)),
    warnings
  };
}

async function parseCsvEntry(entry) {
  const text = await entry.file.text();
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => String(header || "").trim()
  });

  const rows = (result.data || [])
    .map(cleanRow)
    .filter((row) => Object.values(row).some((value) => value !== null && String(value).trim() !== ""));

  const columns = result.meta?.fields?.map((field) => String(field || "").trim()).filter(Boolean) || collectColumns(rows);
  const warnings = (result.errors || [])
    .filter((error) => error.type !== "Delimiter")
    .slice(0, 3)
    .map((error) => `${entry.fileName}: ${error.message}`);

  return {
    rows,
    columns: columns.length > 0 ? columns : collectColumns(rows),
    warnings
  };
}

function normalizeSeries(entry, simulationPath, parsed) {
  const relativeInsideSimulation = trimSimulationPrefix(entry.relativePath, simulationPath);
  const cleanName = relativeInsideSimulation.replace(/\.csv$/i, "");
  const resultKey = normalizeMatchKey(cleanName);
  const timeKey = findTimeKey(parsed.columns);
  const numericColumns = parsed.columns.filter((column) => {
    if (column === timeKey) return false;
    return parsed.rows.some((row) => isFiniteNumber(toNumber(row[column])));
  });

  return {
    id: hashText(`${entry.relativePath}:${entry.file.size}:${entry.file.lastModified}`),
    fileName: entry.fileName,
    relativePath: relativeInsideSimulation,
    resultKey,
    matchKey: resultKey,
    label: formatSeriesLabel(cleanName),
    category: categorizeSeries(cleanName),
    episode: extractEpisode(cleanName),
    rows: parsed.rows,
    columns: parsed.columns,
    numericColumns,
    timeKey
  };
}

function buildChartData(series, metric, maxPoints = 900) {
  if (!series || !metric) return [];

  const rawRows = series.rows
    .map((row, index) => {
      const value = toNumber(row[metric]);
      if (!isFiniteNumber(value)) return null;

      return {
        label: formatAxisLabel(row[series.timeKey], index),
        index,
        value
      };
    })
    .filter(Boolean);

  return downsample(rawRows, maxPoints);
}

function buildCompareChartData(simulations, sourceSeries, metric) {
  if (!sourceSeries || !metric || simulations.length < 2) {
    return { lines: [], data: [] };
  }

  const lines = simulations
    .map((simulation) => {
      const matchingSeries = findMatchingSeries(simulation, sourceSeries, metric);
      if (!matchingSeries) return null;

      return {
        simulation,
        series: matchingSeries,
        rows: buildChartData(matchingSeries, metric, null)
      };
    })
    .filter(Boolean)
    .filter((line) => line.rows.length > 0);

  if (lines.length < 2) {
    return { lines, data: [] };
  }

  const maxLength = Math.max(...lines.map((line) => line.rows.length));
  const step = Math.max(1, Math.ceil(maxLength / 900));
  const data = [];

  for (let index = 0; index < maxLength; index += step) {
    const point = {
      label: lines[0].rows[index]?.label ?? index
    };

    lines.forEach((line) => {
      point[line.simulation.id] = line.rows[index]?.value ?? null;
    });

    data.push(point);
  }

  return { lines, data };
}

function findMatchingSeries(simulation, sourceSeries, metric) {
  return (
    simulation.series.find((series) => series.matchKey === sourceSeries.matchKey && series.numericColumns.includes(metric)) ||
    simulation.series.find((series) => series.label === sourceSeries.label && series.numericColumns.includes(metric)) ||
    null
  );
}

function buildCompareKpiScopes(simulations) {
  const scopesById = new Map();

  simulations.forEach((simulation) => {
    if (!simulation.kpis) return;
    buildKpiScopes(simulation.kpis).forEach((scope) => {
      const current =
        scopesById.get(scope.id) ||
        {
          id: scope.id,
          label: scope.label,
          group: getCompareScopeGroup(scope),
          columnsBySimulationId: {}
        };
      current.columnsBySimulationId[simulation.id] = scope.column;
      scopesById.set(scope.id, current);
    });
  });

  return [...scopesById.values()].sort((left, right) => {
    const order = { community: 0, building: 1, other: 2 };
    const groupOrder = order[left.group] - order[right.group];
    if (groupOrder !== 0) return groupOrder;
    return compareNatural(left.label, right.label);
  });
}

function getCompareScopeGroup(scope) {
  if (scope.id === "community") return "community";
  if (/building|house|site|asset/i.test(`${scope.id} ${scope.label}`)) return "building";
  return "other";
}

function buildCompareScorecardRows(simulations, scope) {
  const definitionsById = new Map(KPI_SCORECARD_DEFINITIONS.map((definition) => [definition.id, definition]));
  const signalsBySimulation = new Map(
    simulations.map((simulation) => [simulation.id, getCompareScorecardSignalMap(simulation, scope)])
  );

  return KPI_SELECTED_DEFINITION_IDS.map((id) => {
    const definition = definitionsById.get(id);
    const signalsBySimulationId = {};
    simulations.forEach((simulation) => {
      signalsBySimulationId[simulation.id] =
        signalsBySimulation.get(simulation.id)?.get(id) || resolveKpiScorecardSignal([], definition);
    });

    return {
      id,
      definition,
      title: definition.title,
      description: definition.description,
      reportedCount: simulations.filter((simulation) => signalsBySimulationId[simulation.id]?.reported).length,
      bestSimulationIds: resolveBestCompareSimulationIds(definition, simulations, signalsBySimulationId),
      signalsBySimulationId
    };
  });
}

function getCompareScorecardSignalMap(simulation, scope) {
  const scopeColumn = scope?.columnsBySimulationId?.[simulation.id];
  const rows =
    simulation.kpis && scopeColumn
      ? getAllKpiRowsForScope(simulation.kpis, scopeColumn).filter((row) => isFiniteNumber(row.value))
      : [];
  const scorecard = buildKpiScorecard(rows);
  return new Map(scorecard.selectedSignals.map((signal) => [signal.id, signal]));
}

function resolveBestCompareSimulationIds(definition, simulations, signalsBySimulationId) {
  const direction = getKpiDefinitionCompareDirection(definition);
  if (direction === "neutral") return [];

  const comparable = simulations
    .map((simulation) => ({
      id: simulation.id,
      value: signalsBySimulationId[simulation.id]?.primary ?? null
    }))
    .filter((item) => isFiniteNumber(item.value));
  if (comparable.length === 0) return [];

  const score = (value) => (direction === "absolute-lower" ? Math.abs(value) : value);
  const bestScore =
    direction === "higher"
      ? Math.max(...comparable.map((item) => score(item.value)))
      : Math.min(...comparable.map((item) => score(item.value)));

  return comparable
    .filter((item) => Math.abs(score(item.value) - bestScore) < 1e-9)
    .map((item) => item.id);
}

function getKpiDefinitionCompareDirection(definition) {
  if (definition?.comparisonDirection === "higher-is-better") return "higher";
  if (definition?.comparisonDirection === "lower-is-better") return "lower";
  if (definition?.comparisonDirection === "closer-to-zero") return "absolute-lower";
  if (definition?.toneRule === "positive-saving" || definition?.toneRule === "service-rate" || definition?.toneRule === "higher-rate-better") {
    return "higher";
  }
  if (definition?.toneRule === "zero-risk" || definition?.toneRule === "lower-ratio-better" || definition?.toneRule === "lower-is-better") {
    return "lower";
  }
  return "neutral";
}

function formatCompareSignalDelta(signal, baselineSignal, definition) {
  const value = signal?.primary ?? null;
  const baseline = baselineSignal?.primary ?? null;
  if (!isFiniteNumber(value) || !isFiniteNumber(baseline)) return null;

  const delta = value - baseline;
  if (Math.abs(delta) < 1e-9) {
    return { label: "Equal", tone: "neutral" };
  }

  return {
    label: `${formatCompareSignedValue(delta, signal || definition)} vs baseline`,
    tone: scoreCompareValueAgainstBaseline(definition, value, baseline)
  };
}

function formatCompareSignedValue(value, signal) {
  const absolute = Math.abs(value);
  const formatted = formatKpiValue(absolute, signal?.valueStyle || "number", signal?.unit || "");
  return `${value > 0 ? "+" : "-"}${formatted}`;
}

function scoreCompareValueAgainstBaseline(definition, value, baseline) {
  if (!isFiniteNumber(value) || !isFiniteNumber(baseline) || Math.abs(value - baseline) < 1e-9) return "neutral";
  const direction = getKpiDefinitionCompareDirection(definition);
  if (direction === "higher") return value > baseline ? "better" : "worse";
  if (direction === "lower") return value < baseline ? "better" : "worse";
  if (direction === "absolute-lower") return Math.abs(value) < Math.abs(baseline) ? "better" : "worse";
  return "neutral";
}

function buildCompareKpiMatrixRows(simulations, scope, showUnion) {
  const rowsByKey = new Map();

  simulations.forEach((simulation) => {
    buildCompareKpiDrilldownRows(simulation, scope).forEach((row) => {
      const current =
        rowsByKey.get(row.key) ||
        {
          key: row.key,
          label: row.label,
          family: row.family,
          subfamily: row.subfamily,
          sourceLabels: [],
          unit: row.unit,
          valuesBySimulationId: {}
        };
      current.valuesBySimulationId[simulation.id] = row;
      current.sourceLabels = unique([...current.sourceLabels, ...row.sourceLabels]).sort(compareNatural);
      current.unit = current.unit || row.unit;
      rowsByKey.set(row.key, current);
    });
  });

  return [...rowsByKey.values()]
    .map((row) => ({
      ...row,
      reportedCount: simulations.filter((simulation) => row.valuesBySimulationId[simulation.id]?.reported).length
    }))
    .filter((row) => showUnion || row.reportedCount === simulations.length)
    .sort((left, right) => {
      const familySort = compareKpiFamilies(left.family, right.family);
      if (familySort !== 0) return familySort;
      const subfamilySort = compareNatural(left.subfamily.label, right.subfamily.label);
      if (subfamilySort !== 0) return subfamilySort;
      return compareNatural(left.label, right.label);
    });
}

function buildCompareKpiDrilldownRows(simulation, scope) {
  const scopeColumn = scope?.columnsBySimulationId?.[simulation.id];
  if (!simulation.kpis || !scopeColumn) return [];

  return buildKpiDrilldownSections(getAllKpiRowsForScope(simulation.kpis, scopeColumn), {
    familyFilter: "all",
    search: "",
    showNa: true,
    selectedScope: { ...scope, column: scopeColumn }
  }).flatMap((familySection) =>
    familySection.subfamilies.flatMap((subfamily) =>
      subfamily.rows.map((row) => ({
        ...row,
        family: familySection.family,
        subfamily: { key: subfamily.key, label: subfamily.label }
      }))
    )
  );
}

function buildCompareKpiFamilyOptions(rows) {
  return unique(rows.map((row) => row.family))
    .sort(compareKpiFamilies)
    .map((family) => ({ family, label: formatKpiFamilyLabel(family) }));
}

function getCompareSimulationReferenceSummary(simulation, scope) {
  const scopeColumn = scope?.columnsBySimulationId?.[simulation.id];
  if (!simulation.kpis || !scopeColumn) return "Reference: not exported";
  return getKpiReferenceSummary(getAllKpiRowsForScope(simulation.kpis, scopeColumn));
}

function formatCompareMatrixValue(entry, row) {
  if (!entry || !isFiniteNumber(entry.primary)) return "N/A";
  return formatKpiDrilldownValue(entry.primary, entry.unit || row.unit);
}

function getKpiScoreRows(kpis) {
  return kpis.rows
    .map((row, index) => {
      const label = getKpiLabel(row, kpis);
      const aggregate = aggregateKpiRow(row, kpis.columns, kpis.labelKey);
      if (!isFiniteNumber(aggregate.value)) return null;

      return {
        key: `${label}-${index}`,
        label,
        shortLabel: shortenLabel(label),
        value: aggregate.value,
        sourceColumn: aggregate.sourceColumn
      };
    })
    .filter(Boolean);
}

function buildKpiScopes(kpis) {
  const numericColumns = kpis.columns
    .filter((column) => column !== kpis.labelKey)
    .filter((column) => kpis.rows.some((row) => isFiniteNumber(toNumber(row[column]))));
  const communityColumn =
    numericColumns.find((column) => /district|community|total|all/i.test(column)) || numericColumns[0];
  const buildingColumns = numericColumns
    .filter((column) => column !== communityColumn)
    .filter((column) => /building|house|site|asset/i.test(column))
    .sort(compareNatural);
  const otherColumns = numericColumns
    .filter((column) => column !== communityColumn && !buildingColumns.includes(column))
    .sort(compareNatural);

  return [
    communityColumn
      ? {
          id: "community",
          label: communityColumn === "District" ? "Community" : formatKpiScopeLabel(communityColumn),
          column: communityColumn
        }
      : null,
    ...buildingColumns.map((column) => ({
      id: normalizeColumnName(column) || column,
      label: formatKpiScopeLabel(column),
      column
    })),
    ...otherColumns.map((column) => ({
      id: normalizeColumnName(column) || column,
      label: formatKpiScopeLabel(column),
      column
    }))
  ].filter(Boolean);
}

function formatKpiScopeLabel(column) {
  return String(column || "")
    .replace(/^district$/i, "Community")
    .replace(/_/g, " ")
    .replace(/\bbuilding\s+(\d+)/i, "Building $1")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getKpiScoreRowsForScope(kpis, scopeColumn) {
  if (!scopeColumn) return getKpiScoreRows(kpis);

  return kpis.rows
    .map((row, index) => {
      const label = getKpiLabel(row, kpis);
      const value = toNumber(row[scopeColumn]);
      if (!isFiniteNumber(value)) return null;

      return {
        key: `${scopeColumn}-${label}-${index}`,
        label,
        shortLabel: shortenLabel(label),
        value,
        sourceColumn: scopeColumn
      };
    })
    .filter(Boolean);
}

function getAllKpiRowsForScope(kpis, scopeColumn) {
  if (!scopeColumn) {
    return kpis.rows.map((row, index) => {
      const label = getKpiLabel(row, kpis);
      const aggregate = aggregateKpiRow(row, kpis.columns, kpis.labelKey);
      return {
        key: `${label}-${index}`,
        label,
        shortLabel: shortenLabel(label),
        value: isFiniteNumber(aggregate.value) ? aggregate.value : null,
        sourceColumn: aggregate.sourceColumn
      };
    });
  }

  return kpis.rows.map((row, index) => {
    const label = getKpiLabel(row, kpis);
    const value = toNumber(row[scopeColumn]);
    return {
      key: `${scopeColumn}-${label}-${index}`,
      label,
      shortLabel: shortenLabel(label),
      value: isFiniteNumber(value) ? value : null,
      sourceColumn: scopeColumn
    };
  });
}

function kpiCandidate(key, options = {}) {
  return { key, ...options };
}

const KPI_SCORECARD_DEFINITIONS = [
  {
    id: "cost-saving-reference",
    title: "Cost saving vs reference",
    description: "Positive values mean the policy is cheaper than the exported reference or baseline.",
    valueStyle: "currency",
    unit: "EUR",
    toneRule: "positive-saving",
    referenceMode: "compare",
    comparisonDirection: "higher-is-better",
    computedDelta: "reference-minus-policy",
    primaryRole: "delta",
    candidates: {
      primary: [
        "cost_saving_vs_bau_eur",
        kpiCandidate("district_cost_total_delta_to_business_as_usual_eur", { transform: "negate" }),
        kpiCandidate("building_cost_total_delta_to_business_as_usual_eur", { transform: "negate" }),
        kpiCandidate("cost_delta_vs_bau_eur", { transform: "negate" }),
        "cost_saving_vs_reference_eur",
        kpiCandidate("cost_delta_vs_reference_eur", { transform: "negate" }),
        "cost_saving_vs_rbcsmart_eur",
        kpiCandidate("district_cost_total_delta_eur", { transform: "negate" }),
        kpiCandidate("building_cost_total_delta_eur", { transform: "negate" }),
        kpiCandidate("cost", {
          title: "Cost",
          description: "Total cost signal for the selected scope.",
          referenceMode: "none",
          valueStyle: "number",
          toneRule: "lower-is-better"
        })
      ],
      policy: ["district_cost_total_control_eur", "building_cost_total_control_eur", "community_cost_eur", "cost_total_control"],
      reference: [
        "district_cost_total_business_as_usual_eur",
        "building_cost_total_business_as_usual_eur",
        "district_cost_total_baseline_eur",
        "building_cost_total_baseline_eur",
        "cost_total_reference",
        "cost_total_baseline"
      ],
      delta: [
        kpiCandidate("district_cost_total_delta_to_business_as_usual_eur", { transform: "negate" }),
        kpiCandidate("building_cost_total_delta_to_business_as_usual_eur", { transform: "negate" }),
        kpiCandidate("district_cost_total_delta_eur", { transform: "negate" }),
        kpiCandidate("building_cost_total_delta_eur", { transform: "negate" }),
        kpiCandidate("cost_total_delta", { transform: "negate" })
      ],
      ratio: [
        "district_cost_ratio_to_business_as_usual_total_ratio",
        "building_cost_ratio_to_business_as_usual_total_ratio",
        "district_cost_ratio_to_baseline_total_ratio",
        "building_cost_ratio_to_baseline_total_ratio",
        "cost_ratio_to_baseline"
      ]
    }
  },
  {
    id: "ev-min-feasible",
    title: "EV minimum feasible service",
    description: "Share of feasible EV departures that meet the minimum acceptable service level.",
    valueStyle: "percentage",
    unit: "%",
    toneRule: "service-rate",
    referenceMode: "none",
    candidates: {
      primary: [
        "ev_min_acceptable_feasible_rate",
        "district_ev_performance_departure_min_acceptable_feasible_ratio",
        "district_ev_performance_departure_min_acceptable_ratio",
        "district_ev_performance_departure_success_ratio",
        "building_ev_performance_departure_min_acceptable_feasible_ratio",
        "building_ev_performance_departure_min_acceptable_ratio",
        "building_ev_performance_departure_success_ratio"
      ]
    }
  },
  {
    id: "ev-within-tolerance",
    title: "EV within tolerance",
    description: "Share of feasible EV departures that finish within the target SOC tolerance band.",
    valueStyle: "percentage",
    unit: "%",
    toneRule: "service-rate",
    referenceMode: "none",
    candidates: {
      primary: [
        "ev_within_tolerance_rate",
        "district_ev_performance_departure_within_tolerance_feasible_ratio",
        "district_ev_performance_departure_within_tolerance_ratio",
        "building_ev_performance_departure_within_tolerance_feasible_ratio",
        "building_ev_performance_departure_within_tolerance_ratio"
      ]
    }
  },
  {
    id: "electrical-violations",
    title: "Electrical violations",
    description: "Energy associated with electrical service phase violations.",
    valueStyle: "energy",
    unit: "kWh",
    toneRule: "zero-risk",
    referenceMode: "none",
    candidates: {
      primary: [
        "electrical_violation_kwh",
        "electrical_violations_kwh",
        "district_electrical_service_phase_violations_energy_total_kwh",
        "building_electrical_service_phase_violations_energy_total_kwh"
      ]
    }
  },
  {
    id: "battery-throughput",
    title: "Battery throughput",
    description: "Total battery cycling energy: charge plus discharge throughput.",
    valueStyle: "energy",
    unit: "kWh",
    toneRule: "neutral",
    referenceMode: "compare",
    comparisonDirection: "lower-is-better",
    primaryRole: "policy",
    candidates: {
      primary: ["district_battery_total_throughput_kwh", "building_battery_total_throughput_kwh", "battery_throughput_kwh"],
      policy: ["district_battery_total_throughput_control_kwh", "building_battery_total_throughput_control_kwh"],
      reference: [
        "district_battery_total_throughput_business_as_usual_kwh",
        "building_battery_total_throughput_business_as_usual_kwh",
        "district_battery_total_throughput_baseline_kwh",
        "building_battery_total_throughput_baseline_kwh"
      ],
      delta: [
        "district_battery_total_throughput_delta_to_business_as_usual_kwh",
        "building_battery_total_throughput_delta_to_business_as_usual_kwh",
        "district_battery_total_throughput_delta_kwh",
        "building_battery_total_throughput_delta_kwh"
      ]
    }
  },
  {
    id: "v2g-export",
    title: "V2G export",
    description: "Total EV energy exported back to the community or grid.",
    valueStyle: "energy",
    unit: "kWh",
    toneRule: "neutral",
    referenceMode: "compare",
    comparisonDirection: "neutral",
    primaryRole: "policy",
    candidates: {
      primary: ["district_ev_total_v2g_export_kwh", "building_ev_total_v2g_export_kwh", "v2g_export_kwh"],
      policy: ["district_ev_total_v2g_export_control_kwh", "building_ev_total_v2g_export_control_kwh"],
      reference: [
        "district_ev_total_v2g_export_business_as_usual_kwh",
        "building_ev_total_v2g_export_business_as_usual_kwh",
        "district_ev_total_v2g_export_baseline_kwh",
        "building_ev_total_v2g_export_baseline_kwh"
      ],
      delta: [
        "district_ev_total_v2g_export_delta_to_business_as_usual_kwh",
        "building_ev_total_v2g_export_delta_to_business_as_usual_kwh",
        "district_ev_total_v2g_export_delta_kwh",
        "building_ev_total_v2g_export_delta_kwh"
      ]
    }
  },
  {
    id: "solar-self-consumption",
    title: "Solar self-consumption",
    description: "Share of generated solar energy consumed locally.",
    valueStyle: "percentage",
    unit: "%",
    toneRule: "higher-rate-better",
    referenceMode: "compare",
    comparisonDirection: "higher-is-better",
    primaryRole: "policy",
    candidates: {
      primary: [
        "district_solar_self_consumption_ratio_self_consumption_ratio",
        "building_solar_self_consumption_ratio_self_consumption_ratio",
        "community_solar_self_consumption_rate",
        "solar_self_consumption"
      ],
      policy: [
        "district_solar_self_consumption_ratio_self_consumption_control_ratio",
        "building_solar_self_consumption_ratio_self_consumption_control_ratio"
      ],
      reference: [
        "district_solar_self_consumption_ratio_self_consumption_business_as_usual_ratio",
        "building_solar_self_consumption_ratio_self_consumption_business_as_usual_ratio",
        "district_solar_self_consumption_ratio_self_consumption_baseline_ratio",
        "building_solar_self_consumption_ratio_self_consumption_baseline_ratio"
      ],
      delta: [
        "district_solar_self_consumption_ratio_self_consumption_delta_to_business_as_usual_ratio",
        "building_solar_self_consumption_ratio_self_consumption_delta_to_business_as_usual_ratio",
        "district_solar_self_consumption_ratio_self_consumption_delta_ratio",
        "building_solar_self_consumption_ratio_self_consumption_delta_ratio"
      ]
    }
  },
  {
    id: "community-import",
    title: "Community import",
    description: "Total imported energy for the selected scope.",
    valueStyle: "energy",
    unit: "kWh",
    toneRule: "neutral",
    referenceMode: "compare",
    comparisonDirection: "lower-is-better",
    primaryRole: "policy",
    candidates: {
      primary: ["district_energy_grid_total_import_control_kwh", "building_energy_grid_total_import_control_kwh", "community_import_kwh"],
      policy: ["district_energy_grid_total_import_control_kwh", "building_energy_grid_total_import_control_kwh"],
      reference: [
        "district_energy_grid_total_import_business_as_usual_kwh",
        "building_energy_grid_total_import_business_as_usual_kwh",
        "district_energy_grid_total_import_baseline_kwh",
        "building_energy_grid_total_import_baseline_kwh"
      ],
      delta: [
        "district_energy_grid_total_import_delta_to_business_as_usual_kwh",
        "building_energy_grid_total_import_delta_to_business_as_usual_kwh",
        "district_energy_grid_total_import_delta_kwh",
        "building_energy_grid_total_import_delta_kwh"
      ]
    }
  },
  {
    id: "community-export",
    title: "Community export",
    description: "Total exported energy for the selected scope.",
    valueStyle: "energy",
    unit: "kWh",
    toneRule: "neutral",
    referenceMode: "compare",
    comparisonDirection: "lower-is-better",
    primaryRole: "policy",
    candidates: {
      primary: ["district_energy_grid_total_export_control_kwh", "building_energy_grid_total_export_control_kwh", "community_export_kwh"],
      policy: ["district_energy_grid_total_export_control_kwh", "building_energy_grid_total_export_control_kwh"],
      reference: [
        "district_energy_grid_total_export_business_as_usual_kwh",
        "building_energy_grid_total_export_business_as_usual_kwh",
        "district_energy_grid_total_export_baseline_kwh",
        "building_energy_grid_total_export_baseline_kwh"
      ],
      delta: [
        "district_energy_grid_total_export_delta_to_business_as_usual_kwh",
        "building_energy_grid_total_export_delta_to_business_as_usual_kwh",
        "district_energy_grid_total_export_delta_kwh",
        "building_energy_grid_total_export_delta_kwh"
      ]
    }
  },
  {
    id: "community-net-exchange",
    title: "Community net exchange",
    description: "Net grid exchange for the selected scope.",
    valueStyle: "energy",
    unit: "kWh",
    toneRule: "neutral",
    referenceMode: "compare",
    comparisonDirection: "closer-to-zero",
    primaryRole: "policy",
    candidates: {
      primary: [
        "district_energy_grid_total_net_exchange_control_kwh",
        "building_energy_grid_total_net_exchange_control_kwh",
        "community_net_exchange_kwh"
      ],
      policy: ["district_energy_grid_total_net_exchange_control_kwh", "building_energy_grid_total_net_exchange_control_kwh"],
      reference: [
        "district_energy_grid_total_net_exchange_business_as_usual_kwh",
        "building_energy_grid_total_net_exchange_business_as_usual_kwh",
        "district_energy_grid_total_net_exchange_baseline_kwh",
        "building_energy_grid_total_net_exchange_baseline_kwh"
      ],
      delta: [
        "district_energy_grid_total_net_exchange_delta_to_business_as_usual_kwh",
        "building_energy_grid_total_net_exchange_delta_to_business_as_usual_kwh",
        "district_energy_grid_total_net_exchange_delta_kwh",
        "building_energy_grid_total_net_exchange_delta_kwh"
      ]
    }
  },
  {
    id: "daily-peak-ratio",
    title: "Daily peak ratio",
    description: "Average daily peak ratio against BAU or simulator baseline. Values below 1 are better.",
    valueStyle: "ratio",
    unit: "x",
    toneRule: "lower-ratio-better",
    referenceMode: "compare",
    comparisonDirection: "lower-is-better",
    primaryRole: "ratio",
    candidates: {
      primary: [
        "peak_daily_ratio_to_bau",
        "district_energy_grid_shape_quality_peak_daily_average_to_business_as_usual_ratio",
        "building_energy_grid_shape_quality_peak_daily_average_to_business_as_usual_ratio",
        "peak_daily_ratio_to_baseline",
        "district_energy_grid_shape_quality_peak_daily_average_to_baseline_ratio",
        "building_energy_grid_shape_quality_peak_daily_average_to_baseline_ratio",
        kpiCandidate("daily_peak", {
          title: "Daily peak",
          description: "Daily peak demand pressure for the selected scope.",
          referenceMode: "none",
          valueStyle: "number",
          toneRule: "lower-is-better"
        })
      ],
      ratio: [
        "peak_daily_ratio_to_bau",
        "district_energy_grid_shape_quality_peak_daily_average_to_business_as_usual_ratio",
        "building_energy_grid_shape_quality_peak_daily_average_to_business_as_usual_ratio",
        "peak_daily_ratio_to_baseline",
        "district_energy_grid_shape_quality_peak_daily_average_to_baseline_ratio",
        "building_energy_grid_shape_quality_peak_daily_average_to_baseline_ratio"
      ],
      policy: ["district_energy_grid_shape_quality_peak_daily_average_control_kwh", "building_energy_grid_shape_quality_peak_daily_average_control_kwh"],
      reference: ["district_energy_grid_shape_quality_peak_daily_average_baseline_kwh", "building_energy_grid_shape_quality_peak_daily_average_baseline_kwh"],
      delta: ["district_energy_grid_shape_quality_peak_daily_average_delta_kwh", "building_energy_grid_shape_quality_peak_daily_average_delta_kwh"]
    }
  },
  {
    id: "all-time-peak-ratio",
    title: "All-time peak ratio",
    description: "All-time peak ratio against BAU or simulator baseline. Values below 1 are better.",
    valueStyle: "ratio",
    unit: "x",
    toneRule: "lower-ratio-better",
    referenceMode: "compare",
    comparisonDirection: "lower-is-better",
    primaryRole: "ratio",
    candidates: {
      primary: [
        "peak_all_time_ratio_to_bau",
        "district_energy_grid_shape_quality_peak_all_time_average_to_business_as_usual_ratio",
        "building_energy_grid_shape_quality_peak_all_time_average_to_business_as_usual_ratio",
        "peak_all_time_ratio_to_baseline",
        "district_energy_grid_shape_quality_peak_all_time_average_to_baseline_ratio",
        "building_energy_grid_shape_quality_peak_all_time_average_to_baseline_ratio"
      ],
      ratio: [
        "peak_all_time_ratio_to_bau",
        "district_energy_grid_shape_quality_peak_all_time_average_to_business_as_usual_ratio",
        "building_energy_grid_shape_quality_peak_all_time_average_to_business_as_usual_ratio",
        "peak_all_time_ratio_to_baseline",
        "district_energy_grid_shape_quality_peak_all_time_average_to_baseline_ratio",
        "building_energy_grid_shape_quality_peak_all_time_average_to_baseline_ratio"
      ]
    }
  },
  {
    id: "load-factor-penalty",
    title: "Load factor penalty",
    description: "Load-factor penalty ratio against BAU or simulator baseline. Values below 1 are better.",
    valueStyle: "ratio",
    unit: "x",
    toneRule: "lower-ratio-better",
    referenceMode: "compare",
    comparisonDirection: "lower-is-better",
    primaryRole: "ratio",
    candidates: {
      primary: [
        "load_factor_penalty_ratio_to_bau",
        "district_energy_grid_shape_quality_load_factor_penalty_daily_average_to_business_as_usual_ratio",
        "district_energy_grid_shape_quality_load_factor_penalty_monthly_average_to_business_as_usual_ratio",
        "load_factor_penalty_ratio_to_baseline",
        "district_energy_grid_shape_quality_load_factor_penalty_daily_average_to_baseline_ratio",
        "district_energy_grid_shape_quality_load_factor_penalty_monthly_average_to_baseline_ratio",
        "building_energy_grid_shape_quality_load_factor_penalty_daily_average_to_baseline_ratio",
        "building_energy_grid_shape_quality_load_factor_penalty_monthly_average_to_baseline_ratio",
        "load_factor_penalty_ratio"
      ],
      ratio: [
        "load_factor_penalty_ratio_to_bau",
        "district_energy_grid_shape_quality_load_factor_penalty_daily_average_to_business_as_usual_ratio",
        "district_energy_grid_shape_quality_load_factor_penalty_monthly_average_to_business_as_usual_ratio",
        "load_factor_penalty_ratio_to_baseline",
        "district_energy_grid_shape_quality_load_factor_penalty_daily_average_to_baseline_ratio",
        "district_energy_grid_shape_quality_load_factor_penalty_monthly_average_to_baseline_ratio",
        "building_energy_grid_shape_quality_load_factor_penalty_daily_average_to_baseline_ratio",
        "building_energy_grid_shape_quality_load_factor_penalty_monthly_average_to_baseline_ratio"
      ]
    }
  }
];

const KPI_PRIORITY_DEFINITION_IDS = [
  "cost-saving-reference",
  "ev-min-feasible",
  "ev-within-tolerance",
  "electrical-violations",
  "battery-throughput",
  "solar-self-consumption"
];

const KPI_SELECTED_DEFINITION_IDS = [
  "cost-saving-reference",
  "ev-min-feasible",
  "ev-within-tolerance",
  "electrical-violations",
  "battery-throughput",
  "v2g-export",
  "solar-self-consumption",
  "community-import",
  "community-export",
  "community-net-exchange",
  "daily-peak-ratio",
  "all-time-peak-ratio",
  "load-factor-penalty"
];

function buildKpiScorecard(rows) {
  const definitionsById = new Map(KPI_SCORECARD_DEFINITIONS.map((definition) => [definition.id, definition]));
  const signalsById = new Map(
    KPI_SCORECARD_DEFINITIONS.map((definition) => [definition.id, resolveKpiScorecardSignal(rows, definition)])
  );
  const prioritySignals = KPI_PRIORITY_DEFINITION_IDS.map((id) => signalsById.get(id)).filter(Boolean);
  const selectedSignals = KPI_SELECTED_DEFINITION_IDS.map(
    (id) => signalsById.get(id) || resolveKpiScorecardSignal(rows, definitionsById.get(id))
  ).filter(Boolean);

  return {
    prioritySignals,
    selectedSignals,
    reportedCount: selectedSignals.filter((signal) => signal.reported).length
  };
}

function getKpiReferenceSummary(rows) {
  const source = inferKpiReferenceSourceFromLabel(rows.map((row) => row.label).join(" "));
  if (source === "bau") return "Reference: BAU";
  if (source === "baseline") return "Reference: legacy baseline";
  if (source === "reference") return "Reference: exported reference";
  return "Reference: not exported";
}

function resolveKpiScorecardSignal(rows, definition) {
  const candidates = definition?.candidates || {};
  const primaryMatch = findKpiCandidate(rows, candidates.primary || []);
  const policyMatch = findKpiCandidate(rows, candidates.policy || []);
  const referenceMatch = findKpiCandidate(rows, candidates.reference || []);
  const deltaMatch = findKpiCandidate(rows, candidates.delta || []);
  const ratioMatch = findKpiCandidate(rows, candidates.ratio || []);
  const overrides = primaryMatch?.candidate || {};
  const resolvedDefinition = {
    ...definition,
    title: overrides.title || definition.title,
    description: overrides.description || definition.description,
    referenceMode: overrides.referenceMode || definition.referenceMode || "compare",
    valueStyle: overrides.valueStyle || definition.valueStyle || "number",
    unit: overrides.unit || definition.unit,
    toneRule: overrides.toneRule || definition.toneRule || "neutral"
  };
  const policy =
    policyMatch?.value ??
    (resolvedDefinition.primaryRole === "policy" || resolvedDefinition.referenceMode === "none"
      ? primaryMatch?.value ?? null
      : null);
  const reference = referenceMatch?.value ?? null;
  const delta =
    deltaMatch?.value ??
    (isFiniteNumber(policy) && isFiniteNumber(reference) ? computeKpiDelta(policy, reference, resolvedDefinition) : null);
  const deltaPct =
    ratioToDeltaPct(ratioMatch?.value) ??
    (isFiniteNumber(delta) && isFiniteNumber(reference) && Math.abs(reference) > 1e-9
      ? (delta / Math.abs(reference)) * 100
      : null);
  const primary = pickKpiPrimaryValue({
    primaryMatch,
    policy,
    reference,
    delta,
    ratio: ratioMatch?.value ?? null,
    definition: resolvedDefinition
  });
  const sourceKeys = unique(
    [primaryMatch, policyMatch, referenceMatch, deltaMatch, ratioMatch]
      .filter(Boolean)
      .map((match) => match.row.key)
  );
  const signal = {
    id: resolvedDefinition.id,
    title: resolvedDefinition.title,
    description: resolvedDefinition.description,
    valueStyle: resolvedDefinition.valueStyle,
    unit: resolvedDefinition.unit || inferKpiUnit(primaryMatch?.row?.label || resolvedDefinition.title),
    toneRule: resolvedDefinition.toneRule,
    referenceMode: resolvedDefinition.referenceMode,
    comparisonDirection: resolvedDefinition.comparisonDirection || "neutral",
    reported: isFiniteNumber(primary) || isFiniteNumber(policy) || isFiniteNumber(reference) || isFiniteNumber(delta),
    primary,
    policy,
    reference,
    delta,
    deltaPct,
    sourceKeys,
    sourceLabel: primaryMatch?.row?.label || policyMatch?.row?.label || referenceMatch?.row?.label || null,
    referenceSource: inferKpiReferenceSourceFromLabel(
      referenceMatch?.row?.label || ratioMatch?.row?.label || deltaMatch?.row?.label || primaryMatch?.row?.label || ""
    )
  };
  signal.tone = scoreKpiSignalTone(signal);
  return signal;
}

function findKpiCandidate(rows, candidates) {
  for (const rawCandidate of candidates) {
    const candidate = typeof rawCandidate === "string" ? { key: rawCandidate } : rawCandidate;
    const row = rows.find((item) => rowMatchesKpiCandidate(item, candidate.key));
    if (!row || !isFiniteNumber(row.value)) continue;
    return {
      row,
      candidate,
      value: candidate.transform === "negate" ? -row.value : row.value
    };
  }

  return null;
}

function rowMatchesKpiCandidate(row, candidateKey) {
  const normalizedLabel = normalizeColumnName(row.label);
  const normalizedCandidate = normalizeColumnName(candidateKey);
  if (!normalizedLabel || !normalizedCandidate) return false;

  const tokens = String(candidateKey || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((token) => !["district", "building", "community"].includes(token));

  if (normalizedLabel === normalizedCandidate) return true;

  const isSpecificCandidate = tokens.length > 3;
  if (
    !isSpecificCandidate &&
    (normalizedLabel.includes(normalizedCandidate) || normalizedLabel.endsWith(normalizedCandidate))
  ) {
    return true;
  }

  if (isSpecificCandidate) return false;

  const roleTokens = ["business", "usual", "baseline", "delta", "control", "ratio", "reference"];
  const candidateHasRole = roleTokens.some((token) => normalizeColumnName(candidateKey).includes(token));
  const labelHasRole = roleTokens.some((token) => normalizedLabel.includes(token));
  if (labelHasRole && !candidateHasRole) return false;

  return tokens.length > 0 && tokens.every((token) => normalizedLabel.includes(normalizeColumnName(token)));
}

function pickKpiPrimaryValue({ primaryMatch, policy, delta, ratio, definition }) {
  if (definition.primaryRole === "ratio" && isFiniteNumber(ratio)) return ratio;
  if (definition.primaryRole === "delta" && isFiniteNumber(delta)) return delta;
  if (definition.primaryRole === "policy" && isFiniteNumber(policy)) return policy;
  if (primaryMatch && isFiniteNumber(primaryMatch.value)) return primaryMatch.value;
  if (isFiniteNumber(delta)) return delta;
  if (isFiniteNumber(policy)) return policy;
  return null;
}

function computeKpiDelta(policy, reference, definition) {
  if (definition.computedDelta === "reference-minus-policy") return reference - policy;
  return policy - reference;
}

function ratioToDeltaPct(value) {
  if (!isFiniteNumber(value)) return null;
  if (Math.abs(value) <= 10) return (value - 1) * 100;
  return value;
}

function scoreKpiSignalTone(signal) {
  if (!signal.reported) return "unknown";
  if (isFiniteNumber(signal.delta)) {
    if (signal.comparisonDirection === "lower-is-better") {
      if (signal.delta < -1e-9) return "better";
      if (signal.delta > 1e-9) return "worse";
    }
    if (signal.comparisonDirection === "higher-is-better") {
      if (signal.delta > 1e-9) return "better";
      if (signal.delta < -1e-9) return "worse";
    }
    if (signal.comparisonDirection === "closer-to-zero" && isFiniteNumber(signal.policy) && isFiniteNumber(signal.reference)) {
      if (Math.abs(signal.policy) < Math.abs(signal.reference)) return "better";
      if (Math.abs(signal.policy) > Math.abs(signal.reference)) return "worse";
    }
  }

  const value = signal.primary;
  if (!isFiniteNumber(value)) return "unknown";
  if (signal.toneRule === "positive-saving") {
    if (value > 1e-9) return "better";
    if (value < -1e-9) return "worse";
    return "neutral";
  }
  if (signal.toneRule === "service-rate") {
    const percent = normalizePercent(value);
    if (percent >= 98) return "better";
    if (percent >= 95) return "neutral";
    return "worse";
  }
  if (signal.toneRule === "zero-risk") {
    return Math.abs(value) < 1e-9 ? "better" : "worse";
  }
  if (signal.toneRule === "lower-ratio-better") {
    if (value <= 0.98) return "better";
    if (value <= 1.02) return "neutral";
    return "worse";
  }
  if (signal.toneRule === "higher-rate-better") {
    const percent = normalizePercent(value);
    if (percent >= 80) return "better";
    if (percent >= 50) return "neutral";
    return "worse";
  }
  if (signal.toneRule === "lower-is-better") {
    return getKpiTone({ label: signal.title, value });
  }
  return "neutral";
}

function resolveKpiComparison(signal) {
  const referenceLabel = formatKpiReferenceLabel(signal.referenceSource);
  if (signal.valueStyle === "ratio" && isFiniteNumber(signal.primary)) {
    const ratioDelta = (signal.primary - 1) * 100;
    const ratioDeltaLabel = `${ratioDelta > 0 ? "+" : ""}${formatNumber(ratioDelta)}%`;
    return {
      tone: signal.tone || "unknown",
      policyLabel: "Ratio",
      policy: formatKpiScorecardValue(signal),
      hasReference: true,
      referenceLabel: `${referenceLabel} parity`,
      reference: "1x",
      deltaLabel: "Delta vs parity",
      delta: ratioDeltaLabel
    };
  }

  return {
    tone: signal.tone || "unknown",
    policyLabel: "Policy",
    policy: formatKpiScorecardField(signal.policy ?? signal.primary, signal),
    hasReference: isFiniteNumber(signal.reference),
    referenceLabel,
    reference: formatKpiScorecardField(signal.reference, signal),
    deltaLabel: isFiniteNumber(signal.deltaPct) ? `Delta vs ${referenceLabel} (${formatNumber(signal.deltaPct)}%)` : `Delta vs ${referenceLabel}`,
    delta: formatKpiScorecardField(signal.delta, signal)
  };
}

function inferKpiReferenceSourceFromLabel(label) {
  const lower = String(label || "").toLowerCase();
  if (lower.includes("business_as_usual") || lower.includes("business as usual") || lower.includes("vs_bau") || /\bbau\b/.test(lower)) {
    return "bau";
  }
  if (lower.includes("baseline") || lower.includes("to_baseline")) return "baseline";
  if (lower.includes("reference") || lower.includes("to_reference")) return "reference";
  return null;
}

function formatKpiReferenceLabel(source) {
  if (source === "bau") return "BAU";
  if (source === "baseline") return "Legacy baseline";
  if (source === "reference") return "Exported reference";
  return "Reference";
}

function formatKpiScorecardValue(signal) {
  return formatKpiScorecardField(signal.primary, signal);
}

function formatKpiScorecardField(value, signal) {
  if (!isFiniteNumber(value)) return "Not reported";
  return formatKpiValue(value, signal.valueStyle, signal.unit);
}

function formatKpiValue(value, valueStyle, unit) {
  if (!isFiniteNumber(value)) return "N/A";
  if (valueStyle === "currency") return `${formatNumber(value)} ${unit || "EUR"}`;
  if (valueStyle === "energy") return `${formatNumber(value)} ${unit || "kWh"}`;
  if (valueStyle === "percentage") return `${formatNumber(normalizePercent(value))}%`;
  if (valueStyle === "ratio") return `${formatNumber(value)}${unit && unit !== "x" ? ` ${unit}` : "x"}`;
  return `${formatNumber(value)}${unit && unit !== "x" ? ` ${unit}` : ""}`.trim();
}

function inferKpiValueStyle(label) {
  const lower = String(label || "").toLowerCase();
  if (/eur|cost|price|tariff/.test(lower)) return "currency";
  if (/kwh|energy|import|export|throughput|consumption/.test(lower)) return "energy";
  if (/ratio|rate|percent|percentage|self[-_\s]*consumption|tolerance|feasible/.test(lower)) return "percentage";
  return "number";
}

function inferKpiUnit(label) {
  const lower = String(label || "").toLowerCase();
  if (/eur|cost|price|tariff/.test(lower)) return "EUR";
  if (/kwh|energy|import|export|throughput|consumption/.test(lower)) return "kWh";
  if (/ratio|rate|percent|percentage|self[-_\s]*consumption|tolerance|feasible/.test(lower)) return "%";
  if (/co2|carbon|emission/.test(lower)) return "kg";
  return "";
}

function buildKpiFamilyOptions(rows) {
  const families = unique(rows.map((row) => classifyKpiFamily(row.label))).sort(compareKpiFamilies);
  return families.map((family) => ({ family, label: formatKpiFamilyLabel(family) }));
}

function buildKpiDrilldownSections(rows, { familyFilter, search, showNa, selectedScope }) {
  const normalizedSearch = search.trim().toLowerCase();
  const groups = new Map();

  rows.forEach((row) => {
    const family = classifyKpiFamily(row.label);
    if (familyFilter !== "all" && family !== familyFilter) return;

    const subfamily = classifyKpiSubfamily(row.label);
    const canonical = canonicalizeKpiGroup(row.label);
    const key = `${family}:${subfamily.key}:${canonical.key}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        family,
        subfamily,
        label: canonical.label,
        sourceLabels: [],
        sourceText: "",
        rows: [],
        roles: {
          control: [],
          reference: [],
          delta: [],
          ratio: [],
          absolute: []
        }
      });
    }

    const group = groups.get(key);
    const role = classifyKpiRowRole(row.label);
    group.rows.push(row);
    group.roles[role].push(row);
    group.sourceLabels.push(formatKpiDisplayLabel(row.label));
    group.sourceText = `${group.sourceText} ${row.label} ${row.sourceColumn}`;
  });

  const groupRows = [...groups.values()]
    .map((group) => finalizeKpiDrilldownGroup(group, selectedScope))
    .filter((row) => showNa || row.reported)
    .filter((row) => {
      if (!normalizedSearch) return true;
      return `${row.label} ${row.sourceLabels.join(" ")} ${row.family} ${row.subfamily.label}`
        .toLowerCase()
        .includes(normalizedSearch);
    })
    .sort((left, right) => compareNatural(left.label, right.label));

  const families = new Map();
  groupRows.forEach((row) => {
    if (!families.has(row.family)) {
      families.set(row.family, {
        family: row.family,
        label: formatKpiFamilyLabel(row.family),
        count: 0,
        subfamilies: new Map()
      });
    }
    const family = families.get(row.family);
    family.count += 1;
    if (!family.subfamilies.has(row.subfamily.key)) {
      family.subfamilies.set(row.subfamily.key, {
        key: row.subfamily.key,
        label: row.subfamily.label,
        rows: []
      });
    }
    family.subfamilies.get(row.subfamily.key).rows.push(row);
  });

  return [...families.values()]
    .sort((left, right) => compareKpiFamilies(left.family, right.family))
    .map((family) => ({
      ...family,
      subfamilies: [...family.subfamilies.values()].sort((left, right) => compareNatural(left.label, right.label))
    }));
}

function finalizeKpiDrilldownGroup(group, selectedScope) {
  const controlRow = pickFirstFinite(group.roles.control) || pickFirstFinite(group.roles.absolute);
  const referenceRow = pickFirstFinite(group.roles.reference);
  const deltaRow = pickFirstFinite(group.roles.delta);
  const ratioRow = pickFirstFinite(group.roles.ratio);
  const control = controlRow?.value ?? null;
  const reference = referenceRow?.value ?? null;
  const delta = deltaRow?.value ?? (isFiniteNumber(control) && isFiniteNumber(reference) ? control - reference : null);
  const deltaPct =
    ratioToDeltaPct(ratioRow?.value) ??
    (isFiniteNumber(delta) && isFiniteNumber(reference) && Math.abs(reference) > 1e-9
      ? (delta / Math.abs(reference)) * 100
      : null);
  const primary = control ?? delta ?? reference ?? ratioRow?.value ?? null;
  const sourceLabels = unique(group.sourceLabels).sort(compareNatural);
  const unit = inferKpiUnit(sourceLabels[0] || group.label);
  const tone = scoreKpiDrilldownTone(group.label, control, reference, delta, primary);
  return {
    key: group.key,
    family: group.family,
    subfamily: group.subfamily,
    label: group.label,
    sourceLabels,
    control,
    reference,
    referenceLabel: referenceRow ? formatKpiReferenceLabel(inferKpiReferenceSourceFromLabel(referenceRow.label)) : "N/A",
    delta,
    deltaPct,
    primary,
    unit,
    tone,
    reported: group.rows.some((row) => isFiniteNumber(row.value)),
    breakdown: group.rows
      .filter((row) => isFiniteNumber(row.value))
      .map((row) => ({
        entity: selectedScope?.label || row.sourceColumn,
        value: row.value
      }))
  };
}

function pickFirstFinite(rows) {
  return rows.find((row) => isFiniteNumber(row.value)) || null;
}

function classifyKpiRowRole(label) {
  const lower = String(label || "").toLowerCase();
  if (/delta|saving|improvement/.test(lower)) return "delta";
  if (/ratio.*(?:bau|baseline|reference)|(?:bau|baseline|reference).*ratio|to_business_as_usual|to_baseline|to_reference/.test(lower)) {
    return "ratio";
  }
  if (/baseline|business_as_usual|business as usual|\bbau\b|reference|rbcsmart/.test(lower)) return "reference";
  if (/control|policy|trained/.test(lower)) return "control";
  return "absolute";
}

function canonicalizeKpiGroup(label) {
  const raw = formatKpiDisplayLabel(label);
  const cleaned = raw
    .replace(/\b(District|Building|Community)\b/gi, "")
    .replace(/\b(Control|Policy|Trained|Baseline|Reference|Business|Usual|BAU|Delta|Saving|Savings|Ratio|To)\b/gi, "")
    .replace(/\b(EUR|KWH|KG|CO2|Percent|Percentage|Rate)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const labelText = cleaned || raw || "KPI";
  return {
    key: normalizeColumnName(labelText) || normalizeColumnName(label),
    label: labelText
  };
}

function classifyKpiFamily(label) {
  const lower = String(label || "").toLowerCase();
  if (/cost|price|tariff|reward|saving/.test(lower)) return "cost";
  if (/carbon|emission|co2/.test(lower)) return "emissions";
  if (/solar|pv|self[-_\s]*consumption/.test(lower)) return "solar_self_consumption";
  if (/ev|electric_vehicle|vehicle|v2g|charger|soc|departure|tolerance|min_acceptable/.test(lower)) return "ev";
  if (/battery|storage|throughput|cycle/.test(lower)) return "battery";
  if (/electrical|phase|violation|voltage|outage/.test(lower)) return "electrical_service_phase";
  if (/comfort|discomfort|resilience|unserved/.test(lower)) return "comfort_resilience";
  if (/equity|fairness/.test(lower)) return "equity";
  if (/grid|import|export|net_exchange|peak|ramping|load_factor|consumption|load/.test(lower)) return "energy_grid";
  return "other";
}

function classifyKpiSubfamily(label) {
  const lower = String(label || "").toLowerCase();
  if (/peak/.test(lower)) return { key: "peak", label: "Peak demand" };
  if (/load_factor/.test(lower)) return { key: "load-factor", label: "Load factor" };
  if (/ramping/.test(lower)) return { key: "ramping", label: "Ramping" };
  if (/import/.test(lower)) return { key: "import", label: "Import" };
  if (/export|v2g/.test(lower)) return { key: "export", label: "Export" };
  if (/net_exchange|net exchange/.test(lower)) return { key: "net-exchange", label: "Net exchange" };
  if (/departure|min_acceptable|tolerance|service/.test(lower)) return { key: "service", label: "Service" };
  if (/throughput|cycle/.test(lower)) return { key: "throughput", label: "Throughput" };
  if (/violation|phase|voltage/.test(lower)) return { key: "violations", label: "Violations" };
  if (/baseline|bau|reference|control|delta/.test(lower)) return { key: "comparison", label: "Comparison" };
  return { key: "reported", label: "Reported" };
}

function scoreKpiDrilldownTone(label, control, reference, delta, primary) {
  const lower = String(label || "").toLowerCase();
  if (isFiniteNumber(delta)) {
    if (/solar|service|saving|self[-_\s]*consumption|tolerance|feasible/.test(lower)) {
      if (delta > 1e-9) return "better";
      if (delta < -1e-9) return "worse";
    }
    if (/cost|carbon|emission|peak|ramping|penalty|violation|import|consumption/.test(lower)) {
      if (delta < -1e-9) return "better";
      if (delta > 1e-9) return "worse";
    }
  }
  if (isFiniteNumber(control) && isFiniteNumber(reference) && /net/.test(lower)) {
    if (Math.abs(control) < Math.abs(reference)) return "better";
    if (Math.abs(control) > Math.abs(reference)) return "worse";
  }
  if (isFiniteNumber(primary)) return getKpiTone({ label, value: primary });
  return "unknown";
}

function formatKpiFamilyLabel(family) {
  const labels = {
    cost: "Cost",
    energy_grid: "Energy grid",
    emissions: "Emissions",
    solar_self_consumption: "Solar self-consumption",
    ev: "EV service",
    battery: "Battery",
    electrical_service_phase: "Electrical service phase",
    comfort_resilience: "Comfort and resilience",
    equity: "Equity",
    other: "Other"
  };
  return labels[family] || formatKpiDisplayLabel(family);
}

function compareKpiFamilies(left, right) {
  const order = [
    "cost",
    "ev",
    "battery",
    "electrical_service_phase",
    "solar_self_consumption",
    "energy_grid",
    "emissions",
    "comfort_resilience",
    "equity",
    "other"
  ];
  const leftIndex = order.indexOf(left);
  const rightIndex = order.indexOf(right);
  if (leftIndex !== rightIndex) return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
  return compareNatural(left, right);
}

function resolveKpiFamilyIcon(family) {
  if (family === "cost") return CircleDollarSign;
  if (family === "emissions") return Factory;
  if (family === "solar_self_consumption") return Sun;
  if (family === "ev") return Car;
  if (family === "battery") return BatteryCharging;
  if (family === "electrical_service_phase" || family === "energy_grid") return PlugZap;
  if (family === "comfort_resilience") return Building2;
  if (family === "equity") return Table2;
  return Database;
}

function formatKpiDrilldownValue(value) {
  return isFiniteNumber(value) ? formatNumber(value) : "N/A";
}

function filterKpiRows(rows, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return rows;
  return rows.filter((row) => `${row.label} ${row.sourceColumn}`.toLowerCase().includes(normalizedQuery));
}

function formatKpiDisplayLabel(label) {
  const text = String(label || "").replace(/^district_/i, "").replace(/^building_/i, "");
  if (text.includes("_")) {
    return text
      .split("_")
      .filter(Boolean)
      .map((part) => (part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
      .join(" ");
  }
  return text;
}

function formatToneLabel(tone) {
  if (tone === "better") return "Better";
  if (tone === "worse") return "Worse";
  return "";
}

function getKpiTone(row) {
  const lower = row.label.toLowerCase();
  const higherIsBetter = /self[-_\s]*consumption|solar|satisfaction|service|saving|reward|score/.test(lower);
  const lowerIsBetter = /cost|carbon|emission|ramping|peak|penalty|violation|consumption/.test(lower);
  let tone = "neutral";
  if (higherIsBetter && row.value > 0) tone = "better";
  else if (higherIsBetter && row.value < 0) tone = "worse";
  else if (lowerIsBetter && row.value < 0) tone = "better";
  else if (lowerIsBetter && row.value > 0) tone = "worse";
  return tone;
}

function formatKpiScoreHint(label) {
  const lower = label.toLowerCase();
  if (/cost/.test(lower)) return "Total operating cost signal for the selected scope.";
  if (/carbon|emission/.test(lower)) return "Carbon impact for the selected scope.";
  if (/ramping/.test(lower)) return "Grid ramping pressure across the selected period.";
  if (/peak/.test(lower)) return "Daily peak demand pressure.";
  if (/solar/.test(lower)) return "Solar self-consumption performance.";
  return "Reported KPI value for the selected scope.";
}

function aggregateKpiRow(row, columns, labelKey) {
  const numericColumns = columns.filter((column) => column !== labelKey && isFiniteNumber(toNumber(row[column])));
  const preferredColumn = numericColumns.find((column) => /district|total|score|value|average|avg|all/i.test(column));

  if (preferredColumn) {
    return {
      value: toNumber(row[preferredColumn]),
      sourceColumn: preferredColumn
    };
  }

  const values = numericColumns.map((column) => toNumber(row[column])).filter(isFiniteNumber);
  if (values.length === 0) {
    return { value: null, sourceColumn: "no numeric value" };
  }

  return {
    value: values.reduce((sum, value) => sum + value, 0) / values.length,
    sourceColumn: values.length === 1 ? numericColumns[0] : "average"
  };
}

function orderKpiColumns(kpis) {
  const labelKey = kpis.labelKey;
  const rest = kpis.columns.filter((column) => column !== labelKey);

  return [labelKey, ...rest.sort(compareNatural)];
}

function findKpiLabelKey(rows, columns) {
  const exact = columns.find((column) => /^kpi$/i.test(column));
  if (exact) return exact;

  const named = columns.find((column) => /kpi|metric|name|indicator|cost/i.test(column));
  if (named) return named;

  const textual = columns.find((column) => rows.some((row) => !isFiniteNumber(toNumber(row[column]))));
  return textual || columns[0] || "KPI";
}

function getKpiLabel(row, kpis) {
  return String(row[kpis.labelKey] || "Unnamed KPI").trim();
}

function formatCell(value) {
  const numeric = toNumber(value);
  return isFiniteNumber(numeric) && String(value).trim() !== "" ? formatNumber(numeric) : String(value ?? "");
}

function cleanRow(row) {
  return Object.entries(row || {}).reduce((cleaned, [key, value]) => {
    const cleanKey = String(key || "").trim();
    if (!cleanKey) return cleaned;
    cleaned[cleanKey] = typeof value === "string" ? value.trim() : value;
    return cleaned;
  }, {});
}

function collectColumns(rows) {
  return unique(rows.flatMap((row) => Object.keys(row)));
}

function isRecognizedResultFile(fileName) {
  const lower = fileName.toLowerCase();
  return lower === "exported_kpis.csv" || lower === "kpis.csv" || /^exported_data_.*\.csv$/.test(lower);
}

function isKpiFile(fileName) {
  const lower = fileName.toLowerCase();
  return lower === "exported_kpis.csv" || lower === "kpis.csv" || /(^|_)kpis?(\.|_)/i.test(lower);
}

function findTimeKey(columns) {
  return (
    columns.find((column) => /^(timestamp|datetime|date_time|time|date)$/i.test(column)) ||
    columns.find((column) => /^(time_step|timestep|step|hour|month)$/i.test(column)) ||
    null
  );
}

function categorizeSeries(name) {
  const lower = name.toLowerCase();
  if (lower.includes("electric_vehicle") || lower.includes("_ev_")) return "Vehicles";
  if (lower.includes("battery") || lower.includes("charger") || lower.includes("pv")) return "Storage";
  if (lower.includes("price") || lower.includes("pricing") || lower.includes("tariff")) return "Pricing";
  if (lower.includes("building")) return "Buildings";
  return "Other";
}

function extractEpisode(name) {
  const match = name.match(/(?:^|_)ep(?:isode)?_?(\d+)/i);
  return match ? `ep${match[1]}` : "";
}

function normalizeMatchKey(name) {
  return name
    .replace(/^exported_data_?/i, "")
    .replace(/\.csv$/i, "")
    .replace(/\\/g, "/")
    .toLowerCase();
}

function formatSeriesLabel(name) {
  return name
    .replace(/^exported_data_?/i, "")
    .replace(/\.csv$/i, "")
    .split("/")
    .pop()
    .replace(/_/g, " ")
    .replace(/\b(ev|pv|kpi)\b/gi, (match) => match.toUpperCase())
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function shortenLabel(label) {
  const trimmed = label.replace(/\s+/g, " ").trim();
  return trimmed.length > 14 ? `${trimmed.slice(0, 13)}.` : trimmed;
}

function formatAxisLabel(value, fallbackIndex) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return fallbackIndex;
  }

  const text = String(value).trim();
  return text.length > 18 ? text.slice(0, 18) : text;
}

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  let cleaned = raw.replace(/\s/g, "").replace("%", "");
  if (/^-?\d+,\d+$/.test(cleaned)) {
    cleaned = cleaned.replace(",", ".");
  } else {
    cleaned = cleaned.replace(/,/g, "");
  }

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function formatNumber(value) {
  if (!isFiniteNumber(value)) return "-";

  const absolute = Math.abs(value);
  if (absolute >= 1000000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 1, notation: "compact" });
  }

  if (absolute >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }

  if (absolute > 0 && absolute < 0.001) {
    return value.toExponential(2);
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function compactNumber(value) {
  if (!isFiniteNumber(value)) return "";
  return value.toLocaleString(undefined, { maximumFractionDigits: 1, notation: "compact" });
}

function downsample(rows, maxPoints) {
  if (!maxPoints || rows.length <= maxPoints) return rows;

  const step = Math.ceil(rows.length / maxPoints);
  return rows.filter((_, index) => index % step === 0 || index === rows.length - 1);
}

function trimSimulationPrefix(relativePath, simulationPath) {
  const normalizedPath = normalizePath(relativePath);
  const normalizedSimulationPath = normalizePath(simulationPath);
  if (normalizedPath.startsWith(`${normalizedSimulationPath}/`)) {
    return normalizedPath.slice(normalizedSimulationPath.length + 1);
  }
  return normalizedPath;
}

function normalizePath(path) {
  return String(path || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function baseName(path) {
  const parts = normalizePath(path).split("/").filter(Boolean);
  return parts[parts.length - 1] || "Simulation";
}

function slugify(value) {
  return String(value || "simulation")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function hashText(input) {
  let hash = 0;
  const text = String(input || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function compareNatural(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

function unique(values) {
  return [...new Set(values)];
}

function mergeSimulations(current, incoming) {
  const byId = new Map(current.map((simulation) => [simulation.id, simulation]));
  incoming.forEach((simulation) => byId.set(simulation.id, simulation));
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

function sameArray(first, second) {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

export default App;
