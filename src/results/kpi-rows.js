import { isFiniteNumber, toNumber } from "./values.js";

function getKpiLabel(row, kpis) {
  return String(row[kpis.labelKey] || "Unnamed KPI").trim();
}

function aggregateKpiRow(row, columns, labelKey) {
  const numericColumns = columns.filter(
    (column) => column !== labelKey && isFiniteNumber(toNumber(row[column])),
  );
  const preferredColumn = numericColumns.find((column) =>
    /district|total|score|value|average|avg|all/i.test(column),
  );

  if (preferredColumn) {
    return {
      value: toNumber(row[preferredColumn]),
      sourceColumn: preferredColumn,
    };
  }

  const values = numericColumns.map((column) => toNumber(row[column])).filter(isFiniteNumber);
  if (values.length === 0) {
    return { value: null, sourceColumn: "no numeric value" };
  }

  return {
    value: values.reduce((sum, value) => sum + value, 0) / values.length,
    sourceColumn: values.length === 1 ? numericColumns[0] : "average",
  };
}

function shortenLabel(label) {
  const trimmed = label.replace(/\s+/g, " ").trim();
  return trimmed.length > 14 ? `${trimmed.slice(0, 13)}.` : trimmed;
}

function formatKpiDisplayLabel(label) {
  const text = String(label || "")
    .replace(/^district_/i, "")
    .replace(/^building_/i, "");
  if (text.includes("_")) {
    return text
      .split("_")
      .filter(Boolean)
      .map((part) =>
        part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1),
      )
      .join(" ");
  }
  return text;
}

export { getKpiLabel, aggregateKpiRow, shortenLabel, formatKpiDisplayLabel };
