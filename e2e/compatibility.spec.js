import { test as base, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await use(page);
    expect(errors).toEqual([]);
  },
});
let root;
function write(name, files) {
  const folder = path.join(root, name);
  fs.mkdirSync(folder, { recursive: true });
  for (const [file, text] of Object.entries(files)) fs.writeFileSync(path.join(folder, file), text);
  return folder;
}
function clone(name, source) {
  const folder = path.join(root, name);
  fs.cpSync(path.resolve(source), folder, { recursive: true });
  return folder;
}
async function load(page, name) {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles(path.join(root, name));
  await expect(page.locator(".simulation-row").first()).toBeVisible();
}
const csv = (control, reference) =>
  `KPI,District\ndistrict_cost_total_control_eur,${control}\n${reference === undefined ? "" : `district_cost_total_business_as_usual_eur,${reference}\n`}`;
test.beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "citylearn-ui-e2e-"));
  clone("cps", "tests/fixtures/exports/cps");
  clone("citylearn", "tests/fixtures/exports/citylearn");
  clone("parquet", "tests/fixtures/formats/parquet");
  write("long", { "kpis.csv": fs.readFileSync("tests/fixtures/formats/long.csv", "utf8") });
  write("cost/A", { "exported_kpis.csv": csv(80) });
  write("cost/B", { "exported_kpis.csv": csv(100) });
  write("saving", { "exported_kpis.csv": csv(80, 100) });
  write("ev", {
    "exported_kpis.csv":
      "KPI,District\ndistrict_ev_departure_audit_departures_count,0\ndistrict_ev_departure_audit_min_acceptable_service_feasible_ratio,\n",
  });
  write("index", {
    "exported_data_A_ep0.csv":
      "time_step,Net Electricity Consumption-kWh,Non-shiftable Load-kWh\n4176,1,1\n4177,2,2\n",
  });
  write("quality", {
    "exported_data_A_ep0.csv":
      "timestamp,Net Electricity Consumption-kWh,Non-shiftable Load-kWh\n2023-01-01T00:00Z,1,1\n2023-01-01T00:15Z,100,100,extra\n2023-01-01T00:30Z,3,3\n",
  });
  write("corrupt", { "exported_data_bad_ep0.parquet": "broken" });
});
test.afterAll(() => fs.rmSync(root, { recursive: true, force: true }));
for (const [name, id] of [
  ["cps", "member_001"],
  ["citylearn", "Building 1"],
  ["parquet", "Member_001"],
])
  test(`${name} equipment exports remain navigable`, async ({ page }) => {
    await load(page, name);
    const building = page.getByTitle(id, { exact: true });
    await building.click();
    await expect(page.getByRole("heading", { name: new RegExp("Consumption$") })).toBeVisible();
    await page.getByRole("button", { name: "1h", exact: true }).click();
    const node = building.locator("..");
    await node.getByRole("button", { name: "Expand", exact: true }).click();
    await node.locator("..").getByRole("button", { name: "Battery", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Battery Data$/ })).toBeVisible();
  });
test("long KPI exports retain their values in the compact view and grouped table", async ({
  page,
}) => {
  await load(page, "long");
  await page.getByRole("tab", { name: "KPIs", exact: true }).click();
  await expect(page.locator(".kpi-priority-tile").first()).toContainText("-3.568 EUR");
  await page.getByRole("button", { name: /All KPI drill-down/ }).click();
  await page.getByPlaceholder("Search KPI...").fill("cost total");
  await page.locator(".kpi-family-summary").first().click();
  await page.locator(".kpi-subfamily-accordion > summary").first().click();
  await expect(page.locator(".kpi-reference-table")).toContainText("7.375");
});
test("cost comparison without metadata stays descriptive and uses lower absolute costs", async ({
  page,
}) => {
  await load(page, "cost");
  await page.getByRole("button", { name: "Compare simulations", exact: true }).click();
  await expect(page.locator('[data-comparison-status="unknown"]')).toBeVisible();
  const row = page.locator(".compare-score-row").first();
  await expect(row).toContainText("80 EUR");
  await expect(row).toContainText("100 EUR");
  await expect(row.locator(".is-best")).toHaveCount(0);
  await expect(row.locator("[data-reported-extreme]")).toContainText("Lowest reported value");
});
test("reference cost produces an accurately signed saving", async ({ page }) => {
  await load(page, "saving");
  await page.getByRole("tab", { name: "KPIs", exact: true }).click();
  const tile = page.locator(".kpi-priority-tile").first();
  await expect(tile).toContainText("Cost saving vs BAU");
  await expect(tile.locator(":scope > strong")).toHaveText("20 EUR");
});
test("zero EV departures are not a failed zero-percent service rate", async ({ page }) => {
  await load(page, "ev");
  await page.getByRole("tab", { name: "KPIs", exact: true }).click();
  await expect(page.locator(".kpi-priority-tile").nth(1)).toContainText("No departures");
});
test("indices without a calendar remain relative and editable", async ({ page }) => {
  await load(page, "index");
  await expect(page.locator("input[type=date]")).toHaveCount(0);
  const end = page.getByRole("spinbutton", { name: "To index" });
  await end.fill("4176");
  await end.press("Tab");
  await expect(end).toHaveValue("4176");
  await expect(page.locator("[data-clock-mode]").first()).toHaveAttribute(
    "data-clock-mode",
    "index",
  );
});
test("malformed records remain in source rows without affecting the plot", async ({ page }) => {
  await load(page, "quality");
  await page.getByTitle("A", { exact: true }).click();
  const plot = page.locator(".equipment-card.sim-chart").first();
  const stats = JSON.parse(await plot.getAttribute("data-series-stats"));
  expect(stats.find((s) => s.field === "Net Electricity Consumption-kWh").total).toBe(4);
  await page.locator(".source-rows > summary").click();
  await expect(page.locator(".source-rows tbody tr")).toHaveCount(3);
  await expect(page.locator(".source-rows tbody tr").nth(1)).toContainText("100");
  await expect(page.locator(".chart-quality, .result-details")).toHaveCount(0);
});
test("a later unreadable folder preserves a valid imported simulation", async ({ page }) => {
  await load(page, "cps");
  await page.locator("input[type=file]").setInputFiles(path.join(root, "corrupt"));
  await expect(page.locator(".simulation-row")).toHaveCount(2);
  await page
    .locator(".simulation-select")
    .filter({ has: page.locator(".simulation-name", { hasText: "cps" }) })
    .click();
  await expect(page.getByTitle("member_001", { exact: true })).toBeVisible();
});
test("mobile source rows stay accessible without technical notices", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await load(page, "quality");
  await page.getByTitle("A", { exact: true }).click();
  await page.locator(".source-rows > summary").click();
  await expect(page.locator(".source-rows tbody tr")).toHaveCount(3);
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
  await expect(page.locator(".data-quality, .chart-quality, .result-details")).toHaveCount(0);
});
