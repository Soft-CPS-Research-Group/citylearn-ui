import React, { useState, useCallback, useEffect } from "react";
import { Row, Col, Button, Form } from "react-bootstrap";
import {
    ReactFlow,
    Controls,
    Background,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FaBuilding, FaCar, FaPlug, FaArrowUp, FaArrowDown, FaBolt, FaSnowflake, FaFireAlt, FaBox, FaPlus } from "react-icons/fa";

// Custom node with that represents elements from the schema
import CustomNode from "./CustomNode";

// Sidebar for dragging elements
const Sidebar = ({ onDragStart }) => (
    <div style={{ width: 200, paddingRight: 10, background: "#f4f4f4" }}>
        <div draggable onDragStart={(e) => onDragStart(e, "building")} style={{ padding: 10, background: "#ddd", marginBottom: 10, cursor: "grab", display: "flex", alignItems: "center", gap: "5px" }}>
            <FaBuilding /> Building
        </div>
        <div draggable onDragStart={(e) => onDragStart(e, "ev")} style={{ padding: 10, background: "#ddd", marginBottom: 10, cursor: "grab", display: "flex", alignItems: "center", gap: "5px" }}>
            <FaCar /> Electric Vehicle
        </div>
        <div draggable onDragStart={(e) => onDragStart(e, "charger")} style={{ padding: 10, background: "#ddd", marginBottom: 10, cursor: "grab", display: "flex", alignItems: "center", gap: "5px" }}>
            <FaPlug /> Charger
        </div>
        <div draggable onDragStart={(e) => onDragStart(e, "pv")} style={{ padding: 10, background: "#ddd", marginBottom: 10, cursor: "grab", display: "flex", alignItems: "center", gap: "5px" }}>
            <FaBolt /> PV
        </div>
        <div draggable onDragStart={(e) => onDragStart(e, "cooling_device")} style={{ padding: 10, background: "#ddd", marginBottom: 10, cursor: "grab", display: "flex", alignItems: "center", gap: "5px" }}>
            <FaSnowflake /> Cooling Device
        </div>
        <div draggable onDragStart={(e) => onDragStart(e, "heating_device")} style={{ padding: 10, background: "#ddd", marginBottom: 10, cursor: "grab", display: "flex", alignItems: "center", gap: "5px" }}>
            <FaFireAlt /> Heating Device
        </div>
        <div draggable onDragStart={(e) => onDragStart(e, "dhw_device")} style={{ padding: 10, background: "#ddd", marginBottom: 10, cursor: "grab", display: "flex", alignItems: "center", gap: "5px" }}>
            <FaFireAlt /> DHW Device
        </div>
        <div draggable onDragStart={(e) => onDragStart(e, "dhw_storage")} style={{ padding: 10, background: "#ddd", marginBottom: 10, cursor: "grab", display: "flex", alignItems: "center", gap: "5px" }}>
            <FaBox /> DHW Storage
        </div>
        <div draggable onDragStart={(e) => onDragStart(e, "cooling_storage")} style={{ padding: 10, background: "#ddd", marginBottom: 10, cursor: "grab", display: "flex", alignItems: "center", gap: "5px" }}>
            <FaBox /> Cooling Storage
        </div>
        <div draggable onDragStart={(e) => onDragStart(e, "heating_storage")} style={{ padding: 10, background: "#ddd", marginBottom: 10, cursor: "grab", display: "flex", alignItems: "center", gap: "5px" }}>
            <FaBox /> Heating Storage
        </div>
        <div draggable onDragStart={(e) => onDragStart(e, "electrical_storage")} style={{ padding: 10, background: "#ddd", marginBottom: 10, cursor: "grab", display: "flex", alignItems: "center", gap: "5px" }}>
            <FaBox /> Electrical Storage
        </div>
    </div>
);

export default function SchemaPage() {
    const [valid, setValid] = useState(true);
    const [show, setShow] = useState(false);
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [nodeCounts, setNodeCounts] =
        useState({
            building: 0, ev: 0, pv: 0, charger: 0,
            cooling_device: 0, heating_device: 0, dhw_device: 0,
            cooling_storage: 0, heating_storage: 0, dhw_storage: 0, electrical_storage: 0
        });

    const [selectedNodes, setSelectedNodes] = useState([]);
    const [copiedNode, setCopiedNode] = useState(null);

    // Track selected nodes
    const handleSelectionChange = useCallback(({ nodes: selected }) => {
        setSelectedNodes(selected);
    }, []);

    const handleKeyDown = useCallback((event) => {
        if (event.ctrlKey || event.metaKey) {
            if (event.key === "c") {
                // Copy the first selected node
                if (selectedNodes.length === 1) {
                    setCopiedNode(selectedNodes[0]);
                }
            }
            if (event.key === "v" && copiedNode) {
                // Paste new node with a new ID and position offset
                setNodes((prevNodes) => [
                    ...prevNodes,
                    {
                        ...copiedNode,
                        id: `${copiedNode.id}-copy-${Date.now()}`,
                        position: {
                            x: copiedNode.position.x + 50,
                            y: copiedNode.position.y + 50,
                        },
                        data: {
                            ...copiedNode.data,
                            label: `${copiedNode.data.label}_1`, // Append "_1" to label
                        },
                        selected: false,
                    }
                ]);
            }
        }
    }, [copiedNode, selectedNodes, setNodes]);

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    // Main form
    const [formData, setFormData] = useState({
        random_seed: 2022,
        root_directory: "",
        central_agent: false,
        simulation_start_time_step: 0,
        simulation_end_time_step: 8759,
        episode_time_steps: "",
        rolling_episode_split: false,
        random_episode_split: false,
        seconds_per_time_step: 3600,
    });

    const [rewardFunctionData, setRewardFunctionData] = useState({ type: "", attributes: {} });

    const handleRewardFunctionChange = (data) => {
        setRewardFunctionData(data);
    };

    const [agentData, setAgentData] = useState({ type: "", attributes: {} });

    const handleAgentChange = (data) => {
        setAgentData(data);
    };

    // Observations list
    const [observations, setObservations] = useState({
        month: { active: false, shared_in_central_agent: false },
        day_type: { active: false, shared_in_central_agent: false },
        hour: { active: false, shared_in_central_agent: false },
        daylight_savings_status: { active: false, shared_in_central_agent: false },
        outdoor_dry_bulb_temperature: { active: false, shared_in_central_agent: false },
        outdoor_dry_bulb_temperature_predicted_1: { active: false, shared_in_central_agent: false },
        outdoor_dry_bulb_temperature_predicted_2: { active: false, shared_in_central_agent: false },
        outdoor_dry_bulb_temperature_predicted_3: { active: false, shared_in_central_agent: false },
        outdoor_relative_humidity: { active: false, shared_in_central_agent: false },
        outdoor_relative_humidity_predicted_1: { active: false, shared_in_central_agent: false },
        outdoor_relative_humidity_predicted_2: { active: false, shared_in_central_agent: false },
        outdoor_relative_humidity_predicted_3: { active: false, shared_in_central_agent: false },
        direct_solar_irradiance: { active: false, shared_in_central_agent: false },
        direct_solar_irradiance_predicted_1: { active: false, shared_in_central_agent: false },
        direct_solar_irradiance_predicted_2: { active: false, shared_in_central_agent: false },
        direct_solar_irradiance_predicted_3: { active: false, shared_in_central_agent: false },
        carbon_intensity: { active: false, shared_in_central_agent: false },
        indoor_dry_bulb_temperature: { active: false, shared_in_central_agent: false },
        net_electricity_consumption: { active: false, shared_in_central_agent: false },
        electricity_pricing: { active: false, shared_in_central_agent: false },
        electric_vehicle_soc: { active: false, shared_in_central_agent: false }
    });

    // Actions list
    const [actions, setActions] = useState({
        cooling_storage: { active: false },
        heating_storage: { active: false },
        dhw_storage: { active: false },
        electrical_storage: { active: false },
        electric_vehicle_storage: { active: false }
    });

    const handleSaveSchema = () => {
        if(!valid) {
            alert("Invalid form data!");
        }

        const filteredFormData = Object.fromEntries(
            Object.entries(formData).map(([key, value]) => {
                if (typeof value === "boolean") return [key, value];
                if (value === "" || value === null) return [key, value];
                return [key, isNaN(value) ? value : parseFloat(value)];
            })
        );

        const schema = {
            ...filteredFormData,
            observations: {},
            actions: {},
            agent: agentData,
            reward_function: rewardFunctionData,
            electric_vehicles_def: {},
            buildings: {}
        };

        Object.keys(actions).forEach((action) => {
            schema.actions[action] = {
                active: actions[action].active,
                shared_in_central_agent: actions[action].shared_in_central_agent
            };
        });

        Object.keys(observations).forEach((observation) => {
            schema.observations[observation] = {
                active: observations[observation].active,
                shared_in_central_agent: observations[observation].shared_in_central_agent
            };
        });

        nodes.forEach((node) => {
            switch (node.data.type) {
                case "ev": {
                    schema.electric_vehicles_def[node.data.label] = {
                        include: true,
                        energy_simulation: node.data.formData.energy_simulation,
                        battery: {
                            type: "citylearn.energy_model.Battery",
                            autosize: false,
                            attributes: Object.fromEntries(
                                Object.entries(node.data.formData).map(([key, value]) => [
                                    key,
                                    isNaN(value) ? value : parseFloat(value)
                                ])
                            )
                        }
                    };
                    break;
                }
                case "building": {
                    schema.buildings[node.data.label] = {
                        include: true,
                        energy_simulation: node.data.formData.energy_simulation,
                        weather: node.data.formData.weather,
                        carbon_intensity: node.data.formData.carbon_intensity,
                        pricing: node.data.formData.pricing,
                        inactive_observations: node.data.formData.inactive_observations,
                        inactive_actions: node.data.formData.inactive_actions,
                        ...getConnectedDevices(nodes, edges, node.id)
                    };
                }
                default: {
                    break;
                }
            }
        });

        console.log(JSON.stringify(schema, null, 2));

        // Convert to JSON file for download
        // const jsonBlob = new Blob([JSON.stringify(schema, null, 2)], { type: "application/json" });
        // const link = document.createElement("a");
        // link.href = URL.createObjectURL(jsonBlob);
        // link.download = "schema.json";
        // document.body.appendChild(link);
        // link.click();
        // document.body.removeChild(link);
    };

    const getConnectedDevices = (nodes, edges, buildingId) => {
        const typesAttributes = {
            "citylearn.electric_vehicle_charger.Charger": ["nominal_power", "efficiency", "charger_type", "max_charging_power", "min_charging_power", "max_discharging_power", "min_discharging_power", "charge_efficiency_curve", "discharge_efficiency_curve"],
            "citylearn.energy_model.PV": ["nominal_power"],
            "citylearn.energy_model.HeatPump": ["nominal_power", "efficiency", "target_cooling_temperature", "target_heating_temperature"],
            "citylearn.energy_model.ElectricHeater": ["nominal_power", "efficiency"],
            "citylearn.energy_model.StorageTank": ["capacity", "max_output_power", "max_input_power"],
            "citylearn.energy_model.Battery": ["capacity", "nominal_power", "capacity_loss_coefficient", "power_efficiency_curve", "capacity_power_curve", "depth_of_discharge"]
        };

        return edges
            .map((edge) => {
                if (edge.target === buildingId) return nodes.find((n) => n.id === edge.source); // Device → Building
                if (edge.source === buildingId) return nodes.find((n) => n.id === edge.target); // Building → Device
                return null;
            })
            .filter((node) => node && node.data.type !== "building") // Exclude buildings
            .reduce((acc, node) => {
                const { safety_factor, types, selectedType, ...rawFormData } = node.data.formData;

                // Filter out formData keys that are not valid for the selectedType
                const filteredFormData = Object.fromEntries(
                    Object.entries(rawFormData).filter(([key]) => typesAttributes[selectedType].includes(key))
                );

                // Convert numeric values dynamically (for fields that can be numeric)
                const finalFormData = Object.fromEntries(
                    Object.entries(filteredFormData).map(([key, value]) => [
                        key,
                        isNaN(value) ? value : parseFloat(value)
                    ])
                );

                acc[node.data.label.toLowerCase()] = {
                    type: selectedType,
                    autosize: false,
                    ...(safety_factor && {
                        autosize_attributes: { safety_factor: parseFloat(safety_factor) }
                    }),
                    attributes: finalFormData
                };

                return acc;
            }, {});
    };

    const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
    const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
    const onConnect = useCallback((connection) => setEdges((eds) => addEdge(connection, eds)), []);

    // Handle drag start
    const onDragStart = (event, nodeType) => {
        event.dataTransfer.setData("application/reactflow", nodeType);
        event.dataTransfer.effectAllowed = "move";
    };

    // Handle drop
    const onDrop = (event) => {
        event.preventDefault();
        const type = event.dataTransfer.getData("application/reactflow");
        if (!type) return;

        const position = { x: event.clientX - 200, y: event.clientY - 50 };

        let icon, label, formData = {};
        switch (type) {
            case "building":
                icon = <FaBuilding />;
                label = `Building_${nodeCounts.building + 1}`;
                setNodeCounts((prev) => ({ ...prev, building: prev.building + 1 }));
                formData = {
                    energy_simulation: `Building_${nodeCounts.building + 1}.csv`,
                    weather: `weather.csv`,
                    carbon_intensity: `carbon_intensity.csv`,
                    pricing: `pricing.csv`,
                    inactive_observations: [],
                    inactive_actions: []
                };
                break;
            case "ev":
                icon = <FaCar />;
                label = `Electric_Vehicle_${nodeCounts.ev + 1}`;
                setNodeCounts((prev) => ({ ...prev, ev: prev.ev + 1 }));
                formData = {
                    energy_simulation: `Electric_Vehicle_${nodeCounts.ev + 1}.csv`,
                    capacity: 40,
                    nominal_power: 50,
                    initial_soc: 0.25,
                    depth_of_discharge: 0.10
                };
                break;
            case "pv":
                icon = <FaBolt />;
                label = `PV_${nodeCounts.pv + 1}`;
                setNodeCounts((prev) => ({ ...prev, pv: prev.pv + 1 }));
                formData = {
                    types: ["citylearn.energy_model.PV"],
                    selectedType: "citylearn.energy_model.PV",
                    nominal_power: 0.7
                };
                break;
            case "charger":
                icon = <FaPlug />;
                label = `Charger_${nodeCounts.charger + 1}`;
                setNodeCounts((prev) => ({ ...prev, charger: prev.charger + 1 }));
                formData = {
                    types: ["citylearn.electric_vehicle_charger.Charger"],
                    selectedType: "citylearn.electric_vehicle_charger.Charger",
                    nominal_power: 4.1096,
                    efficiency: 0.2535,
                    charger_type: 0,
                    max_charging_power: 11,
                    min_charging_power: 1.4,
                    max_discharging_power: 7.2,
                    min_discharging_power: 0.0,
                    charge_efficiency_curve: [0, 0.8],
                    discharge_efficiency_curve: [0, 0.8]
                };
                break;
            case "cooling_device":
                icon = <FaSnowflake />;
                label = `Cooling_Device_${nodeCounts.cooling_device + 1}`;
                setNodeCounts((prev) => ({ ...prev, cooling_device: prev.cooling_device + 1 }));
                formData = {
                    types: ["citylearn.energy_model.HeatPump"],
                    selectedType: "citylearn.energy_model.HeatPump",
                    safety_factor: 0.5,
                    nominal_power: 2.252523899078369,
                    efficiency: 0.28791926968413395,
                    target_cooling_temperature: 6.016841879471529,
                    target_heating_temperature: 45
                };
                break;
            case "heating_device":
                icon = <FaFireAlt />;
                label = `Heating_Device_${nodeCounts.heating_device + 1}`;
                setNodeCounts((prev) => ({ ...prev, heating_device: prev.heating_device + 1 }));
                formData = {
                    types: ["citylearn.energy_model.HeatPump", "citylearn.energy_model.ElectricHeater"],
                    selectedType: "citylearn.energy_model.HeatPump",
                    safety_factor: 0.5,
                    nominal_power: 2.252523899078369,
                    efficiency: 0.28791926968413395,
                    target_cooling_temperature: 6.016841879471529,
                    target_heating_temperature: 45
                };
                break;
            case "dhw_device":
                icon = <FaFireAlt />;
                label = `DHW_Device_${nodeCounts.dhw_device + 1}`;
                setNodeCounts((prev) => ({ ...prev, dhw_device: prev.dhw_device + 1 }));
                formData = {
                    types: ["citylearn.energy_model.HeatPump", "citylearn.energy_model.ElectricHeater"],
                    selectedType: "citylearn.energy_model.HeatPump",
                    safety_factor: 0.5,
                    nominal_power: 4.109619617462158,
                    efficiency: 0.2535049749071043,
                    target_cooling_temperature: 6.016841879471529,
                    target_heating_temperature: 45
                };
                break;
            case "cooling_storage":
                icon = <FaBox />;
                label = `Cooling_Storage_${nodeCounts.cooling_storage + 1}`;
                setNodeCounts((prev) => ({ ...prev, cooling_storage: prev.cooling_storage + 1 }));
                formData = {
                    types: ["citylearn.energy_model.StorageTank"],
                    selectedType: "citylearn.energy_model.StorageTank",
                    capacity: 2.2826755046844482,
                    max_output_power: 0.003212187876499649,
                    max_input_power: 0.5
                };
                break;
            case "heating_storage":
                icon = <FaBox />;
                label = `Heating_Storage_${nodeCounts.heating_storage + 1}`;
                setNodeCounts((prev) => ({ ...prev, heating_storage: prev.heating_storage + 1 }));
                formData = {
                    types: ["citylearn.energy_model.StorageTank"],
                    selectedType: "citylearn.energy_model.StorageTank",
                    capacity: 2.2826755046844482,
                    max_output_power: 0.003212187876499649,
                    max_input_power: 0.5
                };
                break;
            case "dhw_storage":
                icon = <FaBox />;
                label = `DHW_Storage_${nodeCounts.dhw_storage + 1}`;
                setNodeCounts((prev) => ({ ...prev, dhw_storage: prev.dhw_storage + 1 }));
                formData = {
                    types: ["citylearn.energy_model.StorageTank"],
                    selectedType: "citylearn.energy_model.StorageTank",
                    capacity: 2.2826755046844482,
                    max_output_power: 0.003212187876499649,
                    max_input_power: 0.5
                };
                break;
            case "electrical_storage":
                icon = <FaBox />;
                label = `Electrical_Storage_${nodeCounts.electrical_storage + 1}`;
                setNodeCounts((prev) => ({ ...prev, electrical_storage: prev.electrical_storage + 1 }));
                formData = {
                    types: ["citylearn.energy_model.Battery"],
                    selectedType: "citylearn.energy_model.Battery",
                    capacity: 2.2826755046844482,
                    nominal_power: 0.003212187876499649,
                    capacity_loss_coefficient: 0.5,
                    power_efficiency_curve: [0, 0.8],
                    capacity_power_curve: [0, 0.8],
                    depth_of_discharge: 1
                };
                break;
            default: return;
        }

        const newNode = {
            id: `${nodes.length + 1}`,
            type: "customNode",
            position,
            data: { icon, label, type, formData },
            draggable: true,
        };

        setNodes((prev) => [...prev, newNode]);
    };

    return (
        <>
            <Row>
                <Col className="d-flex flex-row-reverse">
                    {!show && <Button variant="primary" onClick={() => setShow(true)}>New Schema</Button>}
                    {show && <Button variant="primary" onClick={handleSaveSchema}>Save Schema</Button>}
                    {show && <Button variant="danger" style={{ marginRight: 15 }} onClick={() => setShow(false)}>Cancel</Button>}
                </Col>
            </Row>

            {/* Form for input data */}
            {show && (
                <>
                    <BaseInfoForm formData={formData} setFormData={setFormData} />

                    <Row>
                        <Col md={6}>
                            <h4>Observations</h4>
                            <Selector name={"Observation"} options={observations} setOptions={setObservations} />
                        </Col>
                        <Col md={3}>
                            <h4>Actions</h4>
                            <Selector name={"Action"} options={actions} setOptions={setActions} />
                        </Col>
                    </Row>

                    <AgentForm onChange={handleAgentChange} setValid={setValid} />

                    <RewardFunctionForm onChange={handleRewardFunctionChange} />
                </>
            )}

            {show && (
                <>
                    <h4>Schema Info</h4>
                    <div style={{ display: "flex", paddingTop: 10, height: "80vh" }}>
                        <Sidebar onDragStart={onDragStart} />
                        <div style={{ flexGrow: 1, background: "#fff", border: "1px solid #ddd" }} onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
                            <ReactFlow nodes={nodes} onNodesChange={onNodesChange} edges={edges} onEdgesChange={onEdgesChange}
                                onConnect={onConnect} onSelectionChange={handleSelectionChange} fitView nodeTypes={{ customNode: CustomNode }}>
                                <Background />
                                <Controls />
                            </ReactFlow>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}

// Form with the base information
const BaseInfoForm = ({ formData, setFormData }) => {
    const handleChange = (e) => {
        const { name, type, value, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    return (<>
        <Form className="mt-3">
            <h4>Base Info</h4>
            <Row>
                <Col className="mb-2" md={6}>
                    <Form.Group>
                        <Form.Label>Random Seed</Form.Label>
                        <Form.Control type="number" name="random_seed" value={formData.random_seed} onChange={handleChange} />
                    </Form.Group>
                </Col>
                <Col className="mb-2" md={6}>
                    <Form.Group>
                        <Form.Label>Root Directory</Form.Label>
                        <Form.Control type="text" name="root_directory" value={formData.root_directory} onChange={handleChange} />
                    </Form.Group>
                </Col>

                <Col className="mb-2" md={6}>
                    <Form.Group>
                        <Form.Label>Simulation Start Time Step</Form.Label>
                        <Form.Control type="number" name="simulation_start_time_step" value={formData.simulation_start_time_step} onChange={handleChange} />
                    </Form.Group>
                </Col>
                <Col className="mb-2" md={6}>
                    <Form.Group>
                        <Form.Label>Simulation End Time Step</Form.Label>
                        <Form.Control type="number" name="simulation_end_time_step" value={formData.simulation_end_time_step} onChange={handleChange} />
                    </Form.Group>
                </Col>

                <Col md={6}>
                    <Form.Group>
                        <Form.Label>Episode Time Steps</Form.Label>
                        <EpisodeTimeStepSelector name="Episode Time Steps" formData={formData} setFormData={setFormData} />
                    </Form.Group>
                </Col>
                <Col md={6}>
                    <Form.Group>
                        <Form.Label>Seconds per Time Step</Form.Label>
                        <Form.Control type="number" name="seconds_per_time_step" value={formData.seconds_per_time_step} onChange={handleChange} />
                    </Form.Group>
                </Col>
            </Row>
            <Row className="mt-3">
                <Col md={4}>
                    <Form.Check className="mb-1 pl-0">
                        <Form.Check.Label>
                            <Form.Check.Input type="checkbox" name="central_agent" checked={formData.central_agent} onChange={handleChange} />
                            <span className="form-check-sign"></span>
                            Central Agent
                        </Form.Check.Label>
                    </Form.Check>
                </Col>
                <Col md={4}>
                    <Form.Check className="mb-1 pl-0">
                        <Form.Check.Label>
                            <Form.Check.Input type="checkbox" name="rolling_episode_split" checked={formData.rolling_episode_split} onChange={handleChange} />
                            <span className="form-check-sign"></span>
                            Rolling Episode Split
                        </Form.Check.Label>
                    </Form.Check>
                </Col>
                <Col md={4}>
                    <Form.Check className="mb-1 pl-0">
                        <Form.Check.Label>
                            <Form.Check.Input type="checkbox" name="random_episode_split" checked={formData.random_episode_split} onChange={handleChange} />
                            <span className="form-check-sign"></span>
                            Random Episode Split
                        </Form.Check.Label>
                    </Form.Check>
                </Col>
            </Row>
        </Form>
    </>)
}

// Form with the agent information
const AgentForm = ({ onChange, setValid }) => {
    const agentTypes = [
        "citylearn.agents.rbc.BasicBatteryRBC",
        "citylearn.agents.rbc.BasicRBC",
        "citylearn.agents.rbc.HourRBC",
        "citylearn.agents.rbc.OptimizedRBC",
        "citylearn.agents.rbc.RBC",
        "citylearn.agents.sac.SAC",
        "citylearn.agents.sac.SACRBC",
        "citylearn.agents.marlisa.MARLISA",
        "citylearn.agents.marlisa.MARLISARBC",
    ];

    const [selectedType, setSelectedType] = useState(agentTypes[0]);
    const [jsonAttributes, setJsonAttributes] = useState({});
    const [jsonText, setJsonText] = useState("");
    const [isValidJson, setIsValidJson] = useState(true);

    const handleTypeChange = (e) => {
        const newType = e.target.value;
        setSelectedType(newType);
        onChange({ type: newType, attributes: jsonAttributes });
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];

        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const jsonData = JSON.parse(e.target.result);
                    setJsonAttributes(jsonData);
                    setJsonText(JSON.stringify(jsonData, null, 4)); // Pretty format JSON
                    setIsValidJson(true);

                    // Pass updated agent data to parent
                    setValid(true);
                    onChange({ type: selectedType, attributes: jsonData });
                } catch (error) {
                    setValid(false);
                }
            };
            reader.readAsText(file);
        }
    };

    // Handle manual edits in textarea
    const handleJsonChange = (e) => {
        const newText = e.target.value;
        setJsonText(newText);

        try {
            const updatedJson = JSON.parse(newText);
            setJsonAttributes(updatedJson);
            setIsValidJson(true);

            // Pass updated JSON to parent
            setValid(true);
            onChange({ type: selectedType, attributes: updatedJson });
        } catch (error) {
            setIsValidJson(false);
            setValid(false);
        }
    };

    return (
        <>
            <Form className="mt-3">
                <h4>Agent Info</h4>

                <Row className="mb-3">
                    <Col md={6}>
                        <Form.Group>
                            <Form.Label className="d-flex">Agent Type</Form.Label>
                            <Form.Select
                                style={{
                                    padding: "10px",
                                    paddingRight: "30px",
                                    cursor: "pointer",
                                    border: "1px solid #ccc",
                                    borderRadius: "5px",
                                    width: "100%",
                                    textAlign: "left"
                                }}
                                value={selectedType}
                                onChange={handleTypeChange}
                            >
                                {agentTypes.map((type) => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                    </Col>

                    <Col md={6}>
                        <Form.Group>
                            <Form.Label>Agent Config (.json)</Form.Label>
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleFileUpload}
                                style={{
                                    display: "block",
                                    padding: "6px",
                                    border: "1px solid #ccc",
                                    borderRadius: "5px",
                                    cursor: "pointer",
                                    width: "100%"
                                }}
                            />
                        </Form.Group>
                    </Col>
                </Row>

                {/* Show the JSON text area only when a JSON file is uploaded */}
                {jsonText && (
                    <Row className="mt-3">
                        <Col>
                            <Form.Group>
                                <Form.Label>Edit JSON Config:</Form.Label>
                                <textarea
                                    value={jsonText}
                                    onChange={handleJsonChange}
                                    onKeyDown={(e) => {
                                        if (e.key === "Tab") {
                                            e.preventDefault(); // Prevent default tab behavior
                                
                                            const { selectionStart, selectionEnd } = e.target;
                                            const newText =
                                                jsonText.substring(0, selectionStart) +
                                                "\t" +
                                                jsonText.substring(selectionEnd);
                                
                                            setJsonText(newText);
                                
                                            // Move cursor after inserted tab
                                            setTimeout(() => {
                                                e.target.selectionStart = e.target.selectionEnd = selectionStart + 1;
                                            }, 0);
                                        }
                                    }}
                                    style={{
                                        width: "100%",
                                        height: "200px",
                                        fontFamily: "monospace",
                                        fontSize: "14px",
                                        padding: "10px",
                                        border: isValidJson ? "1px solid #ccc" : "2px solid red",
                                        borderRadius: "5px",
                                        resize: "vertical",
                                        backgroundColor: isValidJson ? "white" : "#ffe5e5"
                                    }}
                                />
                                {!isValidJson && (
                                    <p style={{ color: "red", fontSize: "12px", marginTop: "5px" }}>
                                        Invalid JSON format. Please fix syntax errors.
                                    </p>
                                )}
                            </Form.Group>
                        </Col>
                    </Row>
                )}
            </Form>
        </>
    );
};

// Form with the reward function information
const RewardFunctionForm = ({ onChange }) => {
    const rewardFunctionTypes = [
        "citylearn.reward_function.RewardFunction",
        "citylearn.reward_function.MARL",
        "citylearn.reward_function.IndependentSACReward",
        "citylearn.reward_function.SolarPenaltyReward",
        "citylearn.reward_function.ComfortReward",
        "citylearn.reward_function.SolarPenaltyAndComfortReward",
        "citylearn.reward_function.V2GPenaltyReward"
    ];

    // State for selected function type
    const [selectedType, setSelectedType] = useState(rewardFunctionTypes[0]);

    // Handle select change
    const handleTypeChange = (e) => {
        const newType = e.target.value;
        setSelectedType(newType);

        onChange({ type: selectedType });
    };

    return (
        <Form className="mt-3">
            <h4>Reward Function Info</h4>

            {/* Dropdown to select reward function type */}
            <Row className="mb-3">
                <Col md={6}>
                    <Form.Group>
                        <Form.Label className="d-flex">Reward Function Type</Form.Label>
                        <Form.Select style={{
                            padding: "10px",
                            cursor: "pointer",
                            border: "1px solid #ccc",
                            borderRadius: "5px",
                            width: "100%",
                            textAlign: "left"
                        }} value={selectedType} onChange={handleTypeChange}>
                            {rewardFunctionTypes.map((type) => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </Form.Select>
                    </Form.Group>
                </Col>
            </Row>
        </Form>
    );
};

// Selector for actions and observations
const Selector = ({ name, options, setOptions }) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleCheckboxChange = (option, field) => {
        setOptions((prev) => ({
            ...prev,
            [option]: { ...prev[option], [field]: !prev[option][field] }
        }));
    };

    return (
        <div style={{ width: "100%", position: "relative", display: "inline-block" }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: "10px",
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
                                {name == "Observation" &&
                                    <th style={{ padding: "8px", textAlign: "center" }}>Shared</th>
                                }
                            </tr>
                        </thead>
                        <tbody>
                            {Object.keys(options).map((option) => (
                                <tr key={option} style={{ borderBottom: "1px solid #ddd" }}>
                                    <td style={{ padding: "8px" }}>{option.replace(/_/g, " ").toUpperCase()}</td>
                                    <td>
                                        <Form.Check className="mb-0">
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
                                    {name == "Observation" &&
                                        <td>
                                            <Form.Check className="mb-0">
                                                <Form.Check.Label style={{ paddingBottom: "17px" }}>
                                                    <Form.Check.Input
                                                        type="checkbox"
                                                        checked={options[option].shared_in_central_agent}
                                                        onChange={() => handleCheckboxChange(option, "shared_in_central_agent")}
                                                    />
                                                    <span className="form-check-sign"></span>
                                                </Form.Check.Label>
                                            </Form.Check>
                                        </td>
                                    }
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

const EpisodeTimeStepSelector = ({ name, formData, setFormData }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [ranges, setRanges] = useState([[0, 0.8]]); // Default range

    // Handle range input change
    const handleRangeChange = (index, field, value) => {
        const updatedRanges = [...ranges];
        updatedRanges[index][field] = parseFloat(value) || 0;
        setRanges(updatedRanges);
        setFormData({ ...formData, episode_time_steps: updatedRanges });
    };

    // Add new row
    const addRow = () => {
        setRanges([...ranges, [0, 0]]);
    };

    // Remove row
    const removeRow = (index) => {
        const updatedRanges = ranges.filter((_, i) => i !== index);
        setRanges(updatedRanges);
        setFormData({ ...formData, episode_time_steps: updatedRanges });
    };

    return (
        <div style={{ width: "100%", position: "relative", display: "inline-block" }}>
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