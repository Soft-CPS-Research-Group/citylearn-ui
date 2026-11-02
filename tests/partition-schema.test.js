import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { readPartitions } from "../src/results/tabular.js";
import { groupResultFiles, parseResultFolder } from "../src/results/import.js";
import { SOURCE, EXCLUDED } from "../src/results/quality.js";
const ROOT = new URL("./fixtures/partition-evolution/", import.meta.url);
function file(name, body) {
  return {
    name,
    webkitRelativePath: "run/" + name,
    size: body.length,
    lastModified: 0,
    text: async () => body.toString("utf8"),
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  };
}
const fixture = (name, part, key = "house") =>
  file(
    `exported_data_${key}_ep0_part${String(part).padStart(5, "0")}.parquet`,
    fs.readFileSync(new URL(name + ".parquet", ROOT)),
  );
const entry = (f) => ({ file: f, fileName: f.name, relativePath: f.webkitRelativePath });
const csv = (part, text) => file(`exported_data_house_ep0_part${part}.csv`, Buffer.from(text));
const parse = (files) => parseResultFolder(groupResultFiles(files)[0]);

test("genuine Parquet optional columns join in numerical part order with null gaps and unchanged zeroes", async () => {
  const files = [fixture("sparse", 2), fixture("optional", 1), fixture("base", 0)];
  const t = await readPartitions(files.map(entry));
  assert.equal(t.rows.length, 5);
  assert.deepEqual(
    t.rows.map((r) => r.energy_kwh),
    [0, 1, 2, 3, 4],
  );
  assert.deepEqual(
    t.rows.map((r) => r["EV SOC-%"]),
    [null, null, 0.8, 0.9, null],
  );
  assert.deepEqual(t.columns, ["timestamp", "energy_kwh", "entity_id", "EV SOC-%"]);
  assert.equal(t.warnings.length, 0);
  assert(!t.sources.some((s) => s.incompatible));
  assert(t.rows.every((r) => r[SOURCE]));
  assert.equal(t.rows[2][SOURCE].file, files[1].name);
  assert.equal(t.rows[2][SOURCE].record, 1);
  const s = await parse(files);
  assert.equal(s.series.filter((x) => !x.tableOnly).length, 1);
  assert.equal(s.series[0].rows.length, 5);
});

test("all-null Arrow columns do not conflict with later concrete values", async () => {
  const t = await readPartitions([fixture("null", 0), fixture("note", 1)].map(entry));
  assert.equal(t.rows.length, 2);
  assert.equal(t.warnings.length, 0);
  assert.equal(t.rows[0].energy_kwh, null);
  assert.equal(t.rows[0].note, null);
  assert.equal(t.rows[1].note, "hello");
});

for (const [kind, message] of [
  ["conflict", "type differs"],
  ["boolean", "type differs"],
  ["identity", "identity differs"],
  ["clock", "columns differ"],
])
  test(`conflicting ${kind} stays inspectable separately`, async () => {
    const t = await readPartitions([fixture("base", 0), fixture(kind, 1)].map(entry));
    assert.equal(t.rows.length, 2);
    assert.equal(t.sources.length, 2);
    assert(t.sources[1].incompatible);
    assert.equal(t.sources[1].table.rows.length, 1);
    assert(t.warnings.some((w) => w.includes(message)));
    assert(t.diagnostics.some((d) => d.code === "partition-alternative"));
  });

test("identical columns with a different series identity are not joined", async () => {
  const t = await readPartitions([fixture("base", 0, "A"), fixture("base", 1, "B")].map(entry));
  assert.equal(t.rows.length, 2);
  assert(t.sources[1].incompatible);
  assert(t.warnings.some((w) => w.includes("different series")));
});

test("timestamp-only overlap is diagnosed after schema union without losing the raw rows", async () => {
  const s = await parse([fixture("base", 0), fixture("overlap", 1)]);
  assert.equal(s.series[0].rows.length, 3);
  assert(s.quality.diagnostics.some((d) => d.code === "duplicate-clock"));
  assert.equal(s.series[0].rows[2].extra, 5);
});

test("optional dangerous property names preserve data without changing prototypes", async () => {
  const t = await readPartitions([fixture("base", 0), fixture("special", 1)].map(entry));
  assert.equal(t.rows.length, 3);
  assert.equal(t.rows[0].__proto__, null);
  assert.equal(t.rows[2].__proto__, 0);
  assert.equal(t.rows[0].constructor, null);
  assert.equal(t.rows[2].constructor, 2);
  assert.equal(Object.getPrototypeOf(t.rows[0]), Object.prototype);
  assert.equal({}.energy_kwh, undefined);
});

test("CSV column evolution keeps missing values, source flags and malformed records explicit", async () => {
  const files = [
    csv(0, "timestamp,energy_kwh\n2023-01-01,0\n"),
    csv(1, "timestamp,energy_kwh,soc\n2023-01-02,2,80\n2023-01-03,3\n"),
  ];
  const t = await readPartitions(files.map(entry));
  assert.equal(t.rows.length, 3);
  assert.equal(t.rows[0].soc, null);
  assert.equal(t.rows[1].soc, "80");
  assert.equal(t.rows[2][EXCLUDED], true);
  assert(t.diagnostics.some((d) => d.code === "field-count"));
  assert.equal(t.rows[2][SOURCE].record, 2);
});

test("shared clock alone does not justify merging unrelated channels", async () => {
  const t = await readPartitions(
    [csv(0, "timestamp,a\n2023-01-01,1\n"), csv(1, "timestamp,b\n2023-01-02,2\n")].map(entry),
  );
  assert.equal(t.rows.length, 1);
  assert(t.sources[1].incompatible);
});

test("native CPS Member028 regression: all 501 rows in one primary series", async () => {
  const folder = new URL("native/", ROOT);
  const files = fs
    .readdirSync(folder)
    .reverse()
    .map((name) => file(name, fs.readFileSync(new URL(name, folder))));
  const t = await readPartitions(files.map(entry));
  assert.equal(t.rows.length, 501);
  assert.equal(t.warnings.length, 0);
  assert(t.columns.includes("EV SOC"));
  assert(t.columns.includes("EV SOC-%"));
  assert(t.rows.some((r) => r["EV SOC-%"] === null));
  assert(t.rows.some((r) => typeof r["EV SOC-%"] === "number"));
  const s = await parse(files);
  assert.equal(s.series.length, 1);
  assert(!s.series[0].tableOnly);
  assert.equal(s.series[0].rows.length, 501);
  assert.equal(s.dataIssues.length, 0);
});
