import { isFiniteNumber, normalizeColumnName } from "./values.js";

export const COST_SCORECARD_DEFINITION = {
  id: "cost-saving-reference",
  title: "Cost saving vs reference",
  description: "Positive values mean the policy is cheaper than the exported reference.",
  valueStyle: "currency",
  unit: "EUR",
  referenceMode: "compare",
  comparisonDirection: "higher-is-better",
  toneRule: "positive-saving",
};
const POLICY = [
  "district_cost_total_control_eur",
  "building_cost_total_control_eur",
  "community_cost_eur",
  "cost_total_control",
  "cost_total_control_eur",
];
const GROUPS = [
  {
    source: "bau",
    label: "BAU",
    reference: [
      "district_cost_total_business_as_usual_eur",
      "building_cost_total_business_as_usual_eur",
      "cost_total_business_as_usual_eur",
      "cost_total_bau_eur",
    ],
    saving: ["cost_saving_vs_bau_eur"],
    delta: [
      "district_cost_total_delta_to_business_as_usual_eur",
      "building_cost_total_delta_to_business_as_usual_eur",
      "cost_delta_vs_bau_eur",
    ],
    ratio: [
      "district_cost_ratio_to_business_as_usual_total_ratio",
      "building_cost_ratio_to_business_as_usual_total_ratio",
      "cost_ratio_to_bau",
    ],
  },
  {
    source: "reference",
    label: "exported reference",
    reference: ["cost_total_reference", "cost_total_reference_eur"],
    saving: ["cost_saving_vs_reference_eur"],
    delta: ["cost_delta_vs_reference_eur"],
    ratio: ["cost_ratio_to_reference"],
  },
  {
    source: "rbcsmart",
    label: "RBC smart reference",
    reference: ["cost_total_rbcsmart_eur"],
    saving: ["cost_saving_vs_rbcsmart_eur"],
    delta: ["cost_delta_vs_rbcsmart_eur"],
    ratio: ["cost_ratio_to_rbcsmart"],
  },
  {
    source: "baseline",
    label: "legacy baseline",
    reference: [
      "district_cost_total_baseline_eur",
      "building_cost_total_baseline_eur",
      "cost_total_baseline",
      "cost_total_baseline_eur",
    ],
    saving: [],
    delta: ["district_cost_total_delta_eur", "building_cost_total_delta_eur", "cost_total_delta"],
    ratio: [
      "district_cost_ratio_to_baseline_total_ratio",
      "building_cost_ratio_to_baseline_total_ratio",
      "cost_ratio_to_baseline",
    ],
  },
];

// Match complete KPI identities: a market saving, daily average, count or cost
// ratio must never be picked just because its name contains "cost".
function pick(rows, aliases) {
  for (const alias of aliases) {
    const row = rows.find(
      (r) =>
        [
          alias,
          ...(alias.startsWith("district_") ? [alias.replace(/^district_/, "portfolio_")] : []),
        ].some((key) => normalizeColumnName(r.label) === normalizeColumnName(key)) &&
        isFiniteNumber(r.value),
    );
    if (row) return row;
  }
  return null;
}
const finite = (value) => (isFiniteNumber(value) ? value : null);
export function costPercent(delta, reference) {
  if (!isFiniteNumber(delta) || !isFiniteNumber(reference) || reference === 0) return null;
  return finite((delta / Math.abs(reference)) * 100);
}
const zero = (value) => (value === 0 ? 0 : value); // Avoid showing a saving of -0 EUR.
const equal = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

function absoluteCost(signal) {
  return {
    ...signal,
    kind: "cost-total",
    title: "Cost",
    description: "Total exported cost for the selected scope. Lower costs are preferable.",
    valueStyle: "currency",
    unit: "EUR",
    referenceMode: "none",
    comparisonDirection: "lower-is-better",
    toneRule: "neutral",
    primary: signal.policy,
    reference: null,
    delta: null,
    deltaPct: null,
    sourceLabel: signal.policySourceLabel,
    sourceKeys: signal.policySourceKey == null ? [] : [signal.policySourceKey],
    referenceSource: null,
    comparisonKey: "cost-total:EUR",
    tone: "neutral",
  };
}

export function resolveCostSignal(rows) {
  const policyRow = pick(rows, POLICY),
    policy = policyRow?.value ?? null;
  let signal = {
    ...COST_SCORECARD_DEFINITION,
    kind: "cost-unavailable",
    title: "Cost",
    description: "No cost metric was exported.",
    reported: false,
    primary: null,
    policy,
    policySourceLabel: policyRow?.label ?? null,
    policySourceKey: policyRow?.key ?? null,
    reference: null,
    delta: null,
    deltaPct: null,
    ratio: null,
    referenceSource: null,
    sourceLabel: policyRow?.label ?? null,
    sourceKeys: policyRow ? [policyRow.key] : [],
    comparisonKey: null,
    tone: "unknown",
  };
  for (const group of GROUPS) {
    const referenceRow = pick(rows, group.reference),
      savingRow = pick(rows, group.saving),
      deltaRow = pick(rows, group.delta),
      ratioRow = pick(rows, group.ratio);
    const reference = referenceRow?.value ?? null;
    const saving =
      isFiniteNumber(policy) && isFiniteNumber(reference)
        ? finite(reference - policy)
        : (savingRow?.value ?? (deltaRow ? zero(-deltaRow.value) : null));
    if (!isFiniteNumber(saving) && !ratioRow) continue;
    signal = {
      ...signal,
      reference,
      referenceSource: group.source,
      sourceKeys: [
        ...new Set(
          [policyRow, referenceRow, savingRow, deltaRow, ratioRow]
            .filter(Boolean)
            .map((r) => r.key),
        ),
      ],
      sourceLabel:
        savingRow?.label ||
        deltaRow?.label ||
        ratioRow?.label ||
        policyRow?.label ||
        referenceRow?.label,
    };
    if (isFiniteNumber(saving)) {
      return {
        ...signal,
        kind: "cost-saving",
        reported: true,
        primary: zero(saving),
        delta: zero(saving),
        title: `Cost saving vs ${group.label}`,
        description: COST_SCORECARD_DEFINITION.description,
        deltaPct: costPercent(saving, reference),
        ratio:
          ratioRow?.value ??
          (isFiniteNumber(policy) && isFiniteNumber(reference) && reference !== 0
            ? finite(policy / reference)
            : null),
        comparisonKey: `cost-saving:${group.source}:EUR`,
        tone: saving > 1e-9 ? "better" : saving < -1e-9 ? "worse" : "neutral",
      };
    }
    // A ratio is dimensionless. Without the reference sign its direction is
    // unknown (a ratio can increase when a negative cost improves).
    return {
      ...signal,
      kind: "cost-ratio",
      reported: true,
      primary: ratioRow.value,
      ratio: ratioRow.value,
      title: `Cost ratio vs ${group.label}`,
      description:
        reference === 0
          ? "Exported cost ratio. The reference cost is zero; no relative change can be calculated."
          : "Exported control/reference cost ratio. Parity is 1x.",
      referenceMode: reference === 0 ? "none" : "compare",
      valueStyle: "ratio",
      unit: "x",
      comparisonDirection:
        reference > 0 ? "lower-is-better" : reference < 0 ? "higher-is-better" : "neutral",
      comparisonKey: `cost-ratio:${group.source}:x`,
      toneRule: "neutral",
      tone:
        !reference || ratioRow.value === 1
          ? "neutral"
          : (1 - ratioRow.value) * Math.sign(reference) > 0
            ? "better"
            : "worse",
    };
  }
  if (isFiniteNumber(policy)) return { ...absoluteCost(signal), reported: true };
  const legacy = pick(rows, ["cost"]);
  if (legacy)
    return {
      ...signal,
      kind: "cost-reported",
      title: "Reported cost",
      description:
        "Reported legacy cost metric. Its unit and reference are not specified by this column.",
      valueStyle: "number",
      unit: "",
      referenceMode: "none",
      comparisonDirection: "neutral",
      toneRule: "neutral",
      primary: legacy.value,
      reported: true,
      sourceLabel: legacy.label,
      sourceKeys: [legacy.key],
      tone: "neutral",
    };
  return signal;
}

export function comparableCostSignals(signals) {
  const present = signals.filter((s) => isFiniteNumber(s?.primary));
  if (present.length < 2) return false;
  const first = present[0];
  return (
    Boolean(first.comparisonKey) &&
    first.comparisonDirection !== "neutral" &&
    present.every(
      (s) =>
        s.comparisonKey === first.comparisonKey &&
        s.comparisonDirection === first.comparisonDirection &&
        (s.kind === "cost-total" ||
          (isFiniteNumber(first.reference) &&
            isFiniteNumber(s.reference) &&
            equal(s.reference, first.reference))),
    )
  );
}

export function resolveCostComparison(signals) {
  let resolved = signals;
  const present = signals.filter((s) => isFiniteNumber(s?.primary));
  if (
    present.length > 1 &&
    !comparableCostSignals(signals) &&
    present.every((s) => isFiniteNumber(s.policy))
  ) {
    // With partial/different references compare the absolute costs shared by all
    // reported cells; do not mix a saving of 20 EUR with a cost of 80 EUR.
    resolved = signals.map((s) => (isFiniteNumber(s.primary) ? absoluteCost(s) : s));
  }
  const shown = resolved.filter((s) => isFiniteNumber(s?.primary));
  const kinds = new Set(shown.map((s) => s.kind));
  const uniform = kinds.size === 1 && new Set(shown.map((s) => s.title)).size === 1;
  const comparable = comparableCostSignals(resolved);
  return {
    signals: resolved,
    comparable,
    title: uniform ? shown[0].title : shown.length ? "Cost — different measures" : "Cost",
    description: comparable
      ? shown[0].description
      : shown.length > 1
        ? "Reported values remain available. A common measure and reference are needed to compare them."
        : shown[0]?.description || "No cost metric was exported.",
    mixedMeasures: !uniform && shown.length > 1,
  };
}

export function bestCostIndices(signals) {
  if (!comparableCostSignals(signals)) return [];
  const present = signals
    .map((s, index) => ({ ...s, index }))
    .filter((s) => isFiniteNumber(s.primary));
  const values = present.map((s) => s.primary),
    higher = present[0].comparisonDirection === "higher-is-better";
  const best = higher ? Math.max(...values) : Math.min(...values);
  return present.filter((s) => equal(s.primary, best)).map((s) => s.index);
}

export function costComparisonDelta(signal, baseline) {
  if (!comparableCostSignals([signal, baseline])) return null;
  const value = finite(signal.primary - baseline.primary);
  if (value === null) return null;
  const higher = signal.comparisonDirection === "higher-is-better";
  return {
    value: equal(signal.primary, baseline.primary) ? 0 : value,
    tone: equal(signal.primary, baseline.primary)
      ? "neutral"
      : (higher ? value > 0 : value < 0)
        ? "better"
        : "worse",
  };
}

// The drill-down displays cost change (control - reference), whereas the saving
// card displays its opposite. Each percentage follows the value in its column.
export function costDrilldown(group) {
  if (!group.rows.some((r) => /(?:^|[^a-z])cost(?:[^a-z]|$)/i.test(r.label))) return null;
  const first = (rows) => rows.find((r) => isFiniteNumber(r.value));
  const source = (label) =>
    /business[_\s-]+as[_\s-]+usual|(?:^|[^a-z])bau(?:[^a-z]|$)/i.test(label)
      ? "bau"
      : /rbcsmart/i.test(label)
        ? "rbcsmart"
        : /reference/i.test(label)
          ? "reference"
          : "baseline";
  const controls = group.roles.control.concat(group.roles.absolute);
  const references = group.roles.reference.filter((r) => isFiniteNumber(r.value));
  const referenceRow = ["bau", "reference", "rbcsmart", "baseline"]
    .map((s) => references.find((r) => source(r.label) === s))
    .find(Boolean);
  const deltaRow = first(
    group.roles.delta.filter(
      (r) => !referenceRow || source(r.label) === source(referenceRow.label),
    ),
  );
  const controlRow = first(controls),
    ratioRow = first(group.roles.ratio);
  const control = controlRow?.value ?? null,
    reference = referenceRow?.value ?? null;
  const saving = Boolean(deltaRow && /saving/i.test(deltaRow.label));
  const delta =
    isFiniteNumber(control) && isFiniteNumber(reference)
      ? finite((saving ? -1 : 1) * (control - reference))
      : (deltaRow?.value ?? null);
  const ratioOnly = !controlRow && !referenceRow && !deltaRow && Boolean(ratioRow);
  const untyped = group.rows.every(
    (r) => normalizeColumnName(r.label) === "cost" || /_count$/i.test(r.label),
  );
  return {
    control,
    reference,
    delta,
    deltaPct: costPercent(delta, reference),
    primary: control ?? delta ?? reference ?? ratioRow?.value ?? null,
    referenceSource: referenceRow ? source(referenceRow.label) : null,
    unit: ratioOnly ? "x" : untyped ? "" : "EUR",
    label: saving && !/saving/i.test(group.label) ? `${group.label} saving` : group.label,
    tone: !isFiniteNumber(delta)
      ? "neutral"
      : Math.abs(delta) <= 1e-9
        ? "neutral"
        : (saving ? delta > 0 : delta < 0)
          ? "better"
          : "worse",
  };
}
