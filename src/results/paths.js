export function normalizePath(path) {
  return String(path || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
}

export function baseName(path) {
  const parts = normalizePath(path).split("/").filter(Boolean);
  return parts[parts.length - 1] || "Simulation";
}

export function slugify(value) {
  return String(value || "simulation")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function hashText(input) {
  let hash = 0;
  const text = String(input || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function trimSimulationPrefix(relativePath, simulationPath) {
  const normalizedPath = normalizePath(relativePath);
  const normalizedSimulationPath = normalizePath(simulationPath);
  if (normalizedPath.startsWith(`${normalizedSimulationPath}/`)) {
    return normalizedPath.slice(normalizedSimulationPath.length + 1);
  }
  return normalizedPath;
}

export function findTimeKey(columns) {
  return (
    columns.find((column) => /^(timestamp|datetime|date_time|time|date)$/i.test(column)) ||
    columns.find((column) =>
      /^(global_time_step|global_step|episode_time_step|time_step|timestep|step|index)$/i.test(
        column,
      ),
    ) ||
    null
  );
}

export function extractEpisode(name) {
  const match = name.match(/(?:^|_)ep(?:isode)?_?(\d+)$/i);
  return match ? `ep${match[1]}` : "";
}

export function normalizeMatchKey(name) {
  return name
    .replace(/^exported_data_?/i, "")
    .replace(/\.(?:csv|parquet|pq|parq)$/i, "")
    .replace(/\\/g, "/")
    .toLowerCase();
}

export function formatSeriesLabel(name) {
  return name
    .replace(/^exported_data_?/i, "")
    .replace(/\.(?:csv|parquet|pq|parq)$/i, "")
    .split("/")
    .pop()
    .replace(/_/g, " ")
    .replace(/\b(ev|pv|kpi)\b/gi, (match) => match.toUpperCase())
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function categorizeSeries(name) {
  const lower = name.toLowerCase();
  if (lower.includes("electric_vehicle") || lower.includes("_ev_")) return "Vehicles";
  if (lower.includes("battery") || lower.includes("charger") || lower.includes("pv"))
    return "Storage";
  if (lower.includes("price") || lower.includes("pricing") || lower.includes("tariff"))
    return "Pricing";
  if (lower.includes("building")) return "Buildings";
  return "Other";
}
