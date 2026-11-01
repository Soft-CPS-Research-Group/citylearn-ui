import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { sourceIdentity, simulationIdentity } from "../src/results/identity.js";
import { parseResultFolder, groupResultFiles } from "../src/results/import.js";
import { buildEquipmentTree } from "../src/results/equipment.js";
import {
  buildKpiScopes,
  getAllKpiRowsForScope,
  buildKpiScorecard,
} from "../src/results/kpi-scorecard.js";
import { buildCompareKpiScopes, buildCompareScorecardRows } from "../src/results/kpi-comparison.js";
const file = (name, text, folder = "run", modified = 0) => ({
  name,
  webkitRelativePath: folder + "/" + name,
  size: new TextEncoder().encode(text).length,
  lastModified: modified,
  text: async () => text,
});
const asset = (name, value = 1, folder = "run") =>
  file(
    `exported_data_${name}_ep0.csv`,
    `timestamp,Net Electricity Consumption-kWh,Non-shiftable Load-kWh\n2023-01-01T00:00Z,${value},${value}\n`,
    folder,
  );
const parse = (files) => parseResultFolder(groupResultFiles(files)[0]);
const long = (rows) =>
  file(
    "kpis.csv",
    "community_id,level,name,cost_function,value\n" +
      rows.map((r) => r.join(",")).join("\n") +
      "\n",
  );
const score = (kpis, scope) => {
  const all = getAllKpiRowsForScope(kpis, scope.column);
  return buildKpiScorecard(
    all.filter((r) => Number.isFinite(r.value)),
    all,
  );
};
for (const [a, b] of [
  ["Aa", "BB"],
  ["ebrfklla", "nicmkbit"],
])
  test(`previous 32-bit collision ${a}/${b} keeps series and selection identities distinct`, async () => {
    const sim = await parse([asset(a, 1), asset(b, 9)]);
    assert.equal(sim.series.length, 2);
    assert.equal(new Set(sim.series.map((s) => s.id)).size, 2);
    const tree = buildEquipmentTree(sim, "ep0"),
      items = tree.buildings.map((b) => b.items.find((i) => i.type === "consumption"));
    assert.equal(new Set(items.map((i) => i.id)).size, 2);
    for (const [name, value] of [
      [a, "1"],
      [b, "9"],
    ]) {
      const selected = items.find((i) => i.id === items.find((i) => i.buildingId === name).id);
      assert.equal(selected.title, name + " Consumption");
      assert.equal(selected.series.rows[0]["Net Electricity Consumption-kWh"], value);
    }
  });
test("tuple source identities preserve punctuation, boundaries, case and numeric-looking names", () => {
  const inputs = [
    ["A:B", 1, 23],
    ["A", 12, 3],
    ["a", 12, 3],
    ["001", 12, 3],
    ["1", 12, 3],
    ['["a"]', 12, 3],
    ["a|b", 12, 3],
    ["a/b", 12, 3],
    ["__proto__", 0, 0],
  ];
  assert.equal(new Set(inputs.map((p) => sourceIdentity("series", p))).size, inputs.length);
  assert.equal(sourceIdentity("series", inputs[0]), sourceIdentity("series", inputs[0]));
});
test("folder fingerprints are stable across picker order and replace the same import without confusing sibling folders", async () => {
  const a = asset("Aa", 1),
    b = asset("BB", 9);
  const first = await parse([a, b]),
    again = await parse([b, a]);
  assert.equal(first.id, again.id);
  const other = await parse([asset("Aa", 1, "other/run"), asset("BB", 9, "other/run")]);
  assert.notEqual(first.id, other.id);
  const updated = await parse([a, { ...b, lastModified: 1 }]);
  assert.notEqual(updated.id, first.id);
});
test("folder identities remain available without Web Crypto and remain distinct", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  try {
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
    const a = await simulationIdentity("A", [["file", 1, 0]]);
    assert(a.startsWith("simulation:["));
    assert.notEqual(a, await simulationIdentity("B", [["file", 1, 0]]));
    assert.equal(a, await simulationIdentity("A", [["file", 1, 0]]));
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "crypto", descriptor);
    else delete globalThis.crypto;
  }
});
for (const format of ["csv", "parquet"])
  test(`native multi-community ${format} retains every local/portfolio scope and raw record`, async () => {
    const name = "exported_kpis_multi_community." + format,
      bytes = fs.readFileSync(new URL("./fixtures/multi-community/" + name, import.meta.url));
    const sim = await parse([
      {
        name,
        webkitRelativePath: "multi/" + name,
        size: bytes.length,
        lastModified: 0,
        text: async () => bytes.toString(),
        arrayBuffer: async () =>
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      },
    ]);
    assert.equal(sim.quality.diagnostics.filter((d) => d.code === "kpi-identity").length, 0);
    const scopes = buildKpiScopes(sim.kpis);
    assert.equal(scopes.length, 5);
    assert.equal(scopes[0].group, "portfolio");
    assert.equal(sim.tables.find((t) => t.label === "Original long KPI rows").rows.length, 5);
    const signals = scopes.map((scope) => ({
      scope,
      cost: score(sim.kpis, scope).selectedSignals.find((s) => s.id === "cost-saving-reference"),
    }));
    for (const [communityId, value] of [
      ["north", 80],
      ["south", 120],
    ]) {
      const locals = signals.filter((x) => x.scope.identity.communityId === communityId);
      assert.equal(locals.length, 2);
      assert(locals.every((x) => x.cost.primary === value));
    }
    assert.equal(signals.find((s) => s.scope.group === "portfolio").cost.primary, 200);
    assert.equal(
      sim.kpis.rows.find((r) => r.KPI === "portfolio_cost_total_control_eur")[scopes[0].column],
      format === "csv" ? "200.0" : 200,
    );
    assert(scopes.every((s) => !sim.kpis.columnLabels[s.column].includes("scope:[")));
  });
test("duplicate records within one community stay excluded while another community remains usable", async () => {
  const rows = [
    ["north", "district", "District", "district_cost_total_control_eur", 80],
    ["north", "district", "District", "district_cost_total_control_eur", 90],
    ["south", "district", "District", "district_cost_total_control_eur", 120],
  ];
  const sim = await parse([long(rows)]);
  assert.equal(sim.quality.diagnostics.filter((d) => d.code === "kpi-identity").length, 2);
  const scopes = buildKpiScopes(sim.kpis);
  assert.equal(scopes.length, 1);
  assert.equal(scopes[0].identity.communityId, "south");
  assert.equal(score(sim.kpis, scopes[0]).selectedSignals[0].primary, 120);
  assert.equal(sim.tables[0].rows.length, 3);
});
test("the same local name at different levels does not collapse qualified identities", async () => {
  const sim = await parse([
    long([
      ["north", "district", "District", "district_cost_total_control_eur", 80],
      ["north", "building", "District", "building_cost_total_control_eur", 20],
    ]),
  ]);
  const scopes = buildKpiScopes(sim.kpis);
  assert.equal(scopes.length, 2);
  assert.equal(new Set(scopes.map((s) => s.id)).size, 2);
  assert.notEqual(scopes[0].label, scopes[1].label);
});
test("punctuation, prototype names, numbers and reserved-looking strings remain community identities", async () => {
  const names = ["001", "1", "__proto__", "constructor", "A-B", "A B", "Portfolio"];
  const sim = await parse([
    long(names.map((n, i) => [n, "building", "Building_1", "building_cost_total_control_eur", i])),
  ]);
  const scopes = buildKpiScopes(sim.kpis);
  assert.equal(scopes.length, names.length);
  assert(
    !sim.quality.diagnostics.some(
      (d) => d.column === "community_id" && d.code === "invalid-number",
    ),
  );
  assert.equal(new Set(scopes.map((s) => s.id)).size, names.length);
  for (const [i, name] of names.entries())
    assert.equal(
      score(
        sim.kpis,
        scopes.find((s) => s.identity.communityId === name),
      ).selectedSignals[0].primary,
      i,
    );
});
test("a declared but missing community identity is diagnosed without discarding other valid scopes", async () => {
  const sim = await parse([
    long([
      ["", "building", "A", "building_cost_total_control_eur", 2],
      ["north", "building", "A", "building_cost_total_control_eur", 3],
    ]),
  ]);
  assert.equal(buildKpiScopes(sim.kpis).length, 1);
  assert.equal(sim.quality.diagnostics.filter((d) => d.code === "kpi-identity").length, 1);
});
test("optional level absence does not read an unrelated column named undefined", async () => {
  const sim = await parse([
    file(
      "kpis.csv",
      "community_id,name,cost_function,value,undefined\nnorth,A,building_cost_total_control_eur,1,extra\n",
    ),
  ]);
  assert.equal(buildKpiScopes(sim.kpis)[0].identity.level, "");
});
test("legacy long exports without community_id preserve their existing columns and scopes", async () => {
  const sim = await parse([
    file(
      "kpis.csv",
      "level,name,cost_function,value\ndistrict,District,district_cost_total_control_eur,80\nbuilding,A,building_cost_total_control_eur,20\n",
    ),
  ]);
  assert.deepEqual(sim.kpis.columns, ["KPI", "District", "A"]);
  assert.equal(sim.kpis.scopeIdentities, undefined);
  assert.equal(buildKpiScopes(sim.kpis)[0].id, "community");
});
test("portfolio cost/reference semantics preserve the correct saving, including a zero reference", async () => {
  const sim = await parse([
    long([
      ["__portfolio__", "portfolio", "Portfolio", "portfolio_cost_total_control_eur", 80],
      [
        "__portfolio__",
        "portfolio",
        "Portfolio",
        "portfolio_cost_total_business_as_usual_eur",
        100,
      ],
    ]),
  ]);
  const s = score(sim.kpis, buildKpiScopes(sim.kpis)[0]).selectedSignals[0];
  assert.equal(s.primary, 20);
  assert.equal(s.deltaPct, 20);
  assert.equal(s.reference, 100);
  const zero = await parse([
    long([
      ["__portfolio__", "portfolio", "Portfolio", "portfolio_cost_total_control_eur", 80],
      ["__portfolio__", "portfolio", "Portfolio", "portfolio_cost_total_baseline_eur", 0],
    ]),
  ]);
  const z = score(zero.kpis, buildKpiScopes(zero.kpis)[0]).selectedSignals[0];
  assert.equal(z.primary, -80);
  assert.equal(z.deltaPct, null);
});
test("portfolio EV rates keep their exported denominator semantics and are not inferred from local means", async () => {
  const sim = await parse([
    long([
      [
        "__portfolio__",
        "portfolio",
        "Portfolio",
        "portfolio_ev_departure_audit_min_acceptable_service_feasible_ratio",
        0.75,
      ],
    ]),
  ]);
  const ev = score(sim.kpis, buildKpiScopes(sim.kpis)[0]).selectedSignals.find(
    (s) => s.id === "ev-min-feasible",
  );
  assert.equal(ev.primary, 0.75);
  assert.equal(ev.reported, true);
});
test("portfolio equipment indicators match known KPI definitions without changing original metric labels", async () => {
  const sim = await parse([
    long([
      [
        "__portfolio__",
        "portfolio",
        "Portfolio",
        "portfolio_electrical_service_phase_violations_energy_total_kwh",
        2,
      ],
    ]),
  ]);
  const signal = score(sim.kpis, buildKpiScopes(sim.kpis)[0]).prioritySignals.find(
    (s) => s.id === "electrical-violations",
  );
  assert.equal(signal.primary, 2);
  assert.equal(
    sim.kpis.rows[0].KPI,
    "portfolio_electrical_service_phase_violations_energy_total_kwh",
  );
});
test("comparison aligns qualified community identities across exports and keeps portfolio separate", async () => {
  const rows = [
    ["north", "district", "District", "district_cost_total_control_eur", 80],
    ["south", "district", "District", "district_cost_total_control_eur", 120],
    ["__portfolio__", "portfolio", "Portfolio", "portfolio_cost_total_control_eur", 200],
  ];
  const a = await parse([long(rows)]),
    b = await parse([long(rows.map((r) => [...r.slice(0, -1), Number(r.at(-1)) + 10]))]);
  b.id = "second";
  const scopes = buildCompareKpiScopes([a, b]);
  assert.equal(scopes.length, 3);
  assert.equal(scopes[0].group, "portfolio");
  for (const scope of scopes) {
    const row = buildCompareScorecardRows([a, b], scope)[0];
    assert.equal(
      row.signalsBySimulationId[b.id].primary - row.signalsBySimulationId[a.id].primary,
      10,
    );
  }
});

test("declared communities remain selectable when every exported value is unknown", async () => {
  const sim = await parse([
    long([
      ["north", "district", "District", "district_cost_total_control_eur", ""],
      ["south", "district", "District", "district_cost_total_control_eur", 0],
    ]),
  ]);
  const scopes = buildKpiScopes(sim.kpis);
  assert.equal(scopes.length, 2);
  assert.equal(
    score(
      sim.kpis,
      scopes.find((s) => s.identity.communityId === "north"),
    ).selectedSignals[0].reported,
    false,
  );
  assert.equal(
    score(
      sim.kpis,
      scopes.find((s) => s.identity.communityId === "south"),
    ).selectedSignals[0].primary,
    0,
  );
});
test("community-local portfolio labels remain distinct from the global portfolio", async () => {
  const sim = await parse([
    long([
      ["north", "portfolio", "Portfolio", "portfolio_cost_total_control_eur", 80],
      ["south", "portfolio", "Portfolio", "portfolio_cost_total_control_eur", 120],
      ["__portfolio__", "portfolio", "Portfolio", "portfolio_cost_total_control_eur", 200],
    ]),
  ]);
  const scopes = buildKpiScopes(sim.kpis);
  assert.equal(new Set(scopes.map((s) => s.label)).size, 3);
  assert(scopes.some((s) => s.label === "Portfolio"));
});

test("a present but blocked crypto provider falls back to a complete folder identity", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  try {
    Object.defineProperty(globalThis, "crypto", {
      value: {
        subtle: {
          digest: async () => {
            throw new Error("blocked");
          },
        },
      },
      configurable: true,
    });
    assert.equal(
      await simulationIdentity("A", [["file", 1, 0]]),
      sourceIdentity("simulation", ["A", [["file", 1, 0]]]),
    );
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "crypto", descriptor);
    else delete globalThis.crypto;
  }
});

test("unrecognised levels, including prototype-looking names, remain ordinary other scopes", async () => {
  const sim = await parse([
    long([
      ["north", "constructor", "A", "cost", 1],
      ["north", "__proto__", "B", "cost", 2],
    ]),
  ]);
  assert(buildKpiScopes(sim.kpis).every((s) => s.group === "other"));
  assert(buildCompareKpiScopes([sim]).every((s) => s.group === "other"));
});

test("qualified scopes cannot align with an unqualified member named like an internal column key", async () => {
  const sim = await parse([
    long([["north", "district", "District", "district_cost_total_control_eur", 80]]),
  ]);
  const column = buildKpiScopes(sim.kpis)[0].column;
  const legacy = {
    id: "legacy",
    kpis: {
      labelKey: "KPI",
      columns: ["KPI", column],
      rows: [{ KPI: "building_cost_total_control_eur", [column]: 8 }],
      levels: { [column]: "building" },
    },
  };
  assert.equal(buildCompareKpiScopes([sim, legacy]).length, 2);
});
