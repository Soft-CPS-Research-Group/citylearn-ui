#!/usr/bin/env python3
"""Generate realistic local sample result folders for the UI.

The timeseries are built from the CityLearn dataset checked out in
../Algorithms. The KPI files are copied from real Algorithms simulator exports
that use KPI v2 with BAU enabled, so the UI exercises the complete scorecard
and drill-down paths.
"""

from __future__ import annotations

import csv
import math
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = (
    ROOT.parent
    / "Algorithms"
    / "datasets"
    / "citylearn_challenge_2022_phase_all_plus_evs_no_derived_no_action_feedback"
)
OUT = ROOT / "sample-results"
SIMULATION_START_TIME_STEP = 4864
HOURS = 512
BUILDINGS = list(range(1, 18))
CHARGERS = [(1, 1), (4, 1), (5, 1), (7, 1), (10, 1), (12, 1), (15, 1), (15, 2)]
SAMPLE_START = datetime(2025, 2, 19, 16, 0, tzinfo=timezone.utc)
ALGORITHMS_RUN = ROOT.parent / "Algorithms" / "runs" / "remote_results" / "phase10_w8_compare_20260612"
SAMPLES = [
    {
        "name": "rbc-basic-market-real-1999h",
        "label": "RBC basic market audit",
        "source": ROOT.parent
        / "Algorithms"
        / "runs"
        / "simulator_1_5_1_rbc_market_audit"
        / "jobs"
        / "rbc_basic_market_sim151_audit_20260604"
        / "results"
        / "simulation_data"
        / "rbc-basic-2022-all-plus-evs-local",
    },
    {
        "name": "rbc-community-market-real-1999h",
        "label": "RBC community market audit",
        "source": ROOT.parent
        / "Algorithms"
        / "runs"
        / "simulator_1_5_1_rbc_market_audit"
        / "jobs"
        / "rbc_community_market_sim151_audit_20260604"
        / "results"
        / "simulation_data"
        / "rbc-community-2022-all-plus-evs-local",
    },
    {
        "name": "rbc-smart-market-real-1999h",
        "label": "RBC smart market audit",
        "source": ROOT.parent
        / "Algorithms"
        / "runs"
        / "simulator_1_5_1_rbc_market_audit"
        / "jobs"
        / "rbc_smart_market_sim151_audit_20260604"
        / "results"
        / "simulation_data"
        / "rbc-smart-2022-all-plus-evs-local",
    },
]


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, object]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def number(value: object, default: float = 0.0) -> float:
    try:
        if value in ("", None):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def timestamp(index: int) -> str:
    return (SAMPLE_START + timedelta(hours=index)).isoformat().replace("+00:00", "Z")


def daylight_shape(hour: int) -> float:
    return max(0.0, math.sin(math.pi * (hour - 6) / 12))


def policy_settings(policy: str) -> dict[str, float]:
    settings = {
        "smart": {
            "day_charge": 0.42,
            "evening_discharge": 0.36,
            "ev_export": 0.06,
            "flex_shift": 0.12,
            "peak_clip": 0.08,
        },
        "community": {
            "day_charge": 0.36,
            "evening_discharge": 0.31,
            "ev_export": 0.11,
            "flex_shift": 0.08,
            "peak_clip": 0.1,
        },
        "matd3": {
            "day_charge": 0.48,
            "evening_discharge": 0.42,
            "ev_export": 0.14,
            "flex_shift": 0.05,
            "peak_clip": 0.14,
        },
    }
    return settings[policy]


def write_building(sim_dir: Path, building: int, source_rows: list[dict[str, str]], policy: str) -> tuple[float, float, float]:
    rows: list[dict[str, object]] = []
    battery_rows: list[dict[str, object]] = []
    settings = policy_settings(policy)
    soc = 0.48 + building * 0.015
    total_net = 0.0
    peak_net = 0.0
    total_solar = 0.0

    for i, source in enumerate(source_rows[:HOURS]):
        hour = i % 24
        day = i // 24
        weekday = day % 7
        base_load = number(source.get("non_shiftable_load")) * (1.0 + building * 0.018)
        solar_scale = 0.18 + (building % 5) * 0.015
        solar = number(source.get("solar_generation")) * solar_scale
        dhw = number(source.get("dhw_demand"))
        cooling = number(source.get("cooling_demand"))
        heating = number(source.get("heating_demand"))

        evening_boost = 0.34 if 17 <= hour <= 21 else 0.0
        weekday_boost = 0.12 if weekday < 5 else -0.05
        flexible_load = max(0.0, settings["flex_shift"] * daylight_shape(hour) + evening_boost + weekday_boost)

        battery_power = settings["day_charge"] * daylight_shape(hour) - (
            settings["evening_discharge"] if 17 <= hour <= 21 else 0.02
        )
        ev_export = settings["ev_export"] if 18 <= hour <= 20 and building in {1, 4, 5, 7, 10, 12, 15} else 0.0

        soc = min(0.95, max(0.08, soc + battery_power * 0.035))
        net = (
            base_load
            + flexible_load
            + dhw * 0.05
            + cooling * 0.03
            + heating * 0.02
            - solar
            - max(0.0, -battery_power)
            - ev_export
        )
        if 18 <= hour <= 21:
            net *= 1.0 - settings["peak_clip"]
        total_net += net
        peak_net = max(peak_net, net)
        total_solar += solar

        rows.append(
            {
                "timestamp": timestamp(i),
                "time_step": i,
                "Non-shiftable Load-kWh": round(base_load + flexible_load, 5),
                "Net Electricity Consumption-kWh": round(net, 5),
                "Energy Production from PV-kWh": round(solar, 5),
                "Energy Production From EV-kWh": round(ev_export, 5),
                "electricity_consumption": round(base_load + flexible_load, 5),
                "solar_generation": round(solar, 5),
                "net_electricity_consumption": round(net, 5),
                "indoor_temperature": round(20.8 + 2.4 * daylight_shape(hour) + 0.2 * math.sin(day / 4), 3),
            }
        )
        battery_rows.append(
            {
                "timestamp": timestamp(i),
                "time_step": i,
                "Battery Soc-%": round(soc, 5),
                "Battery (Dis)Charge-kWh": round(battery_power, 5),
            }
        )

    write_csv(
        sim_dir / f"exported_data_building_{building}_ep0.csv",
        rows,
        [
            "timestamp",
            "time_step",
            "Non-shiftable Load-kWh",
            "Net Electricity Consumption-kWh",
            "Energy Production from PV-kWh",
            "Energy Production From EV-kWh",
            "electricity_consumption",
            "solar_generation",
            "net_electricity_consumption",
            "indoor_temperature",
        ],
    )
    write_csv(
        sim_dir / f"exported_data_building_{building}_battery_ep0.csv",
        battery_rows,
        ["timestamp", "time_step", "Battery Soc-%", "Battery (Dis)Charge-kWh"],
    )
    return total_net, peak_net, total_solar


def write_charger_and_ev(sim_dir: Path, building: int, charger: int, source_rows: list[dict[str, str]], policy: str) -> None:
    charger_rows: list[dict[str, object]] = []
    ev_rows: list[dict[str, object]] = []
    soc = 0.22 + (building % 4) * 0.05

    for i, source in enumerate(source_rows[:HOURS]):
        hour = i % 24
        state = int(round(number(source.get("electric_vehicle_charger_state"))))
        connected = state == 1
        incoming = state == 2
        required = number(source.get("electric_vehicle_required_soc_departure"), -10.0) / 100
        arrival = number(source.get("electric_vehicle_estimated_soc_arrival"), -10.0) / 100

        if connected:
            charge = 0.22 + 0.12 * daylight_shape(hour)
            discharge = 0.0
            if policy in {"community", "matd3"} and 17 <= hour <= 20:
                discharge = 0.12 if policy == "community" else 0.16
                charge = 0.04
            soc = min(0.96, max(0.08, soc + charge * 0.055 - discharge * 0.06))
        else:
            charge = 0.0
            discharge = 0.0
            required = -0.1
            soc = -1.0
            if not incoming:
                arrival = -0.1

        charger_rows.append(
            {
                "timestamp": timestamp(i),
                "time_step": i,
                "EV Charger State": state,
                "Charger Consumption-kWh": round(charge, 5),
                "Charger Production-kWh": round(discharge, 5),
                "EV Estimated SOC Arrival-%": round(arrival, 5),
                "EV Required SOC Departure-%": round(required, 5),
                "EV SOC-%": round(soc, 5),
            }
        )
        ev_rows.append(
            {
                "timestamp": timestamp(i),
                "time_step": i,
                "electric_vehicle_charger_state": state,
                "electric_vehicle_estimated_soc_arrival": round(arrival, 5),
                "electric_vehicle_required_soc_departure": round(required, 5),
                "electric_vehicle_soc": round(soc, 5),
            }
        )

    write_csv(
        sim_dir / f"exported_data_building_{building}_charger_0_{charger}_ep0.csv",
        charger_rows,
        [
            "timestamp",
            "time_step",
            "EV Charger State",
            "Charger Consumption-kWh",
            "Charger Production-kWh",
            "EV Estimated SOC Arrival-%",
            "EV Required SOC Departure-%",
            "EV SOC-%",
        ],
    )
    write_csv(
        sim_dir / f"exported_data_electric_vehicle_{building}_{charger}_ep0.csv",
        ev_rows,
        [
            "timestamp",
            "time_step",
            "electric_vehicle_charger_state",
            "electric_vehicle_estimated_soc_arrival",
            "electric_vehicle_required_soc_departure",
            "electric_vehicle_soc",
        ],
    )


def write_pricing(sim_dir: Path, pricing_rows: list[dict[str, str]], carbon_rows: list[dict[str, str]]) -> float:
    rows: list[dict[str, object]] = []
    weighted_price = 0.0

    for i, source in enumerate(pricing_rows[:HOURS]):
        carbon = carbon_rows[i] if i < len(carbon_rows) else {}
        price = number(source.get("electricity_pricing"))
        weighted_price += price
        rows.append(
            {
                "timestamp": timestamp(i),
                "time_step": i,
                "electricity_pricing-$/kWh": round(price, 5),
                "electricity_pricing_predicted_1-$/kWh": round(number(source.get("electricity_pricing_predicted_1")), 5),
                "electricity_pricing_predicted_2-$/kWh": round(number(source.get("electricity_pricing_predicted_2")), 5),
                "electricity_pricing_predicted_3-$/kWh": round(number(source.get("electricity_pricing_predicted_3")), 5),
                "carbon_intensity": round(number(carbon.get("carbon_intensity"), 0.31), 5),
            }
        )

    write_csv(
        sim_dir / "exported_data_pricing_ep0.csv",
        rows,
        [
            "timestamp",
            "time_step",
            "electricity_pricing-$/kWh",
            "electricity_pricing_predicted_1-$/kWh",
            "electricity_pricing_predicted_2-$/kWh",
            "electricity_pricing_predicted_3-$/kWh",
            "carbon_intensity",
        ],
    )
    return weighted_price / max(1, len(rows))


def copy_algorithm_artifacts(sim_dir: Path, sample: dict[str, str]) -> None:
    job_dir = ALGORITHMS_RUN / "jobs" / sample["job_id"]
    if not job_dir.exists():
        raise SystemExit(f"Missing Algorithms job export: {job_dir}")

    shutil.copy2(job_dir / "exported_kpis.csv", sim_dir / "exported_kpis.csv")
    community_source = job_dir / "exported_data_community.csv"
    if community_source.exists():
        shutil.copy2(community_source, sim_dir / "exported_data_community.csv")
    for name in ["job_info.json", "resolved_config.yaml", "result.json", "status.json", "simulation_data_index.json"]:
        source = job_dir / name
        if source.exists():
            shutil.copy2(source, sim_dir / name)

    readme = sim_dir / "README.txt"
    readme.write_text(
        "\n".join(
            [
                f"Sample: {sample['name']}",
                f"Algorithms job: {sample['job_name']} ({sample['job_id']})",
                "Timeseries: generated from ../Algorithms CityLearn 2022 all-plus-EVs dataset.",
                "KPIs: copied from Algorithms simulator KPI v2 export with BAU enabled.",
                "",
            ]
        )
    )


def generate_simulation(sample: dict[str, str]) -> None:
    sim_dir = OUT / sample["name"]
    source_dir = Path(sample["source"])
    if not source_dir.exists():
      raise SystemExit(f"Missing sample source: {source_dir}")

    shutil.copytree(source_dir, sim_dir)
    (sim_dir / "README.txt").write_text(
        "\n".join(
            [
                f"Sample: {sample['name']}",
                f"Source: {sample['label']}",
                "Origin: copied directly from a real Algorithms simulator export.",
                "Dataset: CityLearn 2022 all-plus-EVs, 17 buildings, hourly resolution.",
                "Contents: real timeseries CSVs for community, buildings, batteries, chargers, EVs and pricing, plus KPI v2 with BAU enabled.",
                "",
            ]
        )
    )


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    for sample in SAMPLES:
        generate_simulation(sample)


if __name__ == "__main__":
    main()
