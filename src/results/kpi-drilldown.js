import { unique, compareNatural } from "../utils/collections.js";
import { formatKpiDisplayLabel } from "./kpi-rows.js";
import { isFiniteNumber, normalizeColumnName, formatNumber } from "./values.js";
import {
  ratioToDeltaPct,
  inferKpiUnit,
  formatKpiReferenceLabel,
  inferKpiReferenceSourceFromLabel,
  getKpiTone,
} from "./kpi-scorecard.js";
import { costDrilldown } from "./cost.js";
import { evDrilldownUnit } from "./ev-service.js";

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
          absolute: [],
        },
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
        subfamilies: new Map(),
      });
    }
    const family = families.get(row.family);
    family.count += 1;
    if (!family.subfamilies.has(row.subfamily.key)) {
      family.subfamilies.set(row.subfamily.key, {
        key: row.subfamily.key,
        label: row.subfamily.label,
        rows: [],
      });
    }
    family.subfamilies.get(row.subfamily.key).rows.push(row);
  });

  return [...families.values()]
    .sort((left, right) => compareKpiFamilies(left.family, right.family))
    .map((family) => ({
      ...family,
      subfamilies: [...family.subfamilies.values()].sort((left, right) =>
        compareNatural(left.label, right.label),
      ),
    }));
}

function finalizeKpiDrilldownGroup(group, selectedScope) {
  const controlRow = pickFirstFinite(group.roles.control) || pickFirstFinite(group.roles.absolute);
  const referenceRow = pickFirstFinite(group.roles.reference);
  const deltaRow = pickFirstFinite(group.roles.delta);
  const ratioRow = pickFirstFinite(group.roles.ratio);
  const control = controlRow?.value ?? null;
  const reference = referenceRow?.value ?? null;
  const delta =
    deltaRow?.value ??
    (isFiniteNumber(control) && isFiniteNumber(reference) ? control - reference : null);
  const deltaPct =
    ratioToDeltaPct(ratioRow?.value) ??
    (isFiniteNumber(delta) && isFiniteNumber(reference) && Math.abs(reference) > 1e-9
      ? (delta / Math.abs(reference)) * 100
      : null);
  const primary = control ?? delta ?? reference ?? ratioRow?.value ?? null;
  const sourceLabels = unique(group.sourceLabels).sort(compareNatural);
  const unit = inferKpiUnit(sourceLabels[0] || group.label);
  const tone = scoreKpiDrilldownTone(group.label, control, reference, delta, primary);
  const cost = costDrilldown(group);
  return {
    key: group.key,
    family: group.family,
    subfamily: group.subfamily,
    label: group.label,
    sourceLabels,
    control,
    reference,
    referenceLabel: referenceRow
      ? formatKpiReferenceLabel(inferKpiReferenceSourceFromLabel(referenceRow.label))
      : "N/A",
    delta,
    deltaPct,
    primary,
    unit,
    tone,
    reported: group.rows.some((row) => isFiniteNumber(row.value)),
    ...(cost
      ? {
          ...cost,
          referenceLabel: cost.referenceSource
            ? formatKpiReferenceLabel(cost.referenceSource)
            : "N/A",
        }
      : {}),
    ...(evDrilldownUnit(group.rows) ? { unit: "fraction" } : {}),
    breakdown: group.rows
      .filter((row) => isFiniteNumber(row.value))
      .map((row) => ({
        entity: selectedScope?.label || row.sourceColumn,
        value: row.value,
      })),
  };
}

function pickFirstFinite(rows) {
  return rows.find((row) => isFiniteNumber(row.value)) || null;
}

function classifyKpiRowRole(label) {
  const lower = String(label || "").toLowerCase();
  if (/delta|saving|improvement/.test(lower)) return "delta";
  if (
    /ratio.*(?:bau|baseline|reference)|(?:bau|baseline|reference).*ratio|to_business_as_usual|to_baseline|to_reference/.test(
      lower,
    )
  ) {
    return "ratio";
  }
  if (/cost/.test(lower) && /(?:^|[^a-z])bau(?:[^a-z]|$)/.test(lower)) return "reference";
  if (/baseline|business_as_usual|business as usual|\bbau\b|reference|rbcsmart/.test(lower))
    return "reference";
  if (/control|policy|trained/.test(lower)) return "control";
  return "absolute";
}

function canonicalizeKpiGroup(label) {
  const raw = formatKpiDisplayLabel(label);
  const cleaned = raw
    .replace(/\b(District|Building|Community)\b/gi, "")
    .replace(
      /\b(Control|Policy|Trained|Baseline|Reference|Business|Usual|BAU|Delta|Saving|Savings|Ratio|To)\b/gi,
      "",
    )
    .replace(/\b(EUR|KWH|KG|CO2|Percent|Percentage|Rate)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const labelText = cleaned || raw || "KPI";
  return {
    key: normalizeColumnName(labelText) || normalizeColumnName(label),
    label: labelText,
  };
}

function classifyKpiFamily(label) {
  const lower = String(label || "").toLowerCase();
  if (/cost|price|tariff|reward|saving/.test(lower)) return "cost";
  if (/carbon|emission|co2/.test(lower)) return "emissions";
  if (/solar|pv|self[-_\s]*consumption/.test(lower)) return "solar_self_consumption";
  if (/ev|electric_vehicle|vehicle|v2g|charger|soc|departure|tolerance|min_acceptable/.test(lower))
    return "ev";
  if (/battery|storage|throughput|cycle/.test(lower)) return "battery";
  if (/electrical|phase|violation|voltage|outage/.test(lower)) return "electrical_service_phase";
  if (/comfort|discomfort|resilience|unserved/.test(lower)) return "comfort_resilience";
  if (/equity|fairness/.test(lower)) return "equity";
  if (/grid|import|export|net_exchange|peak|ramping|load_factor|consumption|load/.test(lower))
    return "energy_grid";
  return "other";
}

function classifyKpiSubfamily(label) {
  const lower = String(label || "").toLowerCase();
  if (/peak/.test(lower)) return { key: "peak", label: "Peak demand" };
  if (/load_factor/.test(lower)) return { key: "load-factor", label: "Load factor" };
  if (/ramping/.test(lower)) return { key: "ramping", label: "Ramping" };
  if (/import/.test(lower)) return { key: "import", label: "Import" };
  if (/export|v2g/.test(lower)) return { key: "export", label: "Export" };
  if (/net_exchange|net exchange/.test(lower))
    return { key: "net-exchange", label: "Net exchange" };
  if (/departure|min_acceptable|tolerance|service/.test(lower))
    return { key: "service", label: "Service" };
  if (/throughput|cycle/.test(lower)) return { key: "throughput", label: "Throughput" };
  if (/violation|phase|voltage/.test(lower)) return { key: "violations", label: "Violations" };
  if (/baseline|bau|reference|control|delta/.test(lower))
    return { key: "comparison", label: "Comparison" };
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
    other: "Other",
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
    "other",
  ];
  const leftIndex = order.indexOf(left);
  const rightIndex = order.indexOf(right);
  if (leftIndex !== rightIndex)
    return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
  return compareNatural(left, right);
}

function formatKpiDrilldownValue(value) {
  return isFiniteNumber(value) ? formatNumber(value) : "N/A";
}

function formatToneLabel(tone) {
  if (tone === "better") return "Better";
  if (tone === "worse") return "Worse";
  return "";
}

export {
  buildKpiFamilyOptions,
  buildKpiDrilldownSections,
  formatKpiFamilyLabel,
  compareKpiFamilies,
  formatKpiDrilldownValue,
  formatToneLabel,
};
