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
  await expect(page.locator(".data-quality").first()).toBeVisible();
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
test("long KPI exports retain their original rows", async ({ page }) => {
  await load(page, "long");
  await page.getByRole("tab", { name: "KPIs", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Decision scorecard" })).toBeVisible();
  await page.locator(".import-context > summary").click();
  await page.getByText("Original long KPI rows", { exact: true }).click();
  await expect(
    page.locator(".import-context table").filter({ hasText: "cost_function" }),
  ).toBeVisible();
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
test("malformed records retain their source and qualify the chart", async ({ page }) => {
  await load(page, "quality");
  const panel = page.locator(".data-quality").first();
  await panel.locator(":scope > summary").click();
  await panel.getByRole("searchbox", { name: "Filter quality issues" }).fill("field-count");
  await panel.getByRole("button", { name: "Record 2", exact: true }).click();
  await expect(panel.locator(".quality-source")).toContainText("extra");
  await expect(page.locator(".chart-quality")).toHaveAttribute("data-quality-status", "partial");
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
test("mobile source-quality inspection stays within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await load(page, "quality");
  const panel = page.locator(".data-quality").first();
  await panel.locator(":scope > summary").click();
  await panel.getByRole("searchbox", { name: "Filter quality issues" }).fill("field-count");
  await panel.getByRole("button", { name: "Inspect source", exact: true }).click();
  await expect(panel.locator(".quality-source")).toBeVisible();
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
});
