import { analyzeTable, issue, isExcluded } from "./quality.js";
import { recoverKpis } from "./kpi-quality.js";
import { temporalContext, inspectClock } from "./temporal.js";
import {
  readPartitions,
  numericColumns,
  isTableFile,
  isKpiFile,
  isRecognizedResultFile,
  tableIdentity,
} from "./tabular.js";
import {
  normalizePath,
  baseName,
  slugify,
  hashText,
  trimSimulationPrefix,
  findTimeKey,
  extractEpisode,
  normalizeMatchKey,
  formatSeriesLabel,
  categorizeSeries,
} from "./paths.js";

const metadataFile = (name) =>
  /(?:^manifest|\.manifest|\.deferrable_service|\.robustness|^service|^robustness)\.json$/i.test(
    name,
  );
const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true });
export function groupResultFiles(files) {
  const entries = [...files]
    .map((file) => {
      const relativePath = normalizePath(file.webkitRelativePath || file.name),
        pieces = relativePath.split("/").filter(Boolean);
      return {
        file,
        relativePath,
        fileName: pieces.at(-1) || file.name,
        directory: pieces.slice(0, -1).join("/") || "selected-files",
      };
    })
    .filter((e) => isTableFile(e.fileName) || metadataFile(e.fileName));
  const directories = new Map();
  for (const entry of entries) {
    if (!directories.has(entry.directory)) directories.set(entry.directory, []);
    directories.get(entry.directory).push(entry);
  }
  const recognized = [...directories]
    .filter(([, e]) => e.some((x) => isRecognizedResultFile(x.fileName)))
    .map(([path]) => path);
  const candidates = (
    recognized.length
      ? recognized
      : [...directories]
          .filter(([, e]) => e.some((x) => isTableFile(x.fileName)))
          .map(([path]) => path)
  ).sort((a, b) => b.length - a.length);
  const groups = new Map();
  for (const entry of entries) {
    const match = candidates.find(
      (path) => entry.directory === path || entry.directory.startsWith(path + "/"),
    );
    // Metadata-only/irrelevant sibling directories do not become simulations.
    if (!match && !isTableFile(entry.fileName)) continue;
    const path = match || entry.directory;
    if (!groups.has(path)) groups.set(path, { path, name: baseName(path), entries: [] });
    groups.get(path).entries.push(entry);
  }
  const names = new Map();
  return [...groups.values()].map((group) => {
    const n = names.get(group.name) || 0;
    names.set(group.name, n + 1);
    return { ...group, name: n ? `${group.name} ${n + 1}` : group.name };
  });
}

function normalizeSeries(entry, group, table) {
  const relative = trimSimulationPrefix(entry.relativePath, group.path);
  const clean = relative.replace(/\.(?:csv|parquet|pq|parq)$/i, "");
  const timeKey = findTimeKey(table.columns);
  return {
    id: hashText(`${entry.relativePath}:${entry.file.size}:${entry.file.lastModified}`),
    fileName: entry.fileName,
    relativePath: relative,
    resultKey: normalizeMatchKey(clean),
    matchKey: normalizeMatchKey(clean),
    label: formatSeriesLabel(clean),
    category: categorizeSeries(clean),
    episode: extractEpisode(clean),
    rows: table.rows,
    columns: table.columns,
    numericColumns: table.headerInvalid
      ? []
      : numericColumns({ ...table, rows: table.rows.filter((row) => !isExcluded(row)) }, timeKey),
    timeKey,
    quality: analyzeTable(table, { file: entry.fileName, path: entry.relativePath, timeKey }),
  };
}

async function sidecars(group, stem, warnings, diagnostics) {
  const metadata = { manifest: null, service: null, robustness: null, sources: {} };
  const choices = {
    manifest: [stem + ".manifest.json", "manifest.json"],
    service: [stem + ".deferrable_service.json", "service.json"],
    robustness: [stem + ".robustness.json", "robustness.json"],
  };
  for (const [kind, names] of Object.entries(choices)) {
    for (const name of names) {
      const entry = group.entries.find(
        (e) =>
          trimSimulationPrefix(e.relativePath, group.path).toLowerCase() === name.toLowerCase(),
      );
      if (!entry) continue;
      let rawText;
      try {
        rawText = await entry.file.text();
        const data = JSON.parse(rawText);
        if (!data || typeof data !== "object" || Array.isArray(data))
          throw new Error("expected a metadata object");
        metadata[kind] = data;
        metadata.sources[kind] = entry.fileName;
        break;
      } catch (error) {
        warnings.push(`${entry.fileName}: ${error.message}; data files remain available.`);
        diagnostics.push(
          issue(
            "invalid-metadata",
            entry.fileName,
            error.message,
            "Optional metadata was ignored; valid data remains readable.",
            { rawText },
          ),
        );
      }
    }
  }
  return metadata;
}

export async function parseResultFolder(group, options = {}) {
  const entries = group.entries.filter((e) => isTableFile(e.fileName)),
    warnings = [],
    dataIssues = [],
    series = [],
    tables = [],
    diagnostics = [];
  const logical = new Map();
  for (const entry of entries) {
    const identity = tableIdentity(entry);
    if (!logical.has(identity.key)) logical.set(identity.key, new Map());
    const variants = logical.get(identity.key),
      variant = identity.extension + ":" + (identity.part === null ? "whole" : "parts");
    if (!variants.has(variant)) variants.set(variant, []);
    variants.get(variant).push(entry);
  }
  let kpis = null,
    kpiStem = null;
  const ordered = [...logical].sort(([a], [b]) => {
    const weight = (key) =>
      /(?:^|\/)exported_kpis$/i.test(key) ? 0 : isKpiFile(baseName(key) + ".csv") ? 1 : 2;
    return weight(a) - weight(b) || natural(a, b);
  });
  function asTable(entry, table, label) {
    const s = normalizeSeries(entry, group, table);
    s.tableOnly = true;
    // Supplemental KPI tables describe an episode but must not replace the
    // default episode selected from equipment timeseries. They stay accessible.
    if (isKpiFile(entry.fileName)) s.episode = "";
    if (label) s.label = label;
    series.push(s);
  }
  for (const [key, variants] of ordered) {
    const selected = [...variants].sort(
      ([a], [b]) =>
        (a.startsWith("csv:") ? 0 : 1) - (b.startsWith("csv:") ? 0 : 1) || a.localeCompare(b),
    );
    let primary = null;
    for (const [variant, files] of selected) {
      const table = await readPartitions(files, options);
      for (const warning of table.warnings) warnings.push(warning);
      for (const diagnostic of table.diagnostics) diagnostics.push(diagnostic);
      for (const warning of table.warnings) dataIssues.push(warning);
      for (const incompatible of table.sources.filter((s) => s.incompatible))
        asTable(
          incompatible.entry,
          incompatible.table,
          "Partition with different columns — " + incompatible.entry.fileName,
        );
      if (!table.columns.length) continue;
      const combined = files.length > 1 || tableIdentity(files[0]).part !== null;
      const fileName = baseName(key) + "." + tableIdentity(files[0]).extension;
      const entry = combined
        ? {
            ...files[0],
            fileName,
            relativePath: key + "." + tableIdentity(files[0]).extension,
            file: {
              size: files.reduce((n, e) => n + e.file.size, 0),
              lastModified: files.reduce(
                (latest, e) => Math.max(latest, e.file.lastModified || 0),
                0,
              ),
            },
          }
        : files[0];
      if (primary) {
        const message = `Multiple representations of ${baseName(key)}: using ${primary}; ${variant} remains available as a table.`;
        warnings.push(message);
        dataIssues.push(message);
        diagnostics.push(
          issue(
            "representation-alternative",
            fileName,
            message,
            "Only the chosen representation is used for charts; the alternative remains inspectable and is not counted twice.",
            { severity: "info", path: entry.relativePath },
          ),
        );
        asTable(entry, table, "Alternative — " + entry.fileName);
        continue;
      }
      primary = variant;
      const names = table.columns.map((c) => c.toLowerCase());
      const kpiCandidate =
        isKpiFile(fileName) ||
        names.includes("kpi") ||
        ["name", "cost_function", "value"].every((c) => names.includes(c));
      if (kpiCandidate && !kpis) {
        try {
          const recovered = recoverKpis(table, fileName);
          for (const diagnostic of recovered.diagnostics) diagnostics.push(diagnostic);
          for (const diagnostic of recovered.diagnostics)
            warnings.push(`${fileName}: ${diagnostic.message}`);
          if (recovered.diagnostics.length)
            dataIssues.push(`${fileName}: ambiguous KPI identities excluded`);
          kpis = recovered.kpis;
          if (!kpis) {
            asTable(entry, table);
            primary = null;
            continue;
          }
          kpiStem = trimSimulationPrefix(key, group.path);
          const long = kpis.inputShape === "long";
          kpis.quality = analyzeTable(table, {
            file: fileName,
            kpi: !long,
            labelKey: long ? null : kpis.labelKey,
          });
          diagnostics.push(
            ...kpis.quality.diagnostics.filter((d) => !(table.diagnostics || []).includes(d)),
          );
          if (kpis.quality.columns.some((c) => c.invalid))
            dataIssues.push(`${fileName}: invalid numeric KPI values`);
          if (long) tables.push({ label: "Original long KPI rows", ...table });
          else if (recovered.diagnostics.length || table.rows.some(isExcluded))
            tables.push({ label: "Original KPI rows (including excluded records)", ...table });
        } catch (error) {
          warnings.push(`${fileName}: ${error.message}`);
          dataIssues.push(`${fileName}: unsupported KPI layout`);
          asTable(entry, table);
          primary = null;
        }
      } else if (kpiCandidate) {
        warnings.push(`${fileName}: additional KPI table retained separately.`);
        dataIssues.push("Multiple KPI tables in one folder");
        diagnostics.push(
          issue(
            "additional-kpi",
            fileName,
            "Additional KPI table retained separately.",
            "The primary scorecard is not silently merged with this other table.",
            { severity: "info", path: entry.relativePath },
          ),
        );
        asTable(entry, table);
      } else {
        const s = normalizeSeries(entry, group, table);
        // Unknown tabular exports have an inspectable table without inventing a
        // calendar. A chart remains available for their numeric columns.
        if (!s.timeKey || table.headerInvalid || s.quality.accepted === 0) s.tableOnly = true;
        series.push(s);
      }
    }
  }
  if (!kpis) {
    warnings.push("No recognised KPI file found.");
    diagnostics.push(
      issue(
        "missing-kpi",
        group.name,
        "No usable KPI table was found.",
        "Timeseries and source tables remain accessible; scorecard values are not fabricated.",
        { severity: "info" },
      ),
    );
  }
  options.signal?.throwIfAborted();
  const metadata = await sidecars(group, kpiStem || "exported_kpis", warnings, diagnostics);
  for (const item of series) {
    item.temporal = temporalContext(metadata, item.episode);
    const clock = inspectClock(item),
      prior = item.quality.diagnostics;
    Object.assign(item.quality, clock);
    item.quality.diagnostics = [...prior, ...clock.diagnostics];
  }
  const knownDiagnostics = new Set(diagnostics);
  for (const item of series)
    for (const diagnostic of item.quality.diagnostics)
      if (!knownDiagnostics.has(diagnostic)) {
        knownDiagnostics.add(diagnostic);
        diagnostics.push(diagnostic);
      }
  // Manifest references are evidence, not paths to fetch or execute.
  const fingerprint = group.entries
    .filter((e) => isTableFile(e.fileName) || metadataFile(e.fileName))
    .map((e) => `${e.relativePath}:${e.file.size}:${e.file.lastModified}`)
    .sort()
    .join("|");
  return {
    id: `${slugify(group.name)}-${hashText(fingerprint || group.path)}`,
    name: group.name,
    path: group.path,
    importedAt: new Date().toISOString(),
    fileCount: entries.length,
    kpis,
    series: series.sort((a, b) => a.label.localeCompare(b.label)),
    warnings,
    metadata,
    tables,
    dataIssues,
    quality: {
      diagnostics,
      files: entries.length,
      records: series.reduce((n, s) => n + s.rows.length, 0),
    },
    formats: [...new Set(entries.map((e) => tableIdentity(e).extension))],
  };
}

export async function parseResultGroups(groups, parse = parseResultFolder, options = {}) {
  const simulations = [],
    rejected = [];
  let completed = 0,
    files = 0;
  const totalFiles = groups.reduce(
    (n, g) => n + (g.entries || []).filter((e) => isTableFile(e.fileName)).length,
    0,
  );
  for (const group of groups) {
    options.signal?.throwIfAborted();
    options.onProgress?.({
      phase: "folder",
      folder: group.name,
      folders: groups.length,
      completed,
      files,
      totalFiles,
    });
    // One folder at a time bounds peak decoding/clone work. No member/file cap.
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      const simulation = await parse(group, {
        signal: options.signal,
        yield: options.yield,
        onFile(entry) {
          options.signal?.throwIfAborted();
          options.onProgress?.({
            phase: "file",
            folder: group.name,
            file: entry.fileName,
            folders: groups.length,
            completed,
            files: ++files,
            totalFiles,
          });
        },
      });
      options.signal?.throwIfAborted();
      options.onSimulation?.(simulation);
      if (options.retain !== false) simulations.push(simulation);
    } catch (error) {
      if (options.signal?.aborted || error.name === "AbortError") throw error;
      rejected.push({ folder: group.name, message: error.message || String(error) });
    }
    completed++;
  }
  return { simulations, rejected };
}
