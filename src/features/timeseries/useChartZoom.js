import { useEffect, useRef, useState } from "react";

// Keep pointer gestures separate from the chart's asynchronous tooltip events.
// Only the viewing window changes; source rows and aggregation stay untouched.
export function useChartZoom(range, setRange, frame, domain) {
  const drag = useRef(null);
  const original = useRef(null);
  const applied = useRef(null);
  const [selection, setSelection] = useState(null);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (applied.current && range.some((value, i) => value !== applied.current[i])) {
      applied.current = null;
      original.current = null;
      drag.current = null;
      setSelection(null);
      setZoomed(false);
    }
  }, [range]);

  const coordinate = (event) => {
    const axis = frame.current?.querySelector(".recharts-xAxis .recharts-cartesian-axis-line");
    const bounds = axis?.getBoundingClientRect();
    if (!bounds?.width || !domain.every(Number.isFinite)) return null;
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    return Math.max(range[0], Math.min(range[1], domain[0] + ratio * (domain[1] - domain[0])));
  };
  const cancel = () => {
    drag.current = null;
    setSelection(null);
  };
  const reset = () => {
    if (!original.current) return;
    const previous = original.current;
    original.current = null;
    applied.current = null;
    setZoomed(false);
    cancel();
    setRange(previous);
  };
  return {
    selection,
    zoomed,
    reset,
    events: {
      onPointerDown(event) {
        if (event.pointerType === "touch" || event.button !== 0) return;
        const value = coordinate(event);
        if (value === null) return;
        drag.current = { start: value, x: event.clientX };
      },
      onPointerMove(event) {
        if (!drag.current || Math.abs(event.clientX - drag.current.x) < 6) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        const value = coordinate(event);
        if (value !== null) setSelection([drag.current.start, value]);
      },
      onPointerUp(event) {
        const current = drag.current;
        if (!current) return;
        const end = coordinate(event);
        cancel();
        if (end === null || Math.abs(event.clientX - current.x) < 6 || current.start === end)
          return;
        const next = [Math.min(current.start, end), Math.max(current.start, end)];
        if (next.every((value, i) => value === range[i])) return;
        original.current ||= [...range];
        applied.current = next;
        setZoomed(true);
        setRange(next);
      },
      onPointerCancel: cancel,
      onLostPointerCapture: cancel,
      onDoubleClick: reset,
    },
  };
}
