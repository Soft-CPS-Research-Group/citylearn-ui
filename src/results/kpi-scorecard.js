import { qualifiedScopeLabel } from "./kpi-identities.js";
import {
  isFiniteNumber,
  toNumber,
  normalizeColumnName,
  normalizePercent,
  formatNumber,
} from "./values.js";
import { compareNatural, unique } from "../utils/collections.js";
import { getKpiLabel, aggregateKpiRow, shortenLabel } from "./kpi-rows.js";
import {
  KPI_SCORECARD_DEFINITIONS,
  KPI_PRIORITY_DEFINITION_IDS,
  KPI_SELECTED_DEFINITION_IDS,
} from "./kpi-definitions.js";
import { isEvService, resolveEvService } from "./ev-service.js";
import { COST_SCORECARD_DEFINITION, resolveCostSignal } from "./cost.js";

function buildKpiScopes(kpis) {
  const numericColumns = kpis.columns
    .filter((column) => column !== kpis.labelKey)
    .filter((column) => kpis.rows.some((row) => isFiniteNumber(toNumber(row[column]))));
  if (kpis.scopeIdentities) {
    const groups = {
      portfolio: "portfolio",
      district: "community",
      community: "community",
      building: "building",
    };
    const group = (level) =>
      Object.hasOwn(groups, level.toLowerCase()) ? groups[level.toLowerCase()] : "other";
    const order = { portfolio: 0, community: 1, building: 2, other: 3 };
    return kpis.columns
      .filter((column) => column !== kpis.labelKey && Object.hasOwn(kpis.scopeIdentities, column))
      .map((column) => {
        const entity = kpis.scopeIdentities[column];
        return {
          id: `qualified:${column}`,
          column,
          label: qualifiedScopeLabel(entity),
          group: group(entity.level),
          qualified: true,
          identity: entity,
        };
      })
      .sort((a, b) => order[a.group] - order[b.group] || compareNatural(a.label, b.label));
  }
  const declaredLevels = numericColumns.some((column) => typeof kpis.levels?.[column] === "string");
  const communityColumn = declaredLevels
    ? numericColumns.find((column) =>
        ["district", "community"].includes(String(kpis.levels[column]).toLowerCase()),
      )
    : numericColumns.find((column) => /district|community|total|all/i.test(column)) ||
      numericColumns[0];
  const buildingColumns = numericColumns
    .filter((column) => column !== communityColumn)
    .filter(
      (column) =>
        String(kpis.levels?.[column]).toLowerCase() === "building" ||
        /building|house|site|asset/i.test(column),
    )
    .sort(compareNatural);
  const otherColumns = numericColumns
    .filter((column) => column !== communityColumn && !buildingColumns.includes(column))
    .sort(compareNatural);

  return [
    communityColumn
      ? {
          id: "community",
          label:
            communityColumn === "District" ? "Community" : formatKpiScopeLabel(communityColumn),
          column: communityColumn,
        }
      : null,
    ...buildingColumns.map((column) => ({
      id: `column:${column}`,
      label: formatKpiScopeLabel(column),
      column,
    })),
    ...otherColumns.map((column) => ({
      id: `column:${column}`,
      label: formatKpiScopeLabel(column),
      column,
    })),
  ].filter(Boolean);
}

function formatKpiScopeLabel(column) {
  return String(column || "")
    .replace(/^district$/i, "Community")
    .replace(/_/g, " ")
    .replace(/\bbuilding\s+(\d+)/i, "Building $1")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getAllKpiRowsForScope(kpis, scopeColumn) {
  if (!scopeColumn) {
    return kpis.rows.map((row, index) => {
      const label = getKpiLabel(row, kpis);
      const aggregate = aggregateKpiRow(row, kpis.columns, kpis.labelKey);
      return {
        key: `${label}-${index}`,
        label,
        shortLabel: shortenLabel(label),
        value: isFiniteNumber(aggregate.value) ? aggregate.value : null,
        sourceColumn: aggregate.sourceColumn,
      };
    });
  }

  return kpis.rows.map((row, index) => {
    const label = getKpiLabel(row, kpis);
    const value = toNumber(row[scopeColumn]);
    return {
      key: `${scopeColumn}-${label}-${index}`,
      label,
      shortLabel: shortenLabel(label),
      value: isFiniteNumber(value) ? value : null,
      sourceColumn: scopeColumn,
    };
  });
}

function buildKpiScorecard(rows, allRows = rows) {
  const definitionsById = new Map(
    KPI_SCORECARD_DEFINITIONS.map((definition) => [definition.id, definition]),
  );
  const signalsById = new Map(
    KPI_SCORECARD_DEFINITIONS.map((definition) => [
      definition.id,
      resolveKpiScorecardSignal(rows, definition, allRows),
    ]),
  );
  const prioritySignals = KPI_PRIORITY_DEFINITION_IDS.map((id) => signalsById.get(id)).filter(
    Boolean,
  );
  const selectedSignals = KPI_SELECTED_DEFINITION_IDS.map(
    (id) =>
      signalsById.get(id) || resolveKpiScorecardSignal(rows, definitionsById.get(id), allRows),
  ).filter(Boolean);

  return {
    prioritySignals,
    selectedSignals,
    reportedCount: selectedSignals.filter((signal) => signal.reported).length,
  };
}

function getKpiReferenceSummary(rows) {
  const source = inferKpiReferenceSourceFromLabel(rows.map((row) => row.label).join(" "));
  if (source === "bau") return "Reference: BAU";
  if (source === "baseline") return "Reference: legacy baseline";
  if (source === "reference") return "Reference: exported reference";
  return "Reference: not exported";
}

function resolveKpiScorecardSignal(rows, definition, allRows = rows) {
  if (isEvService(definition.id)) return resolveEvService(allRows, definition.id);
  if (definition.id === COST_SCORECARD_DEFINITION.id) return resolveCostSignal(rows);
  const candidates = definition?.candidates || {};
  const primaryMatch = findKpiCandidate(rows, candidates.primary || []);
  const policyMatch = findKpiCandidate(rows, candidates.policy || []);
  const referenceMatch = findKpiCandidate(rows, candidates.reference || []);
  const deltaMatch = findKpiCandidate(rows, candidates.delta || []);
  const ratioMatch = findKpiCandidate(rows, candidates.ratio || []);
  const overrides = primaryMatch?.candidate || {};
  const resolvedDefinition = {
    ...definition,
    title: overrides.title || definition.title,
    description: overrides.description || definition.description,
    referenceMode: overrides.referenceMode || definition.referenceMode || "compare",
    valueStyle: overrides.valueStyle || definition.valueStyle || "number",
    unit: overrides.unit || definition.unit,
    toneRule: overrides.toneRule || definition.toneRule || "neutral",
  };
  const policy =
    policyMatch?.value ??
    (resolvedDefinition.primaryRole === "policy" || resolvedDefinition.referenceMode === "none"
      ? (primaryMatch?.value ?? null)
      : null);
  const reference = referenceMatch?.value ?? null;
  const delta =
    deltaMatch?.value ??
    (isFiniteNumber(policy) && isFiniteNumber(reference)
      ? computeKpiDelta(policy, reference, resolvedDefinition)
      : null);
  const deltaPct =
    ratioToDeltaPct(ratioMatch?.value) ??
    (isFiniteNumber(delta) && isFiniteNumber(reference) && Math.abs(reference) > 1e-9
      ? (delta / Math.abs(reference)) * 100
      : null);
  const primary = pickKpiPrimaryValue({
    primaryMatch,
    policy,
    reference,
    delta,
    ratio: ratioMatch?.value ?? null,
    definition: resolvedDefinition,
  });
  const sourceKeys = unique(
    [primaryMatch, policyMatch, referenceMatch, deltaMatch, ratioMatch]
      .filter(Boolean)
      .map((match) => match.row.key),
  );
  const signal = {
    id: resolvedDefinition.id,
    title: resolvedDefinition.title,
    description: resolvedDefinition.description,
    valueStyle: resolvedDefinition.valueStyle,
    unit:
      resolvedDefinition.unit || inferKpiUnit(primaryMatch?.row?.label || resolvedDefinition.title),
    toneRule: resolvedDefinition.toneRule,
    referenceMode: resolvedDefinition.referenceMode,
    comparisonDirection: resolvedDefinition.comparisonDirection || "neutral",
    reported:
      isFiniteNumber(primary) ||
      isFiniteNumber(policy) ||
      isFiniteNumber(reference) ||
      isFiniteNumber(delta),
    primary,
    policy,
    reference,
    delta,
    deltaPct,
    sourceKeys,
    sourceLabel:
      primaryMatch?.row?.label || policyMatch?.row?.label || referenceMatch?.row?.label || null,
    referenceSource: inferKpiReferenceSourceFromLabel(
      referenceMatch?.row?.label ||
        ratioMatch?.row?.label ||
        deltaMatch?.row?.label ||
        primaryMatch?.row?.label ||
        "",
    ),
  };
  signal.tone = scoreKpiSignalTone(signal);
  return signal;
}

function findKpiCandidate(rows, candidates) {
  for (const rawCandidate of candidates) {
    const candidate = typeof rawCandidate === "string" ? { key: rawCandidate } : rawCandidate;
    const row = rows.find((item) => rowMatchesKpiCandidate(item, candidate.key));
    if (!row || !isFiniteNumber(row.value)) continue;
    return {
      row,
      candidate,
      value: candidate.transform === "negate" ? -row.value : row.value,
    };
  }

  return null;
}

function rowMatchesKpiCandidate(row, candidateKey) {
  const normalizedLabel = normalizeColumnName(
    String(row.label).replace(/^portfolio_/i, "district_"),
  );
  const normalizedCandidate = normalizeColumnName(candidateKey);
  if (!normalizedLabel || !normalizedCandidate) return false;

  const tokens = String(candidateKey || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((token) => !["district", "building", "community"].includes(token));

  if (normalizedLabel === normalizedCandidate) return true;

  const isSpecificCandidate = tokens.length > 3;
  if (
    !isSpecificCandidate &&
    (normalizedLabel.includes(normalizedCandidate) || normalizedLabel.endsWith(normalizedCandidate))
  ) {
    return true;
  }

  if (isSpecificCandidate) return false;

  const roleTokens = ["business", "usual", "baseline", "delta", "control", "ratio", "reference"];
  const candidateHasRole = roleTokens.some((token) =>
    normalizeColumnName(candidateKey).includes(token),
  );
  const labelHasRole = roleTokens.some((token) => normalizedLabel.includes(token));
  if (labelHasRole && !candidateHasRole) return false;

  return (
    tokens.length > 0 &&
    tokens.every((token) => normalizedLabel.includes(normalizeColumnName(token)))
  );
}

function pickKpiPrimaryValue({ primaryMatch, policy, delta, ratio, definition }) {
  if (definition.primaryRole === "ratio" && isFiniteNumber(ratio)) return ratio;
  if (definition.primaryRole === "delta" && isFiniteNumber(delta)) return delta;
  if (definition.primaryRole === "policy" && isFiniteNumber(policy)) return policy;
  if (primaryMatch && isFiniteNumber(primaryMatch.value)) return primaryMatch.value;
  if (isFiniteNumber(delta)) return delta;
  if (isFiniteNumber(policy)) return policy;
  return null;
}

function computeKpiDelta(policy, reference, definition) {
  if (definition.computedDelta === "reference-minus-policy") return reference - policy;
  return policy - reference;
}

function ratioToDeltaPct(value) {
  if (!isFiniteNumber(value)) return null;
  if (Math.abs(value) <= 10) return (value - 1) * 100;
  return value;
}

function scoreKpiSignalTone(signal) {
  if (!signal.reported) return "unknown";
  if (isFiniteNumber(signal.delta)) {
    if (signal.comparisonDirection === "lower-is-better") {
      if (signal.delta < -1e-9) return "better";
      if (signal.delta > 1e-9) return "worse";
    }
    if (signal.comparisonDirection === "higher-is-better") {
      if (signal.delta > 1e-9) return "better";
      if (signal.delta < -1e-9) return "worse";
    }
    if (
      signal.comparisonDirection === "closer-to-zero" &&
      isFiniteNumber(signal.policy) &&
      isFiniteNumber(signal.reference)
    ) {
      if (Math.abs(signal.policy) < Math.abs(signal.reference)) return "better";
      if (Math.abs(signal.policy) > Math.abs(signal.reference)) return "worse";
    }
  }

  const value = signal.primary;
  if (!isFiniteNumber(value)) return "unknown";
  if (signal.toneRule === "positive-saving") {
    if (value > 1e-9) return "better";
    if (value < -1e-9) return "worse";
    return "neutral";
  }
  if (signal.toneRule === "service-rate") {
    const percent = normalizePercent(value);
    if (percent >= 98) return "better";
    if (percent >= 95) return "neutral";
    return "worse";
  }
  if (signal.toneRule === "zero-risk") {
    return Math.abs(value) < 1e-9 ? "better" : "worse";
  }
  if (signal.toneRule === "lower-ratio-better") {
    if (value <= 0.98) return "better";
    if (value <= 1.02) return "neutral";
    return "worse";
  }
  if (signal.toneRule === "higher-rate-better") {
    const percent = normalizePercent(value);
    if (percent >= 80) return "better";
    if (percent >= 50) return "neutral";
    return "worse";
  }
  if (signal.toneRule === "lower-is-better") {
    return getKpiTone({ label: signal.title, value });
  }
  return "neutral";
}

function resolveKpiComparison(signal) {
  const referenceLabel = formatKpiReferenceLabel(signal.referenceSource);
  if (signal.valueStyle === "ratio" && isFiniteNumber(signal.primary)) {
    const ratioDelta = (signal.primary - 1) * 100;
    const ratioDeltaLabel = isFiniteNumber(ratioDelta)
      ? `${ratioDelta > 0 ? "+" : ""}${formatNumber(ratioDelta)}%`
      : "Not reported";
    return {
      tone: signal.tone || "unknown",
      policyLabel: "Ratio",
      policy: formatKpiScorecardValue(signal),
      hasReference: true,
      referenceLabel: `${referenceLabel} parity`,
      reference: "1x",
      deltaLabel: signal.kind === "cost-ratio" ? "Ratio change vs parity" : "Delta vs parity",
      delta: ratioDeltaLabel,
    };
  }

  return {
    tone: signal.tone || "unknown",
    policyLabel: "Policy",
    policy: formatKpiScorecardField(
      signal.kind === "cost-saving" ? signal.policy : (signal.policy ?? signal.primary),
      signal,
    ),
    hasReference: isFiniteNumber(signal.reference),
    referenceLabel,
    reference: formatKpiScorecardField(signal.reference, signal),
    deltaLabel: `${signal.kind === "cost-saving" ? "Saving" : "Delta"} vs ${referenceLabel}${isFiniteNumber(signal.deltaPct) ? ` (${formatNumber(signal.deltaPct)}%)` : ""}`,

    delta: formatKpiScorecardField(signal.delta, signal),
  };
}

function inferKpiReferenceSourceFromLabel(label) {
  const lower = String(label || "").toLowerCase();
  if (
    lower.includes("business_as_usual") ||
    lower.includes("business as usual") ||
    lower.includes("vs_bau") ||
    /(?:^|[^a-z])bau(?:[^a-z]|$)/.test(lower)
  ) {
    return "bau";
  }
  if (lower.includes("baseline") || lower.includes("to_baseline")) return "baseline";
  if (lower.includes("reference") || lower.includes("to_reference")) return "reference";
  return null;
}

function formatKpiReferenceLabel(source) {
  if (source === "bau") return "BAU";
  if (source === "baseline") return "Legacy baseline";
  if (source === "reference") return "Exported reference";
  if (source === "rbcsmart") return "RBC smart reference";
  return "Reference";
}

function formatKpiScorecardValue(signal) {
  return formatKpiScorecardField(signal.primary, signal);
}

function formatKpiScorecardField(value, signal) {
  if (!isFiniteNumber(value))
    return signal.kind === "ev-service" ? signal.statusLabel : "Not reported";
  return formatKpiValue(value, signal.valueStyle, signal.unit);
}

function formatKpiValue(value, valueStyle, unit) {
  if (!isFiniteNumber(value)) return "N/A";
  if (valueStyle === "currency") return `${formatNumber(value)} ${unit || "EUR"}`;
  if (valueStyle === "energy") return `${formatNumber(value)} ${unit || "kWh"}`;
  if (valueStyle === "percentage") return `${formatNumber(normalizePercent(value))}%`;
  if (valueStyle === "ratio")
    return `${formatNumber(value)}${unit && unit !== "x" ? ` ${unit}` : "x"}`;
  return `${formatNumber(value)}${unit && unit !== "x" ? ` ${unit}` : ""}`.trim();
}

function inferKpiUnit(label) {
  const lower = String(label || "").toLowerCase();
  if (/eur|cost|price|tariff/.test(lower)) return "EUR";
  if (/kwh|energy|import|export|throughput|consumption/.test(lower)) return "kWh";
  if (/ratio|rate|percent|percentage|self[-_\s]*consumption|tolerance|feasible/.test(lower))
    return "%";
  if (/co2|carbon|emission/.test(lower)) return "kg";
  return "";
}

function getKpiTone(row) {
  const lower = row.label.toLowerCase();
  const higherIsBetter =
    /self[-_\s]*consumption|solar|satisfaction|service|saving|reward|score/.test(lower);
  const lowerIsBetter = /cost|carbon|emission|ramping|peak|penalty|violation|consumption/.test(
    lower,
  );
  let tone = "neutral";
  if (higherIsBetter && row.value > 0) tone = "better";
  else if (higherIsBetter && row.value < 0) tone = "worse";
  else if (lowerIsBetter && row.value < 0) tone = "better";
  else if (lowerIsBetter && row.value > 0) tone = "worse";
  return tone;
}

export {
  buildKpiScopes,
  getAllKpiRowsForScope,
  buildKpiScorecard,
  getKpiReferenceSummary,
  resolveKpiScorecardSignal,
  ratioToDeltaPct,
  resolveKpiComparison,
  inferKpiReferenceSourceFromLabel,
  formatKpiReferenceLabel,
  formatKpiScorecardValue,
  formatKpiValue,
  inferKpiUnit,
  getKpiTone,
};
