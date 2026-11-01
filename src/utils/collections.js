function compareNatural(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

function unique(values) {
  return [...new Set(values)];
}

function mergeSimulations(current, incoming) {
  const byId = new Map(current.map((simulation) => [simulation.id, simulation]));
  incoming.forEach((simulation) => byId.set(simulation.id, simulation));
  return [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
}

export { compareNatural, unique, mergeSimulations };
