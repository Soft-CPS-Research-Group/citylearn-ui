import React, { useState, useCallback, useEffect } from "react";
import { Row, Col, Button, Form, Control, OverlayTrigger, Tooltip } from "react-bootstrap";
import { ToastContainer, toast } from 'react-toastify';
import {
    ReactFlow,
    Controls,
    Background,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FaBuilding, FaCar, FaPlug, FaBolt, FaSnowflake, FaFireAlt, FaBox, FaArrowDown, FaArrowUp } from "react-icons/fa";
import dayjs from 'dayjs';

// Custom node with that represents elements from the schema
import CustomNode from "./CustomNode";

export default function SchemaPage() {
    const [validFormData, setValidFormData] = useState(false);
    const [validJSONConfig, setValidJSONConfig] = useState(true);

    // Dataset Info
    const [datasetName, setDatasetName] = useState("");
    const handleDatasetName = async (e) => {
        const dataset = e.target.value;
        setDatasetName(dataset);
    };

    const [formData, setFormData] = useState({
        random_seed: 2022,
        root_directory: "",
        central_agent: false,
        simulation_start_time_step: 0,
        simulation_end_time_step: 8759,
        episode_time_steps: 1,
        rolling_episode_split: false,
        random_episode_split: false,
        seconds_per_time_step: 3600,
        period: 0,
        date_from: "",
        date_until: ""
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

    // Schema Info
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

    const [siteName, setSiteName] = useState("");
    const handleSiteChange = async (e) => {
        const site = e.target.value;
        setSiteName(site);
    };

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

    const handleSaveSchema = async () => {
        const filteredFormData = Object.fromEntries(
            Object.entries(formData).map(([key, value]) => {
                if (typeof value === "boolean") return [key, value];
                if (value === "" || value === null) return [key, value];
                return [key, isNaN(value) ? value : parseFloat(value)];
            })
        );

        const configs = {
            ...filteredFormData,
            observations: {},
            actions: {},
            agent: agentData,
            reward_function: rewardFunctionData
        };

        Object.keys(actions).forEach((action) => {
            configs.actions[action] = {
                active: actions[action].active,
                shared_in_central_agent: actions[action].shared_in_central_agent
            };
        });

        Object.keys(observations).forEach((observation) => {
            configs.observations[observation] = {
                active: observations[observation].active,
                shared_in_central_agent: observations[observation].shared_in_central_agent
            };
        });

        const body = {
            name: datasetName,
            site_id: siteName,
            citylearn_configs: configs,
            from_ts: dayjs(formData.date_from).format("YYYY-MM-DD HH:mm:ss"),
            until_ts: dayjs(formData.date_until).format("YYYY-MM-DD HH:mm:ss"),
        };

        const schema = {
            ...body,
            electric_vehicles_def: {},
            buildings: {}
        };

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


        try {
            const json = JSON.stringify(schema, null, 2);
            console.log(json);

            // Create a Blob from the JSON string
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'schema.json'; // File name
            document.body.appendChild(a);
            a.click();

            // Clean up
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success('Schema created successfully!', {
                position: "top-right",
                autoClose: 5000,
                hideProgressBar: false
            });
        } catch (error) {
            toast.error('Error creating schema!', {
                position: "top-right",
                autoClose: 5000,
                hideProgressBar: false
            });
        }
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
                    {show &&
                        <Button variant={!validJSONConfig || !validFormData || siteName == "" || datasetName == "" ? "secondary" : "primary"}
                            onClick={handleSaveSchema} disabled={!validJSONConfig || !validFormData || siteName == "" || datasetName == ""}>Save Schema
                        </Button>
                    }
                    {show && <Button variant="danger" style={{ marginRight: 15 }} onClick={() => setShow(false)}>Cancel</Button>}
                </Col>
                <ToastContainer />
            </Row>

            {show && (
                <>
                    <Row>
                        <Col md={3}>
                            <h4>
                                Dataset Name
                                <OverlayTrigger placement="top" overlay={<Tooltip>Name of the dataset</Tooltip>}>
                                    <i className="nc-icon nc-bulb-63" style={{ cursor: 'pointer', fontSize: '20px', marginLeft: '5px' }}></i>
                                </OverlayTrigger>
                            </h4>
                            <Form.Control type="text" name="name" value={datasetName} onChange={handleDatasetName} aria-label="Dataset Name" />
                        </Col>
                    </Row>

                    <BaseInfoForm formData={formData} setFormData={setFormData} setValidFormData={setValidFormData} />

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

                    <AgentForm onChange={handleAgentChange} setValidJSONConfig={setValidJSONConfig} />

                    <RewardFunctionForm onChange={handleRewardFunctionChange} />

                    <Row>
                        <Col>
                            <h4>
                                Schema Name
                                <OverlayTrigger placement="top" overlay={<Tooltip>Name of the schema</Tooltip>}>
                                    <i className="nc-icon nc-bulb-63" style={{ cursor: 'pointer', fontSize: '20px', marginLeft: '5px' }}></i>
                                </OverlayTrigger>
                            </h4>
                            <Form.Control className="w-25" type="text" name="site_name" value={siteName} onChange={handleSiteChange} aria-label="Site Name" />
                        </Col>
                    </Row>

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
const BaseInfoForm = ({ formData, setFormData, setValidFormData }) => {
    const [errors, setErrors] = useState({});
    const requiredFields = [
        'random_seed',
        'root_directory',
        'simulation_start_time_step',
        'simulation_end_time_step',
        'episode_time_steps',
        'seconds_per_time_step',
        'period',
        'date_from',
        'date_until'
    ];

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const val = type === 'checkbox' ? checked : value;

        setFormData((prev) => ({ ...prev, [name]: val }));
    };

    // Re-run validation whenever formData changes
    useEffect(() => {
        const newErrors = {};

        requiredFields.forEach((field) => {
            if (formData[field] === '' || formData[field] === null) {
                newErrors[field] = 'This field is required';
            }
        });

        const start = parseInt(formData.simulation_start_time_step);
        const end = parseInt(formData.simulation_end_time_step);
        if (!isNaN(start) && !isNaN(end) && start >= end) {
            newErrors.simulation_time_step = '"Start Time Step" must be less than "End Time Step"';
        }

        const from = new Date(formData.date_from);
        const until = new Date(formData.date_until);
        if (from && until && from > until) {
            newErrors.date_from = '"From" date must be earlier than "Until" date';
        }

        setErrors(newErrors);
        setValidFormData(Object.keys(newErrors).length === 0);
    }, [formData, setValidFormData]);

    return (<>
        <Form className="mt-3">
            <h4>Base Info</h4>
            <Row>
                <Col className="mb-2" md={6}>
                    <Form.Group>
                        <Form.Label htmlFor="random_seed">Random Seed</Form.Label>
                        <Form.Control
                            type="number"
                            id="random_seed"
                            name="random_seed"
                            min={0}
                            max={9999999}
                            value={formData.random_seed}
                            onChange={handleChange}
                            isInvalid={errors.random_seed}
                        />
                        <Form.Control.Feedback type="invalid">{errors.random_seed}</Form.Control.Feedback>
                    </Form.Group>
                </Col>

                <Col className="mb-2" md={6}>
                    <Form.Group>
                        <Form.Label htmlFor="root_directory">Root Directory</Form.Label>
                        <Form.Control
                            type="text"
                            id="root_directory"
                            name="root_directory"
                            value={formData.root_directory}
                            onChange={handleChange}
                            isInvalid={errors.root_directory}
                        />
                        <Form.Control.Feedback type="invalid">{errors.root_directory}</Form.Control.Feedback>
                    </Form.Group>
                </Col>

                <Col className="mb-2" md={6}>
                    <Form.Group>
                        <Form.Label htmlFor="simulation_start_time_step">Simulation Start Time Step</Form.Label>
                        <Form.Control
                            type="number"
                            id="simulation_start_time_step"
                            name="simulation_start_time_step"
                            value={formData.simulation_start_time_step}
                            onChange={handleChange}
                            min={0}
                            isInvalid={errors.simulation_start_time_step || errors.simulation_time_step}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors.simulation_start_time_step || errors.simulation_time_step}
                        </Form.Control.Feedback>
                    </Form.Group>
                </Col>

                <Col className="mb-2" md={6}>
                    <Form.Group>
                        <Form.Label htmlFor="simulation_end_time_step">Simulation End Time Step</Form.Label>
                        <Form.Control
                            type="number"
                            id="simulation_end_time_step"
                            name="simulation_end_time_step"
                            value={formData.simulation_end_time_step}
                            onChange={handleChange}
                            min={0}
                            isInvalid={errors.simulation_end_time_step || errors.simulation_time_step}
                        />
                        <Form.Control.Feedback type="invalid">
                            {errors.simulation_end_time_step || errors.simulation_time_step}
                        </Form.Control.Feedback>
                    </Form.Group>
                </Col>

                <Col md={6} className="mb-2">
                    <Form.Group>
                        <Form.Label htmlFor="episode_time_steps">Episode Time Steps</Form.Label>
                        <Form.Control
                            type="number"
                            id="episode_time_steps"
                            name="episode_time_steps"
                            value={formData.episode_time_steps}
                            onChange={handleChange}
                            min={0}
                            isInvalid={errors.episode_time_steps}
                        />
                        <Form.Control.Feedback type="invalid">{errors.episode_time_steps}</Form.Control.Feedback>
                    </Form.Group>
                </Col>

                <Col md={6} className="mb-2">
                    <Form.Group>
                        <Form.Label htmlFor="seconds_per_time_step">Seconds per Time Step</Form.Label>
                        <Form.Control
                            type="number"
                            id="seconds_per_time_step"
                            name="seconds_per_time_step"
                            value={formData.seconds_per_time_step}
                            onChange={handleChange}
                            min={0}
                            isInvalid={errors.seconds_per_time_step}
                        />
                        <Form.Control.Feedback type="invalid">{errors.seconds_per_time_step}</Form.Control.Feedback>
                    </Form.Group>
                </Col>
            </Row>

            <Row>
                <Col md={4}>
                    <Form.Group>
                        <Form.Label htmlFor="period">
                            Period
                            <OverlayTrigger placement="top" overlay={<Tooltip>Interval between time steps (in minutes)</Tooltip>}>
                                <i className="nc-icon nc-bulb-63" style={{ cursor: 'pointer', fontSize: '20px', marginLeft: '5px' }}></i>
                            </OverlayTrigger>
                        </Form.Label>
                        <Form.Control
                            type="number"
                            name="period"
                            min={1}
                            value={formData.period}
                            onChange={handleChange}
                            isInvalid={errors.period}
                            aria-label="Period" />
                        <Form.Control.Feedback type="invalid">{errors.period}</Form.Control.Feedback>
                    </Form.Group>
                </Col>
                <Col md={4}>
                    <Form.Label htmlFor="date_from">
                        From
                        <OverlayTrigger placement="top" overlay={<Tooltip>Start date of the period</Tooltip>}>
                            <i className="nc-icon nc-bulb-63" style={{ cursor: 'pointer', fontSize: '20px', marginLeft: '5px' }}></i>
                        </OverlayTrigger>
                    </Form.Label>
                    <Form.Control
                        type="datetime-local"
                        name="date_from"
                        value={formData.date_from}
                        onChange={handleChange}
                        aria-label="From"
                        isInvalid={errors.date_from} />
                    <Form.Control.Feedback type="invalid">{errors.date_from}</Form.Control.Feedback>
                </Col>
                <Col md={4}>
                    <Form.Label htmlFor="date_until">
                        Until
                        <OverlayTrigger placement="top" overlay={<Tooltip>End date of the period</Tooltip>}>
                            <i className="nc-icon nc-bulb-63" style={{ cursor: 'pointer', fontSize: '20px', marginLeft: '5px' }}></i>
                        </OverlayTrigger>
                    </Form.Label>
                    <Form.Control
                        type="datetime-local"
                        name="date_until"
                        value={formData.date_until}
                        onChange={handleChange}
                        aria-label="Until"
                        isInvalid={errors.date_until} />
                    <Form.Control.Feedback type="invalid">{errors.date_until}</Form.Control.Feedback>
                </Col>
            </Row>

            <Row className="mt-3">
                <Col md={4} className="px-1">
                    <Form.Check className="mb-1 pl-0">
                        <Form.Check.Label>
                            <Form.Check.Input type="checkbox" name="central_agent" checked={formData.central_agent} onChange={handleChange} />
                            <span className="form-check-sign"></span>
                            Central Agent
                        </Form.Check.Label>
                    </Form.Check>
                </Col>
                <Col md={4} className="px-1">
                    <Form.Check className="mb-1 pl-0">
                        <Form.Check.Label>
                            <Form.Check.Input type="checkbox" name="rolling_episode_split" checked={formData.rolling_episode_split} onChange={handleChange} />
                            <span className="form-check-sign"></span>
                            Rolling Episode Split
                        </Form.Check.Label>
                    </Form.Check>
                </Col>
                <Col md={4} className="px-1">
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
const AgentForm = ({ onChange, setValidJSONConfig, initialType = agentTypes[0] }) => {
    const [selectedType, setSelectedType] = useState(initialType);
    const [jsonAttributes, setJsonAttributes] = useState({});
    const [jsonText, setJsonText] = useState("");
    const [isValidJson, setIsValidJson] = useState(true);

    // Initialize the value on the selector
    useEffect(() => {
        onChange({ type: initialType, attributes: {} });
    }, [initialType]);

    const handleTypeChange = (e) => {
        const newType = e.target.value;
        setSelectedType(newType);
        onChange({ type: newType, attributes: jsonAttributes });
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];

        // Validate if file is .json
        if (file && file.type !== "application/json" && !file.name.endsWith(".json")) {
            toast.error('Only .json files are allowed!', {
                position: "top-right",
                autoClose: 5000,
                hideProgressBar: false
            });
            event.target.value = "";
            return;
        }

        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const jsonData = JSON.parse(e.target.result);
                    setJsonAttributes(jsonData);
                    setJsonText(JSON.stringify(jsonData, null, 4)); // Pretty format JSON
                    setIsValidJson(true);

                    // Pass updated agent data to parent
                    setValidJSONConfig(true);
                    onChange({ type: selectedType, attributes: jsonData });
                } catch (error) {
                    setValidJSONConfig(false);
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
            setValidJSONConfig(true);
            onChange({ type: selectedType, attributes: updatedJson });
        } catch (error) {
            setIsValidJson(false);
            setValidJSONConfig(false);
        }
    };

    return (
        <>
            <Form className="mt-3">
                <h4>Agent Info</h4>

                <Row className="mb-3">
                    <Col md={6}>
                        <Form.Group>
                            <Form.Label className="d-flex" htmlFor="agent_type">Agent Type</Form.Label>
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
                                onChange={handleTypeChange} id="agent_type" aria-label="Agent Type"
                            >
                                {agentTypes.map((type) => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                    </Col>

                    <Col md={6}>
                        <Form.Group>
                            <Form.Label htmlFor="agent_config">
                                Agent Config (.json)
                                <OverlayTrigger placement="top" overlay={<Tooltip>Custom configurations for the agent. File must be in JSON format</Tooltip>}>
                                    <i className="nc-icon nc-bulb-63" style={{ cursor: 'pointer', fontSize: '20px', marginLeft: '5px' }}></i>
                                </OverlayTrigger>
                            </Form.Label>
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
                                id="agent_config"
                                aria-label="Agent Config"
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
const rewardFunctionTypes = [
    "citylearn.reward_function.RewardFunction",
    "citylearn.reward_function.MARL",
    "citylearn.reward_function.IndependentSACReward",
    "citylearn.reward_function.SolarPenaltyReward",
    "citylearn.reward_function.ComfortReward",
    "citylearn.reward_function.SolarPenaltyAndComfortReward",
    "citylearn.reward_function.V2GPenaltyReward"
];
const RewardFunctionForm = ({ onChange, initialType = rewardFunctionTypes[0] }) => {
    // State for selected function type
    const [selectedType, setSelectedType] = useState(initialType);

    // Initialize the value on the selector
    useEffect(() => {
        onChange({ type: initialType });
    }, [initialType]);

    // Handle select change
    const handleTypeChange = (e) => {
        const newType = e.target.value;
        setSelectedType(newType);
        onChange({ type: newType });
    };

    return (
        <Form className="mt-3">
            <h4>Reward Function Info</h4>

            {/* Dropdown to select reward function type */}
            <Row className="mb-3">
                <Col md={6}>
                    <Form.Group>
                        <Form.Label className="d-flex" htmlFor="reward_function">Reward Function Type</Form.Label>
                        <Form.Select style={{
                            padding: "10px",
                            cursor: "pointer",
                            border: "1px solid #ccc",
                            borderRadius: "5px",
                            width: "100%",
                            textAlign: "left"
                        }} value={selectedType} onChange={handleTypeChange} id="reward_function" aria-label="Reward Function Type">
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