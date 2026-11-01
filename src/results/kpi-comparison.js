import {
  buildKpiScopes,
  resolveKpiScorecardSignal,
  getAllKpiRowsForScope,
  buildKpiScorecard,
  formatKpiValue,
  getKpiReferenceSummary,
} from "./kpi-scorecard.js";
import { compareNatural, unique } from "../utils/collections.js";
import { KPI_SCORECARD_DEFINITIONS, KPI_SELECTED_DEFINITION_IDS } from "./kpi-definitions.js";
import {
  COST_SCORECARD_DEFINITION,
  resolveCostComparison,
  bestCostIndices,
  costComparisonDelta,
} from "./cost.js";
import { isEvService, evComparison, bestEvIndices, evComparisonDelta } from "./ev-service.js";
import { isFiniteNumber, formatNumber } from "./values.js";
import {
  compareKpiFamilies,
  buildKpiDrilldownSections,
  formatKpiFamilyLabel,
  formatKpiDrilldownValue,
} from "./kpi-drilldown.js";

function buildCompareKpiScopes(simulations) {
  const scopesById = new Map();

  simulations.forEach((simulation) => {
    if (!simulation.kpis) return;
    buildKpiScopes(simulation.kpis).forEach((scope) => {
      const current = scopesById.get(scope.id) || {
        id: scope.id,
        label: scope.label,
        group: getCompareScopeGroup(scope),
        columnsBySimulationId: {},
      };
      current.columnsBySimulationId[simulation.id] = scope.column;
      scopesById.set(scope.id, current);
    });
  });

  return [...scopesById.values()].sort((left, right) => {
    const order = { portfolio: -1, community: 0, building: 1, other: 2 };
    const groupOrder = order[left.group] - order[right.group];
    if (groupOrder !== 0) return groupOrder;
    return compareNatural(left.label, right.label);
  });
}

function getCompareScopeGroup(scope) {
  if (scope.group) return scope.group;
  if (scope.id === "community") return "community";
  if (/building|house|site|asset/i.test(`${scope.id} ${scope.label}`)) return "building";
  return "other";
}

function buildCompareScorecardRows(simulations, scope) {
  const definitionsById = new Map(
    KPI_SCORECARD_DEFINITIONS.map((definition) => [definition.id, definition]),
  );
  const signalsBySimulation = new Map(
    simulations.map((simulation) => [
      simulation.id,
      getCompareScorecardSignalMap(simulation, scope),
    ]),
  );

  return KPI_SELECTED_DEFINITION_IDS.map((id) => {
    const definition = definitionsById.get(id);
    const signalsBySimulationId = {};
    simulations.forEach((simulation) => {
      signalsBySimulationId[simulation.id] =
        signalsBySimulation.get(simulation.id)?.get(id) ||
        resolveKpiScorecardSignal([], definition);
    });

    const cost =
      id === COST_SCORECARD_DEFINITION.id
        ? resolveCostComparison(simulations.map((s) => signalsBySimulationId[s.id]))
        : null;
    if (cost)
      simulations.forEach((s, index) => {
        signalsBySimulationId[s.id] = cost.signals[index];
      });
    const ev = isEvService(id)
      ? evComparison(
          simulations.map((s) => signalsBySimulationId[s.id]),
          id,
        )
      : null;
    return {
      id,
      definition,
      title: cost?.title || ev?.title || definition.title,
      description: cost?.description || ev?.description || definition.description,
      mixedMeasures: cost?.mixedMeasures || ev?.mixedMeasures || false,
      reportedCount: simulations.filter(
        (simulation) => signalsBySimulationId[simulation.id]?.reported,
      ).length,
      bestSimulationIds: resolveBestCompareSimulationIds(
        definition,
        simulations,
        signalsBySimulationId,
      ),
      signalsBySimulationId,
    };
  });
}

function getCompareScorecardSignalMap(simulation, scope) {
  const scopeColumn = scope?.columnsBySimulationId?.[simulation.id];
  const allRows =
    simulation.kpis && scopeColumn ? getAllKpiRowsForScope(simulation.kpis, scopeColumn) : [];
  const scorecard = buildKpiScorecard(
    allRows.filter((row) => isFiniteNumber(row.value)),
    allRows,
  );
  return new Map(scorecard.selectedSignals.map((signal) => [signal.id, signal]));
}

function resolveBestCompareSimulationIds(definition, simulations, signalsBySimulationId) {
  if (isEvService(definition.id)) {
    return bestEvIndices(simulations.map((s) => signalsBySimulationId[s.id])).map(
      (index) => simulations[index].id,
    );
  }
  if (definition.id === COST_SCORECARD_DEFINITION.id) {
    return bestCostIndices(simulations.map((s) => signalsBySimulationId[s.id])).map(
      (index) => simulations[index].id,
    );
  }
  const direction = getKpiDefinitionCompareDirection(definition);
  if (direction === "neutral") return [];

  const comparable = simulations
    .map((simulation) => ({
      id: simulation.id,
      value: signalsBySimulationId[simulation.id]?.primary ?? null,
    }))
    .filter((item) => isFiniteNumber(item.value));
  if (comparable.length === 0) return [];

  const score = (value) => (direction === "absolute-lower" ? Math.abs(value) : value);
  const bestScore =
    direction === "higher"
      ? Math.max(...comparable.map((item) => score(item.value)))
      : Math.min(...comparable.map((item) => score(item.value)));

  return comparable
    .filter((item) => Math.abs(score(item.value) - bestScore) < 1e-9)
    .map((item) => item.id);
}

function getKpiDefinitionCompareDirection(definition) {
  if (definition?.comparisonDirection === "higher-is-better") return "higher";
  if (definition?.comparisonDirection === "lower-is-better") return "lower";
  if (definition?.comparisonDirection === "closer-to-zero") return "absolute-lower";
  if (
    definition?.toneRule === "positive-saving" ||
    definition?.toneRule === "service-rate" ||
    definition?.toneRule === "higher-rate-better"
  ) {
    return "higher";
  }
  if (
    definition?.toneRule === "zero-risk" ||
    definition?.toneRule === "lower-ratio-better" ||
    definition?.toneRule === "lower-is-better"
  ) {
    return "lower";
  }
  return "neutral";
}

function formatCompareSignalDelta(signal, baselineSignal, definition) {
  if (isEvService(definition.id)) {
    const ev = evComparisonDelta(signal, baselineSignal);
    return ev
      ? {
          label:
            Math.abs(ev.points) < 1e-9
              ? "Equal"
              : `${ev.points > 0 ? "+" : ""}${formatNumber(ev.points)} pp vs baseline`,
          tone: ev.tone,
        }
      : null;
  }
  const value = signal?.primary ?? null;
  const baseline = baselineSignal?.primary ?? null;
  if (!isFiniteNumber(value) || !isFiniteNumber(baseline)) return null;

  const cost =
    definition.id === COST_SCORECARD_DEFINITION.id
      ? costComparisonDelta(signal, baselineSignal)
      : null;
  if (definition.id === COST_SCORECARD_DEFINITION.id && !cost) return null;
  const delta = cost ? cost.value : value - baseline;
  if (Math.abs(delta) < 1e-9) {
    return { label: "Equal", tone: "neutral" };
  }

  return {
    label: `${formatCompareSignedValue(delta, signal || definition)} vs baseline`,
    tone: cost ? cost.tone : scoreCompareValueAgainstBaseline(definition, value, baseline),
  };
}

function formatCompareSignedValue(value, signal) {
  const absolute = Math.abs(value);
  const formatted = formatKpiValue(absolute, signal?.valueStyle || "number", signal?.unit || "");
  return `${value > 0 ? "+" : "-"}${formatted}`;
}

function scoreCompareValueAgainstBaseline(definition, value, baseline) {
  if (!isFiniteNumber(value) || !isFiniteNumber(baseline) || Math.abs(value - baseline) < 1e-9)
    return "neutral";
  const direction = getKpiDefinitionCompareDirection(definition);
  if (direction === "higher") return value > baseline ? "better" : "worse";
  if (direction === "lower") return value < baseline ? "better" : "worse";
  if (direction === "absolute-lower")
    return Math.abs(value) < Math.abs(baseline) ? "better" : "worse";
  return "neutral";
}

function buildCompareKpiMatrixRows(simulations, scope, showUnion) {
  const rowsByKey = new Map();

  simulations.forEach((simulation) => {
    buildCompareKpiDrilldownRows(simulation, scope).forEach((row) => {
      const current = rowsByKey.get(row.key) || {
        key: row.key,
        label: row.label,
        family: row.family,
        subfamily: row.subfamily,
        sourceLabels: [],
        unit: row.unit,
        valuesBySimulationId: {},
      };
      current.valuesBySimulationId[simulation.id] = row;
      current.sourceLabels = unique([...current.sourceLabels, ...row.sourceLabels]).sort(
        compareNatural,
      );
      current.unit = current.unit || row.unit;
      rowsByKey.set(row.key, current);
    });
  });

  return [...rowsByKey.values()]
    .map((row) => ({
      ...row,
      reportedCount: simulations.filter(
        (simulation) => row.valuesBySimulationId[simulation.id]?.reported,
      ).length,
    }))
    .filter((row) => showUnion || row.reportedCount === simulations.length)
    .sort((left, right) => {
      const familySort = compareKpiFamilies(left.family, right.family);
      if (familySort !== 0) return familySort;
      const subfamilySort = compareNatural(left.subfamily.label, right.subfamily.label);
      if (subfamilySort !== 0) return subfamilySort;
      return compareNatural(left.label, right.label);
    });
}

function buildCompareKpiDrilldownRows(simulation, scope) {
  const scopeColumn = scope?.columnsBySimulationId?.[simulation.id];
  if (!simulation.kpis || !scopeColumn) return [];

  return buildKpiDrilldownSections(getAllKpiRowsForScope(simulation.kpis, scopeColumn), {
    familyFilter: "all",
    search: "",
    showNa: true,
    selectedScope: { ...scope, column: scopeColumn },
  }).flatMap((familySection) =>
    familySection.subfamilies.flatMap((subfamily) =>
      subfamily.rows.map((row) => ({
        ...row,
        family: familySection.family,
        subfamily: { key: subfamily.key, label: subfamily.label },
      })),
    ),
  );
}

function buildCompareKpiFamilyOptions(rows) {
  return unique(rows.map((row) => row.family))
    .sort(compareKpiFamilies)
    .map((family) => ({ family, label: formatKpiFamilyLabel(family) }));
}

function getCompareSimulationReferenceSummary(simulation, scope) {
  const scopeColumn = scope?.columnsBySimulationId?.[simulation.id];
  if (!simulation.kpis || !scopeColumn) return "Reference: not exported";
  return getKpiReferenceSummary(getAllKpiRowsForScope(simulation.kpis, scopeColumn));
}

function formatCompareMatrixValue(entry, row) {
  if (!entry || !isFiniteNumber(entry.primary)) return "N/A";
  return formatKpiDrilldownValue(entry.primary, entry.unit || row.unit);
}

export {
  buildCompareKpiScopes,
  buildCompareScorecardRows,
  formatCompareSignalDelta,
  buildCompareKpiMatrixRows,
  buildCompareKpiFamilyOptions,
  getCompareSimulationReferenceSummary,
  formatCompareMatrixValue,
};
