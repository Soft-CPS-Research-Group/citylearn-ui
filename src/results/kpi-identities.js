export function longKpiIdentity(row, columns) {
  const field = (name) => columns.find((column) => column.toLowerCase() === name);
  const name = String(row[field("name")] ?? "").trim(),
    metric = String(row[field("cost_function")] ?? "").trim();
  const communityField = field("community_id"),
    qualified = Boolean(communityField);
  const communityId = qualified ? String(row[communityField] ?? "").trim() : null;
  const levelField = field("level");
  const level = levelField ? String(row[levelField] ?? "").trim() : "";
  const entityKey = qualified ? "scope:" + JSON.stringify([communityId, level, name]) : name;
  return {
    name,
    metric,
    communityId,
    level,
    qualified,
    entityKey,
    metricKey: JSON.stringify([entityKey, metric]),
    invalid: !name || !metric || (qualified && !communityId),
  };
}
export function qualifiedScopeLabel(entity) {
  return entity.level.toLowerCase() === "portfolio" && entity.communityId === "__portfolio__"
    ? entity.name
    : `${entity.communityId} · ${entity.name}${entity.level ? ` (${entity.level})` : ""}`;
}
