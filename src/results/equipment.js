import { resolveField, stripEpisodeFromKey } from "./values.js";

const TYPES = {
  building: "building",
  member: "building",
  battery: "battery",
  bess: "battery",
  charger: "charger",
  ev: "ev",
  electric_vehicle: "ev",
  pv: "pv",
  pricing: "pricing",
  community: "community",
};
const natural = (a, b) =>
  String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
const canonical = (id) => String(id).normalize("NFC").toLowerCase();

function sourceKey(series) {
  const path =
    series.relativePath || series.fileName || series.resultKey || series.matchKey || series.id;
  const parts = String(path).replace(/\\/g, "/").split("/");
  const name = stripEpisodeFromKey(
    parts
      .pop()
      .replace(/\.(?:csv|parquet|pq|parq)$/i, "")
      .replace(/^exported_data_?/i, ""),
  );
  return [...parts, name].join("/");
}

function uniqueValue(series, aliases) {
  const field = resolveField(series.columns || [], aliases);
  if (!field) return null;
  let value = null;
  for (const row of series.rows || []) {
    const next = String(row[field] ?? "").trim();
    if (!next) continue;
    if (value !== null && value !== next) return null;
    value = next;
  }
  return value;
}

// Column signatures are shared by the CPS and CityLearn exporters. A name is
// only a legacy fallback; an unfamiliar asset still gets a usable generic view.
export function classifySeries(series) {
  const key = sourceKey(series);
  const columns = series.columns || [];
  const has = (...aliases) => Boolean(resolveField(columns, aliases));
  const entity = series.entity || series.metadata?.entity || {};
  let type = series.tableOnly
    ? "generic"
    : Object.hasOwn(TYPES, entity.type)
      ? TYPES[entity.type]
      : null;
  if (!type && /(?:^|[/_])business_as_usual(?:$|_)/i.test(key)) type = "generic";
  if (
    !type &&
    (has("Charger Consumption-kWh", "charger_consumption", "Charger Production-kWh") ||
      has("EV Charger State", "electric_vehicle_charger_state"))
  )
    type = "charger";
  if (!type && has("Battery (Dis)Charge-kWh", "battery_charge", "battery_discharge", "battery_soc"))
    type = "battery";
  if (!type && has("electric_vehicle_soc", "EV SOC-%")) type = "ev";
  if (!type && key.toLowerCase() === "community") type = "community";
  if (
    !type &&
    has("Net Electricity Consumption-kWh", "net_electricity_consumption") &&
    has("Non-shiftable Load-kWh", "non_shiftable_load", "electricity_consumption")
  )
    type = "building";
  if (
    !type &&
    (has("Stored energy by community- kWh") ||
      (has("Self Consumption-kWh") && has("Total Solar Generation-kWh")))
  )
    type = "community";
  if (
    !type &&
    has(
      "electricity_pricing-$/kWh",
      "electricity_pricing",
      "electricity_price",
      "price_eur_per_kwh",
    ) &&
    columns.every((c) => /price|pricing|tariff|carbon|timestamp|time|date|step/i.test(c))
  )
    type = "pricing";
  if (
    !type &&
    has(
      "solar_generation",
      "pv_generation",
      "PV Production-kWh",
      "Energy Production from PV-kWh",
      "pv",
    )
  )
    type = "pv";
  if (!type) {
    const base = key.split("/").pop();
    if (/^building_\d+_charger_\d+_\d+$/i.test(base)) type = "charger";
    else if (/^building_\d+_battery/i.test(base)) type = "battery";
    else if (/^building_\d+_.*pv/i.test(base)) type = "pv";
    else if (/^building_\d+$/i.test(base)) type = "building";
    else if (/electric_vehicle/i.test(base)) type = "ev";
    else if (/^pricing|price/i.test(base)) type = "pricing";
  }
  const declaredId = entity.id == null ? "" : String(entity.id);
  const id = declaredId || uniqueValue(series, ["entity_id", "name"]) || key.split("/").pop();
  const buildingId =
    entity.buildingId ?? uniqueValue(series, ["building_id", "member_id", "building_name"]);
  return {
    type: type || "generic",
    id,
    key,
    buildingId: buildingId == null ? null : String(buildingId),
  };
}

function item(type, label, title, series, buildingId = null) {
  return { id: `${series.id}-${type}`, type, label, title, series, buildingId };
}

export function buildEquipmentTree(simulation, selectedEpisode) {
  const tree = { buildings: [], vehicles: [], pricing: [], other: [] };
  const entries = simulation.series
    .filter((s) => !selectedEpisode || !s.episode || s.episode === selectedEpisode)
    .map((series) => ({ series, ...classifySeries(series) }));
  const buildings = new Map();
  const kpiNames = (simulation.kpis?.columns || []).filter((c) => c !== simulation.kpis.labelKey);
  const displayId = (id) => {
    const matches = kpiNames.filter((n) => canonical(n) === canonical(id));
    return matches.length === 1 ? matches[0] : id;
  };
  function addBuilding(id, key) {
    const existing = buildings.get(key);
    if (existing) return existing;
    const name = displayId(id);
    const building = {
      id: key,
      label: name.replace(/^building_(\d+)$/i, "Building $1"),
      entityId: name,
      sourceKeys: [key],
      items: [],
      chargers: [],
      batteries: [],
    };
    buildings.set(key, building);
    return building;
  }
  // Resolve hosts first so imports do not depend on file picker ordering.
  for (const entry of entries.filter((e) => e.type === "building")) {
    const building = addBuilding(entry.id, entry.key);
    building.items.push(
      item("production", "Production", `${building.label} Production`, entry.series, building.id),
      item(
        "consumption",
        "Consumption",
        `${building.label} Consumption`,
        entry.series,
        building.id,
      ),
    );
  }
  function hostFor(entry) {
    const hosts = [...buildings.values()];
    if (entry.buildingId != null) {
      const matches = hosts.filter(
        (b) =>
          canonical(b.entityId) === canonical(entry.buildingId) ||
          b.sourceKeys.some((k) => canonical(k) === canonical(entry.buildingId)),
      );
      if (matches.length === 1) return matches[0];
      if (matches.length > 1) return null;
      return addBuilding(entry.buildingId, `entity:${entry.buildingId}`);
    }
    const matches = hosts.filter((b) =>
      b.sourceKeys.some((k) => {
        const prefix = canonical(k),
          key = canonical(entry.key);
        return key.startsWith(prefix + "_") || key.startsWith(prefix + "/");
      }),
    );
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) return null;
    // Preserve old exports that contain equipment files without a building file.
    const legacy = entry.key.match(/^(.*\/)?(building_\d+)_(?:battery|charger|.*pv)/i);
    return legacy ? addBuilding(legacy[2], (legacy[1] || "") + legacy[2].toLowerCase()) : null;
  }
  for (const entry of entries) {
    const { series, type, id } = entry;
    if (type === "building" || type === "community") continue;
    if (["charger", "battery", "pv"].includes(type)) {
      const host = hostFor(entry);
      const legacyCharger = entry.key.match(/(?:^|\/)building_\d+_charger_\d+_(\d+)$/i);
      const suffix = host?.sourceKeys.find((k) =>
        canonical(entry.key).startsWith(canonical(k) + "_"),
      );
      const label =
        type === "battery"
          ? "Battery"
          : type === "pv"
            ? "PV"
            : legacyCharger
              ? `Charger ${legacyCharger[1]}`
              : suffix
                ? entry.key.slice(suffix.length + 1) || id
                : id;
      const result = item(
        type,
        label,
        host ? `${host.label} - ${label} Data` : `${id} Data`,
        series,
        host?.id || null,
      );
      if (!host) tree.other.push(result);
      else if (type === "charger") host.chargers.push(result);
      else if (type === "battery") host.batteries.push(result);
      else host.items.push(result);
    } else if (type === "ev") tree.vehicles.push(item(type, id, `${id} Data`, series));
    else if (type === "pricing")
      tree.pricing.push(item(type, "Pricing Data", "Pricing Info", series));
    else tree.other.push(item("generic", series.label || id, series.label || id, series));
  }
  tree.buildings = [...buildings.values()].sort((a, b) => natural(a.id, b.id));
  for (const b of tree.buildings)
    for (const key of ["items", "chargers", "batteries"])
      b[key].sort((a, b) => natural(a.label, b.label));
  for (const key of ["vehicles", "pricing", "other"])
    tree[key].sort((a, b) => natural(a.label, b.label));
  return tree;
}
