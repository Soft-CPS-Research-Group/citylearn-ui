import { test as base, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await use(page);
    expect(errors).toEqual([]);
  },
});
let root;
test.beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "citylearn-energaize-"));
  for (const name of ["calendar", "relative"]) {
    const folder = path.join(root, name);
    fs.mkdirSync(folder);
    const relative = name === "relative";
    const rows = Array.from(
      { length: relative ? 12 : 48 },
      (_, i) =>
        `${relative ? 4176 + i : new Date(Date.UTC(2023, 0, 1, i)).toISOString()},${i + 1},${i + 1}`,
    );
    const csv = `${relative ? "time_step" : "timestamp"},Net Electricity Consumption-kWh,Non-shiftable Load-kWh\n${rows.join("\n")}\n`;
    for (const member of ["Studio-α", "Studio-β"])
      fs.writeFileSync(path.join(folder, `exported_data_${member}_ep0.csv`), csv);
  }
});
test.beforeAll(() => {
  const folder = path.join(root, "reference");
  fs.mkdirSync(folder);
  fs.writeFileSync(
    path.join(folder, "exported_data_community_ep0.csv"),
    "time_step,Net Electricity Consumption-kWh\n0,3\n1,7\n",
  );
  fs.writeFileSync(
    path.join(folder, "exported_data_business_as_usual_ep0.csv"),
    "time_step,name,level,net_electricity_consumption_kwh\n0,Member_001,building,1\n0,Member_002,building,2\n1,Member_001,building,3\n1,Member_002,building,4\n",
  );
});
test.afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

async function load(page, folder) {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles(path.join(root, folder));
  await expect(page.locator(".equipment-card.sim-chart").first()).toBeVisible();
}
async function span(plot) {
  return (
    Number(await plot.getAttribute("data-range-end")) -
    Number(await plot.getAttribute("data-range-start"))
  );
}
async function drag(page, reverse = false) {
  const frame = page.locator(".sim-chart-canvas .recharts-wrapper").first();
  await frame.scrollIntoViewIfNeeded();
  const box = await frame.boundingBox();
  const left = box.x + box.width * 0.3;
  const right = box.x + box.width * 0.7;
  const y = box.y + box.height * 0.4;
  await page.mouse.move(reverse ? right : left, y);
  await page.mouse.down();
  await page.mouse.move(reverse ? left : right, y, { steps: 8 });
  await page.mouse.up();
}

for (const name of ["calendar", "relative"])
  test(`${name}: drag zoom and reset preserve the original source rows`, async ({ page }) => {
    await load(page, name);
    const plot = page.locator(".equipment-card.sim-chart").first();
    const original = await span(plot);
    await drag(page);
    await expect.poll(() => span(plot)).toBeLessThan(original);
    await page.getByRole("button", { name: "Reset zoom", exact: true }).click();
    await expect.poll(() => span(plot)).toBe(original);
    await drag(page, true);
    await expect.poll(() => span(plot)).toBeLessThan(original);
    await page.locator(".sim-chart-canvas").first().dblclick();
    await expect.poll(() => span(plot)).toBe(original);
    await page.getByText("Reconstructed rows", { exact: true }).click();
    await expect(page.locator(".source-rows tbody tr")).toHaveCount(name === "relative" ? 12 : 48);
    expect(await page.locator(".source-rows td").allTextContents()).toContain("2");
  });

test("relative period fields work from the keyboard without a slider or invented date", async ({
  page,
}) => {
  await load(page, "relative");
  const plot = page.locator(".equipment-card.sim-chart").first();
  const before = Number(await plot.getAttribute("data-range-end"));
  const handle = page.getByRole("spinbutton", { name: "To index", exact: true });
  await handle.focus();
  await handle.fill("4186");
  await handle.press("Tab");
  await expect(plot).toHaveAttribute("data-range-end", String(before - 60000));
  await expect(page.locator("input[type=date]")).toHaveCount(0);
  await expect(handle).toHaveValue("4186");
  await expect(page.locator("input[type=range]")).toHaveCount(0);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(plot).toHaveAttribute("data-range-end", String(before));
});

test("building search preserves generic identities and side-by-side selection", async ({
  page,
}) => {
  await load(page, "calendar");
  const search = page.getByRole("searchbox", { name: "Find building", exact: true });
  await search.fill("β");
  await expect(page.getByTitle(/Studio-α/i)).toHaveCount(0);
  await expect(page.getByTitle(/Studio-β/i)).toBeVisible();
  await page.getByTitle(/Studio-β/i).click();
  await expect(page.locator(".equipment-header h3")).toContainText(/Studio.*β/i);
  await search.fill("not present");
  await expect(page.getByText("No buildings match this search.")).toBeVisible();
  await search.fill("");
  await page.getByTitle(/Studio-α/i).click({ modifiers: ["Control"] });
  await expect(page.locator(".sim-chart-grid.is-compare .sim-chart")).toHaveCount(2);
  await page.evaluate(() => document.fonts.load('14px "Public Sans"'));
  expect(await page.evaluate(() => document.fonts.check('14px "Public Sans"'))).toBe(true);
});

test("an empty window stays empty instead of showing samples outside the selected period", async ({
  page,
}) => {
  await load(page, "relative");
  const start = page.getByRole("spinbutton", { name: "From index", exact: true });
  const end = page.getByRole("spinbutton", { name: "To index", exact: true });
  await start.fill("4176.2");
  await start.press("Tab");
  await end.fill("4176.8");
  await end.press("Tab");
  await expect(page.getByRole("heading", { name: "No data in selected period" })).toBeVisible();
  await expect(page.locator(".equipment-card .recharts-wrapper")).toHaveCount(0);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.locator(".sim-chart-canvas .recharts-wrapper")).toBeVisible();
});

test("BAU data does not add navigation clutter or a clock label beside granularity", async ({
  page,
}) => {
  await load(page, "reference");
  await expect(page.getByRole("button", { name: "Other", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "References", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Business as usual", exact: true })).toHaveCount(0);
  await expect(page.locator(".timeseries-toolbar .timeline-basis")).toHaveCount(0);
  await expect(page.locator(".timeline-note")).toHaveText("Step");
  await expect(page.locator(".chart-quality, .result-details, input[type=range]")).toHaveCount(0);
  await page.getByText("Source rows", { exact: true }).click();
  await expect(page.locator(".source-rows tbody tr")).toHaveCount(2);
});
