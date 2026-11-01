export function clockLabel(timeline) {
  return (
    { utc: "UTC", local: "Local time", elapsed: "Elapsed time", index: "Step", row: "Row" }[
      timeline.mode
    ] || "Time"
  );
}

export function isBauReference(item) {
  return /^exported_data_business_as_usual(?:_ep\d+)?(?:_part\d+)?\.(csv|parquet|pq|parq)$/i.test(
    item.series?.fileName || "",
  );
}

export const chartTitle = (item) => (isBauReference(item) ? "Business as usual" : item.title);
