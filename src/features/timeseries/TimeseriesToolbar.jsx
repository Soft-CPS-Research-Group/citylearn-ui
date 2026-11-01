import { useState, useEffect } from "react";
import { unique } from "../../utils/collections.js";
import { getActiveQuickRange, formatDateInput, parseDateInput, endOfDay } from "./chart-utils.js";
import { toNumber, isFiniteNumber } from "../../results/values.js";
import { formatInterval } from "../../results/temporal.js";

function TimeseriesToolbar({
  range,
  setRange,
  minTimestamp,
  maxTimestamp,
  timeInterval,
  setTimeInterval,
  baseIntervalMinutes,
  timeline,
}) {
  const relative = ["index", "elapsed", "row"].includes(timeline.mode);
  const indexOnly = ["index", "row"].includes(timeline.mode);
  const base = baseIntervalMinutes || (indexOnly ? 1 : 60);
  const [start, end] = range;
  const [draftRange, setDraftRange] = useState(["", ""]);
  useEffect(() => {
    if (relative)
      setDraftRange(
        [start, end].map((value) =>
          String(Number((value / timeline.coordinatePerStep).toFixed(6))),
        ),
      );
  }, [start, end, relative, timeline.coordinatePerStep]);
  const options = unique(indexOnly ? [base, 10, 100] : [base, 1, 5, 15, 60, 180, 360, 1440])
    .filter((v) => v >= base)
    .sort((a, b) => a - b);
  const quick = indexOnly
    ? [{ id: "all", label: "All", days: null }]
    : [
        { id: "1", label: "1 day", days: 1 },
        { id: "7", label: "7 days", days: 7 },
        { id: "10", label: "10 days", days: 10 },
        { id: "all", label: "All", days: null },
      ];
  const active = getActiveQuickRange(range, minTimestamp, maxTimestamp);
  const setNumeric = (value, which) => {
    const step = toNumber(value);
    if (!isFiniteNumber(step)) {
      setDraftRange(range.map((v) => String(Number((v / timeline.coordinatePerStep).toFixed(6)))));
      return;
    }
    const coordinate = Math.min(
      maxTimestamp,
      Math.max(minTimestamp, step * timeline.coordinatePerStep),
    );
    setRange(
      which === 0
        ? [Math.min(coordinate, range[1]), range[1]]
        : [range[0], Math.max(coordinate, range[0])],
    );
  };
  return (
    <section className="timeseries-toolbar">
      <div className="timeseries-toolbar-left">
        <div className="segmented-row">
          <span className="timeseries-granularity-label">
            {indexOnly ? "Group by" : "Granularity"}
          </span>
          {options.map((value) => (
            <button
              key={value}
              type="button"
              className={timeInterval === value ? "segment-btn is-active" : "segment-btn"}
              onClick={() => setTimeInterval(value)}
            >
              {formatInterval(value, timeline)}
            </button>
          ))}
        </div>
      </div>
      <div className="timeseries-toolbar-right">
        <div className="timeseries-date-row">
          {relative ? (
            [0, 1].map((which) => (
              <label className="timeseries-date-field" key={which}>
                <span>
                  {which === 0 ? "From" : "To"} {timeline.mode === "row" ? "row" : "step"}
                </span>
                <input
                  type="number"
                  aria-label={which === 0 ? "From index" : "To index"}
                  step="any"
                  min={minTimestamp / timeline.coordinatePerStep}
                  max={maxTimestamp / timeline.coordinatePerStep}
                  value={draftRange[which]}
                  onChange={(event) =>
                    setDraftRange((current) =>
                      current.map((value, index) => (index === which ? event.target.value : value)),
                    )
                  }
                  onBlur={(event) => setNumeric(event.target.value, which)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                />
              </label>
            ))
          ) : (
            <>
              <label className="timeseries-date-field">
                <span>From</span>
                <input
                  type="date"
                  value={formatDateInput(range[0])}
                  min={formatDateInput(minTimestamp)}
                  max={formatDateInput(maxTimestamp)}
                  onChange={(event) => {
                    const next = Math.max(
                      minTimestamp,
                      parseDateInput(event.target.value, range[0]),
                    );
                    setRange([Math.min(next, range[1]), range[1]]);
                  }}
                />
              </label>
              <label className="timeseries-date-field">
                <span>To</span>
                <input
                  type="date"
                  value={formatDateInput(range[1])}
                  min={formatDateInput(minTimestamp)}
                  max={formatDateInput(maxTimestamp)}
                  onChange={(event) => {
                    const next = Math.min(
                      maxTimestamp,
                      endOfDay(parseDateInput(event.target.value, range[1])),
                    );
                    setRange([range[0], Math.max(next, range[0])]);
                  }}
                />
              </label>
            </>
          )}
        </div>
        <div className="quick-range top">
          {quick.map((option) => (
            <button
              key={option.id}
              type="button"
              className={active === option.id ? "is-active" : ""}
              onClick={() =>
                setRange([
                  minTimestamp,
                  option.days === null
                    ? maxTimestamp
                    : Math.min(maxTimestamp, minTimestamp + option.days * 86400000),
                ])
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export { TimeseriesToolbar };
