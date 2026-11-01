import { COST_SCORECARD_DEFINITION } from "./cost.js";
import { EV_SERVICE_DEFINITIONS } from "./ev-service.js";

function kpiCandidate(key, options = {}) {
  return { key, ...options };
}

const KPI_SCORECARD_DEFINITIONS = [
  COST_SCORECARD_DEFINITION,
  ...EV_SERVICE_DEFINITIONS,
  {
    id: "electrical-violations",
    title: "Electrical violations",
    description: "Energy associated with electrical service phase violations.",
    valueStyle: "energy",
    unit: "kWh",
    toneRule: "zero-risk",
    referenceMode: "none",
    candidates: {
      primary: [
        "electrical_violation_kwh",
        "electrical_violations_kwh",
        "district_electrical_service_phase_violations_energy_total_kwh",
        "building_electrical_service_phase_violations_energy_total_kwh",
      ],
    },
  },
  {
    id: "battery-throughput",
    title: "Battery throughput",
    description: "Total battery cycling energy: charge plus discharge throughput.",
    valueStyle: "energy",
    unit: "kWh",
    toneRule: "neutral",
    referenceMode: "compare",
    comparisonDirection: "lower-is-better",
    primaryRole: "policy",
    candidates: {
      primary: [
        "district_battery_total_throughput_kwh",
        "building_battery_total_throughput_kwh",
        "battery_throughput_kwh",
      ],
      policy: [
        "district_battery_total_throughput_control_kwh",
        "building_battery_total_throughput_control_kwh",
      ],
      reference: [
        "district_battery_total_throughput_business_as_usual_kwh",
        "building_battery_total_throughput_business_as_usual_kwh",
        "district_battery_total_throughput_baseline_kwh",
        "building_battery_total_throughput_baseline_kwh",
      ],
      delta: [
        "district_battery_total_throughput_delta_to_business_as_usual_kwh",
        "building_battery_total_throughput_delta_to_business_as_usual_kwh",
        "district_battery_total_throughput_delta_kwh",
        "building_battery_total_throughput_delta_kwh",
      ],
    },
  },
  {
    id: "v2g-export",
    title: "V2G export",
    description: "Total EV energy exported back to the community or grid.",
    valueStyle: "energy",
    unit: "kWh",
    toneRule: "neutral",
    referenceMode: "compare",
    comparisonDirection: "neutral",
    primaryRole: "policy",
    candidates: {
      primary: [
        "district_ev_total_v2g_export_kwh",
        "building_ev_total_v2g_export_kwh",
        "v2g_export_kwh",
      ],
      policy: [
        "district_ev_total_v2g_export_control_kwh",
        "building_ev_total_v2g_export_control_kwh",
      ],
      reference: [
        "district_ev_total_v2g_export_business_as_usual_kwh",
        "building_ev_total_v2g_export_business_as_usual_kwh",
        "district_ev_total_v2g_export_baseline_kwh",
        "building_ev_total_v2g_export_baseline_kwh",
      ],
      delta: [
        "district_ev_total_v2g_export_delta_to_business_as_usual_kwh",
        "building_ev_total_v2g_export_delta_to_business_as_usual_kwh",
        "district_ev_total_v2g_export_delta_kwh",
        "building_ev_total_v2g_export_delta_kwh",
      ],
    },
  },
  {
    id: "solar-self-consumption",
    title: "Solar self-consumption",
    description: "Share of generated solar energy consumed locally.",
    valueStyle: "percentage",
    unit: "%",
    toneRule: "higher-rate-better",
    referenceMode: "compare",
    comparisonDirection: "higher-is-better",
    primaryRole: "policy",
    candidates: {
      primary: [
        "district_solar_self_consumption_ratio_self_consumption_ratio",
        "building_solar_self_consumption_ratio_self_consumption_ratio",
        "community_solar_self_consumption_rate",
        "solar_self_consumption",
      ],
      policy: [
        "district_solar_self_consumption_ratio_self_consumption_control_ratio",
        "building_solar_self_consumption_ratio_self_consumption_control_ratio",
      ],
      reference: [
        "district_solar_self_consumption_ratio_self_consumption_business_as_usual_ratio",
        "building_solar_self_consumption_ratio_self_consumption_business_as_usual_ratio",
        "district_solar_self_consumption_ratio_self_consumption_baseline_ratio",
        "building_solar_self_consumption_ratio_self_consumption_baseline_ratio",
      ],
      delta: [
        "district_solar_self_consumption_ratio_self_consumption_delta_to_business_as_usual_ratio",
        "building_solar_self_consumption_ratio_self_consumption_delta_to_business_as_usual_ratio",
        "district_solar_self_consumption_ratio_self_consumption_delta_ratio",
        "building_solar_self_consumption_ratio_self_consumption_delta_ratio",
      ],
    },
  },
  {
    id: "community-import",
    title: "Community import",
    description: "Total imported energy for the selected scope.",
    valueStyle: "energy",
    unit: "kWh",
    toneRule: "neutral",
    referenceMode: "compare",
    comparisonDirection: "lower-is-better",
    primaryRole: "policy",
    candidates: {
      primary: [
        "district_energy_grid_total_import_control_kwh",
        "building_energy_grid_total_import_control_kwh",
        "community_import_kwh",
      ],
      policy: [
        "district_energy_grid_total_import_control_kwh",
        "building_energy_grid_total_import_control_kwh",
      ],
      reference: [
        "district_energy_grid_total_import_business_as_usual_kwh",
        "building_energy_grid_total_import_business_as_usual_kwh",
        "district_energy_grid_total_import_baseline_kwh",
        "building_energy_grid_total_import_baseline_kwh",
      ],
      delta: [
        "district_energy_grid_total_import_delta_to_business_as_usual_kwh",
        "building_energy_grid_total_import_delta_to_business_as_usual_kwh",
        "district_energy_grid_total_import_delta_kwh",
        "building_energy_grid_total_import_delta_kwh",
      ],
    },
  },
  {
    id: "community-export",
    title: "Community export",
    description: "Total exported energy for the selected scope.",
    valueStyle: "energy",
    unit: "kWh",
    toneRule: "neutral",
    referenceMode: "compare",
    comparisonDirection: "lower-is-better",
    primaryRole: "policy",
    candidates: {
      primary: [
        "district_energy_grid_total_export_control_kwh",
        "building_energy_grid_total_export_control_kwh",
        "community_export_kwh",
      ],
      policy: [
        "district_energy_grid_total_export_control_kwh",
        "building_energy_grid_total_export_control_kwh",
      ],
      reference: [
        "district_energy_grid_total_export_business_as_usual_kwh",
        "building_energy_grid_total_export_business_as_usual_kwh",
        "district_energy_grid_total_export_baseline_kwh",
        "building_energy_grid_total_export_baseline_kwh",
      ],
      delta: [
        "district_energy_grid_total_export_delta_to_business_as_usual_kwh",
        "building_energy_grid_total_export_delta_to_business_as_usual_kwh",
        "district_energy_grid_total_export_delta_kwh",
        "building_energy_grid_total_export_delta_kwh",
      ],
    },
  },
  {
    id: "community-net-exchange",
    title: "Community net exchange",
    description: "Net grid exchange for the selected scope.",
    valueStyle: "energy",
    unit: "kWh",
    toneRule: "neutral",
    referenceMode: "compare",
    comparisonDirection: "closer-to-zero",
    primaryRole: "policy",
    candidates: {
      primary: [
        "district_energy_grid_total_net_exchange_control_kwh",
        "building_energy_grid_total_net_exchange_control_kwh",
        "community_net_exchange_kwh",
      ],
      policy: [
        "district_energy_grid_total_net_exchange_control_kwh",
        "building_energy_grid_total_net_exchange_control_kwh",
      ],
      reference: [
        "district_energy_grid_total_net_exchange_business_as_usual_kwh",
        "building_energy_grid_total_net_exchange_business_as_usual_kwh",
        "district_energy_grid_total_net_exchange_baseline_kwh",
        "building_energy_grid_total_net_exchange_baseline_kwh",
      ],
      delta: [
        "district_energy_grid_total_net_exchange_delta_to_business_as_usual_kwh",
        "building_energy_grid_total_net_exchange_delta_to_business_as_usual_kwh",
        "district_energy_grid_total_net_exchange_delta_kwh",
        "building_energy_grid_total_net_exchange_delta_kwh",
      ],
    },
  },
  {
    id: "daily-peak-ratio",
    title: "Daily peak ratio",
    description:
      "Average daily peak ratio against BAU or simulator baseline. Values below 1 are better.",
    valueStyle: "ratio",
    unit: "x",
    toneRule: "lower-ratio-better",
    referenceMode: "compare",
    comparisonDirection: "lower-is-better",
    primaryRole: "ratio",
    candidates: {
      primary: [
        "peak_daily_ratio_to_bau",
        "district_energy_grid_shape_quality_peak_daily_average_to_business_as_usual_ratio",
        "building_energy_grid_shape_quality_peak_daily_average_to_business_as_usual_ratio",
        "peak_daily_ratio_to_baseline",
        "district_energy_grid_shape_quality_peak_daily_average_to_baseline_ratio",
        "building_energy_grid_shape_quality_peak_daily_average_to_baseline_ratio",
        kpiCandidate("daily_peak", {
          title: "Daily peak",
          description: "Daily peak demand pressure for the selected scope.",
          referenceMode: "none",
          valueStyle: "number",
          toneRule: "lower-is-better",
        }),
      ],
      ratio: [
        "peak_daily_ratio_to_bau",
        "district_energy_grid_shape_quality_peak_daily_average_to_business_as_usual_ratio",
        "building_energy_grid_shape_quality_peak_daily_average_to_business_as_usual_ratio",
        "peak_daily_ratio_to_baseline",
        "district_energy_grid_shape_quality_peak_daily_average_to_baseline_ratio",
        "building_energy_grid_shape_quality_peak_daily_average_to_baseline_ratio",
      ],
      policy: [
        "district_energy_grid_shape_quality_peak_daily_average_control_kwh",
        "building_energy_grid_shape_quality_peak_daily_average_control_kwh",
      ],
      reference: [
        "district_energy_grid_shape_quality_peak_daily_average_baseline_kwh",
        "building_energy_grid_shape_quality_peak_daily_average_baseline_kwh",
      ],
      delta: [
        "district_energy_grid_shape_quality_peak_daily_average_delta_kwh",
        "building_energy_grid_shape_quality_peak_daily_average_delta_kwh",
      ],
    },
  },
  {
    id: "all-time-peak-ratio",
    title: "All-time peak ratio",
    description:
      "All-time peak ratio against BAU or simulator baseline. Values below 1 are better.",
    valueStyle: "ratio",
    unit: "x",
    toneRule: "lower-ratio-better",
    referenceMode: "compare",
    comparisonDirection: "lower-is-better",
    primaryRole: "ratio",
    candidates: {
      primary: [
        "peak_all_time_ratio_to_bau",
        "district_energy_grid_shape_quality_peak_all_time_average_to_business_as_usual_ratio",
        "building_energy_grid_shape_quality_peak_all_time_average_to_business_as_usual_ratio",
        "peak_all_time_ratio_to_baseline",
        "district_energy_grid_shape_quality_peak_all_time_average_to_baseline_ratio",
        "building_energy_grid_shape_quality_peak_all_time_average_to_baseline_ratio",
      ],
      ratio: [
        "peak_all_time_ratio_to_bau",
        "district_energy_grid_shape_quality_peak_all_time_average_to_business_as_usual_ratio",
        "building_energy_grid_shape_quality_peak_all_time_average_to_business_as_usual_ratio",
        "peak_all_time_ratio_to_baseline",
        "district_energy_grid_shape_quality_peak_all_time_average_to_baseline_ratio",
        "building_energy_grid_shape_quality_peak_all_time_average_to_baseline_ratio",
      ],
    },
  },
  {
    id: "load-factor-penalty",
    title: "Load factor penalty",
    description:
      "Load-factor penalty ratio against BAU or simulator baseline. Values below 1 are better.",
    valueStyle: "ratio",
    unit: "x",
    toneRule: "lower-ratio-better",
    referenceMode: "compare",
    comparisonDirection: "lower-is-better",
    primaryRole: "ratio",
    candidates: {
      primary: [
        "load_factor_penalty_ratio_to_bau",
        "district_energy_grid_shape_quality_load_factor_penalty_daily_average_to_business_as_usual_ratio",
        "district_energy_grid_shape_quality_load_factor_penalty_monthly_average_to_business_as_usual_ratio",
        "load_factor_penalty_ratio_to_baseline",
        "district_energy_grid_shape_quality_load_factor_penalty_daily_average_to_baseline_ratio",
        "district_energy_grid_shape_quality_load_factor_penalty_monthly_average_to_baseline_ratio",
        "building_energy_grid_shape_quality_load_factor_penalty_daily_average_to_baseline_ratio",
        "building_energy_grid_shape_quality_load_factor_penalty_monthly_average_to_baseline_ratio",
        "load_factor_penalty_ratio",
      ],
      ratio: [
        "load_factor_penalty_ratio_to_bau",
        "district_energy_grid_shape_quality_load_factor_penalty_daily_average_to_business_as_usual_ratio",
        "district_energy_grid_shape_quality_load_factor_penalty_monthly_average_to_business_as_usual_ratio",
        "load_factor_penalty_ratio_to_baseline",
        "district_energy_grid_shape_quality_load_factor_penalty_daily_average_to_baseline_ratio",
        "district_energy_grid_shape_quality_load_factor_penalty_monthly_average_to_baseline_ratio",
        "building_energy_grid_shape_quality_load_factor_penalty_daily_average_to_baseline_ratio",
        "building_energy_grid_shape_quality_load_factor_penalty_monthly_average_to_baseline_ratio",
      ],
    },
  },
];

const KPI_PRIORITY_DEFINITION_IDS = [
  "cost-saving-reference",
  "ev-min-feasible",
  "ev-within-tolerance",
  "electrical-violations",
  "battery-throughput",
  "solar-self-consumption",
];

const KPI_SELECTED_DEFINITION_IDS = [
  "cost-saving-reference",
  "ev-min-feasible",
  "ev-within-tolerance",
  "electrical-violations",
  "battery-throughput",
  "v2g-export",
  "solar-self-consumption",
  "community-import",
  "community-export",
  "community-net-exchange",
  "daily-peak-ratio",
  "all-time-peak-ratio",
  "load-factor-penalty",
];

export { KPI_SCORECARD_DEFINITIONS, KPI_PRIORITY_DEFINITION_IDS, KPI_SELECTED_DEFINITION_IDS };
