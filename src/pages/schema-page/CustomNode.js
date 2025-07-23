import React, { useState, useEffect, useMemo } from "react";
import {
    Handle,
    Position
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button, Form } from "react-bootstrap";
import { FaArrowUp, FaArrowDown, FaPlus } from "react-icons/fa";


const getInitialFormData = (type, id, data) => {
    const defaultFormData = {
        building: {
            energy_simulation: `Building_${id}.csv`,
            weather: `weather.csv`,
            carbon_intensity: `carbon_intensity.csv`,
            pricing: `pricing.csv`,
            inactive_observations: [],
            inactive_actions: []
        },
        ev: {
            energy_simulation: `Electric_Vehicle_${id}.csv`,
            capacity: 40,
            nominal_power: 50,
            initial_soc: 0.25,
            depth_of_discharge: 0.10
        },
        pv: {
            types: ["citylearn.energy_model.PV"],
            nominal_power: 0.7,
        },
        charger: {
            types: ["citylearn.electric_vehicle_charger.Chargerk"],
            nominal_power: 4.1096,
            efficiency: 0.2535,
            charger_type: 0,
            max_charging_power: 11,
            min_charging_power: 1.4,
            max_discharging_power: 7.2,
            min_discharging_power: 0.0,
            charge_efficiency_curve: [0, 0.8],
            discharge_efficiency_curve: [0, 0.8]
        },
        cooling_device: {
            types: ["citylearn.energy_model.HeatPump"],
            safety_factor: 0.5,
            nominal_power: 4.1096,
            efficiency: 0.2535,
            target_cooling_temperature: 7.99,
            target_heating_temperature: 45
        },
        heating_device: {
            types: ["citylearn.energy_model.HeatPump", "citylearn.energy_model.ElectricHeater"],
            safety_factor: 0.5,
            nominal_power: 4.1096,
            efficiency: 0.2535,
            target_cooling_temperature: 7.99,
            target_heating_temperature: 45
        },
        dhw_device: {
            types: ["citylearn.energy_model.HeatPump", "citylearn.energy_model.ElectricHeater"],
            safety_factor: 0.5,
            nominal_power: 4.1096,
            efficiency: 0.2535
        },
        cooling_storage: {
            types: ["citylearn.energy_model.StorageTank"],
            safety_factor: 0.5,
            capacity: 2.28,
            loss_coefficient: 0.0032
        },
        heating_storage: {
            types: ["citylearn.energy_model.StorageTank"],
            safety_factor: 0.5,
            capacity: 2.28,
            loss_coefficient: 0.0032
        },
        electrical_storage: {
            types: ["citylearn.energy_model.Battery"],
            safety_factor: 0.5,
            capacity: 2.28,
            power_efficiency_curve: [0, 0.8],
            capacity_power_curve: [0, 0.8],
            loss_coefficient: 0.0032
        },
        dhw_storage: {
            types: ["citylearn.energy_model.StorageTank"],
            safety_factor: 0.5,
            capacity: 2.28,
            loss_coefficient: 0.0032
        }
    };

    return data.formData || defaultFormData[type] || {};
};

const CustomNode = ({ data, id, selected }) => {
    const [formData, setFormData] = useState(() => getInitialFormData(data.type, id, data));

    // Observations list
    const [observations, setObservations] = useState({
        month: { active: false },
        day_type: { active: false },
        hour: { active: false },
        daylight_savings_status: { active: false },
        outdoor_dry_bulb_temperature: { active: false },
        outdoor_dry_bulb_temperature_predicted_1: { active: false },
        outdoor_dry_bulb_temperature_predicted_2: { active: false },
        outdoor_dry_bulb_temperature_predicted_3: { active: false },
        outdoor_relative_humidity: { active: false },
        outdoor_relative_humidity_predicted_1: { active: false },
        outdoor_relative_humidity_predicted_2: { active: false },
        outdoor_relative_humidity_predicted_3: { active: false },
        direct_solar_irradiance: { active: false },
        direct_solar_irradiance_predicted_1: { active: false },
        direct_solar_irradiance_predicted_2: { active: false },
        direct_solar_irradiance_predicted_3: { active: false },
        carbon_intensity: { active: false },
        indoor_dry_bulb_temperature: { active: false },
        net_electricity_consumption: { active: false },
        electricity_pricing: { active: false },
        electric_vehicle_soc: { active: false }
    });

    // Actions list
    const [actions, setActions] = useState({
        cooling_storage: { active: false },
        heating_storage: { active: false },
        dhw_storage: { active: false },
        electrical_storage: { active: false },
        electric_vehicle_storage: { active: false }
    });

    const typesAttributes = {
        "citylearn.electric_vehicle_charger.Charger": [
            { name: "nominal_power", type: "number", label: "Nominal Power", defaultValue: 4.1096 },
            { name: "efficiency", type: "number", label: "Efficiency", defaultValue: 0.2535 },
            { name: "charger_type", type: "select", label: "Charger Type", defaultValue: 0 },
            { name: "max_charging_power", type: "number", label: "Max Charging Power", defaultValue: 11 },
            { name: "min_charging_power", type: "number", label: "Min Charging Power", defaultValue: 1.4 },
            { name: "max_discharging_power", type: "number", label: "Max Discharging Power", defaultValue: 7.2 },
            { name: "min_discharging_power", type: "number", label: "Min Discharging Power", defaultValue: 0.0 },
            { name: "charge_efficiency_curve", type: "table", label: "Charge Efficiency Curve", defaultValue: [] },
            { name: "discharge_efficiency_curve", type: "table", label: "Discharge Efficiency Curve", defaultValue: [] }
        ],
        "citylearn.energy_model.PV": [
            { name: "nominal_power", type: "number", label: "Nominal Power (kW)", defaultValue: 0.7 }
        ],
        "citylearn.energy_model.HeatPump": [
            { name: "nominal_power", type: "number", label: "Nominal Power (kW)", defaultValue: 2.6 },
            { name: "efficiency", type: "number", label: "Efficiency", defaultValue: 0.25 },
            { name: "target_cooling_temperature", type: "number", label: "Target Cooling Temperature", defaultValue: 7.9 },
            { name: "target_heating_temperature", type: "number", label: "Target Heating Temperature", defaultValue: 45 }
        ],
        "citylearn.energy_model.ElectricHeater": [
            { name: "nominal_power", type: "number", label: "Nominal Power (kW)", defaultValue: 4.1 },
            { name: "efficiency", type: "number", label: "Efficiency", defaultValue: 0.25 }
        ],
        "citylearn.energy_model.StorageTank": [
            { name: "capacity", type: "number", label: "Capacity", defaultValue: 4.1 },
            { name: "max_output_power", type: "number", label: "Maximum Output Power", defaultValue: 0.25 },
            { name: "max_input_power", type: "number", label: "Maximum Input Power", defaultValue: 0.25 }
        ],
        "citylearn.energy_model.Battery": [
            { name: "capacity", type: "number", label: "Capacity", defaultValue: 0 },
            { name: "nominal_power", type: "number", label: "Nominal Power", defaultValue: 0.25 },
            { name: "capacity_loss_coefficient", type: "number", label: "Capacity Loss Coeficient", defaultValue: 0.0001 },
            { name: "power_efficiency_curve", type: "table", label: "Power Efficiency Curve", defaultValue: [] },
            { name: "capacity_power_curve", type: "table", label: "Capacity Power Curve", defaultValue: [] },
            { name: "depth_of_discharge", type: "number", label: "Depth of Discharge", defaultValue: 1 }
        ]
    };

    const allowedTypes = {
        charger: ["citylearn.electric_vehicle_charger.Charger"],
        pv: ["citylearn.energy_model.PV"],
        dhw_device: ["citylearn.energy_model.HeatPump", "citylearn.energy_model.ElectricHeater"],
        cooling_device: ["citylearn.energy_model.HeatPump"],
        heating_device: ["citylearn.energy_model.HeatPump", "citylearn.energy_model.ElectricHeater"],
        dhw_storage: ["citylearn.energy_model.StorageTank"],
        cooling_storage: ["citylearn.energy_model.StorageTank"],
        heating_storage: ["citylearn.energy_model.StorageTank"],
        electrical_storage: ["citylearn.energy_model.Battery"]
    };

    const selectedChargerType = useMemo(() => formData.types?.[0] || "", [formData]);
    const selectedPVType = useMemo(() => formData.types?.[0] || "", [formData]);
    const selectedCoolingDeviceType = useMemo(() => formData.types?.[0] || "", [formData]);
    const selectedHeatingDeviceType = useMemo(() => formData.types?.[0] || "", [formData]);
    const selectedDHWDeviceType = useMemo(() => formData.types?.[0] || "", [formData]);
    const selectedCoolingStorageType = useMemo(() => formData.types?.[0] || "", [formData]);
    const selectedHeatingStorageType = useMemo(() => formData.types?.[0] || "", [formData]);
    const selectedDHWStorageType = useMemo(() => formData.types?.[0] || "", [formData]);
    const selectedElectricalStorageType = useMemo(() => formData.types?.[0] || "", [formData]);

    const handleChange = (e, index = null) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));

        if (index != null) {
            data.formData.selectedType = data.formData.types[index];
        }
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        data.formData[name] = value;
    };
    
    return (
        <div
            style={{
                ...getNodeStyle(data.type),
                background: "#fff",
                borderRadius: "8px",
                border: selected ? "2px solid blue" : "1px solid #ddd",
                textAlign: "center",
                boxShadow: "2px 2px 5px rgba(0,0,0,0.1)",
                padding: "10px",
                maxHeight: "400px",
                position: "relative",
                transition: "max-height 0.3s ease"
            }}>
            {/* Header */}
            <NodeHeader data={data} />

            <div style={{
                overflowY: "auto",
                maxHeight: "350px",
            }}>
                {/* Building Form */}
                {data.type === "building" && (
                    <div style={{ textAlign: "left", fontSize: "12px" }}>
                        <label className="mb-1">Energy Simualtion File:</label>
                        <input className="mb-1" type="text" name="energy_simulation" aria-label="Energy Simulation File" value={formData.energy_simulation} onChange={handleChange} onBlur={handleBlur} style={{ width: "100%" }} />

                        <label className="mb-1">Weather File:</label>
                        <input className="mb-1" type="text" name="weather" aria-label="Weather File" value={formData.weather} onChange={handleChange} onBlur={handleBlur} style={{ width: "100%" }} />

                        <label className="mb-1">Carbon Intensity File:</label>
                        <input className="mb-1" type="text" name="carbon_intensity" aria-label="Carbon Intensity File" value={formData.carbon_intensity} onChange={handleChange} onBlur={handleBlur} style={{ width: "100%" }} />

                        <label className="mb-1">Pricing File:</label>
                        <input className="mb-1" type="text" name="pricing" aria-label="Pricing File" value={formData.pricing} onChange={handleChange} onBlur={handleBlur} style={{ width: "100%" }} />

                        <label className="mb-1">Inactive Observations:</label>
                        <Selector name={"Observation"} data={data} options={observations} setOptions={setObservations} />

                        <label className="mb-1">Inactive Actions:</label>
                        <Selector name={"Action"} data={data} options={actions} setOptions={setActions} />
                    </div>
                )}

                {/* EV Form */}
                {data.type === "ev" && (
                    <div style={{ textAlign: "left", fontSize: "12px" }}>
                        <label className="mb-1">File Name:</label>
                        <input className="mb-1" type="text" name="energy_simulation" aria-label={"energy_simulation"} value={formData.energy_simulation} onChange={handleChange} onBlur={handleBlur} style={{ width: "100%" }} />

                        <label className="mb-1">Battery Capacity (kWh):</label>
                        <input className="mb-1" type="number" name="capacity" aria-label={"capacity"} value={formData.capacity} onChange={handleChange} onBlur={handleBlur} style={{ width: "100%" }} />

                        <label className="mb-1">Battery Nominal Power (kW):</label>
                        <input className="mb-1" type="number" name="nominal_power" aria-label={"nominal_power"} value={formData.nominal_power} onChange={handleChange} onBlur={handleBlur} style={{ width: "100%" }} />

                        <label className="mb-1">Battery Initial SOC:</label>
                        <input className="mb-1" type="number" step="0.01" name="initial_soc" aria-label={"initial_soc"} value={formData.initial_soc} onChange={handleChange} onBlur={handleBlur} style={{ width: "100%" }} />

                        <label className="mb-1">Battery Depth of Discharge:</label>
                        <input className="mb-1" type="number" step="0.01" name="depth_of_discharge" aria-label={"depth_of_discharge"} value={formData.depth_of_discharge} onChange={handleChange} onBlur={handleBlur} style={{ width: "100%" }} />
                    </div>
                )}

                {/* PV Form */}
                {data.type === "pv" && (
                    <div style={{ textAlign: "left", fontSize: "12px" }}>
                        <label className="mb-1">Type:</label>
                        <select aria-label="select"
                            value={selectedPVType}
                            onChange={(e) => {
                                const selectedIndex = e.target.selectedIndex;
                                handleChange(e, selectedIndex);
                                setFormData({ ...formData, types: [e.target.value] });
                            }}
                            style={{ padding: "5px 10px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "5px", width: "100%" }}
                        >
                            {allowedTypes[data.type]?.map((type) => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>

                        {typesAttributes[selectedPVType]?.map(({ name, type, label, defaultValue }) => (
                            <div key={name}>
                                <label className="mb-1">{label}:</label>
                                <input
                                    className="mb-1"
                                    type={type}
                                    name={name}
                                    value={formData[name] || defaultValue}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    style={{ width: "100%" }}
                                    aria-label={name}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Charger Form */}
                {data.type === "charger" && (
                    <div style={{ textAlign: "left", fontSize: "12px" }}>
                        <label className="mb-1">Type:</label>
                        <select aria-label="select"
                            value={selectedChargerType}
                            onChange={(e) => {
                                const selectedIndex = e.target.selectedIndex;
                                handleChange(e, selectedIndex);
                                setFormData({ ...formData, types: [e.target.value] });
                            }}
                            style={{ padding: "5px 10px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "5px", width: "100%" }}
                        >
                            {allowedTypes[data.type]?.map((type) => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>

                        {typesAttributes[selectedChargerType]?.map(({ name, type, label, defaultValue }) => (
                            <div key={name}>
                                <label className="mb-1">{label}:</label>

                                {(type != "table" && type != "select") &&
                                    <input
                                        className="mb-1"
                                        type={type}
                                        name={name}
                                        value={formData[name] || defaultValue}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        style={{ width: "100%" }}
                                        aria-label="Charger"
                                    />
                                }

                                {(type == "select") &&
                                    <ChargerSelector data={data} />
                                }

                                {(type == "table") &&
                                    <>
                                        <TableInput name={name} data={data} formData={formData} setFormData={setFormData} />
                                    </>
                                }
                            </div>
                        ))}
                    </div>
                )}

                {/* Cooling Device Form */}
                {data.type === "cooling_device" && (
                    <div style={{ textAlign: "left", fontSize: "12px" }}>
                        <label className="mb-1">Type:</label>
                        <select aria-label="select"
                            value={selectedCoolingDeviceType}
                            onChange={(e) => {
                                const selectedIndex = e.target.selectedIndex;
                                handleChange(e, selectedIndex);
                                setFormData({ ...formData, types: [e.target.value] });
                            }}
                            style={{ padding: "5px 10px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "5px", width: "100%" }}
                        >
                            {allowedTypes[data.type]?.map((type) => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>

                        <label className="mb-1">Safety Factor:</label>
                        <input className="mb-1" type="text" name="safety_factor" aria-label={"safety_factor"} value={formData.safety_factor} onChange={handleChange} onBlur={handleBlur} style={{ width: "100%" }} />

                        {typesAttributes[selectedCoolingDeviceType]?.map(({ name, type, label, defaultValue }) => (
                            <div key={name}>
                                <label className="mb-1">{label}:</label>
                                <input
                                    className="mb-1"
                                    type={type}
                                    name={name}
                                    value={formData[name] || defaultValue}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    style={{ width: "100%" }}
                                    aria-label={name}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Heating Device Form */}
                {data.type === "heating_device" && (
                    <div style={{ textAlign: "left", fontSize: "12px" }}>
                        <label className="mb-1">Type:</label>
                        <select aria-label="select"
                            value={selectedHeatingDeviceType}
                            onChange={(e) => {
                                const selectedIndex = e.target.selectedIndex;
                                handleChange(e, selectedIndex);
                                setFormData({ ...formData, types: [e.target.value] });
                            }}
                            style={{ padding: "5px 10px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "5px", width: "100%" }}
                        >
                            {allowedTypes[data.type]?.map((type) => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>

                        <label className="mb-1">Safety Factor:</label>
                        <input className="mb-1" type="text" name="safety_factor" aria-label={"safety_factor"} value={formData.safety_factor} onChange={handleChange} onBlur={handleBlur} style={{ width: "100%" }} />

                        {typesAttributes[selectedHeatingDeviceType]?.map(({ name, type, label, defaultValue }) => (
                            <div key={name}>
                                <label className="mb-1">{label}:</label>
                                <input
                                    className="mb-1"
                                    type={type}
                                    name={name}
                                    value={formData[name] || defaultValue}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    style={{ width: "100%" }}
                                    aria-label={name}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* DHW Device Form */}
                {data.type === "dhw_device" && (
                    <div style={{ textAlign: "left", fontSize: "12px" }}>
                        <label className="mb-1">Type:</label>
                        <select aria-label="select"
                            value={selectedDHWDeviceType}
                            onChange={(e) => {
                                const selectedIndex = e.target.selectedIndex;
                                handleChange(e, selectedIndex);
                                setFormData({ ...formData, types: [e.target.value] });
                            }}
                            style={{ padding: "5px 10px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "5px", width: "100%" }}
                        >
                            {allowedTypes[data.type]?.map((type) => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>

                        <label className="mb-1">Safety Factor:</label>
                        <input className="mb-1" type="text" name="safety_factor" aria-label={"safety_factor"} value={formData.safety_factor} onChange={handleChange} onBlur={handleBlur} style={{ width: "100%" }} />

                        {typesAttributes[selectedDHWDeviceType]?.map(({ name, type, label, defaultValue }) => (
                            <div key={name}>
                                <label className="mb-1">{label}:</label>
                                <input
                                    className="mb-1"
                                    type={type}
                                    name={name}
                                    value={formData[name] || defaultValue}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    style={{ width: "100%" }}
                                    aria-label={name}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* DHW Storage Form */}
                {data.type === "dhw_storage" && (
                    <div style={{ textAlign: "left", fontSize: "12px" }}>
                        <label className="mb-1">Type:</label>
                        <select aria-label="select"
                            value={selectedDHWStorageType}
                            onChange={(e) => {
                                const selectedIndex = e.target.selectedIndex;
                                handleChange(e, selectedIndex);
                                setFormData({ ...formData, types: [e.target.value] });
                            }}
                            style={{ padding: "5px 10px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "5px", width: "100%" }}
                        >
                            {allowedTypes[data.type]?.map((type) => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>

                        {typesAttributes[selectedDHWStorageType]?.map(({ name, type, label, defaultValue }) => (
                            <div key={name}>
                                <label className="mb-1">{label}:</label>
                                <input
                                    className="mb-1"
                                    type={type}
                                    name={name}
                                    value={formData[name] || defaultValue}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    style={{ width: "100%" }}
                                    aria-label={name}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Cooling Storage Form */}
                {data.type === "cooling_storage" && (
                    <div style={{ textAlign: "left", fontSize: "12px" }}>
                        <label className="mb-1">Type:</label>
                        <select aria-label="select"
                            value={selectedCoolingStorageType}
                            onChange={(e) => {
                                const selectedIndex = e.target.selectedIndex;
                                handleChange(e, selectedIndex);
                                setFormData({ ...formData, types: [e.target.value] });
                            }}
                            style={{ padding: "5px 10px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "5px", width: "100%" }}
                        >
                            {allowedTypes[data.type]?.map((type) => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>

                        {typesAttributes[selectedCoolingStorageType]?.map(({ name, type, label, defaultValue }) => (
                            <div key={name}>
                                <label className="mb-1">{label}:</label>
                                <input
                                    className="mb-1"
                                    type={type}
                                    name={name}
                                    value={formData[name] || defaultValue}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    style={{ width: "100%" }}
                                    aria-label={name}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Heating Storage Form */}
                {data.type === "heating_storage" && (
                    <div style={{ textAlign: "left", fontSize: "12px" }}>
                        <label className="mb-1">Type:</label>
                        <select aria-label="select"
                            value={selectedHeatingStorageType}
                            onChange={(e) => {
                                const selectedIndex = e.target.selectedIndex;
                                handleChange(e, selectedIndex);
                                setFormData({ ...formData, types: [e.target.value] });
                            }}
                            style={{ padding: "5px 10px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "5px", width: "100%" }}
                        >
                            {allowedTypes[data.type]?.map((type) => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>

                        {typesAttributes[selectedHeatingStorageType]?.map(({ name, type, label, defaultValue }) => (
                            <div key={name}>
                                <label className="mb-1">{label}:</label>
                                <input
                                    className="mb-1"
                                    type={type}
                                    name={name}
                                    value={formData[name] || defaultValue}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    style={{ width: "100%" }}
                                    aria-label={name}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Electrical Storage Form */}
                {data.type === "electrical_storage" && (
                    <div style={{ textAlign: "left", fontSize: "12px" }}>
                        <label className="mb-1">Type:</label>
                        <select aria-label="select"
                            value={selectedElectricalStorageType}
                            onChange={(e) => {
                                const selectedIndex = e.target.selectedIndex;
                                handleChange(e, selectedIndex);
                                setFormData({ ...formData, types: [e.target.value] });
                            }}
                            style={{ padding: "5px 10px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "5px", width: "100%" }}
                        >
                            {allowedTypes[data.type]?.map((type) => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>

                        {typesAttributes[selectedElectricalStorageType]?.map(({ name, type, label, defaultValue }) => (
                            <div key={name}>
                                <label className="mb-1">{label}:</label>

                                {(type != "table") &&
                                    <input
                                        className="mb-1"
                                        type={type}
                                        name={name}
                                        value={formData[name] || defaultValue}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        style={{ width: "100%" }}
                                        aria-label={name}
                                    />
                                }

                                {(type == "table") &&
                                    <>
                                        <TableInput name={name} data={data} formData={formData} setFormData={setFormData} />
                                    </>
                                }
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Connection Handles */}
            <Handle type="source" position={Position.Top} id="top-source" style={{ background: "#555" }} />
            <Handle type="target" position={Position.Top} id="top-target" style={{ background: "#555" }} />

            <Handle type="source" position={Position.Left} id="left-source" style={{ background: "#555" }} />
            <Handle type="target" position={Position.Left} id="left-target" style={{ background: "#555" }} />

            <Handle type="source" position={Position.Right} id="right-source" style={{ background: "#555" }} />
            <Handle type="target" position={Position.Right} id="right-target" style={{ background: "#555" }} />

            <Handle type="source" position={Position.Bottom} id="bottom-source" style={{ background: "#555" }} />
            <Handle type="target" position={Position.Bottom} id="bottom-target" style={{ background: "#555" }} />
        </div>
    );
};


const NodeHeader = ({ data }) => {
    const [editing, setEditing] = useState(false);
    const [label, setLabel] = useState(data.label);

    const handleBlur = (e) => {
        const { name, value } = e.target;
        data.label = value;
        setEditing(false);
    };

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "5px",
                fontWeight: "bold"
            }}
            onDoubleClick={() => setEditing(true)}
        >
            {data.icon}
            {editing ? (
                <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    onBlur={handleBlur}
                    autoFocus
                    style={{
                        marginLeft: 5,
                        border: "none",
                        outline: "none",
                        fontWeight: "bold",
                        background: "transparent",
                    }}
                />
            ) : (
                <span style={{ marginLeft: 5 }}>{label}</span>
            )}
        </div>
    );
};

const Selector = ({ name, data, options, setOptions }) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleCheckboxChange = (option, field) => {
        setOptions((prev) => ({
            ...prev,
            [option]: { ...prev[option], [field]: !prev[option][field] }
        }));
    };

    useEffect(() => {
        if (name === "Observation") {
            const observations = Object.entries(options)
                .filter(([key, value]) => value.active)
                .map(([key]) => key);

            data.formData.inactive_observations = observations;
        }

        if (name === "Action") {
            const actions = Object.entries(options)
                .filter(([key, value]) => value.active)
                .map(([key]) => key);

            data.formData.inactive_actions = actions;
        }
    }, [options, name]);

    return (
        <div style={{ width: "100%", position: "relative", display: "inline-block" }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: "5px 10px",
                    background: "lightgray",
                    border: "none",
                    cursor: "pointer",
                    borderRadius: "5px",
                    width: "100%",
                    textAlign: "left"
                }}
            >
                <span className="d-flex align-items-center">
                    <span style={{ marginRight: "5px" }}>Select {name.concat("s")}</span>
                    {isOpen ? <FaArrowUp /> : <FaArrowDown />}
                </span>
            </button>

            {isOpen && (
                <div
                    style={{
                        position: "absolute",
                        top: "100%",
                        left: "0",
                        background: "#fff",
                        border: "1px solid #ddd",
                        borderRadius: "8px",
                        padding: "10px",
                        boxShadow: "2px 2px 5px rgba(0,0,0,0.2)",
                        width: "100%",
                        maxHeight: "300px",
                        overflowY: "auto",
                        zIndex: 10
                    }}
                >
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
                                <th style={{ padding: "8px" }}>{name}</th>
                                <th style={{ padding: "8px", textAlign: "center" }}>Active</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.keys(options).map((option) => (
                                <tr key={option} style={{ borderBottom: "1px solid #ddd" }}>
                                    <td style={{ padding: "8px" }}>{option.replace(/_/g, " ").toUpperCase()}</td>
                                    <td>
                                        <Form.Check className="mb-0" style={{ paddingLeft: "0px" }}>
                                            <Form.Check.Label style={{ paddingBottom: "17px" }}>
                                                <Form.Check.Input
                                                    type="checkbox"
                                                    checked={options[option].active}
                                                    onChange={() => handleCheckboxChange(option, "active")}
                                                />
                                                <span className="form-check-sign"></span>
                                            </Form.Check.Label>
                                        </Form.Check>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

const ChargerSelector = ({ data }) => {
    const chargerTypes = [
        { name: "AC", value: 0 },
        { name: "DC", value: 1 }
    ];

    const [selectedCharger, setSelectedCharger] = useState(data.formData.chargerType || chargerTypes[0].value);

    const handleTypeChange = (e) => {
        const value = Number(e.target.value);
        setSelectedCharger(value);

        data.formData.charger_type = value;
    };

    return (
        <div>
            <select aria-label="select"
                name="chargerType"
                value={selectedCharger}
                onChange={handleTypeChange}
                style={{ padding: "5px", marginBottom: "5px" }}
            >
                {chargerTypes.map((charger) => (
                    <option key={charger.value} value={charger.value}>
                        {charger.name}
                    </option>
                ))}
            </select>
        </div>
    );
};

const TableInput = ({ name, data, formData, setFormData }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [ranges, setRanges] = useState([[0, 0.8]]); // Default range

    // Handle range input change
    const handleRangeChange = (index, field, value) => {
        const updatedRanges = [...ranges];
        updatedRanges[index][field] = parseFloat(value) || 0;
        setRanges(updatedRanges);
        setFormData({ ...formData, [name]: updatedRanges });

        data.formData[name] = updatedRanges;
    };

    // Add new row
    const addRow = () => {
        setRanges([...ranges, [0, 0]]);

        data.formData[name] = [...ranges, [0, 0]];
    };

    // Remove row
    const removeRow = (index) => {
        const updatedRanges = ranges.filter((_, i) => i !== index);
        setRanges(updatedRanges);
        setFormData({ ...formData, [name]: updatedRanges });

        data.formData[name] = updatedRanges;
    };

    return (
        <div className="mb-1" style={{ width: "100%", position: "relative", display: "inline-block" }}>
            {/* Dropdown Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: "10px",
                    background: "lightgray",
                    border: "none",
                    cursor: "pointer",
                    borderRadius: "5px",
                    width: "100%",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <span>{name}</span>
                {isOpen ? <FaArrowUp /> : <FaArrowDown />}
            </button>

            {/* Dropdown Table */}
            {isOpen && (
                <div
                    style={{
                        position: "absolute",
                        top: "100%",
                        left: "0",
                        background: "#fff",
                        border: "1px solid #ddd",
                        borderRadius: "8px",
                        padding: "10px",
                        boxShadow: "2px 2px 5px rgba(0,0,0,0.2)",
                        width: "100%",
                        maxHeight: "300px",
                        overflowY: "auto",
                        zIndex: 10,
                    }}
                >
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
                                <th style={{ padding: "8px" }}>Min</th>
                                <th style={{ padding: "8px" }}>Max</th>
                                <th style={{ padding: "8px" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ranges.map((range, index) => (
                                <tr key={index} style={{ borderBottom: "1px solid #ddd" }}>
                                    <td>
                                        <Form.Control
                                            type="number"
                                            step="0.1"
                                            value={range[0]}
                                            onChange={(e) => handleRangeChange(index, 0, e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <Form.Control
                                            type="number"
                                            step="0.1"
                                            value={range[1]}
                                            onChange={(e) => handleRangeChange(index, 1, e.target.value)}
                                        />
                                    </td>
                                    <td style={{ paddingLeft: "10px" }}>
                                        <Button variant="danger" style={{
                                            padding: "5px 10px",
                                            background: "red",
                                            color: "#fff",
                                            border: "none",
                                            borderRadius: "5px",
                                            cursor: "pointer"
                                        }} onClick={() => removeRow(index)} disabled={ranges.length === 1}>
                                            ✖
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <Button className="d-flex align-items-center" variant="primary" onClick={addRow} style={{ marginTop: "5px" }}>
                        <FaPlus></FaPlus>
                        <span style={{ paddingLeft: "5px" }}>Add Row</span>
                    </Button>
                </div>
            )}
        </div>
    );
};

const getNodeStyle = (type) => {
    switch (type) {
        case "building":
            return { width: 260 };
        case "pv":
            return { width: 210 };
        case "charger":
            return { width: 300 };
        case "cooling_device":
            return { width: 275 };
        case "heating_device":
            return { width: 275 };
        case "dhw_device":
            return { width: 275 };
        case "cooling_storage":
            return { width: 260 };
        case "heating_storage":
            return { width: 260 };
        case "dhw_storage":
            return { width: 260 };
        case "electrical_storage":
            return { width: 300 };
        default:
            return { width: 200 };
    }
};

export default CustomNode;