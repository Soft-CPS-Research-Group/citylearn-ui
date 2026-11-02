import { findTimeKey } from "./paths.js";
import { isExcluded, missingValue } from "./quality.js";

// Describe the decoded scalar domain, without coercing values or column names.
export function parquetColumnTypes(nodes) {
  function kind(node) {
    const e = node.element;
    if (["UNKNOWN", "NULL"].includes(e.logical_type?.type)) return null;
    if (node.children.length || e.repetition_type === "REPEATED") return JSON.stringify(node);
    if (["INT32", "INT64", "FLOAT", "DOUBLE"].includes(e.type)) return "number";
    if (e.type === "BOOLEAN") return "boolean";
    if (e.logical_type?.type === "STRING" || e.converted_type === "UTF8") return "string";
    return JSON.stringify({ type: e.type, logical: e.logical_type, converted: e.converted_type });
  }
  return Object.fromEntries(nodes.map((node) => [node.element.name, kind(node)]));
}

function constantIdentity(table, column) {
  let identity = null;
  for (const row of table.rows) {
    if (isExcluded(row) || missingValue(row[column])) continue;
    if (identity !== null && identity !== row[column]) return null;
    identity = row[column];
  }
  return identity;
}

const identityColumn = (name) =>
  /^(entity|building|member|charger|community|episode)[ _-]?id$/i.test(name);

export class PartitionSchema {
  constructor() {
    this.first = null;
    this.types = new Map();
    this.identities = new Map();
  }

  accept(identity, table) {
    const schema = table.schemaColumns || table.columns;
    const time = findTimeKey(schema);
    if (this.first) {
      const first = this.first;
      if (identity.key !== first.identity.key) return "partition belongs to a different series";
      const common = schema.filter((column) => first.schema.includes(column));
      const changed = schema.length !== first.schema.length || common.length !== schema.length;
      if (
        changed &&
        (identity.part === null ||
          first.identity.part === null ||
          table.headerInvalid ||
          first.headerInvalid ||
          !time ||
          time !== first.time ||
          !common.some((column) => column !== time && !identityColumn(column)))
      )
        return "partition columns differ without a compatible shared time series";
    }
    const identities = new Map();
    for (const column of schema) {
      const type = table.columnTypes?.[column];
      if (column !== time && this.types.has(column) && type && this.types.get(column) !== type)
        return `partition type differs for column ${column}`;
      if (identityColumn(column)) {
        const value = constantIdentity(table, column);
        if (value !== null) {
          if (this.identities.has(column) && this.identities.get(column) !== value)
            return `partition identity differs for column ${column}`;
          identities.set(column, value);
        }
      }
    }
    this.first ||= { identity, schema, time, headerInvalid: table.headerInvalid };
    for (const [column, type] of Object.entries(table.columnTypes || {}))
      if (type && column !== time) this.types.set(column, type);
    for (const [column, value] of identities) this.identities.set(column, value);
    return null;
  }
}

export function fillOptionalColumns(sources, columns) {
  for (const { table } of sources) {
    const missing = columns.filter((column) => !table.columns.includes(column));
    if (!missing.length) continue;
    for (const row of table.rows)
      for (const column of missing)
        if (!Object.hasOwn(row, column))
          Object.defineProperty(row, column, {
            value: null,
            enumerable: true,
            configurable: true,
            writable: true,
          });
  }
}
