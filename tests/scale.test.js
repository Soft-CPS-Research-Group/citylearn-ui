import test from "node:test";
import assert from "node:assert/strict";
import { chartOverview, overlayOverview } from "../src/results/chart-overview.js";
import { packResult, unpackResult } from "../src/results/worker-wire.js";
import { createImportTask } from "../src/results/import-task.js";
import { parseResultGroups, parseResultFolder, groupResultFiles } from "../src/results/import.js";
import { SOURCE, EXCLUDED, SIGNAL_COVERAGE } from "../src/results/quality.js";
import { GLOBAL_STEP, COVERAGE, prepareTimeline } from "../src/results/temporal.js";
const file = (
  folder = "run",
  text = "timestamp,energy-kWh\n2023-01-01T00:00Z,2\n",
  name = "exported_data_A_ep0.csv",
) => ({
  name,
  webkitRelativePath: folder + "/" + name,
  size: text.length,
  lastModified: 0,
  text: async () => text,
});
const energy = { field: "energy", strategy: "sum" },
  soc = { field: "soc", strategy: "avg" };
test("two-year display reduction retains impulses, signed extrema, endpoints and exact full-range totals", () => {
  const rows = Array.from({ length: 70176 }, (_, i) => ({
    timestamp: i * 900000,
    energy: i === 12345 ? 990 : i === 22222 ? -800 : 1,
    soc: i === 33333 ? 100 : i === 44444 ? 0 : 50,
  }));
  const copy = structuredClone(rows),
    drawing = chartOverview(rows, [energy, soc]);
  assert(drawing.reduced);
  assert(drawing.rows.length <= 800);
  assert.equal(drawing.totalRows, 70176);
  for (const i of [0, 12345, 22222, 33333, 44444, rows.length - 1])
    assert(drawing.rows.includes(rows[i]));
  assert.equal(
    drawing.stats[0].total,
    rows.reduce((s, r) => s + r.energy, 0),
  );
  assert.equal(drawing.stats[1].total, null);
  assert.deepEqual(
    drawing.stats.map((s) => [s.min, s.max]),
    [
      [-800, 990],
      [0, 100],
    ],
  );
  assert.deepEqual(rows, copy);
  assert.notEqual(
    drawing.rows.reduce((s, r) => s + r.energy, 0),
    drawing.stats[0].total,
  );
});
test("drawing never invents zeros for unavailable values or mutates quality metadata", () => {
  const rows = Array.from({ length: 4000 }, (_, i) => ({
    timestamp: i,
    energy: i > 100 && i < 500 ? null : i === 900 ? NaN : 0,
    [SIGNAL_COVERAGE]: { status: i < 500 ? "partial" : "complete" },
  }));
  const drawing = chartOverview(rows, [energy]);
  assert(drawing.rows.some((r) => r.energy === null));
  assert(drawing.rows.some((r) => Number.isNaN(r.energy)));
  assert.equal(drawing.stats[0].total, 0);
  assert.equal(drawing.stats[0].valid, 3600);
  assert(drawing.rows.every((r) => rows.includes(r)));
  assert(drawing.rows.every((r) => r[SIGNAL_COVERAGE]));
  const missing = chartOverview(
    rows.map((r) => ({ ...r, energy: null })),
    [energy],
  );
  assert.equal(missing.stats[0].total, null);
  assert.equal(missing.stats[0].min, null);
});
test("small charts retain their original rows without any display reduction", () => {
  const rows = [
    { timestamp: 0, energy: -1 },
    { timestamp: 1, energy: 0 },
  ];
  assert.equal(chartOverview(rows, [energy]).rows, rows);
  assert.equal(chartOverview(rows, [energy]).reduced, false);
  assert.equal(chartOverview([], []).rows.length, 0);
});
test("every visible signal keeps its extrema even with many columns and repeated coordinates", () => {
  const configs = Array.from({ length: 15 }, (_, i) => ({ field: "f" + i }));
  const rows = Array.from({ length: 8000 }, (_, i) => ({
    timestamp: Math.floor(i / 2),
    ...Object.fromEntries(
      configs.map((c, n) => [c.field, i === 400 + n ? 100 + n : i === 900 + n ? -100 - n : 0]),
    ),
  }));
  const drawing = chartOverview(rows, configs);
  assert(drawing.rows.length <= 800);
  for (const [n, c] of configs.entries()) {
    assert(drawing.rows.some((r) => r[c.field] === 100 + n));
    assert(drawing.rows.some((r) => r[c.field] === -100 - n));
  }
});
test("connection overview retains original event objects, ordering, counts and endpoints", () => {
  const original = {
    events: Array.from({ length: 10000 }, (_, i) => ({
      timestamp: i,
      type: i % 2 ? "connect" : "disconnect",
    })),
    intervals: Array.from({ length: 5000 }, (_, i) => ({ start: i * 2, end: i * 2 + 1 })),
  };
  const view = overlayOverview(original);
  assert(view.reduced);
  assert(view.events.length <= 160);
  assert(view.intervals.length <= 160);
  assert.equal(view.totalEvents, 10000);
  assert.equal(view.totalIntervals, 5000);
  assert.equal(view.events[0], original.events[0]);
  assert.equal(view.events.at(-1), original.events.at(-1));
  assert.equal(original.events.length, 10000);
});
test("worker transport preserves provenance, exclusion Sets, internal symbols and graph identity", () => {
  const row = {
    timestamp: 0,
    "source-record": "a user column",
    metadata: "user value",
    [SOURCE]: { file: "x", record: 8 },
    [EXCLUDED]: true,
    [GLOBAL_STEP]: 4176,
    [COVERAGE]: { partial: true },
    [SIGNAL_COVERAGE]: { status: "partial" },
  };
  const value = { rows: [row], excluded: new Set([row]), map: new Map([["row", row]]) };
  value.same = row;
  const restored = unpackResult(structuredClone(packResult(value)));
  assert.deepEqual(restored, value);
  assert.equal(restored.rows[0], restored.same);
  assert(restored.excluded.has(restored.rows[0]));
  assert.equal(restored.map.get("row"), restored.rows[0]);
  assert.equal(restored.rows[0][SOURCE].record, 8);
  assert.equal(restored.rows[0]["source-record"], "a user column");
});
test("worker transport rejects unexpected internal symbol names instead of silently discarding metadata", () => {
  assert.throws(() => packResult({ [Symbol("unregistered")]: true }), /Unsupported/);
  assert.throws(() => unpackResult({ value: {}, metadata: [[{}, "unknown", 1]] }), /Unsupported/);
});
test("worker round-trip preserves a real parsed file's excluded rows and clock decisions", async () => {
  const input = new File(
    ["timestamp,energy-kWh\n2023-01-01T00:00Z,2\ninvalid,7\n2023-01-01T00:30Z,3,extra\n"],
    "exported_data_A_ep0.csv",
  );
  const sim = await parseResultFolder(groupResultFiles([input])[0]);
  const restored = unpackResult(structuredClone(packResult(sim)));
  assert.deepEqual(restored, sim);
  assert.deepEqual(prepareTimeline(restored.series[0]), prepareTimeline(sim.series[0]));
  assert.equal(restored.series[0].rows[2][EXCLUDED], true);
});
test("folders parse sequentially, expose completed folders immediately and can avoid retaining a duplicate batch", async () => {
  let active = 0,
    max = 0;
  const delivered = [];
  const result = await parseResultGroups(
    [{ name: "A" }, { name: "B" }, { name: "C" }],
    async (g) => {
      active++;
      max = Math.max(active, max);
      await new Promise((r) => setTimeout(r, 2));
      active--;
      return g;
    },
    { retain: false, onSimulation: (s) => delivered.push(s.name) },
  );
  assert.equal(max, 1);
  assert.deepEqual(delivered, ["A", "B", "C"]);
  assert.deepEqual(result, { simulations: [], rejected: [] });
});
test("cancellation between files prevents a half-imported folder being delivered", async () => {
  const controller = new AbortController(),
    delivered = [];
  let started = 0;
  const groups = groupResultFiles([file("run"), file("run", undefined, "exported_data_B_ep0.csv")]);
  await assert.rejects(
    parseResultGroups(groups, undefined, {
      signal: controller.signal,
      onProgress: (p) => {
        if (p.phase === "file" && ++started === 2) controller.abort();
      },
      onSimulation: (s) => delivered.push(s),
    }),
    { name: "AbortError" },
  );
  assert.equal(started, 2);
  assert.equal(delivered.length, 0);
});
test("workers unavailable: existing import contracts work through the sequential fallback", async () => {
  const delivered = [],
    progress = [];
  const task = createImportTask([file()], {
    workerFactory() {
      throw new Error("blocked");
    },
    onSimulation: (s) => delivered.push(s),
    onProgress: (p) => progress.push(p),
  });
  const result = await task.promise;
  assert.equal(result.rejected.length, 0);
  assert.equal(delivered[0].series[0].rows[0]["energy-kWh"], "2");
  assert.equal(delivered[0].series[0].rows[0][SOURCE].record, 1);
  assert(progress.some((p) => p.phase === "fallback"));
});
function fake() {
  return {
    terminated: 0,
    terminate() {
      this.terminated++;
    },
    postMessage() {},
  };
}
test("cancelling a background task terminates it and ignores late results", async () => {
  const worker = fake(),
    delivered = [];
  const task = createImportTask([file()], {
    workerFactory: () => worker,
    onSimulation: (s) => delivered.push(s),
  });
  const rejection = assert.rejects(task.promise, { name: "AbortError" });
  const lateMessage = worker.onmessage;
  task.cancel();
  await rejection;
  lateMessage({ data: { type: "simulation", payload: packResult({ path: "run" }) } });
  assert.equal(delivered.length, 0);
  assert.equal(worker.terminated, 1);
});
test("a runtime worker failure falls back only for folders not already delivered", async () => {
  const worker = fake(),
    delivered = [];
  const inputs = [file("A"), file("B")],
    task = createImportTask(inputs, {
      workerFactory: () => worker,
      onSimulation: (s) => delivered.push(s),
    });
  const sim = await parseResultFolder(groupResultFiles(inputs)[0]);
  worker.onmessage({ data: { type: "simulation", payload: packResult(sim) } });
  worker.onerror({ preventDefault() {} });
  await task.promise;
  assert.deepEqual(
    delivered.map((s) => s.path),
    ["A", "B"],
  );
  assert.equal(worker.terminated, 1);
});
test("completed background imports terminate the worker, do not keep a duplicate batch, and can be cancelled harmlessly afterwards", async () => {
  const worker = fake(),
    delivered = [];
  const task = createImportTask([file()], {
    workerFactory: () => worker,
    onSimulation: (s) => delivered.push(s),
  });
  worker.onmessage({ data: { type: "simulation", payload: packResult({ path: "run" }) } });
  worker.onmessage({ data: { type: "done", rejected: [] } });
  assert.deepEqual(await task.promise, { rejected: [] });
  assert.equal(delivered.length, 1);
  task.cancel();
  assert.equal(worker.terminated, 1);
});
test("an undecodable worker response is explicit and does not silently retry or erase delivered folders", async () => {
  const worker = fake(),
    delivered = [],
    task = createImportTask([file()], {
      workerFactory: () => worker,
      onSimulation: (s) => delivered.push(s),
    });
  const rejection = assert.rejects(task.promise, /could not be decoded/);
  worker.onmessage({ data: { type: "simulation", payload: packResult({ path: "run" }) } });
  worker.onmessageerror();
  await rejection;
  assert.equal(delivered.length, 1);
  assert.equal(worker.terminated, 1);
});
test("empty selections and worker processing failures report errors without pretending success", async () => {
  await assert.rejects(createImportTask([]).promise, /No CSV/);
  const worker = fake(),
    task = createImportTask([file()], { workerFactory: () => worker });
  const rejected = assert.rejects(task.promise, /decoder failed/);
  worker.onmessage({ data: { type: "error", message: "decoder failed" } });
  await rejected;
});

test("axis and tooltip formatters retain time/coverage semantics using only clock scalars", async () => {
  const { chartFormatters } = await import("../src/results/chart-formatters.js");
  const { formatTimelineValue } = await import("../src/results/temporal.js");
  for (const mode of ["utc", "local", "elapsed", "index", "row"]) {
    const timeline = {
      mode,
      coordinatePerStep: 60000,
      baseIntervalMinutes: 0.25,
      rows: [{ large: "source rows never needed for labels" }],
    };
    const formats = chartFormatters(timeline),
      point = mode === "utc" || mode === "local" ? Date.UTC(2023, 0, 1, 0, 0, 15) : 4176 * 60000;
    assert.equal(formats.axis(point), formatTimelineValue(timeline, point));
    assert.equal(formats.tooltip(point, []), formatTimelineValue(timeline, point, true));
    assert(
      formats
        .tooltip(point, [{ payload: { [SIGNAL_COVERAGE]: { status: "partial" } } }])
        .endsWith(" · partial/unknown data"),
    );
    assert(
      formats
        .tooltip(point, [{ payload: { [COVERAGE]: { partial: true } } }])
        .endsWith(" · partial/unknown data"),
    );
  }
});

test("a large malformed table preserves every diagnostic without a spread-argument failure", async () => {
  const count = 130000;
  const text =
    "global_step,energy-kWh\n" + Array.from({ length: count }, (_, i) => `${i},1,extra\n`).join("");
  const sim = await parseResultFolder(groupResultFiles([file("large-partial", text)])[0]);
  assert.equal(sim.series[0].rows.length, count);
  assert.equal(sim.series[0].quality.accepted, 0);
  assert.equal(sim.quality.diagnostics.filter((d) => d.code === "field-count").length, count);
  assert.equal(sim.series[0].rows.at(-1)[SOURCE].record, count);
  assert(sim.series[0].tableOnly);
});
