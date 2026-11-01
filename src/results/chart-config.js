import {
  resolveField,
  toNumber,
  formatNumber,
  normalizePercent,
  normalizeVisiblePercent,
  positiveValue,
  negativeValue,
  chargerEnergyValue,
} from "./values.js";
import { inferAggregation } from "./aggregation.js";

export const CHART_COLORS = [
  "#0f766e",
  "#2563eb",
  "#d97706",
  "#be123c",
  "#6d28d9",
  "#4d7c0f",
  "#b45309",
  "#0e7490",
];

const percentFormatter = (value) => `${formatNumber(value)}%`;

export function getEquipmentChartConfig(item) {
  const field = (aliases) => resolveField(item.series.columns, aliases);
  const batteryEnergyField = field([
    "Battery (Dis)Charge-kWh",
    "battery_charge",
    "battery_discharge",
  ]);
  const chargerConsumptionField = field(["Charger Consumption-kWh", "charger_consumption"]);
  const chargerProductionField = field(["Charger Production-kWh", "charger_production"]);
  const chargerArrivalField = field([
    "EV Estimated SOC Arrival-%",
    "electric_vehicle_estimated_soc_arrival",
  ]);
  const chargerRequiredField = field([
    "EV Required SOC Departure-%",
    "electric_vehicle_required_soc_departure",
  ]);
  const chargerSocField = field(["EV SOC-%", "electric_vehicle_soc"]);
  const chargerStateField = field([
    "EV Charger State",
    "electric_vehicle_charger_state",
    "charger_state",
  ]);

  const configs = {
    community: {
      kind: "Community",
      unit: "kWh",
      series: [
        {
          key: "community-net-consumption",
          label: "Net Electricity Consumption-kWh",
          field: field(["Net Electricity Consumption-kWh"]),
          chart: "bar",
          strategy: "sum",
          color: "#d97706",
        },
        {
          key: "community-non-shiftable",
          label: "Non-shiftable Load-kWh",
          field: field(["Non-shiftable Load-kWh"]),
          chart: "bar",
          strategy: "sum",
          color: "#2563eb",
        },
        {
          key: "community-pv",
          label: "Energy Production from PV-kWh",
          field: field([
            "Energy Production from PV-kWh",
            "Total Solar Generation-kWh",
            "solar_generation",
            "pv_generation",
          ]),
          chart: "bar",
          strategy: "sum",
          color: "#6d28d9",
        },
        {
          key: "community-ev",
          label: "Energy Production From EV-kWh",
          field: field(["Energy Production From EV-kWh"]),
          chart: "bar",
          strategy: "sum",
          color: "#0f766e",
        },
      ],
    },
    production: {
      kind: "Production",
      unit: "kWh",
      series: [
        {
          key: "pv-production",
          label: "Energy Production from PV-kWh",
          field: field([
            "Energy Production from PV-kWh",
            "solar_generation",
            "pv_generation",
            "PV Production-kWh",
          ]),
          chart: "bar",
          strategy: "sum",
          color: "#6d28d9",
        },
        {
          key: "ev-production",
          label: "Energy Production from EV-kWh",
          field: field([
            "Energy Production From EV-kWh",
            "Energy Production from EV-kWh",
            "ev_generation",
          ]),
          chart: "bar",
          strategy: "sum",
          color: "#0f766e",
        },
      ],
    },
    consumption: {
      kind: "Consumption",
      unit: "kWh",
      series: [
        {
          key: "non-shiftable",
          label: "Non-shiftable Load-kWh",
          field: field([
            "Non-shiftable Load-kWh",
            "electricity_consumption",
            "load",
            "non_shiftable_load",
          ]),
          chart: "bar",
          strategy: "sum",
          color: "#2563eb",
        },
        {
          key: "net-consumption",
          label: "Net Electricity Consumption-kWh",
          field: field([
            "Net Electricity Consumption-kWh",
            "net_electricity_consumption",
            "net_consumption",
          ]),
          chart: "bar",
          strategy: "sum",
          color: "#d97706",
        },
      ],
    },
    battery: {
      kind: "Battery",
      unit: "kWh / %",
      hasRightAxis: true,
      rightDomain: [0, 100],
      rightFormatter: percentFormatter,
      showZeroLine: true,
      series: [
        {
          key: "battery-charge",
          label: "Battery Charge-kWh",
          field: batteryEnergyField ? "__battery_charge" : null,
          derive: (row) => positiveValue(row[batteryEnergyField]),
          sourceFields: [batteryEnergyField],
          chart: "bar",
          strategy: "sum",
          stackId: "battery",
          color: "#2563eb",
        },
        {
          key: "battery-discharge",
          label: "Battery Discharge-kWh",
          field: batteryEnergyField ? "__battery_discharge" : null,
          derive: (row) => negativeValue(row[batteryEnergyField]),
          sourceFields: [batteryEnergyField],
          chart: "bar",
          strategy: "sum",
          stackId: "battery",
          color: "#d97706",
        },
        {
          key: "battery-soc",
          label: "Battery Soc-%",
          field: field(["Battery Soc-%", "battery_soc", "soc"]),
          chart: "line",
          strategy: "avg",
          axis: "right",
          transform: normalizePercent,
          color: "#be123c",
        },
      ],
    },
    charger: {
      kind: "Charger",
      unit: "kWh / %",
      hasRightAxis: true,
      rightDomain: [0, 100],
      rightFormatter: percentFormatter,
      showZeroLine: true,
      activityFields: {
        consumption: chargerConsumptionField,
        production: chargerProductionField,
        arrival: chargerArrivalField,
        required: chargerRequiredField,
        soc: chargerSocField,
        state: chargerStateField,
      },
      series: [
        {
          key: "charger-net",
          label: "Charger Net-kWh",
          field: chargerConsumptionField || chargerProductionField ? "__charger_net" : null,
          derive: (row) => {
            if (
              toNumber(row[chargerConsumptionField]) === null &&
              toNumber(row[chargerProductionField]) === null
            )
              return null;
            return (
              chargerEnergyValue(row[chargerConsumptionField]) -
              chargerEnergyValue(row[chargerProductionField])
            );
          },
          sourceFields: [chargerConsumptionField, chargerProductionField],
          chart: "bar",
          strategy: "sum",
          color: "#2563eb",
        },
        {
          key: "charger-arrival",
          label: "EV Estimated SOC Arrival-%",
          field: chargerArrivalField,
          chart: "line",
          strategy: "avg",
          axis: "right",
          transform: normalizeVisiblePercent,
          curve: "stepAfter",
          dashArray: "5 4",
          color: "#6d28d9",
        },
        {
          key: "charger-required",
          label: "EV Required SOC Departure-%",
          field: chargerRequiredField,
          chart: "line",
          strategy: "avg",
          axis: "right",
          transform: normalizeVisiblePercent,
          curve: "stepAfter",
          dashArray: "5 4",
          color: "#d97706",
        },
        {
          key: "charger-soc",
          label: "EV SOC-%",
          field: chargerSocField,
          chart: "line",
          strategy: "avg",
          axis: "right",
          transform: normalizeVisiblePercent,
          color: "#172033",
        },
      ],
    },
    ev: {
      kind: "Electric Vehicle",
      unit: "%",
      hasRightAxis: false,
      series: [
        {
          key: "estimated-arrival",
          label: "Estimated SOC Arrival",
          field: field(["electric_vehicle_estimated_soc_arrival", "EV Estimated SOC Arrival-%"]),
          chart: "line",
          strategy: "avg",
          transform: normalizePercent,
          color: "#6d28d9",
        },
        {
          key: "required-departure",
          label: "Required SOC Departure",
          field: field(["electric_vehicle_required_soc_departure", "EV Required SOC Departure-%"]),
          chart: "line",
          strategy: "avg",
          transform: normalizePercent,
          color: "#d97706",
        },
        {
          key: "ev-soc",
          label: "EV SOC",
          field: field(["electric_vehicle_soc", "EV SOC-%"]),
          chart: "line",
          strategy: "avg",
          transform: normalizePercent,
          color: "#0f766e",
        },
      ],
    },
    pv: {
      kind: "PV",
      unit: "",
      series: [
        {
          key: "pv",
          label: "PV",
          field: field([
            "Energy Production from PV-kWh",
            "PV Production-kWh",
            "pv",
            "PV",
            "solar_generation",
            "pv_generation",
          ]),
          chart: "bar",
          strategy: "sum",
          color: "#6d28d9",
        },
        {
          key: "uv",
          label: "UV",
          field: field(["uv", "UV"]),
          chart: "bar",
          strategy: "sum",
          color: "#2563eb",
        },
        {
          key: "amt",
          label: "AMT",
          field: field(["amt", "AMT"]),
          chart: "bar",
          strategy: "sum",
          color: "#d97706",
        },
      ],
    },
    pricing: {
      kind: "Pricing",
      unit: "$/kWh",
      series: [
        {
          key: "price",
          label: "electricity_pricing-$/kWh",
          field: field(["electricity_pricing-$/kWh", "electricity_pricing", "price"]),
          chart: "line",
          strategy: "avg",
          color: "#d97706",
        },
        {
          key: "price-1",
          label: "electricity_pricing_predicted_1-$/kWh",
          field: field([
            "electricity_pricing_predicted_1-$/kWh",
            "electricity_pricing_predicted_1",
          ]),
          chart: "line",
          strategy: "avg",
          color: "#6d28d9",
        },
        {
          key: "price-2",
          label: "electricity_pricing_predicted_2-$/kWh",
          field: field([
            "electricity_pricing_predicted_2-$/kWh",
            "electricity_pricing_predicted_2",
          ]),
          chart: "line",
          strategy: "avg",
          color: "#0f766e",
        },
        {
          key: "carbon",
          label: "carbon_intensity",
          field: field(["carbon_intensity", "carbon_intensity_predicted"]),
          chart: "line",
          strategy: "avg",
          color: "#be123c",
        },
      ],
    },
  };

  return (
    configs[item.type] || {
      kind: "Timeseries",
      unit: "",
      series: item.series.numericColumns.map((column, index) => ({
        key: column,
        label: column,
        field: column,
        chart: "line",
        strategy: inferAggregation(column, item.series.columnMetadata?.[column]),
        visible: index < 4,
        color: CHART_COLORS[index % CHART_COLORS.length],
      })),
    }
  );
}
