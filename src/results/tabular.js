import { SOURCE, EXCLUDED, issue, numericValue } from "./quality.js";
import Papa from "papaparse";
import { isFiniteNumber } from "./values.js";

export const isTableFile = (name) => /\.(?:csv|parquet|pq|parq)$/i.test(name);
export const isKpiFile = (name) =>
  /^(?:exported_)?kpis?\.(?:csv|parquet|pq|parq)$/i.test(name) || /(^|_)kpis?(\.|_)/i.test(name);
export const isRecognizedResultFile = (name) =>
  isTableFile(name) && (isKpiFile(name) || /^exported_data_/i.test(name));
export const collectColumns = (rows) => [...new Set(rows.flatMap((row) => Object.keys(row)))];

function scalar(value) {
  if (typeof value === "bigint")
    return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : String(value);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  return value;
}
function cleanRow(row) {
  return Object.fromEntries(
    Object.entries(row || {})
      .filter(([key]) => String(key).trim())
      .map(([key, value]) => [
        String(key).trim(),
        typeof value === "string" ? value.trim() : scalar(value),
      ]),
  );
}

export async function readTable(entry) {
  if (/\.csv$/i.test(entry.fileName)) {
    const text = await entry.file.text();
    const parsed = Papa.parse(text, { header: false, skipEmptyLines: "greedy" });
    const headers = (parsed.data[0] || []).map((value) => String(value ?? "").trim()),
      used = new Set(),
      seenHeaders = new Set(),
      reserved = new Set((parsed.data[0] || []).map((v) => String(v ?? "").trim())),
      diagnostics = [];
    let headerInvalid = false;
    const columns = headers.map((header, index) => {
      let name = header || `(unnamed column ${index + 1})`;
      if (!header || seenHeaders.has(header)) {
        headerInvalid = true;
        diagnostics.push(
          issue(
            "invalid-header",
            entry.fileName,
            !header ? `Column ${index + 1} has an empty header.` : `Duplicate header: ${header}.`,
            "Columns are preserved with explicit inspection labels; this table is not used for automatic charts or KPIs.",
            { column: header || `column ${index + 1}` },
          ),
        );
      }
      seenHeaders.add(header);
      let suffix = 2;
      while (used.has(name) || (name !== header && reserved.has(name)))
        name = `${header || "(unnamed)"} (column ${index + 1}, ${suffix++})`;
      used.add(name);
      return name;
    });
    let extraColumn = "(extra fields)";
    while (used.has(extraColumn)) extraColumn = "_" + extraColumn;
    const rows = parsed.data.slice(1).map((values, index) => {
      const row = Object.fromEntries(
        columns
          .slice(0, values.length)
          .map((column, i) => [column, String(values[i] ?? "").trim()]),
      );
      row[SOURCE] = { file: entry.fileName, path: entry.relativePath, record: index + 1 };
      if (values.length !== headers.length) {
        row[EXCLUDED] = true;
        if (values.length > headers.length) row[extraColumn] = values.slice(headers.length);
        diagnostics.push(
          issue(
            "field-count",
            entry.fileName,
            `Data record ${index + 1}: expected ${headers.length} fields, found ${values.length}.`,
            "This record is retained in the source table and excluded from charts and KPI calculations.",
            {
              record: index + 1,
              examples: [
                {
                  record: index + 1,
                  column: values.length > headers.length ? extraColumn : "(missing fields)",
                  value: values,
                },
              ],
            },
          ),
        );
      }
      if (headerInvalid) row[EXCLUDED] = true;
      return row;
    });
    for (const error of parsed.errors) {
      if (error.type === "Delimiter") {
        diagnostics.push(
          issue(
            "delimiter-default",
            entry.fileName,
            error.message,
            "A single-column/comma table remains readable.",
            { severity: "info" },
          ),
        );
        continue;
      }
      const record = Number.isInteger(error.row) ? error.row : null;
      diagnostics.push(
        issue(
          "csv-" + error.code,
          entry.fileName,
          error.message,
          "Ambiguous records are retained for inspection and excluded from calculations.",
          { record: record && record > 0 ? record : null },
        ),
      );
      if (record !== null && record > 0 && rows[record - 1]) rows[record - 1][EXCLUDED] = true;
      else for (const row of rows) row[EXCLUDED] = true;
    }
    const schemaColumns = [...columns];
    if (rows.some((row) => Object.hasOwn(row, extraColumn))) columns.push(extraColumn);
    if (!headers.length || !rows.length)
      diagnostics.push(
        issue(
          "empty-table",
          entry.fileName,
          headers.length
            ? "The table has headers but no data records."
            : "The file has no readable table.",
          "No measurements or zero values are inferred.",
        ),
      );
    for (const diagnostic of diagnostics) diagnostic.path = entry.relativePath;
    return {
      rows,
      columns,
      schemaColumns,
      warnings: diagnostics
        .filter((d) => d.severity !== "info")
        .map((d) => `${entry.fileName}: ${d.message}`),
      diagnostics,
      headerInvalid,
      rawHeaders: headerInvalid ? headers : undefined,
      rawText:
        headerInvalid || parsed.errors.some((e) => e.type !== "Delimiter") ? text : undefined,
    };
  }
  const [{ parquetReadObjects, parquetMetadataAsync, parquetSchema }, { compressors }] =
    await Promise.all([import("hyparquet"), import("hyparquet-compressors")]);
  // File.slice keeps the decoder local and avoids copying the entire file just
  // to read its footer. Node/test adapters can supply an ArrayBuffer instead.
  const file =
    typeof entry.file.slice === "function"
      ? {
          byteLength: entry.file.size,
          slice: (start, end) => entry.file.slice(start, end).arrayBuffer(),
        }
      : await entry.file.arrayBuffer();
  const metadata = await parquetMetadataAsync(file);
  const columns = parquetSchema(metadata).children.map((c) => c.element.name);
  const rows = (await parquetReadObjects({ file, metadata, compressors })).map(cleanRow);
  for (const [index, row] of rows.entries())
    row[SOURCE] = { file: entry.fileName, path: entry.relativePath, record: index + 1 };
  const diagnostics = rows.length
    ? []
    : [
        issue(
          "empty-table",
          entry.fileName,
          "The Parquet table contains no records.",
          "No measurements or zero values are inferred.",
        ),
      ];
  for (const diagnostic of diagnostics) diagnostic.path = entry.relativePath;
  return {
    rows,
    columns,
    warnings: diagnostics.map((d) => `${entry.fileName}: ${d.message}`),
    diagnostics,
  };
}

// Native parquet parts are suffixed after the episode, so IDs containing the
// word "part" are not mistaken for a partition when there is no episode suffix.
export function tableIdentity(entry) {
  const extension = entry.fileName.match(/\.([^.]+)$/)?.[1].toLowerCase();
  const path = entry.relativePath.replace(/\.(?:csv|parquet|pq|parq)$/i, "");
  const part = path.match(/^(.*_ep(?:isode)?_?\d+)_part(\d+)$/i);
  return { key: part ? part[1] : path, extension, part: part ? Number(part[2]) : null };
}

export async function readPartitions(entries, options = {}) {
  const warnings = [],
    diagnostics = [],
    parts = entries
      .map((e) => ({ entry: e, ...tableIdentity(e) }))
      .sort((a, b) => (a.part ?? -1) - (b.part ?? -1));
  const numbered = parts.filter((p) => p.part !== null);
  if (numbered.some((p, i) => p.part !== i)) {
    warnings.push(
      "Partition numbering is incomplete or duplicated; only selected parts are available.",
    );
    diagnostics.push(
      issue(
        "partition-sequence",
        entries[0].fileName,
        "Partition numbering is incomplete or duplicated.",
        "Selected valid parts remain readable; file/period completeness is unknown.",
      ),
    );
  }
  let columns = null,
    schemaColumns = null;
  const rows = [],
    sources = [],
    usedParts = new Set();
  for (const { entry, part } of parts) {
    options.signal?.throwIfAborted();
    options.onFile?.(entry);
    if (options.yield) await new Promise((resolve) => setTimeout(resolve, 0));
    options.signal?.throwIfAborted();
    try {
      const table = await readTable(entry);
      for (const diagnostic of table.diagnostics || []) diagnostics.push(diagnostic);
      if (part !== null && usedParts.has(part)) {
        warnings.push(
          `${entry.fileName}: duplicate partition ${part}; retained as a separate table, not added twice.`,
        );
        diagnostics.push(
          issue(
            "partition-alternative",
            entry.fileName,
            warnings.at(-1),
            "This part remains a separate source table and is not added to the chosen series.",
          ),
        );
        sources.push({ entry, table, incompatible: true });
        continue;
      }
      const schema = table.schemaColumns || table.columns;
      if (
        schemaColumns &&
        (schema.length !== schemaColumns.length || schema.some((c) => !schemaColumns.includes(c)))
      ) {
        warnings.push(`${entry.fileName}: partition columns differ; retained as a separate table.`);
        diagnostics.push(
          issue(
            "partition-alternative",
            entry.fileName,
            warnings.at(-1),
            "This part remains a separate source table and is not added to the chosen series.",
          ),
        );
        sources.push({ entry, table, incompatible: true });
        continue;
      }
      schemaColumns ||= schema;
      columns ||= [...table.columns];
      for (const column of table.columns) if (!columns.includes(column)) columns.push(column);
      if (part !== null) usedParts.add(part);
      for (const row of table.rows) rows.push(row);
      for (const warning of table.warnings) warnings.push(warning);
      sources.push({ entry, table });
    } catch (error) {
      if (options.signal?.aborted || error.name === "AbortError") throw error;
      warnings.push(`${entry.fileName}: ${error.message}`);
      diagnostics.push(
        issue(
          "unreadable-file",
          entry.fileName,
          error.message,
          "This file could not be decoded. Other valid files remain available.",
          { severity: "error", path: entry.relativePath },
        ),
      );
    }
  }
  return {
    rows,
    columns: columns || [],
    warnings,
    sources,
    diagnostics,
    headerInvalid: sources.some((s) => !s.incompatible && s.table.headerInvalid),
    rawHeaders: sources.find((s) => s.table.rawHeaders)?.table.rawHeaders,
    rawText: sources.find((s) => s.table.rawText)?.table.rawText,
  };
}

export function adaptKpis(table, fileName) {
  const { rows, columns } = table;
  const field = (name) => columns.find((c) => c.toLowerCase() === name);
  const metric = field("cost_function"),
    entity = field("name"),
    value = field("value");
  if (metric && entity && value) {
    const metrics = new Map(),
      entities = [],
      seenEntities = new Set(),
      identities = new Set(),
      levels = new Map();
    for (const row of rows) {
      const name = String(row[entity] ?? "").trim(),
        key = String(row[metric] ?? "").trim();
      if (!name || !key) throw new Error("Long KPI row has no entity or indicator identity.");
      const identity = JSON.stringify([name, key]);
      if (identities.has(identity))
        throw new Error(`Duplicate KPI/entity identity: ${name} / ${key}.`);
      identities.add(identity);
      if (!seenEntities.has(name)) {
        seenEntities.add(name);
        entities.push(name);
      }
      if (!metrics.has(key)) metrics.set(key, new Map());
      metrics.get(key).set(name, row[value]);
      const level = field("level");
      if (level && row[level] != null) {
        if (levels.has(name) && levels.get(name) !== row[level])
          throw new Error(`Conflicting levels for KPI entity ${name}.`);
        levels.set(name, row[level]);
      }
    }
    let labelKey = "KPI";
    while (seenEntities.has(labelKey)) labelKey = "_" + labelKey;
    const wide = [...metrics].map(([key, values]) =>
      Object.fromEntries([
        [labelKey, key],
        ...entities.map((name) => [name, values.get(name) ?? null]),
      ]),
    );
    return {
      fileName,
      rows: wide,
      columns: [labelKey, ...entities],
      labelKey,
      levels: Object.fromEntries(levels),
      inputShape: "long",
    };
  }
  const labelKey =
    field("kpi") ||
    columns.find((c) => /^(metric|indicator|cost_function|name)$/i.test(c)) ||
    (isKpiFile(fileName)
      ? columns.find((c) =>
          rows.some((row) => String(row[c] ?? "").trim() && !isFiniteNumber(numericValue(row[c]))),
        )
      : null);
  if (!labelKey) throw new Error("Unrecognised KPI layout; available as a table.");
  const identities = new Set();
  for (const row of rows) {
    const label = String(row[labelKey] ?? "").trim();
    if (!label || identities.has(label))
      throw new Error(`Missing or duplicate KPI identity: ${label || "(empty)"}.`);
    identities.add(label);
  }
  return { fileName, rows, columns, labelKey };
}

export function numericColumns(table, timeKey) {
  return table.columns.filter(
    (c) => c !== timeKey && table.rows.some((row) => isFiniteNumber(numericValue(row[c]))),
  );
}
