import { formatTimelineValue, COVERAGE } from "./temporal.js";
import { SIGNAL_COVERAGE } from "./quality.js";
import { formatNumber } from "./values.js";

// Axis settings can outlive a chart in the plotting library's selector cache.
// Capture only clock scalars, never the series, prepared rows or render scope.
export function chartFormatters({ mode, coordinatePerStep, baseIntervalMinutes }) {
  const clock = { mode, coordinatePerStep, baseIntervalMinutes };
  return {
    axis: (value) => formatTimelineValue(clock, value),
    tooltip: (label, payload) =>
      formatTimelineValue(clock, Number(label), true) +
      (payload?.[0]?.payload?.[COVERAGE]?.partial ||
      ["partial", "unknown"].includes(payload?.[0]?.payload?.[SIGNAL_COVERAGE]?.status)
        ? " · partial/unknown data"
        : ""),
  };
}
export const tooltipValue = (value, name) => [formatNumber(value), name];
export const genericTooltipValue = (value) => formatNumber(value);
