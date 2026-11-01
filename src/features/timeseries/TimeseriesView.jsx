import { useMemo, useState, useEffect } from "react";
import {
  getSimulationEpisodes,
  buildTimeseriesTree,
  createCommunityResultItem,
  flattenTreeItems,
  getItemsTimeBounds,
  sortBuildingIds,
} from "./result-items.js";
import { reconstructCommunity } from "../../results/community.js";
import { isFiniteNumber } from "../../results/values.js";
import { FolderOpen, BarChart3 } from "lucide-react";
import { TimeseriesToolbar } from "./TimeseriesToolbar.jsx";
import { SimulationTree } from "./SimulationTree.jsx";
import { EquipmentChart } from "./EquipmentChart.jsx";

function TimeseriesView({
  simulation,
  selectedEpisodeBySimulation,
  setSelectedEpisodeBySimulation,
  selectedResultItem,
  setSelectedResultItem,
}) {
  const episodes = useMemo(() => getSimulationEpisodes(simulation), [simulation]);
  const selectedEpisode = selectedEpisodeBySimulation[simulation.id] || episodes[0] || "";
  const tree = useMemo(
    () => buildTimeseriesTree(simulation, selectedEpisode),
    [simulation, selectedEpisode],
  );
  const communityItem = useMemo(
    () => createCommunityResultItem(tree, simulation, selectedEpisode),
    [tree, simulation, selectedEpisode],
  );
  const communityWarnings = useMemo(
    () =>
      communityItem
        ? []
        : reconstructCommunity(tree.buildings, simulation, selectedEpisode).warnings,
    [communityItem, tree, simulation, selectedEpisode],
  );
  const flatItems = useMemo(() => flattenTreeItems(tree), [tree]);
  const selectedItem = useMemo(() => {
    if (selectedResultItem?.simulationId !== simulation.id)
      return (
        communityItem ||
        flatItems.find((item) => item.type === "consumption") ||
        flatItems[0] ||
        null
      );
    if (selectedResultItem.id === communityItem?.id) return communityItem;
    return (
      flatItems.find((item) => item.id === selectedResultItem.id) ||
      communityItem ||
      flatItems[0] ||
      null
    );
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
        [simulation.id]: episodes[0],
      }));
    }
  }, [episodes, selectedEpisodeBySimulation, setSelectedEpisodeBySimulation, simulation.id]);

  useEffect(() => {
    if (
      communityItem &&
      (!selectedResultItem || selectedResultItem.simulationId !== simulation.id)
    ) {
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
    const end = ["index", "row"].includes(displayBounds.timeline.mode)
      ? displayBounds.max
      : Math.min(displayBounds.max, displayBounds.min + 7 * 24 * 60 * 60 * 1000);
    setRange([displayBounds.min, end]);
    setTimeInterval(baseInterval);
  }, [
    displayKey,
    displayBounds.min,
    displayBounds.max,
    displayBounds.baseInterval,
    displayBounds.timeline.mode,
  ]);

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
    const defaultItem =
      building?.items.find((item) => item.type === "consumption") || building?.items[0];
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
        <h3>No result data files found</h3>
      </section>
    );
  }

  return (
    <section className="timeseries-workspace">
      {displayBounds.compatible && !displayItems.every((item) => item.series.tableOnly) && (
        <TimeseriesToolbar
          range={range}
          setRange={setRange}
          minTimestamp={displayBounds.min}
          maxTimestamp={displayBounds.max}
          timeInterval={timeInterval}
          setTimeInterval={setTimeInterval}
          baseIntervalMinutes={displayBounds.baseInterval}
          timeline={displayBounds.timeline}
        />
      )}

      {!displayBounds.compatible && (
        <p className="timeline-note" role="status">
          Clock contexts differ. Each chart uses its own range.
        </p>
      )}
      {!communityItem && (
        <p className="timeline-note" role="status">
          {communityWarnings.join(" ")}
        </p>
      )}
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
              [simulation.id]: episode,
            }));
            setSelectedBuildingIds([]);
            setSelectedResultItem(null);
          }}
        />

        <section className="result-detail-panel">
          {displayItems.length > 0 ? (
            <div
              className={displayItems.length > 1 ? "sim-chart-grid is-compare" : "sim-chart-grid"}
            >
              {displayItems.map((item) => (
                <EquipmentChart
                  key={item.id}
                  item={item}
                  controls={
                    displayBounds.compatible &&
                    !displayItems.every((entry) => entry.series.tableOnly)
                      ? { range, setRange, timeInterval, setTimeInterval }
                      : null
                  }
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

export { TimeseriesView };
