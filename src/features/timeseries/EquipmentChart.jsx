import {
  chartFormatters,
  tooltipValue,
  genericTooltipValue,
} from "../../results/chart-formatters.js";
import { chartOverview, overlayOverview } from "../../results/chart-overview.js";
import { useState, useEffect, useRef, useMemo } from "react";
import { DataTable } from "../../components/results/ImportContext.jsx";
import { getEquipmentChartConfig, CHART_COLORS } from "../../results/chart-config.js";
import { useEquipmentChartData } from "./useEquipmentChartData.js";
import { useChartZoom } from "./useChartZoom.js";
import {
  deriveChargerActivityOverlay,
  EMPTY_CHARGER_OVERLAY,
  getEquipmentBarSize,
  getEquipmentXDomain,
  compactNumber,
  buildChartData,
} from "./chart-utils.js";
import { TimeseriesToolbar } from "./TimeseriesToolbar.jsx";
import { clockLabel, chartTitle } from "./chart-presentation.js";
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
  ReferenceArea,
  Tooltip,
  Legend,
  Line,
  Bar,
  LineChart,
} from "recharts";
import { formatTimelineValue } from "../../results/temporal.js";
import { BarChart3, RotateCcw } from "lucide-react";

function EquipmentChart({ item, controls = null }) {
  const [tableView, setTableView] = useState(Boolean(item.series.tableOnly));
  useEffect(
    () => setTableView(Boolean(item.series.tableOnly)),
    [item.series.id, item.series.tableOnly],
  );
  if (!item.series.tableOnly) return <EquipmentPlot item={item} controls={controls} />;
  return (
    <div className="generic-equipment">
      <div className="generic-view-controls">
        <button type="button" onClick={() => setTableView(true)}>
          Table
        </button>
        <button
          type="button"
          disabled={!item.series.numericColumns.length}
          onClick={() => setTableView(false)}
        >
          Chart
        </button>
      </div>
      {tableView ? (
        <article className="equipment-card">
          <header>
            <h3 title={item.series.fileName}>{chartTitle(item)}</h3>
          </header>
          <DataTable table={item.series} />
        </article>
      ) : (
        <EquipmentPlot item={item} controls={controls} />
      )}
    </div>
  );
}

function EquipmentPlot({ item, controls = null }) {
  const chartFrameRef = useRef(null);
  const [sourceRowsOpen, setSourceRowsOpen] = useState(false);
  const [chartFrameWidth, setChartFrameWidth] = useState(0);
  const chartConfig = useMemo(() => getEquipmentChartConfig(item), [item]);
  const {
    rows,
    preparedRows,
    timeline,
    range,
    setRange,
    timeInterval,
    setTimeInterval,
    fallbackMetric,
  } = useEquipmentChartData(item.series, chartConfig, controls);
  const formatters = useMemo(() => chartFormatters(timeline), [timeline]);
  const chargerOverlay = useMemo(
    () =>
      item.type === "charger"
        ? deriveChargerActivityOverlay(preparedRows, chartConfig, range, timeInterval)
        : EMPTY_CHARGER_OVERLAY,
    [chartConfig, item.type, preparedRows, range, timeInterval],
  );
  const visibleDefaults = useMemo(
    () =>
      Object.fromEntries(
        chartConfig.series.map((series) => [series.key, series.visible !== false]),
      ),
    [chartConfig],
  );
  const [visibleSeries, setVisibleSeries] = useState(visibleDefaults);

  useEffect(() => {
    setVisibleSeries(visibleDefaults);
  }, [visibleDefaults]);

  const activeSeries = useMemo(
    () => chartConfig.series.filter((series) => visibleSeries[series.key] && series.field),
    [chartConfig, visibleSeries],
  );
  const drawing = useMemo(() => chartOverview(rows, activeSeries), [rows, activeSeries]);
  const overlayDrawing = useMemo(() => overlayOverview(chargerOverlay), [chargerOverlay]);
  const activeBarCount = activeSeries.filter((series) => series.chart !== "line").length;
  const barSize = getEquipmentBarSize(drawing.rows.length, activeBarCount, chartFrameWidth);
  const xDomain = useMemo(() => getEquipmentXDomain(rows, timeInterval), [rows, timeInterval]);
  const zoom = useChartZoom(range, setRange, chartFrameRef, xDomain);

  useEffect(() => {
    const node = chartFrameRef.current;
    if (!node) return undefined;

    const updateWidth = () => setChartFrameWidth(node.getBoundingClientRect().width || 0);
    updateWidth();

    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <article
      className={
        item.type === "community"
          ? "equipment-card sim-chart is-primary"
          : "equipment-card sim-chart"
      }
      data-original-points={drawing.totalRows}
      data-drawn-points={drawing.rows.length}
      data-series-stats={JSON.stringify(drawing.stats)}
      data-range-start={range[0]}
      data-range-end={range[1]}
    >
      <header className="equipment-header">
        <div>
          <span className="eyebrow">{chartConfig.kind}</span>
          <h3 title={item.series.fileName}>{chartTitle(item)}</h3>
        </div>
        <div className="chart-actions">
          {zoom.zoomed && (
            <button className="button button-ghost" type="button" onClick={zoom.reset}>
              <RotateCcw size={14} aria-hidden="true" /> Reset zoom
            </button>
          )}
        </div>
      </header>

      {!controls && (
        <TimeseriesToolbar
          range={range}
          setRange={setRange}
          minTimestamp={preparedRows[0]?.timestamp ?? 0}
          maxTimestamp={preparedRows.at(-1)?.timestamp ?? 0}
          timeInterval={timeInterval}
          setTimeInterval={setTimeInterval}
          baseIntervalMinutes={timeline.baseIntervalMinutes}
          timeline={timeline}
        />
      )}
      <p className="timeline-note" data-clock-mode={timeline.mode}>
        {clockLabel(timeline)}
      </p>
      <div className="sim-chart-legend">
        {chartConfig.series.map((series, index) => {
          const active = Boolean(visibleSeries[series.key]);
          return (
            <button
              className={active ? "sim-legend-item is-active" : "sim-legend-item"}
              key={series.key}
              type="button"
              aria-pressed={active}
              disabled={!series.field}
              onClick={() =>
                setVisibleSeries((current) => ({
                  ...current,
                  [series.key]: !current[series.key],
                }))
              }
            >
              <span
                className="metric-color"
                style={{ background: series.color || CHART_COLORS[index % CHART_COLORS.length] }}
              />
              <span>{series.label}</span>
            </button>
          );
        })}
      </div>

      {activeSeries.length > 0 && rows.length > 0 ? (
        <div
          className="equipment-chart-frame sim-chart-canvas"
          ref={chartFrameRef}
          {...zoom.events}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={drawing.rows}
              stackOffset="sign"
              margin={{ top: 12, right: 24, left: 6, bottom: 10 }}
              barCategoryGap="24%"
              barGap={2}
            >
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                type="number"
                dataKey="timestamp"
                scale={timeline.mode === "utc" || timeline.mode === "local" ? "time" : "linear"}
                domain={xDomain}
                allowDataOverflow={false}
                tick={{ fontSize: 12 }}
                tickFormatter={formatters.axis}
                minTickGap={42}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12 }}
                width={68}
                tickFormatter={compactNumber}
              />
              {chartConfig.hasRightAxis && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={chartConfig.rightDomain}
                  tick={{ fontSize: 12 }}
                  width={56}
                  tickFormatter={chartConfig.rightFormatter || compactNumber}
                />
              )}
              {chartConfig.showZeroLine && (
                <ReferenceLine
                  yAxisId="left"
                  y={0}
                  stroke="#9aa5b1"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
              )}
              {overlayDrawing.intervals.map((interval, index) => (
                <ReferenceArea
                  key={`charger-interval-${index}-${interval.start}-${interval.end}`}
                  xAxisId={0}
                  yAxisId="left"
                  x1={interval.start}
                  x2={interval.end}
                  fill="#0f766e"
                  fillOpacity={0.1}
                  strokeOpacity={0}
                  ifOverflow="extendDomain"
                />
              ))}
              <Tooltip
                labelFormatter={formatters.tooltip}
                formatter={tooltipValue}
                contentStyle={{
                  background: "var(--panel)",
                  borderColor: "var(--line)",
                  borderRadius: 10,
                  fontSize: 12,
                }}
              />
              {zoom.selection && (
                <ReferenceArea
                  x1={Math.min(...zoom.selection)}
                  x2={Math.max(...zoom.selection)}
                  yAxisId="left"
                  fill="var(--accent)"
                  fillOpacity={0.15}
                  stroke="var(--accent)"
                  strokeOpacity={0.5}
                />
              )}
              {activeSeries.map((series, index) =>
                series.chart === "line" ? (
                  <Line
                    key={series.key}
                    yAxisId={series.axis || "left"}
                    type={series.curve || "monotone"}
                    dataKey={series.field}
                    name={series.label}
                    stroke={series.color || CHART_COLORS[index % CHART_COLORS.length]}
                    strokeWidth={2}
                    strokeDasharray={series.dashArray}
                    isAnimationActive={false}
                    dot={false}
                    connectNulls={Boolean(series.connectNulls)}
                  />
                ) : (
                  <Bar
                    key={series.key}
                    yAxisId={series.axis || "left"}
                    dataKey={series.field}
                    name={series.label}
                    stackId={series.stackId}
                    barSize={barSize}
                    stroke={series.color || CHART_COLORS[index % CHART_COLORS.length]}
                    strokeWidth={0.35}
                    fill={series.color || CHART_COLORS[index % CHART_COLORS.length]}
                    fillOpacity={0.82}
                    radius={[3, 3, 0, 0]}
                    shape={<EquipmentBarShape minWidth={barSize} />}
                    isAnimationActive={false}
                  />
                ),
              )}
              {overlayDrawing.events.map((event, index) => (
                <ReferenceLine
                  key={`charger-${event.type}-${index}-${event.timestamp}`}
                  xAxisId={0}
                  yAxisId="left"
                  x={event.timestamp}
                  stroke={event.type === "connect" ? "#0f766e" : "#be123c"}
                  strokeDasharray="5 4"
                  strokeWidth={2}
                  ifOverflow="extendDomain"
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : activeSeries.length > 0 && rows.length === 0 ? (
        <section className="empty-panel compact">
          <BarChart3 size={24} aria-hidden="true" />
          <h3>No data in selected period</h3>
          <p>Choose another period to view the exported samples.</p>
        </section>
      ) : (
        <GenericSeriesFallback series={item.series} metric={fallbackMetric} />
      )}
      <details
        className="source-rows"
        onToggle={(event) => setSourceRowsOpen(event.currentTarget.open)}
      >
        <summary>{item.series.aggregationEvidence ? "Reconstructed rows" : "Source rows"}</summary>
        {sourceRowsOpen && (
          <DataTable
            table={
              item.series.aggregationEvidence
                ? {
                    ...item.series,
                    formatters: {
                      timestamp: (value) => formatTimelineValue(timeline, value, true),
                    },
                  }
                : item.series
            }
          />
        )}
      </details>
    </article>
  );
}

function GenericSeriesFallback({ series, metric }) {
  const rows = useMemo(() => buildChartData(series, metric, 900), [series, metric]);

  if (!metric || rows.length === 0) {
    return (
      <section className="empty-panel compact">
        <BarChart3 size={26} aria-hidden="true" />
        <h3>No matching Energaize chart columns found</h3>
      </section>
    );
  }

  return (
    <div className="equipment-chart-frame">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 12, right: 24, left: 6, bottom: 10 }}>
          <CartesianGrid stroke="#e4e8ec" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={28} />
          <YAxis tick={{ fontSize: 12 }} width={68} tickFormatter={compactNumber} />
          <Tooltip formatter={genericTooltipValue} />
          <Legend />
          <Line
            type="monotone"
            dataKey="value"
            name={metric}
            stroke="#0f766e"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function EquipmentBarShape({ x, y, width, height, fill, stroke, fillOpacity, minWidth }) {
  const numericX = Number(x);
  const numericY = Number(y);
  const numericWidth = Number(width);
  const numericHeight = Number(height);
  const minimumWidth = Number(minWidth);

  if (
    !Number.isFinite(numericX) ||
    !Number.isFinite(numericY) ||
    !Number.isFinite(numericWidth) ||
    !Number.isFinite(numericHeight) ||
    numericHeight === 0
  ) {
    return null;
  }

  const rawWidth = Math.abs(numericWidth);
  const rawX = numericWidth < 0 ? numericX + numericWidth : numericX;
  const resolvedWidth = Math.max(rawWidth, Number.isFinite(minimumWidth) ? minimumWidth : 1);
  const adjustedX = rawX + rawWidth / 2 - resolvedWidth / 2;
  const resolvedY = numericHeight < 0 ? numericY + numericHeight : numericY;
  const resolvedHeight = Math.abs(numericHeight);

  return (
    <rect
      x={adjustedX}
      y={resolvedY}
      width={resolvedWidth}
      height={resolvedHeight}
      fill={fill}
      fillOpacity={fillOpacity ?? 0.9}
      stroke={stroke || fill}
      strokeWidth={0.45}
    />
  );
}

export { EquipmentChart };
