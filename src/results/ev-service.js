import { isFiniteNumber, normalizeColumnName, formatNumber } from "./values.js";

export const EV_SERVICE_DEFINITIONS = [
  {
    id: "ev-min-feasible",
    title: "EV minimum service",
    description: "Reported EV departure service.",
    valueStyle: "percentage",
    unit: "%",
    referenceMode: "none",
    comparisonDirection: "higher-is-better",
  },
  {
    id: "ev-within-tolerance",
    title: "EV within tolerance",
    description: "Reported SOC tolerance service.",
    valueStyle: "percentage",
    unit: "%",
    referenceMode: "none",
    comparisonDirection: "higher-is-better",
  },
];
export const isEvService = (id) => EV_SERVICE_DEFINITIONS.some((d) => d.id === id);
const aliases = (suffix) => [
  `district_${suffix}`,
  `building_${suffix}`,
  `portfolio_${suffix}`,
  suffix,
];
const rate = (value) => isFiniteNumber(value) && value >= 0 && value <= 1;
const count = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);

function descriptor(threshold, basis, suffixes, denominator, numerator) {
  const criterion =
    threshold === "min_acceptable"
      ? "minimum"
      : threshold === "within_tolerance"
        ? "tolerance"
        : "target";
  const label =
    criterion === "minimum"
      ? "EV minimum service"
      : criterion === "tolerance"
        ? "EV within tolerance"
        : "EV target reached";
  const bases = {
    "audit-feasible": ["feasible, observed", "observed feasible departures"],
    "audit-observed": ["observed departures", "observed departures"],
    "legacy-feasible": [
      "feasible (legacy)",
      "feasible departures counted by the legacy definition",
    ],
    "legacy-all": ["counted departures", "all departures counted by the legacy definition"],
    unspecified: ["reported rate", "departures with an unspecified denominator"],
  };
  return {
    threshold,
    criterion,
    basis,
    title: `${label} — ${bases[basis][0]}`,
    denominatorLabel: bases[basis][1],
    suffixes,
    denominator,
    numerator,
    description: `Share of ${bases[basis][1]} meeting ${criterion === "minimum" ? "minimum acceptable service" : criterion === "tolerance" ? "the target SOC tolerance band" : "the target SOC"}.`,
  };
}
const legacyTotal = ["ev_events_departure_count", "ev_departure_events_count"];
function candidates(threshold) {
  return [
    descriptor(
      threshold,
      "audit-feasible",
      [`ev_departure_audit_${threshold}_service_feasible_ratio`],
      [`ev_departure_audit_${threshold}_feasible_service_observed_count`],
      [`ev_departure_audit_${threshold}_feasible_service_met_count`],
    ),
    descriptor(
      threshold,
      "audit-observed",
      [`ev_departure_audit_${threshold}_service_observed_ratio`],
      ["ev_departure_audit_service_observed_count"],
      [`ev_departure_audit_${threshold}_service_met_count`],
    ),
    descriptor(
      threshold,
      "legacy-feasible",
      [
        `ev_performance_departure_${threshold}_feasible_ratio`,
        `ev_departure_${threshold}_feasible_rate`,
        ...(threshold === "min_acceptable" ? ["ev_min_acceptable_feasible_rate"] : []),
      ],
      [
        `ev_events_departure_${threshold}_feasible_count`,
        `ev_departure_${threshold}_feasible_events_count`,
      ],
      [],
    ),
    descriptor(
      threshold,
      "legacy-all",
      [`ev_performance_departure_${threshold}_ratio`, `ev_departure_${threshold}_rate`],
      legacyTotal,
      [`ev_events_departure_${threshold}_count`, `ev_departure_${threshold}_events_count`],
    ),
    ...(threshold === "within_tolerance"
      ? [descriptor(threshold, "unspecified", ["ev_within_tolerance_rate"], [], [])]
      : []),
  ];
}
const targetCandidates = [
  descriptor(
    "target",
    "legacy-feasible",
    ["ev_performance_departure_success_feasible_ratio", "ev_departure_success_feasible_rate"],
    ["ev_events_departure_target_feasible_count", "ev_departure_target_feasible_events_count"],
    [],
  ),
  descriptor(
    "target",
    "legacy-all",
    ["ev_performance_departure_success_ratio", "ev_departure_success_rate"],
    legacyTotal,
    ["ev_events_departure_met_count", "ev_departure_met_events_count"],
  ),
];

export function resolveEvService(rows, id) {
  const definition = EV_SERVICE_DEFINITIONS.find((d) => d.id === id);
  const threshold = id === "ev-min-feasible" ? "min_acceptable" : "within_tolerance";
  const index = new Map();
  for (const row of rows) {
    const key = normalizeColumnName(row.label);
    if (!index.has(key) || !isFiniteNumber(index.get(key).value)) index.set(key, row);
  }
  function get(suffixes) {
    for (const suffix of suffixes)
      for (const name of aliases(suffix)) {
        const row = index.get(normalizeColumnName(name));
        if (row && isFiniteNumber(row.value)) return row;
      }
    return null;
  }
  let invalidCount = false;
  const number = (suffixes) => {
    const value = get(suffixes)?.value;
    if (isFiniteNumber(value) && count(value) === null) invalidCount = true;
    return count(value);
  };
  const exists = (suffix) => aliases(suffix).some((key) => index.has(normalizeColumnName(key)));
  const audit = [
    "service_feasible_ratio",
    "service_observed_ratio",
    "feasible_count",
    "unknown_count",
  ].some((suffix) => exists(`ev_departure_audit_${threshold}_${suffix}`));
  const available = candidates(threshold).filter((c) =>
    audit ? c.basis !== "legacy-feasible" : !c.basis.startsWith("audit"),
  );
  if (threshold === "min_acceptable") {
    available.push(
      ...(audit
        ? targetCandidates.filter((c) => c.basis === "legacy-all")
        : [...candidates("target").slice(0, 2), ...targetCandidates]),
    );
  }
  const selected =
    available.find((c) => rate(get(c.suffixes)?.value) && number(c.denominator) !== 0) ||
    available.find((c) => get(c.suffixes)) ||
    available.find((c) => c.suffixes.some(exists));
  const picked = selected || descriptor(threshold, "unspecified", [], [], []);
  const row = get(picked.suffixes),
    exportedValue = row?.value ?? null;
  const denominator = number(picked.denominator),
    numerator = number(picked.numerator);
  const total = number(["ev_departure_audit_departures_count"]);
  const observed = number(["ev_departure_audit_service_observed_count"]);
  const serviceUnknown = number(["ev_departure_audit_service_unknown_count"]);
  const feasible = number([`ev_departure_audit_${picked.threshold}_feasible_count`]);
  const infeasible = number([`ev_departure_audit_${picked.threshold}_infeasible_count`]);
  const feasibilityUnknown = number([`ev_departure_audit_${picked.threshold}_unknown_count`]);
  const legacyDepartures = number(legacyTotal);
  const vehicleCount = number(["ev_vehicle_count", "ev_vehicles_count", "ev_assets_count"]);
  const serviceCoverage =
    total > 0 && observed !== null
      ? observed / total
      : (get(["ev_departure_audit_service_coverage_ratio"])?.value ?? null);
  const feasibilityCoverage =
    total > 0 && feasible !== null && infeasible !== null
      ? (feasible + infeasible) / total
      : (get([`ev_departure_audit_${picked.threshold}_coverage_ratio`])?.value ?? null);
  const inconsistent =
    invalidCount ||
    (picked.basis === "audit-feasible" &&
      denominator !== null &&
      ((feasible !== null && denominator > feasible) ||
        (observed !== null && denominator > observed))) ||
    (picked.basis === "legacy-feasible" &&
      denominator !== null &&
      legacyDepartures !== null &&
      denominator > legacyDepartures) ||
    (serviceCoverage !== null && !rate(serviceCoverage)) ||
    (feasibilityCoverage !== null && !rate(feasibilityCoverage)) ||
    (denominator !== null && numerator !== null && numerator > denominator) ||
    (total !== null && observed !== null && observed > total) ||
    (total !== null && feasible !== null && infeasible !== null && feasible + infeasible > total) ||
    (total !== null &&
      observed !== null &&
      serviceUnknown !== null &&
      observed + serviceUnknown !== total) ||
    (total !== null &&
      feasible !== null &&
      infeasible !== null &&
      feasibilityUnknown !== null &&
      feasible + infeasible + feasibilityUnknown !== total) ||
    (vehicleCount === 0 && (total > 0 || legacyDepartures > 0)) ||
    (rate(exportedValue) &&
      denominator > 0 &&
      numerator !== null &&
      Math.abs(exportedValue - numerator / denominator) > 0.001);
  const servicePartial = (rate(serviceCoverage) && serviceCoverage < 1) || serviceUnknown > 0;
  const feasibilityPartial =
    (rate(feasibilityCoverage) && feasibilityCoverage < 1) || feasibilityUnknown > 0;
  const partial = servicePartial || (picked.basis.endsWith("feasible") && feasibilityPartial);
  let status = rate(exportedValue) ? "reported" : exportedValue !== null ? "invalid" : "unknown";
  let statusLabel = status === "invalid" ? "Invalid exported rate" : "Not reported";
  if (!inconsistent) {
    if (vehicleCount === 0) {
      status = "not-applicable";
      statusLabel = "No EVs";
    } else if (total === 0 || (total === null && legacyDepartures === 0)) {
      status = "not-applicable";
      statusLabel = "No departures";
    } else if (observed === 0 && total > 0) {
      status = "unknown";
      statusLabel = "Service unknown";
    } else if (denominator === 0) {
      status = "not-applicable";
      statusLabel = "No evaluable departures";
    }
  }
  const primary = status === "reported" ? (exportedValue === 0 ? 0 : exportedValue) : null;
  const evidence = [];
  if (!selected) evidence.push("Denominator not reported.");
  else
    evidence.push(
      `Denominator: ${denominator === null ? "count not reported; " : `${denominator} `}${picked.denominatorLabel}.`,
    );
  if (numerator !== null && denominator !== null)
    evidence.push(
      denominator === 0
        ? `Service met: ${numerator}; no evaluable departures.`
        : `Service met: ${numerator}/${denominator}.`,
    );
  if (total !== null) {
    evidence.push(`Recorded departures: ${total}.`);
    evidence.push(
      total === 0
        ? "Service coverage: no departures."
        : observed !== null
          ? `Service observed: ${observed}/${total}${serviceUnknown === null ? "" : `; ${serviceUnknown} unknown`}.`
          : rate(serviceCoverage)
            ? `Service coverage: ${formatNumber(serviceCoverage * 100)}% (reported; count not reported).`
            : "Service coverage not reported.",
    );
    if (total === 0) evidence.push("Feasibility coverage: no departures.");
    else if (feasible !== null && infeasible !== null)
      evidence.push(
        `Feasibility known: ${feasible + infeasible}/${total}${feasibilityUnknown === null ? "" : `; ${feasibilityUnknown} unknown`}.`,
      );
    else
      evidence.push(
        rate(feasibilityCoverage)
          ? `Feasibility coverage: ${formatNumber(feasibilityCoverage * 100)}% (reported; counts not reported).`
          : "Feasibility coverage not reported.",
      );
    if (observed === null && serviceUnknown !== null)
      evidence.push(`Service unknown: ${serviceUnknown}.`);
    if ((feasible === null || infeasible === null) && feasibilityUnknown !== null)
      evidence.push(`Feasibility unknown: ${feasibilityUnknown}.`);
  } else {
    if (legacyDepartures !== null) evidence.push(`Legacy counted departures: ${legacyDepartures}.`);
    if (observed !== null) evidence.push(`Service observed: ${observed}; total not reported.`);
    if (serviceUnknown !== null) evidence.push(`Service unknown: ${serviceUnknown}.`);
    if (feasibilityUnknown !== null) evidence.push(`Feasibility unknown: ${feasibilityUnknown}.`);
    if (rate(serviceCoverage))
      evidence.push(
        `Service coverage: ${formatNumber(serviceCoverage * 100)}% (reported; total not reported).`,
      );
    if (rate(feasibilityCoverage))
      evidence.push(
        `Feasibility coverage: ${formatNumber(feasibilityCoverage * 100)}% (reported; counts not reported).`,
      );
    if (!rate(serviceCoverage) && !rate(feasibilityCoverage))
      evidence.push("Coverage not reported.");
  }
  if (inconsistent) evidence.push("Inconsistent EV counts or rate; check the exported data.");
  const tone =
    primary === null
      ? "unknown"
      : inconsistent || partial || picked.basis === "unspecified"
        ? "neutral"
        : primary >= 0.98
          ? "better"
          : primary >= 0.95
            ? "neutral"
            : "worse";
  return {
    ...definition,
    ...picked,
    title: selected ? picked.title : definition.title,
    description: selected
      ? picked.description
      : "The service rate and its denominator were not exported.",
    kind: "ev-service",
    valueStyle: "percentage",
    unit: "%",
    referenceMode: "none",
    policy: primary,
    primary,
    reference: null,
    delta: null,
    deltaPct: null,
    referenceSource: null,
    reported: primary !== null,
    exportedValue,
    status,
    statusLabel,
    denominator,
    numerator,
    total,
    observed,
    serviceUnknown,
    feasible,
    infeasible,
    feasibilityUnknown,
    serviceCoverage,
    feasibilityCoverage,
    partial,
    servicePartial,
    feasibilityPartial,
    inconsistent,
    evidence,
    tone,
    comparisonDirection: picked.basis === "unspecified" ? "neutral" : "higher-is-better",
    comparisonKey: `${picked.criterion}:${picked.basis}`,
    sourceLabel: row?.label ?? null,
    sourceKeys: row ? [row.key] : [],
  };
}

export function comparableEvSignals(signals) {
  const shown = signals.filter((s) => isFiniteNumber(s?.primary));
  return (
    shown.length >= 2 &&
    shown.every(
      (s) =>
        s.comparisonKey === shown[0].comparisonKey &&
        s.comparisonDirection !== "neutral" &&
        !s.partial &&
        !s.inconsistent,
    )
  );
}
export function evComparison(signals, id) {
  const shown = signals.filter((s) => isFiniteNumber(s?.primary));
  const same = new Set(shown.map((s) => s.comparisonKey)).size <= 1;
  return {
    title: same
      ? shown[0]?.title || EV_SERVICE_DEFINITIONS.find((d) => d.id === id).title
      : `${id === "ev-min-feasible" ? "EV minimum service" : "EV within tolerance"} — different bases`,
    description: comparableEvSignals(signals)
      ? shown[0].description
      : "Reported values remain visible. Comparisons require the same service criterion and denominator, with no known coverage gap.",
    mixedMeasures: !same,
  };
}
export function bestEvIndices(signals) {
  if (!comparableEvSignals(signals)) return [];
  const max = Math.max(...signals.filter((s) => isFiniteNumber(s?.primary)).map((s) => s.primary));
  return signals.flatMap((s, i) =>
    isFiniteNumber(s?.primary) && Math.abs(s.primary - max) <= 1e-9 ? [i] : [],
  );
}
export function evComparisonDelta(signal, baseline) {
  if (!comparableEvSignals([signal, baseline])) return null;
  const points = (signal.primary - baseline.primary) * 100;
  return {
    points: points === 0 ? 0 : points,
    tone: Math.abs(points) <= 1e-9 ? "neutral" : points > 0 ? "better" : "worse",
  };
}

const serviceRateNames = new Set(
  [
    ...candidates("min_acceptable"),
    ...candidates("within_tolerance"),
    ...candidates("target").slice(0, 2),
    ...targetCandidates,
  ]
    .flatMap((c) => c.suffixes.flatMap(aliases))
    .map(normalizeColumnName),
);
export function evDrilldownUnit(rows) {
  return rows.some(
    (r) =>
      serviceRateNames.has(normalizeColumnName(r.label)) ||
      /(?:evdepartureaudit|evperformancedeparture).*ratio$/.test(normalizeColumnName(r.label)),
  )
    ? "fraction"
    : null;
}
