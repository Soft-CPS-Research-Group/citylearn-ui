import { useRef, useState, useMemo, useEffect } from "react";
import { mergeSimulations, unique } from "./utils/collections.js";
import { createImportTask } from "./results/import-task.js";
import { ImportProgress } from "./components/ImportProgress.jsx";
import { GitHubMark, Footer } from "./components/Footer.jsx";
import { EmptyState, Sidebar } from "./components/Sidebar.jsx";
import { ImportContext } from "./components/results/ImportContext.jsx";
import { QualityPanel } from "./components/results/DataQuality.jsx";
import { TimeseriesView } from "./features/timeseries/TimeseriesView.jsx";
import { KpiView } from "./features/kpis/KpiView.jsx";
import { CompareView } from "./features/comparison/CompareView.jsx";
import { BarChart3, Table2 } from "lucide-react";

function App() {
  const fileInputRef = useRef(null);
  const importTask = useRef(null);
  const [progress, setProgress] = useState(null);
  const [importNotice, setImportNotice] = useState("");
  useEffect(() => () => importTask.current?.cancel(), []);
  const [simulations, setSimulations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [view, setView] = useState("timeseries");
  const [lastResultView, setLastResultView] = useState("timeseries");
  const [isParsing, setIsParsing] = useState(false);
  const [importError, setImportError] = useState("");
  const [simulationQuery, setSimulationQuery] = useState("");
  const [compareIds, setCompareIds] = useState([]);
  const [selectedEpisodeBySimulation, setSelectedEpisodeBySimulation] = useState({});
  const [selectedResultItem, setSelectedResultItem] = useState(null);

  const activeSimulation = useMemo(
    () => simulations.find((simulation) => simulation.id === activeId) || null,
    [simulations, activeId],
  );

  useEffect(() => {
    if (simulations.length === 0) {
      setActiveId(null);
      return;
    }

    if (!simulations.some((simulation) => simulation.id === activeId)) {
      setActiveId(simulations[0].id);
    }
  }, [simulations, activeId]);

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
    if (!files.length || importTask.current) return;
    setIsParsing(true);
    setImportError("");
    setImportNotice("");
    setProgress({ phase: "starting", files: 0, totalFiles: files.length });
    const accepted = [];
    const task = createImportTask(files, {
      onProgress: setProgress,
      onSimulation(simulation) {
        if (
          !simulation ||
          !(simulation.kpis || simulation.series.length || simulation.quality?.diagnostics.length)
        )
          return;
        const id = simulation.id;
        accepted.push(id);
        setSimulations((current) => mergeSimulations(current, [simulation]));
        // Select once per batch. Completed folders can be used while later ones read.
        if (accepted.length === 1) setActiveId(id);
        setCompareIds((current) => unique([...current, id]).slice(0, 4));
      },
    });
    importTask.current = task;
    try {
      const batch = await task.promise;
      if (batch.rejected.length)
        setImportError(batch.rejected.map((r) => `${r.folder}: ${r.message}`).join("; "));
      if (!accepted.length && !batch.rejected.length)
        throw new Error("No simulations could be parsed from the selected files.");
    } catch (error) {
      if (error.name === "AbortError")
        setImportNotice("Import cancelled. Completed folders remain available.");
      else setImportError(error.message || "The selected folder could not be imported.");
    } finally {
      if (importTask.current === task) {
        importTask.current = null;
        setIsParsing(false);
        setProgress(null);
      }
    }
  };

  const removeSimulation = (id) => {
    setSimulations((current) => current.filter((simulation) => simulation.id !== id));
    setCompareIds((current) => current.filter((compareId) => compareId !== id));
    setSelectedResultItem((current) => (current?.simulationId === id ? null : current));
    setSelectedEpisodeBySimulation((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
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

      {isParsing && (
        <ImportProgress progress={progress} onCancel={() => importTask.current?.cancel()} />
      )}
      {importNotice && (
        <p className="import-notice" role="status">
          {importNotice}
        </p>
      )}

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
                <span className="eyebrow">
                  {view === "compare" ? "KPI comparison" : "Selected simulation"}
                </span>
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

            {view !== "compare" && activeSimulation && (
              <ImportContext simulation={activeSimulation} />
            )}
            {view !== "compare" && activeSimulation && (
              <QualityPanel key={activeSimulation.id} simulation={activeSimulation} />
            )}
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
              <CompareView simulations={simulations} compareIds={compareIds} />
            )}
          </main>
        </div>
      )}

      <Footer />
    </div>
  );
}

const VIEW_TABS = [
  { id: "timeseries", label: "Timeseries", icon: BarChart3 },
  { id: "kpis", label: "KPIs", icon: Table2 },
];

export default App;
