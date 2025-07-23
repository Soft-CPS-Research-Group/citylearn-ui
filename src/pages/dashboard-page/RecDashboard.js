import React, { useState, useRef } from "react";
import { Container, Tab, Tabs, Row, Col, Card, CardBody, Button, ListGroup, Collapse, Form } from "react-bootstrap";
import { FaIndustry, FaPlug, FaBolt, FaBuilding, FaBatteryFull, FaUpload, FaMoneyBill } from "react-icons/fa";
import SelectSimulationModal from "../../components/shared/SelectSimulationModal";
import CardEV from "../../components/utils/equipment/CardEV.js";
import CardPV from "../../components/utils/equipment/CardPV.js";
import Papa from "papaparse";
import CardProduction from "components/utils/building/CardProduction";
import CardConsumption from "components/utils/building/CardConsumption";
import CardCharger from "components/utils/equipment/CardCharger";
import CardBattery from "components/utils/equipment/CardBattery";
import { useEffect } from "react";
import CardPricing from "components/utils/equipment/CardPricing";

function RecDashboard() {
  const [show, setShow] = useState(false);
  const [selectedSimulations, setSelectedSimulations] = useState([]);

  const fileInputRef = useRef(null);
  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const [availableEpisodes, setAvailableEpisodes] = useState({});

  const [selectedSimulationGraph, setSelectedSimulationGraph] = useState({});
  const [selectedSimulationEquipment, setSelectedSimulationEquipment] = useState({});

  const handleOpen = () => setShow(true);
  const handleSimulationSelection = (simulations) => {
    setSelectedSimulations(simulations);
  };

  const handleGraphSelection = (simulation, graphData) => {
    setSelectedSimulationGraph(prev => ({
      ...prev,
      [simulation]: graphData,
    }));
  };

  const handleEquipmentSelection = (simulation, equipmentData) => {
    setSelectedSimulationEquipment(prev => ({
      ...prev,
      [simulation]: equipmentData,
    }));
  };

  // Files and parsed folder data
  const [simulationFolders, setSimulationFolders] = useState([]);
  const [parsedSimulations, setParsedSimulations] = useState({});
  const [fileMapByFolder, setFileMapByFolder] = useState({});

  //Reads the selected folder information and stores it
  const handleFolderUpload = async (event) => {
    const files = Array.from(event.target.files);
    const folderNames = new Set();

    // Step 1: Group files by folder name (Simulation_1, Simulation_2, etc.)
    const simulations = {};

    files.forEach(file => {
      const pathParts = file.webkitRelativePath.split('/');
      const folderName = pathParts[1];
      const fileName = pathParts[2];

      folderNames.add(folderName);

      if (!simulations[folderName]) {
        simulations[folderName] = {};
      }

      simulations[folderName][fileName] = file;
    });

    setSimulationFolders([...folderNames].sort());
    setFileMapByFolder(simulations);
  };

  useEffect(() => {
    if (!selectedSimulations.length || Object.keys(fileMapByFolder).length === 0) return;

    setParsedSimulations((prevParsed) => {
      const updatedParsed = { ...prevParsed };
      const episodesBySim = {};
      let totalFiles = 0;
      let parsedFiles = 0;

      selectedSimulations.forEach((folderName) => {
        if (updatedParsed[folderName]) return;

        const fileMap = fileMapByFolder[folderName];
        if (!fileMap) return;

        updatedParsed[folderName] = {};
        episodesBySim[folderName] = new Set();

        const dataFiles = Object.entries(fileMap).filter(
          ([fileName]) => !/kpi(s)?/i.test(fileName)
        );

        totalFiles += dataFiles.length;

        dataFiles.forEach(([fileName, file]) => {
          const cleanedFileName = fileName
            .replace("exported_data_", "")
            .replace(/\.[^/.]+$/, "");

          // Extract episode name like `ep0`, `ep1`, etc.
          const episodeMatch = cleanedFileName.match(/_?(ep\d+)/i);
          if (episodeMatch) {
            episodesBySim[folderName].add(episodeMatch[1]);
          }

          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              updatedParsed[folderName][cleanedFileName] = results.data;
              parsedFiles++;

              if (parsedFiles === totalFiles) {
                const episodesObj = {};
                for (const sim in episodesBySim) {
                  episodesObj[sim] = Array.from(episodesBySim[sim]).sort();
                }
                setAvailableEpisodes(episodesObj);
                setParsedSimulations(updatedParsed);
              }
            },
            error: (error) => {
              console.error(`❌ Error parsing ${file.name}:`, error);
              parsedFiles++;
              if (parsedFiles === totalFiles) {
                setParsedSimulations(updatedParsed);
              }
            }
          });
        });
      });

      return prevParsed;
    });
  }, [selectedSimulations, fileMapByFolder]);


  const [selectedEpisode, setSelectedEpisode] = useState({}); // per simulation

  const handleEpisodeChange = (simulation, episode) => {
    setSelectedEpisode((prev) => ({
      ...prev,
      [simulation]: episode,
    }));

    // Reset graph and equipment selections
    setSelectedSimulationGraph((prev) => ({
      ...prev,
      [simulation]: null,
    }));
    setSelectedSimulationEquipment((prev) => ({
      ...prev,
      [simulation]: null,
    }));
  };

  return (
    <Container fluid>
      <Row>
        <Col>
          {/* Hidden File Input */}
          <input
            type="file"
            webkitdirectory="true"
            multiple
            onChange={handleFolderUpload}
            ref={fileInputRef}
            style={{ display: "none" }}
            aria-label="Upload simulation data"
          />

          <Button
            className="d-flex align-items-center"
            variant="secondary"
            onClick={handleUploadClick}
          >
            <FaUpload style={{ marginRight: "10px" }} />
            Upload Simulations
          </Button>
        </Col>

        {simulationFolders.length > 0 && (
          <Col className="d-flex flex-row-reverse">
            <Button variant="primary" onClick={handleOpen}>Select Simulations</Button>
          </Col>
        )}
      </Row>

      <SelectSimulationModal
        onSelectionChange={handleSimulationSelection}
        show={show} setShow={setShow} simulationList={simulationFolders}
      />

      {/* Load tabs only if there are selected simulations */}
      {selectedSimulations.length > 0 && (
        <Tabs defaultActiveKey={selectedSimulations.sort()[0]} id="simulation-tabs" className="mt-3 mb-3">
          {selectedSimulations.sort().map((simulation, index) => (
            <Tab eventKey={simulation} title={simulation} key={index}>
              <Row>
                <Col>
                  {availableEpisodes[simulation] && availableEpisodes[simulation].length > 1 && (
                    <Form.Group controlId={`episodeSelect-${simulation}`} className="mb-2 w-25">
                      <Form.Label>Select Episode</Form.Label>
                      <Form.Control
                        as="select"
                        value={selectedEpisode[simulation] || availableEpisodes[simulation][0]}
                        onChange={(e) => handleEpisodeChange(simulation, e.target.value)}
                      >
                        {availableEpisodes[simulation].map((ep) => (
                          <option key={ep} value={ep}>
                            {`Episode ${ep.replace(/ep/i, "")}`}
                          </option>
                        ))}
                      </Form.Control>
                    </Form.Group>
                  )}
                </Col>
              </Row>
              <Row>
                <Col lg="3">
                  {parsedSimulations[simulation] && (
                    <DynamicTreeList
                      folderData={
                        Object.fromEntries(
                          Object.entries(parsedSimulations[simulation]).filter(([key]) =>
                            key.includes(selectedEpisode[simulation] || availableEpisodes[simulation]?.[0])
                          )
                        )
                      }
                      selectedEpisode={selectedEpisode[simulation] || availableEpisodes[simulation][0]}
                      setSelectedGraph={(graphData) => handleGraphSelection(simulation, graphData)}
                      setSelectedEquipment={(equipmentData) => handleEquipmentSelection(simulation, equipmentData)}
                    />
                  )}
                </Col>
                <Col lg="9">
                  {/* Render selected graph */}
                  {selectedSimulationGraph[simulation] && selectedSimulationGraph[simulation].data && (
                    <Card>
                      <CardBody>
                        {selectedSimulationGraph[simulation].title.includes("Production") && (
                          <CardProduction data={selectedSimulationGraph[simulation].data} title={selectedSimulationGraph[simulation].title} />
                        )}
                        {selectedSimulationGraph[simulation].title.includes("Consumption") && (
                          <CardConsumption data={selectedSimulationGraph[simulation].data} title={selectedSimulationGraph[simulation].title} />
                        )}
                      </CardBody>
                    </Card>
                  )}
                  {/* Render selected equipment */}
                  {selectedSimulationEquipment[simulation] && (
                    <Card>
                      <CardBody>
                        {selectedSimulationEquipment[simulation].title.includes("Electric Vehicle") && (
                          <CardEV data={selectedSimulationEquipment[simulation].data} title={selectedSimulationEquipment[simulation].title} />
                        )}
                        {selectedSimulationEquipment[simulation].title.includes("Charger") && (
                          <CardCharger data={selectedSimulationEquipment[simulation].data} title={selectedSimulationEquipment[simulation].title} />
                        )}
                        {selectedSimulationEquipment[simulation].title.includes("Battery") && (
                          <CardBattery data={selectedSimulationEquipment[simulation].data} title={selectedSimulationEquipment[simulation].title} />
                        )}
                        {selectedSimulationEquipment[simulation].title.includes("Pv") && (
                          <CardPV data={selectedSimulationEquipment[simulation].data} title={selectedSimulationEquipment[simulation].title} />
                        )}
                        {selectedSimulationEquipment[simulation].title.includes("Pricing") && (
                          <CardPricing data={selectedSimulationEquipment[simulation].data} title={selectedSimulationEquipment[simulation].title} />
                        )}
                      </CardBody>
                    </Card>
                  )}
                </Col>
              </Row>
            </Tab>
          ))}
        </Tabs>
      )}
    </Container>
  );
}

const DynamicTreeList = ({ folderData, selectedEpisode, setSelectedGraph, setSelectedEquipment }) => {
  const [openBuildings, setOpenBuildings] = useState({});
  const [openEVs, setOpenEVs] = useState(false);
  const [openPricing, setOpenPricing] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const stripEpisode = (key) => key.replace(/_ep\d+$/i, '');

  const toggleSection = (id) => {
    setOpenBuildings((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleEVsSection = () => setOpenEVs((prev) => !prev);
  const togglePricingSection = () => setOpenPricing((prev) => !prev);

  const handleProductionClick = (fullKey) => {
    setSelectedItem(`${fullKey}_production`);
    setSelectedGraph({ title: `${formatLabel(stripEpisode(fullKey))} Production`, data: folderData[fullKey] });
  };

  const handleConsumptionClick = (fullKey) => {
    setSelectedItem(`${fullKey}_consumption`);
    setSelectedGraph({ title: `${formatLabel(stripEpisode(fullKey))} Consumption`, data: folderData[fullKey] });
  };

  const handleChargerClick = (chargerKey) => {
    const match = stripEpisode(chargerKey).match(/^building_(\d+)_charger_\d+_(\d+)$/);
    setSelectedItem(`${chargerKey}_charger_info`);
    setSelectedEquipment({ title: `Building ${match[1]} - Charger ${match[2]} Data`, data: folderData[chargerKey] });
  };

  const handleBatteryClick = (batteryKey) => {
    const match = stripEpisode(batteryKey).match(/^building_(\d+)_battery/);
    setSelectedItem(`${batteryKey}_battery_info`);
    setSelectedEquipment({ title: `Building ${match[1]} - Battery Data`, data: folderData[batteryKey] });
  };

  const handleEVClick = (evKey) => {
    setSelectedItem(`${evKey}_ev_info`);
    setSelectedEquipment({ title: `${formatLabel(stripEpisode(evKey))} Data`, data: folderData[evKey] });
  };

  const handlePricingClick = (pricingKey) => {
    setSelectedItem(`pricing_info`);
    setSelectedEquipment({ title: `Pricing Info`, data: folderData[pricingKey] });
  };

  const formatLabel = (label) =>
    label.replace(/_/g, " ").replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

  const buildingGroups = {};
  const evsGroup = [];
  let pricingKey = null;

  Object.keys(folderData).forEach((fullKey) => {
    const key = fullKey.toLowerCase();
    const baseKey = stripEpisode(key);

    const chargerMatch = baseKey.match(/^building_(\d+)_charger_\d+_(\d+)$/);
    const batteryMatch = baseKey.match(/^building_(\d+)_battery/);
    const isBuilding = baseKey.startsWith("building_") && !chargerMatch && !batteryMatch;
    const isEV = baseKey.includes("electric_vehicle");

    // Chargers/Batteries grouped under parent building
    if (chargerMatch || batteryMatch) {
      const buildingKey = `building_${(chargerMatch || batteryMatch)[1]}`;
      if (!buildingGroups[buildingKey]) {
        buildingGroups[buildingKey] = { chargers: [], batteries: [] };
      }

      const category = chargerMatch ? "chargers" : "batteries";
      buildingGroups[buildingKey][category].push(fullKey);
    } else if (isBuilding) {
      if (!buildingGroups[baseKey]) {
        buildingGroups[baseKey] = { chargers: [], batteries: [] };
      }
    }

    if (isEV) {
      evsGroup.push(fullKey);
    }

    if (key.startsWith("pricing") && !pricingKey) {
      pricingKey = fullKey;
    }
  });

  const sortedBuildings = [...new Set(Object.keys(buildingGroups))].sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || "0", 10);
    const numB = parseInt(b.match(/\d+/)?.[0] || "0", 10);
    return numA - numB;
  });

  return (
    <ListGroup as="div" variant="flush" className="border border-1" style={{ maxHeight: "875px", overflowY: "auto", overflowX: "hidden" }}>
      {sortedBuildings.map((building) => (
        <React.Fragment key={building}>
          <ListGroup.Item action onClick={() => toggleSection(building)} aria-expanded={openBuildings[building] || false}
            className="d-flex align-items-center" style={{ fontWeight: "bold", backgroundColor: "#e9ecef" }}>
            <FaBuilding style={{ marginRight: "8px" }} />
            {formatLabel(building)}
          </ListGroup.Item>
          <Collapse in={openBuildings[building]}>
            <div style={{ marginLeft: "1rem" }}>
              <ListGroup.Item action onClick={() => handleProductionClick(building + "_" + selectedEpisode)} active={selectedItem === `${building + "_" + selectedEpisode}_production`}>
                <FaIndustry style={{ marginRight: "8px" }} />
                Production
              </ListGroup.Item>
              <ListGroup.Item action onClick={() => handleConsumptionClick(building + "_" + selectedEpisode)} active={selectedItem === `${building + "_" + selectedEpisode}_consumption`}>
                <FaPlug style={{ marginRight: "8px" }} />
                Consumption
              </ListGroup.Item>

              {/* Chargers */}
              {buildingGroups[building].chargers.length > 0 && (
                <>
                  <ListGroup.Item style={{ fontWeight: "bold", backgroundColor: "#e9ecef" }}>
                    <FaPlug style={{ marginRight: "8px" }} />
                    Chargers
                  </ListGroup.Item>
                  {buildingGroups[building].chargers.sort().map((charger, index) => (
                    <ListGroup.Item key={charger} action onClick={() => handleChargerClick(charger)} active={selectedItem === `${charger}_charger_info`}
                      className="d-flex align-items-center" style={{ marginLeft: "1rem" }}>
                      <FaPlug style={{ marginRight: "8px" }} />
                      Charger {index + 1}
                    </ListGroup.Item>
                  ))}
                </>
              )}

              {/* Batteries */}
              {buildingGroups[building].batteries.length > 0 && (
                <>
                  <ListGroup.Item style={{ fontWeight: "bold", backgroundColor: "#e9ecef" }}>
                    <FaBatteryFull style={{ marginRight: "8px" }} />
                    Batteries
                  </ListGroup.Item>
                  {buildingGroups[building].batteries.sort().map((battery, index) => (
                    <ListGroup.Item key={battery} action onClick={() => handleBatteryClick(battery)} active={selectedItem === `${battery}_battery_info`}
                      className="d-flex align-items-center" style={{ marginLeft: "1rem" }}>
                      <FaBatteryFull style={{ marginRight: "8px" }} />
                      Battery {index + 1}
                    </ListGroup.Item>
                  ))}
                </>
              )}
            </div>
          </Collapse>
        </React.Fragment>
      ))}

      {/* EVs Section */}
      {evsGroup.length > 0 && (
        <React.Fragment>
          <ListGroup.Item
            className="d-flex align-items-center"
            style={{ fontWeight: "bold", backgroundColor: "#e9ecef" }}
            action onClick={toggleEVsSection}
            aria-expanded={openEVs}>
            <FaBolt style={{ marginRight: "8px" }} />
            EVs
          </ListGroup.Item>
          <Collapse in={openEVs}>
            <div style={{ marginLeft: "1rem" }}>
              {evsGroup.sort().map((ev) => (
                <ListGroup.Item key={ev} action onClick={() => handleEVClick(ev)}
                  active={selectedItem === `${ev}_ev_info`}>
                  <FaBolt style={{ marginRight: "8px" }} />
                  {formatLabel(stripEpisode(ev))}
                </ListGroup.Item>
              ))}
            </div>
          </Collapse>
        </React.Fragment>
      )}

      {/* Pricing Section */}
      {pricingKey && folderData[pricingKey]?.length > 0 && (
        <React.Fragment>
          <ListGroup.Item
            className="d-flex align-items-center"
            style={{ fontWeight: "bold", backgroundColor: "#e9ecef" }}
            action onClick={togglePricingSection}
            aria-expanded={openPricing}>
            <FaMoneyBill style={{ marginRight: "8px" }} />
            Pricing
          </ListGroup.Item>
          <Collapse in={openPricing}>
            <div style={{ marginLeft: "1rem" }}>
              <ListGroup.Item key={"pricing"} action onClick={() => handlePricingClick(pricingKey)}
                active={selectedItem === `pricing_info`}>
                <FaMoneyBill style={{ marginRight: "8px" }} />
                Pricing Data
              </ListGroup.Item>
            </div>
          </Collapse>
        </React.Fragment>
      )}
    </ListGroup>
  );
};

export default RecDashboard;
