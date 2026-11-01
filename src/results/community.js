import { resolveField, toNumber, isFiniteNumber } from "./values.js";
import {
  prepareTimeline,
  parseCalendarTime,
  formatTimelineValue,
  GLOBAL_STEP,
  COVERAGE,
} from "./temporal.js";

const ENERGY = {
  "Non-shiftable Load-kWh": [
    "Non-shiftable Load-kWh",
    "electricity_consumption",
    "load",
    "non_shiftable_load",
  ],
  "Net Electricity Consumption-kWh": [
    "Net Electricity Consumption-kWh",
    "net_electricity_consumption",
    "net_consumption",
  ],
  "Energy Production from PV-kWh": [
    "Energy Production from PV-kWh",
    "solar_generation",
    "pv_generation",
    "PV Production-kWh",
  ],
  "Energy Production From EV-kWh": [
    "Energy Production From EV-kWh",
    "Energy Production from EV-kWh",
    "ev_generation",
  ],
};
const object = (v) => v && typeof v === "object" && !Array.isArray(v);
const activeValue = (v) =>
  v === true || v === 1 || /^(true|1)$/i.test(String(v))
    ? true
    : v === false || v === 0 || /^(false|0)$/i.test(String(v))
      ? false
      : null;

function membership(simulation, entries, timeline) {
  const schema = simulation.metadata?.manifest?.effective_schema || {};
  const catalog = object(schema.buildings) ? schema.buildings : null;
  const events =
    Array.isArray(schema.topology_events) && schema.topology_mode === "dynamic"
      ? schema.topology_events
          .filter(
            (e) =>
              object(e) &&
              ["add_member", "remove_member"].includes(e.operation) &&
              e.applied !== false,
          )
          .map((event, i) => ({
            ...event,
            order: i,
            step: toNumber(event.time_step),
            instant: parseCalendarTime(
              event.timestamp_local,
              event.timezone || entries[0]?.series.temporal?.timezone,
            ),
          }))
      : [];
  const ids = new Set(entries.map((e) => e.memberId));
  if (catalog) for (const id of Object.keys(catalog)) ids.add(id);
  for (const event of events)
    if (event.target_member_id != null) ids.add(String(event.target_member_id));
  function state(id, row, source) {
    const activeKey =
      source && resolveField(source.columns, ["member_active", "is_active", "active"]);
    const explicit = activeKey ? activeValue(row?.[activeKey]) : null;
    if (explicit !== null) return explicit;
    let current = catalog && Object.hasOwn(catalog, id) ? catalog[id]?.include !== false : null;
    const applicable = [];
    for (const event of events.filter((e) => String(e.target_member_id) === id)) {
      if (isFiniteNumber(row[GLOBAL_STEP]) && isFiniteNumber(event.step)) {
        if (event.step <= row[GLOBAL_STEP]) applicable.push({ event, at: event.step });
      } else if (event.instant && event.instant.mode === timeline.mode) {
        if (event.instant.timestamp <= row.timestamp)
          applicable.push({ event, at: event.instant.timestamp });
      } else if (
        ["index", "elapsed"].includes(timeline.mode) &&
        timeline.indexOrigin === "global" &&
        isFiniteNumber(event.step)
      ) {
        if (event.step * timeline.coordinatePerStep <= row.timestamp)
          applicable.push({ event, at: event.step });
      } else return null; // The schedule cannot be placed on this clock.
    }
    applicable.sort((a, b) => a.at - b.at || a.event.order - b.event.order);
    for (const { event } of applicable) current = event.operation === "add_member";
    return current;
  }
  return { ids: [...ids], state, declared: Boolean(catalog), events: events.length };
}

// Join interval starts, never array positions. Missing observations remain
// unknown; an absent member is zero contribution only with membership evidence.
export function reconstructCommunity(buildings, simulation, episode) {
  const entries = buildings
    .map((building) => ({
      memberId: building.entityId || building.label,
      series: (
        building.items.find((i) => i.type === "consumption") ||
        building.items.find((i) => i.type === "production")
      )?.series,
    }))
    .filter((e) => e.series)
    .map((e) => ({ ...e, timeline: prepareTimeline(e.series) }));
  if (!entries.length) return { series: null, warnings: [] };
  const timeline = entries[0].timeline,
    warnings = [];
  const sourceIncomplete = entries.some(
    (e) => e.series.quality?.excluded || e.series.quality?.clockRejectedCount,
  );
  if (sourceIncomplete)
    warnings.push(
      "Some source records were excluded from calculations. Reconstructed values remain known subtotals.",
    );
  const incompatible = entries.some(
    (e) =>
      e.timeline.mode !== timeline.mode ||
      e.timeline.mode === "row" ||
      (["index", "elapsed"].includes(timeline.mode) &&
        e.timeline.indexOrigin !== timeline.indexOrigin),
  );
  const declaredIntervals = new Set(
    entries.map((e) => e.timeline.secondsPerStep).filter((v) => v !== null),
  );
  if (incompatible || declaredIntervals.size > 1) {
    return {
      series: null,
      warnings: [
        incompatible
          ? "Community cannot be reconstructed: member clocks have no common unambiguous coordinates. Individual series remain available."
          : "Community cannot be reconstructed across different declared interval durations without inventing energy allocation. Individual series remain available.",
      ],
    };
  }
  const members = membership(simulation, entries, timeline),
    byMember = new Map(),
    coordinates = new Map();
  for (const entry of entries) {
    const samples = new Map();
    for (const row of entry.timeline.rows) {
      if (!samples.has(row.timestamp)) samples.set(row.timestamp, []);
      samples.get(row.timestamp).push(row);
      if (!coordinates.has(row.timestamp)) coordinates.set(row.timestamp, row);
    }
    if (byMember.has(entry.memberId))
      return {
        series: null,
        warnings: [
          "Community member identity is duplicated; individual series remain available without a guessed aggregate.",
        ],
      };
    byMember.set(entry.memberId, {
      ...entry,
      samples,
      fields: Object.fromEntries(
        Object.entries(ENERGY).map(([field, aliases]) => [
          field,
          resolveField(entry.series.columns, aliases),
        ]),
      ),
    });
  }
  const fields = Object.keys(ENERGY).filter((field) =>
    [...byMember.values()].some((member) => member.fields[field]),
  );
  const rows = [];
  for (const [timestamp, reference] of [...coordinates].sort(([a], [b]) => a - b)) {
    const row = {
      timestamp,
      [GLOBAL_STEP]: reference[GLOBAL_STEP],
      label: formatTimelineValue(timeline, timestamp),
    };
    const coverage = {
      expected: 0,
      observed: 0,
      absent: 0,
      unknown: 0,
      missing: 0,
      ambiguous: 0,
      conflicts: 0,
      fields: {},
      partial: false,
    };
    const contributions = [];
    for (const id of members.ids) {
      const member = byMember.get(id),
        samples = member?.samples.get(timestamp) || [];
      const source = samples[0],
        active = members.state(id, source || reference, member?.series);
      if (active === true) coverage.expected++;
      else if (active === false) coverage.absent++;
      else coverage.unknown++;
      if (samples.length > 1) {
        coverage.ambiguous++;
        continue;
      }
      if (!source) {
        if (active !== false) coverage.missing++;
        continue;
      }
      coverage.observed++;
      if (active === false) coverage.conflicts++;
      contributions.push({ member, source });
    }
    for (const field of fields) {
      const values = contributions
        .map(({ member, source }) =>
          member.fields[field] ? toNumber(source[member.fields[field]]) : null,
        )
        .filter(isFiniteNumber);
      row[field] = values.length ? values.reduce((sum, v) => sum + v, 0) : null;
      coverage.fields[field] = {
        observed: values.length,
        missing: contributions.length - values.length,
      };
    }
    // Optional equipment channels absent from a source are unknown, not a
    // fabricated zero. Coverage is available per channel as well as per member.
    coverage.partial = Boolean(
      coverage.unknown ||
      coverage.missing ||
      coverage.ambiguous ||
      coverage.conflicts ||
      Object.values(coverage.fields).some((f) => f.missing),
    );
    row[COVERAGE] = coverage;
    Object.assign(row, {
      "Declared active members": coverage.expected,
      "Observed member rows": coverage.observed,
      "Declared absent members": coverage.absent,
      "Unknown membership": coverage.unknown,
      "Missing/unknown member rows": coverage.missing,
      "Ambiguous member coordinates": coverage.ambiguous,
      "Membership conflicts": coverage.conflicts,
      "Channel coverage": coverage.fields,
    });
    rows.push(row);
  }
  if (!members.declared)
    warnings.push(
      "Membership is not exported. Missing member rows are unknown, not zero demand; values are known subtotals.",
    );
  if (rows.some((r) => r[COVERAGE].ambiguous))
    warnings.push(
      "Repeated member coordinates are ambiguous. Those member contributions are excluded from the reconstructed subtotal and retained in their source series.",
    );
  if (rows.some((r) => r[COVERAGE].conflicts))
    warnings.push(
      "Some rows conflict with declared inactive membership. Their reported values remain in the subtotal; membership coverage is inconsistent.",
    );
  const partialRows = rows.filter((r) => r[COVERAGE].partial).length;
  const columns = [
    "timestamp",
    ...fields,
    "Declared active members",
    "Observed member rows",
    "Declared absent members",
    "Unknown membership",
    "Missing/unknown member rows",
    "Ambiguous member coordinates",
    "Membership conflicts",
    "Channel coverage",
  ];
  const result = {
    id: `community-${simulation.id}-${episode || "all"}`,
    fileName: "community aggregate",
    relativePath: "community aggregate",
    resultKey: "community",
    matchKey: "community",
    label: "Community",
    category: "Buildings",
    episode,
    rows,
    columns,
    numericColumns: fields,
    timeKey: "timestamp",
    timeline: { ...timeline, rows: undefined, warnings: [...timeline.warnings, ...warnings] },
    aggregationEvidence: {
      source: "reconstructed",
      sourceIncomplete,
      membership: members.declared ? "Declared membership schedule" : "Membership not exported",
      intervals: rows.length,
      partialIntervals: partialRows,
      warnings,
    },
  };
  return { series: result, warnings };
}
