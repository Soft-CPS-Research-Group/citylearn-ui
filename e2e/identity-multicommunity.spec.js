import { test as base, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await use(page);
    expect(errors).toEqual([]);
  },
});
let root;
function folder(name, files) {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    const p = path.join(dir, name);
    fs.writeFileSync(p, body);
    fs.utimesSync(p, 1704067200, 1704067200);
  }
  return dir;
}
async function load(page, name) {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles(path.join(root, name));
  await expect(page.locator(".simulation-row").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel import", exact: true })).toHaveCount(0);
}
test.beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "citylearn-identity-"));
  for (const [label, pair] of [
    ["case", ["Aa", "BB"]],
    ["lowercase", ["ebrfklla", "nicmkbit"]],
  ])
    for (const [i, name] of pair.entries())
      folder(label, {
        [`exported_data_${name}_ep0.csv`]: `timestamp,Net Electricity Consumption-kWh,Non-shiftable Load-kWh\n2023-01-01T00:00Z,${i ? 9 : 1},${i ? 9 : 1}\n`,
      });
  for (const ext of ["csv", "parquet"])
    folder(ext, {
      ["exported_kpis_multi_community." + ext]: fs.readFileSync(
        "tests/fixtures/multi-community/exported_kpis_multi_community." + ext,
      ),
    });
  const header = "community_id,level,name,cost_function,value\n";
  for (const [run, offset] of [
    ["A", 0],
    ["B", 10],
  ])
    folder("compare/" + run, {
      "kpis.csv":
        header +
        `north,district,District,district_cost_total_control_eur,${80 + offset}\nsouth,district,District,district_cost_total_control_eur,${120 + offset}\n__portfolio__,portfolio,Portfolio,portfolio_cost_total_control_eur,${200 + 2 * offset}\n`,
    });
});
test.afterAll(() => {
  if (root) fs.rmSync(root, { recursive: true, force: true });
});
for (const [name, pair] of [
  ["case", ["Aa", "BB"]],
  ["lowercase", ["ebrfklla", "nicmkbit"]],
])
  test(`valid ${name} hash-collision filenames select their own source and chart`, async ({
    page,
  }) => {
    await load(page, name);
    for (const [i, id] of pair.entries()) {
      await page.getByTitle(id, { exact: true }).click();
      await expect(
        page.getByRole("heading", { name: id + " Consumption", exact: true }),
      ).toBeVisible();
      await page.locator(".source-rows > summary").click();
      await expect(page.locator(".source-rows tbody tr").first()).toContainText(String(i ? 9 : 1));
    }
  });
for (const format of ["csv", "parquet"])
  test(`qualified ${format} scopes show both communities and portfolio without duplicate diagnostics`, async ({
    page,
  }) => {
    await load(page, format);
    await page.getByRole("tab", { name: "KPIs", exact: true }).click();
    await page.getByRole("button", { name: "Portfolio", exact: true }).click();
    await expect(page.locator(".kpi-priority-tile").first()).toContainText("200 EUR");
    for (const [id, value] of [
      ["north", 80],
      ["south", 120],
    ])
      for (const level of ["district", "building"]) {
        const label =
          id + " · " + (level === "district" ? "District" : "Building_1") + " (" + level + ")";
        await page.getByRole("button", { name: label, exact: true }).click();
        await expect(page.locator(".kpi-priority-tile").first()).toContainText(value + " EUR");
      }
    await expect(page.locator(".result-details, .data-quality, .import-context")).toHaveCount(0);
    await expect(
      page.locator(".kpi-priority-tile p, .kpi-priority-tile dl, .ev-service-evidence"),
    ).toHaveCount(0);
  });
test("comparison uses each qualified local scope and a separate portfolio total", async ({
  page,
}) => {
  await load(page, "compare");
  await page.getByRole("button", { name: "Compare simulations", exact: true }).click();
  for (const [label, a, b] of [
    ["Portfolio", 200, 220],
    ["north · District (district)", 80, 90],
    ["south · District (district)", 120, 130],
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    const row = page.locator(".compare-score-row").first();
    await expect(row).toContainText(a + " EUR");
    await expect(row).toContainText(b + " EUR");
    await expect(row.locator(".is-best")).toHaveCount(0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
});

test("imports stay usable without Web Crypto or background workers", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "crypto", { value: undefined, configurable: true });
    window.Worker = class {
      constructor() {
        throw new Error("Background worker unavailable in fallback test");
      }
    };
  });
  await load(page, "lowercase");
  await page.getByTitle("nicmkbit", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "nicmkbit Consumption", exact: true }),
  ).toBeVisible();
});
