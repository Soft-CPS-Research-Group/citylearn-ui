import { unique, compareNatural } from "../../utils/collections.js";
import { buildEquipmentTree, classifySeries } from "../../results/equipment.js";
import {
  PlugZap,
  BatteryCharging,
  Sun,
  Factory,
  Car,
  CircleDollarSign,
  FileSpreadsheet,
  Building2,
} from "lucide-react";
import { reconstructCommunity } from "../../results/community.js";
import { timeBounds } from "../../results/temporal.js";

function getSimulationEpisodes(simulation) {
  const episodes = unique(simulation.series.map((series) => series.episode).filter(Boolean)).sort(
    compareNatural,
  );
  return episodes.length > 0 ? episodes : [""];
}

function buildTimeseriesTree(simulation, selectedEpisode) {
  const tree = buildEquipmentTree(simulation, selectedEpisode);
  const icons = {
    charger: PlugZap,
    battery: BatteryCharging,
    pv: Sun,
    production: Factory,
    consumption: PlugZap,
    ev: Car,
    pricing: CircleDollarSign,
    generic: FileSpreadsheet,
  };
  flattenTreeItems(tree).forEach((item) => {
    item.icon = icons[item.type] || FileSpreadsheet;
  });
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
    buildingId,
  };
}

function flattenTreeItems(tree) {
  return [
    ...tree.buildings.flatMap((building) => [
      ...building.items,
      ...building.chargers,
      ...building.batteries,
    ]),
    ...tree.vehicles,
    ...tree.pricing,
    ...tree.other,
  ];
}

function createCommunityResultItem(tree, simulation, selectedEpisode) {
  const explicitCommunitySeries = simulation.series.find((series) => {
    return (
      classifySeries(series).type === "community" &&
      (!selectedEpisode || !series.episode || series.episode === selectedEpisode)
    );
  });

  if (explicitCommunitySeries) {
    return createResultItem({
      type: "community",
      label: "Community",
      title: "Community Overview",
      icon: Building2,
      series: explicitCommunitySeries,
    });
  }

  const rebuilt = reconstructCommunity(tree.buildings, simulation, selectedEpisode);
  if (!rebuilt.series) return null;
  return createResultItem({
    type: "community",
    label: "Community",
    title: "Community Overview",
    icon: Building2,
    series: rebuilt.series,
  });
}

function getItemsTimeBounds(items) {
  return timeBounds(items);
}

function sortBuildingIds(ids, buildings) {
  const order = new Map(buildings.map((building, index) => [building.id, index]));
  return [...ids].sort((left, right) => (order.get(left) ?? 9999) - (order.get(right) ?? 9999));
}

export {
  getSimulationEpisodes,
  buildTimeseriesTree,
  flattenTreeItems,
  createCommunityResultItem,
  getItemsTimeBounds,
  sortBuildingIds,
};
