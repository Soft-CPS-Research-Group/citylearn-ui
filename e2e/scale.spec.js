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
const kpis = "KPI,District\ndistrict_cost_total_control_eur,80\n";
const header =
  "timestamp,Net Electricity Consumption-kWh,Non-shiftable Load-kWh,Energy Production from PV-kWh\n";
function folder(name, files) {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  return dir;
}
async function load(page, name) {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles(path.join(root, name));
  await expect(page.locator(".simulation-row").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel import", exact: true })).toHaveCount(0);
}
test.beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "citylearn-scale-"));
  const count = 70176,
    start = Date.UTC(2023, 0, 1);
  let csv = header;
  for (let i = 0; i < count; i++)
    csv +=
      new Date(start + i * 900000).toISOString() +
      "," +
      (i === count - 1 ? 1000 : i === 12345 ? -400 : 1) +
      ",2,0.5\n";
  folder("long", { "exported_data_community_ep0.csv": csv, "exported_kpis.csv": kpis });
  folder("many", {
    "exported_kpis.csv":
      "KPI,District," +
      Array.from({ length: 128 }, (_, i) => `Campus ${String(i + 1).padStart(3, "0")}`).join(",") +
      "\ndistrict_cost_total_control_eur,80," +
      Array(128).fill("1").join(",") +
      "\n",
  });
  const short =
    header +
    Array.from(
      { length: 48 },
      (_, i) => new Date(start + i * 900000).toISOString() + ",1,2,0.5\n",
    ).join("");
  for (let i = 1; i <= 128; i++)
    folder("many", {
      [`exported_data_Campus ${String(i).padStart(3, "0")}_ep0.csv`]: short,
      [`exported_data_Campus ${String(i).padStart(3, "0")}_battery_ep0.csv`]:
        "timestamp,Battery (Dis)Charge-kWh,Battery SOC-%\n2023-01-01T00:00Z,0.2,50\n",
    });
  folder("small", { "exported_kpis.csv": kpis });
  // Generated load fixture, not a simulator campaign or a committed dataset.
  folder("cancel", {
    "exported_data_pending_ep0.csv":
      header +
      Array.from(
        { length: 250000 },
        (_, i) => new Date(start + i * 900000).toISOString() + ",1,2,0.5\n",
      ).join(""),
  });
  for (let i = 0; i < 8; i++) folder("batch/run-" + i, { "exported_kpis.csv": kpis });
  folder("batch/partial", { "exported_data_bad_ep0.parquet": "broken" });
  fs.cpSync("tests/fixtures/exports/cps", path.join(root, "fallback-cps"), { recursive: true });
  fs.cpSync("tests/fixtures/formats/parquet", path.join(root, "fallback-parquet"), {
    recursive: true,
  });
});
test.afterAll(() => {
  if (root) fs.rmSync(root, { recursive: true, force: true });
});
test("two years retain bounded rendering, full-span extrema, exact totals and source pagination", async ({
  page,
}) => {
  await load(page, "long");
  await page.getByRole("button", { name: "All", exact: true }).click();
  const overview = page.locator(".equipment-card.sim-chart").first();
  await expect(overview).toHaveAttribute("data-original-points", "70176");
  expect(Number(await overview.getAttribute("data-drawn-points"))).toBeLessThanOrEqual(800);
  expect(await page.locator(".recharts-bar-rectangle").count()).toBeLessThan(2500);
  const stats = JSON.parse(await overview.getAttribute("data-series-stats"));
  const energy = stats.find((s) => s.field === "Net Electricity Consumption-kWh");
  expect(energy.total).toBe(70774);
  expect(energy.min).toBe(-400);
  expect(energy.max).toBe(1000);
  await expect(page.locator(".chart-overview")).toHaveCount(0);
  await page.locator(".source-rows > summary").click();
  const source = page.locator(".source-rows");
  await source.getByRole("spinbutton", { name: "Table page" }).fill("1404");
  await source.getByRole("spinbutton", { name: "Table page" }).press("Enter");
  await expect(source).toContainText("page 1404/1404");
  await expect(source.locator("tbody tr").last()).toContainText("1000");
  await source.getByRole("spinbutton", { name: "Table page" }).fill("1");
  await source.getByRole("spinbutton", { name: "Table page" }).press("Enter");
  await expect(source).toContainText("page 1/1404");
  await page.setViewportSize({ width: 390, height: 844 });
  const geometry = await overview.evaluate((element) => ({
    right: element.getBoundingClientRect().right,
    viewport: innerWidth,
    cardWidth: element.closest(".equipment-card").clientWidth,
    cardScroll: element.closest(".equipment-card").scrollWidth,
  }));
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewport);
  expect(geometry.cardScroll).toBeLessThanOrEqual(geometry.cardWidth + 1);
});
test("128 generic building IDs and 256 equipment files remain navigable without a member ceiling", async ({
  page,
}) => {
  await load(page, "many");
  await page.getByTitle("Campus 128", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Campus 128 Consumption", exact: true }),
  ).toBeVisible();
  const building = page.getByTitle("Campus 128", { exact: true });
  await building.locator("..").getByRole("button", { name: "Expand", exact: true }).click();
  await building.locator("../..").getByRole("button", { name: "Battery", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Campus 128 - Battery Data", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "KPIs", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Decision scorecard", exact: true }),
  ).toBeVisible();
});
test("background cancellation is prompt, keeps existing folders and permits another import", async ({
  page,
}) => {
  await load(page, "small");
  await page.locator("input[type=file]").setInputFiles(path.join(root, "cancel"));
  const cancel = page.getByRole("button", { name: "Cancel import", exact: true });
  await expect(cancel).toBeVisible();
  await cancel.click();
  await expect(
    page.getByText("Import cancelled. Completed folders remain available.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".simulation-row")).toHaveCount(1);
  await page.locator("input[type=file]").setInputFiles(path.join(root, "many"));
  await expect(page.locator(".simulation-row")).toHaveCount(2);
  await expect(cancel).toHaveCount(0);
  await expect(page.getByTitle("Campus 128", { exact: true })).toBeVisible();
});
test("multiple folders import independently and retain partial diagnostics for comparisons/removal", async ({
  page,
}) => {
  await load(page, "batch");
  await expect(page.locator(".simulation-row")).toHaveCount(9);
  await page.getByRole("button", { name: "Compare simulations", exact: true }).click();
  await expect(page.locator(".compare-score-row").first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "4 simulations selected", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove partial", exact: true }).click();
  await expect(page.locator(".simulation-row")).toHaveCount(8);
});
for (const name of ["fallback-cps", "fallback-parquet"])
  test(`${name} stays readable if workers are unavailable`, async ({ page }) => {
    await page.addInitScript(() => {
      window.Worker = class {
        constructor() {
          throw new Error("Worker blocked for fallback contract test");
        }
      };
    });
    await load(page, name);
    await expect(page.locator(".equipment-card")).toBeVisible();
    await expect(page.locator(".inline-error")).toHaveCount(0);
  });
test("repeated large import/removal releases selected series and workers", async ({ page }) => {
  await page.goto("/");
  const session = await page.context().newCDPSession(page);
  await session.send("HeapProfiler.enable");
  await session.send("Performance.enable");
  await session.send("HeapProfiler.collectGarbage");
  const heap = async () =>
    (await session.send("Performance.getMetrics")).metrics.find((m) => m.name === "JSHeapUsedSize")
      .value;
  const before = await heap();
  for (let i = 0; i < 3; i++) {
    await page.locator("input[type=file]").setInputFiles(path.join(root, "long"));
    await expect(page.locator(".simulation-row")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Cancel import", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(page.locator(".equipment-card.sim-chart")).toHaveAttribute(
      "data-original-points",
      "70176",
    );
    await page.getByRole("button", { name: "Remove long", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Import CityLearn simulation folders", exact: true }),
    ).toBeVisible();
  }
  await session.send("HeapProfiler.collectGarbage");
  expect((await heap()) - before).toBeLessThan(25 * 1024 * 1024);
  await session.detach();
});
