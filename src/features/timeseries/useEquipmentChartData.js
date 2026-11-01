import { useMemo, useState, useEffect } from "react";
import { prepareTimeline, formatTimelineValue } from "../../results/temporal.js";
import { aggregateRowsForChart } from "../../results/aggregation.js";
import { declaredIntervalMs } from "../../results/quality.js";

function useEquipmentChartData(series, chartConfig, controls = null) {
  const timeline = useMemo(() => prepareTimeline(series), [series]);
  const preparedRows = timeline.rows;
  const minTimestamp = preparedRows[0]?.timestamp ?? 0;
  const maxTimestamp = preparedRows[preparedRows.length - 1]?.timestamp ?? minTimestamp;
  const baseIntervalMinutes = timeline.baseIntervalMinutes || 60;
  const defaultEnd = ["index", "row"].includes(timeline.mode)
    ? maxTimestamp
    : Math.min(maxTimestamp, minTimestamp + 10 * 24 * 60 * 60 * 1000);
  const [localRange, setLocalRange] = useState([minTimestamp, defaultEnd || maxTimestamp]);
  const [localTimeInterval, setLocalTimeInterval] = useState(baseIntervalMinutes);
  const range = controls?.range || localRange;
  const timeInterval = controls?.timeInterval || localTimeInterval;

  useEffect(() => {
    if (controls) return;
    setLocalRange([minTimestamp, defaultEnd || maxTimestamp]);
    setLocalTimeInterval(baseIntervalMinutes);
  }, [controls, series.id, minTimestamp, defaultEnd, maxTimestamp, baseIntervalMinutes]);

  const sourceIncomplete = Boolean(
    series.quality?.excluded ||
    series.quality?.clockUncertain ||
    series.aggregationEvidence?.sourceIncomplete,
  );
  const rows = useMemo(() => {
    const filtered = preparedRows.filter(
      (row) => row.timestamp >= range[0] && row.timestamp <= range[1],
    );
    return aggregateRowsForChart(filtered, timeInterval, chartConfig.series, {
      origin: range[0],
      sampleIntervalMs: declaredIntervalMs(timeline),
      selectedStart: range[0],
      selectedEnd: range[1],
      sourceIncomplete,
    }).map((row) => ({ ...row, label: formatTimelineValue(timeline, row.timestamp) }));
  }, [preparedRows, range, timeInterval, chartConfig, timeline, sourceIncomplete]);

  const fallbackMetric = series.numericColumns[0] || null;

  return {
    rows,
    preparedRows,
    timeline,
    range,
    setRange: controls?.setRange || setLocalRange,
    timeInterval,
    setTimeInterval: controls?.setTimeInterval || setLocalTimeInterval,
    fallbackMetric,
  };
}

export { useEquipmentChartData };
