import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Papa from "papaparse";
import {
  buildKpiScopes,
  getAllKpiRowsForScope,
  buildKpiScorecard,
} from "../src/results/kpi-scorecard.js";
import { buildCompareKpiScopes, buildCompareScorecardRows } from "../src/results/kpi-comparison.js";
import { buildKpiDrilldownSections } from "../src/results/kpi-drilldown.js";
import { toNumber } from "../src/results/values.js";

const kpis = (metrics) => ({
  labelKey: "KPI",
  columns: ["KPI", "District"],
  rows: Object.entries(metrics).map(([KPI, District]) => ({ KPI, District })),
});
function signals(table, column = "District") {
  const all = getAllKpiRowsForScope(table, column);
  return buildKpiScorecard(
    all.filter((row) => Number.isFinite(row.value)),
    all,
  ).selectedSignals;
}
const cost = (metrics) =>
  signals(kpis(metrics)).find((signal) => signal.id === "cost-saving-reference");
test("the extracted scorecard shows absolute cost when no reference was exported", () => {
  const s = cost({ district_cost_total_control_eur: 80 });
  assert.equal(s.primary, 80);
  assert.equal(s.kind, "cost-total");
  assert.equal(s.title, "Cost");
});
test("the extracted scorecard keeps negative/zero reference arithmetic and does not invent a percentage", () => {
  const negative = cost({
    district_cost_total_control_eur: -120,
    district_cost_total_business_as_usual_eur: -100,
  });
  assert.equal(negative.primary, 20);
  assert.equal(negative.deltaPct, 20);
  const zero = cost({
    district_cost_total_control_eur: 20,
    district_cost_total_business_as_usual_eur: 0,
  });
  assert.equal(zero.primary, -20);
  assert.equal(zero.deltaPct, null);
});
test("the extracted comparison resolves a common absolute measure under a partial reference", () => {
  const sims = [
    {
      id: "A",
      kpis: kpis({
        district_cost_total_control_eur: 80,
        district_cost_total_business_as_usual_eur: 100,
      }),
    },
    { id: "B", kpis: kpis({ district_cost_total_control_eur: 90 }) },
  ];
  const row = buildCompareScorecardRows(sims, buildCompareKpiScopes(sims)[0])[0];
  assert.equal(row.title, "Cost");
  assert.equal(row.signalsBySimulationId.A.primary, 80);
  assert.equal(row.signalsBySimulationId.B.primary, 90);
  assert.deepEqual(row.bestSimulationIds, ["A"]);
});
test("scope identities preserve punctuation and a member named community", () => {
  const table = {
    labelKey: "KPI",
    columns: ["KPI", "District", "A-B", "A B", "community"],
    rows: [{ KPI: "cost", District: 1, "A-B": 2, "A B": 3, community: 4 }],
    levels: { District: "district", "A-B": "building", "A B": "building", community: "building" },
  };
  const scopes = buildKpiScopes(table);
  assert.equal(new Set(scopes.map((s) => s.id)).size, 4);
  assert.equal(scopes.find((s) => s.column === "community").id, "column:community");
});
test("all-null declared EV metrics remain present in the extracted scorecard evidence", () => {
  const table = kpis({
    district_ev_departure_audit_departures_count: 0,
    district_ev_departure_audit_min_acceptable_service_feasible_ratio: null,
  });
  const all = getAllKpiRowsForScope(table, "District");
  assert.equal(all[1].value, null);
  const ev = signals(table).find((s) => s.id === "ev-min-feasible");
  assert.equal(ev.reported, false);
  assert.equal(ev.status, "not-applicable");
});
test("drill-down retains extra indicators, zero values and raw scope identity", () => {
  const rows = getAllKpiRowsForScope(
    kpis({ district_cost_total_control_eur: 0, district_custom_energy_import_kwh: 3 }),
    "District",
  );
  const sections = buildKpiDrilldownSections(rows, {
    familyFilter: "all",
    search: "",
    showNa: true,
    selectedScope: { column: "District" },
  });
  const entries = sections.flatMap((s) => s.subfamilies.flatMap((f) => f.rows));
  assert(entries.some((r) => r.primary === 0));
  assert(entries.some((r) => r.primary === 3));
});
for (const name of [
  "citylearn",
  "cps-core",
  "cps-micro",
  "cps-premium",
  "legacy-basic",
  "legacy-community",
  "legacy-smart",
])
  test(`real ${name} costs reconcile through the public scorecard model`, () => {
    const p = new URL(`./fixtures/cost-exports/${name}.csv`, import.meta.url),
      data = Papa.parse(fs.readFileSync(p, "utf8"), { header: true, skipEmptyLines: true });
    const table = { rows: data.data, columns: data.meta.fields, labelKey: "KPI" };
    for (const scope of buildKpiScopes(table)) {
      const all = getAllKpiRowsForScope(table, scope.column),
        raw = new Map(all.map((r) => [r.label, r.value])),
        prefix = scope.column === "District" ? "district" : "building";
      const control = raw.get(prefix + "_cost_total_control_eur");
      if (!Number.isFinite(control)) continue;
      const actual = signals(table, scope.column).find((s) => s.id === "cost-saving-reference");
      assert.equal(actual.policy, control);
      const bau = raw.get(prefix + "_cost_total_business_as_usual_eur"),
        baseline = raw.get(prefix + "_cost_total_baseline_eur"),
        reference = Number.isFinite(bau) ? bau : baseline;
      assert.equal(actual.primary, Number.isFinite(reference) ? reference - control : control);
    }
  });
for (const name of [
  "citylearn",
  "cps-core",
  "cps-micro",
  "cps-premium",
  "legacy-basic",
  "legacy-community",
  "legacy-smart",
])
  test(`real ${name} EV cards preserve reported departure rates through the public model`, () => {
    const data = Papa.parse(
      fs.readFileSync(new URL(`./fixtures/ev-exports/${name}.csv`, import.meta.url), "utf8"),
      { header: true, skipEmptyLines: true },
    );
    const table = { rows: data.data, columns: data.meta.fields, labelKey: "KPI" };
    for (const scope of buildKpiScopes(table))
      for (const s of signals(table, scope.column).filter(
        (s) => s.kind === "ev-service" && s.reported,
      )) {
        assert(s.primary >= 0 && s.primary <= 1);
        assert(table.rows.some((r) => toNumber(r[scope.column]) === s.primary));
      }
  });
