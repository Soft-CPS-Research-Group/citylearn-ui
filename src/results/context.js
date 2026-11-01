const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const nonempty = (value) => object(value) && Object.keys(value).length > 0;
const present = (value) => value !== undefined && value !== null;
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const positive = (value) => Number.isFinite(value) && value > 0;
const text = (value) => typeof value === "string" && value.length > 0;
const sha = (value) => typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : object(value)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
export const sameContextValue = (a, b) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

export function metadataSummary(metadata = {}) {
  const m = metadata.manifest || {},
    c = m.comparison_context || {},
    temporal = m.temporal_reproducibility || c.temporal || {};
  const reference = m.business_as_usual_reference || {};
  const inventory = m.final_inventory;
  const coverage = metadata.robustness;
  const service = metadata.service || m.deferrable_service_audit;
  return {
    simulatorVersion: m.simulator_version ?? c.engine?.version ?? null,
    revision: m.git_commit ?? null,
    sourceFingerprint: c.engine?.source_sha256 ?? null,
    secondsPerStep: m.seconds_per_time_step ?? c.seconds_per_time_step ?? null,
    startStep: m.episode_start_time_step ?? c.episode_start_time_step ?? null,
    endStep: m.episode_end_time_step ?? c.episode_end_time_step ?? null,
    completedIntervals: m.completed_intervals ?? c.completed_intervals ?? null,
    timezone: temporal.timezone ?? m.effective_schema?.timezone ?? null,
    seed: m.random_seed ?? c.random_seed ?? null,
    referenceDefinition: reference.definition_version ?? m.business_as_usual_definition ?? null,
    referenceEvaluated: reference.evaluated ?? null,
    observationInterface: c.observation?.interface ?? m.effective_schema?.interface ?? null,
    observationContract: c.observation?.agent_contract ?? null,
    declaredMembers: object(m.effective_schema?.buildings)
      ? Object.keys(m.effective_schema.buildings).length
      : null,
    finalInventory: Array.isArray(inventory)
      ? inventory.map((row) => (object(row) ? row : { value: row }))
      : null,
    serviceDefinition: service?.definition_version ?? null,
    servicePopulation: service?.population ?? null,
    serviceDistrict: service?.district ?? null,
    robustnessDefinition: coverage?.definition_version ?? null,
    robustnessCoverageUnit: coverage?.coverage_unit ?? null,
    robustnessDistrict: coverage?.district ?? null,
    robustnessExecuted: coverage?.executed_intervals?.district ?? null,
  };
}

const fields = [
  [
    "engine",
    "Engine/source",
    (v) => nonempty(v) && text(v.version) && sha(v.source_sha256) && nonempty(v.runtime_versions),
  ],
  ["physical_configuration_sha256", "Physical configuration", sha],
  ["data_files_sha256", "Input data", (v) => nonempty(v) && Object.values(v).every(sha)],
  ["episode_start_time_step", "Window start", integer],
  ["episode_end_time_step", "Window end", integer],
  ["completed_intervals", "Executed duration", integer],
  ["seconds_per_time_step", "Time resolution", positive],
  ["time_step_ratio", "Time scaling", positive],
  ["random_seed", "Random seed", integer],
  ["ev_drift_seed", "EV seed", integer],
  ["initial_inventory", "Initial stored energy", Array.isArray],
  [
    "service_tolerances",
    "Service tolerances",
    (v) => nonempty(v) && Number.isFinite(v.ev_within) && Number.isFinite(v.ev_service),
  ],
  [
    "observation",
    "Observation contract",
    (v) => nonempty(v) && text(v.interface) && object(v.agent_contract),
  ],
  ["market", "Market/pricing", nonempty],
  [
    "temporal",
    "Clock/replay contract",
    (v) =>
      nonempty(v) &&
      text(v.definition_version) &&
      text(v.clock_source) &&
      positive(v.control_seconds_per_time_step),
  ],
];

export function compareSimulationContext(left, right) {
  const a = left.metadata?.manifest || {},
    b = right.metadata?.manifest || {};
  const ca = a.comparison_context || {},
    cb = b.comparison_context || {};
  const missing = [],
    differences = [];
  function compare(label, x, y, valid = present) {
    if (!valid(x) || !valid(y)) missing.push(label);
    if (present(x) && present(y) && !sameContextValue(x, y)) differences.push(label);
  }
  if (
    ca.definition_version !== "paired-experiment-v1" ||
    cb.definition_version !== "paired-experiment-v1"
  )
    missing.push("Versioned comparison contract");
  for (const [key, label, valid] of fields) compare(label, ca[key], cb[key], valid);
  // Older/minimal manifests can still reveal definite differences even when
  // they cannot establish a complete paired context.
  const sa = metadataSummary(left.metadata),
    sb = metadataSummary(right.metadata);
  for (const [key, label] of [
    ["simulatorVersion", "Simulator version"],
    ["sourceFingerprint", "Source fingerprint"],
    ["secondsPerStep", "Time resolution"],
    ["startStep", "Window start"],
    ["endStep", "Window end"],
    ["completedIntervals", "Executed duration"],
    ["seed", "Random seed"],
    ["timezone", "Timezone"],
    ["referenceDefinition", "Reference definition"],
  ]) {
    if (present(sa[key]) && present(sb[key]) && !sameContextValue(sa[key], sb[key]))
      differences.push(label);
  }
  for (const m of [a, b]) {
    const identity = m.controller_identity || {};
    if (
      !text(identity.implementation) ||
      !text(identity.version) ||
      !object(identity.parameters) ||
      !text(identity.observation_access)
    )
      missing.push("Controller identity/access");
    if (nonempty(m.input_file_changes)) differences.push("Inputs changed during execution");
    if (m.unresolved_file_references?.length) missing.push("Resolved input evidence");
  }
  compare(
    "Controller observation access",
    a.controller_identity?.observation_access,
    b.controller_identity?.observation_access,
    text,
  );
  const ra = a.business_as_usual_reference,
    rb = b.business_as_usual_reference;
  if (object(ra) && object(rb)) {
    for (const key of [
      "implementation",
      "simulator_version",
      "definition_version",
      "observation_access",
    ]) {
      compare(`Reference ${key}`, ra[key], rb[key], text);
    }
    compare("Reference parameters", ra.resolved_parameters, rb.resolved_parameters, object);
  } else missing.push("Reference identity");
  for (const key of ["energy_accounting", "kpi_family_audit"]) {
    if (present(a[key]) && present(b[key]))
      compare(
        key === "energy_accounting" ? "Energy accounting definition" : "KPI definitions",
        a[key],
        b[key],
      );
    else
      missing.push(
        key === "energy_accounting" ? "Energy accounting definition" : "KPI definitions",
      );
  }
  const va = left.metadata?.service || a.deferrable_service_audit,
    vb = right.metadata?.service || b.deferrable_service_audit;
  compare("Appliance service definition", va?.definition_version, vb?.definition_version, text);
  if (left.dataIssues?.length || right.dataIssues?.length)
    missing.push("Complete/unambiguous imported data");
  const unique = (values) => [...new Set(values)];
  return {
    left: left.name,
    right: right.name,
    status: differences.length ? "different" : missing.length ? "unknown" : "matched",
    differences: unique(differences),
    missing: unique(missing),
  };
}
export function assessComparison(simulations) {
  const pairs = simulations.slice(1).map((s) => compareSimulationContext(simulations[0], s));
  return {
    status: pairs.some((p) => p.status === "different")
      ? "different"
      : pairs.length && pairs.every((p) => p.status === "matched")
        ? "matched"
        : "unknown",
    pairs,
  };
}
