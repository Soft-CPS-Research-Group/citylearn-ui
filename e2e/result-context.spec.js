import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let root;
test.beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "citylearn-context-"));
  // Native CityLearn export values: a zero difference is distinct from a
  // non-zero absolute cost, a missing value and a non-zero service rate.
  const csv = `KPI,District
 district_cost_total_control_eur,43.989
 district_cost_total_baseline_eur,43.989
 district_cost_total_delta_eur,0
 district_battery_total_throughput_kwh,0
 district_electrical_service_phase_violations_energy_total_kwh,0
 district_solar_self_consumption_ratio_self_consumption_ratio,0.609
 district_ev_events_departure_count,14
 district_ev_events_departure_met_count,0
 district_ev_events_departure_within_tolerance_count,4
 district_ev_performance_departure_success_ratio,0
 district_ev_performance_departure_within_tolerance_ratio,0.286
`.replace(/^ /gm, "");
  for (const name of ["native", "metadata"]) {
    const folder = path.join(root, name);
    fs.mkdirSync(folder);
    fs.writeFileSync(path.join(folder, "exported_kpis.csv"), csv);
  }
  fs.writeFileSync(
    path.join(root, "metadata", "manifest.json"),
    JSON.stringify({
      simulator_version: "1.9.11",
      completed_intervals: 0,
      random_seed: 0,
      business_as_usual_reference: { evaluated: false },
    }),
  );
});
test.afterAll(() => fs.rmSync(root, { recursive: true, force: true }));
async function load(page, folder) {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles(path.join(root, folder));
  await expect(page.locator(".simulation-row")).toHaveCount(1);
}

test("zero savings do not erase actual costs or non-zero CityLearn KPIs", async ({ page }) => {
  await load(page, "native");
  await page.getByRole("tab", { name: "KPIs", exact: true }).click();
  const tiles = page.locator(".kpi-priority-tile");
  await expect(tiles.first().locator(":scope > strong")).toHaveText("0 EUR");
  await expect(tiles.locator("p, dl, ul")).toHaveCount(0);
  await expect(tiles.nth(2).locator(":scope > strong")).toHaveText("28.6%");
  await expect(tiles.nth(4).locator(":scope > strong")).toHaveText("0 kWh");
  await expect(tiles.nth(5).locator(":scope > strong")).toHaveText("60.9%");
  await expect(page.locator(".import-context, .data-quality, .result-details")).toHaveCount(0);
  const footer = page.getByRole("contentinfo", { name: "Institutional partners" });
  await expect(footer.getByRole("link")).toHaveCount(5);
  await expect(footer.getByRole("link", { name: "i-charging", exact: true })).toHaveCount(0);
  await expect(footer).toContainText("Tiago Fonseca");
});

test("metadata does not add inspectors or explanations to result cards", async ({ page }) => {
  await load(page, "metadata");
  await page.getByRole("tab", { name: "KPIs", exact: true }).click();
  await expect(page.locator(".result-details, .import-context, .data-quality")).toHaveCount(0);
  await expect(
    page.locator(".kpi-priority-tile p, .kpi-priority-tile dl, .ev-service-evidence"),
  ).toHaveCount(0);
  await expect(page.locator(".kpi-priority-tile").nth(5)).toContainText("60.9%");
});
