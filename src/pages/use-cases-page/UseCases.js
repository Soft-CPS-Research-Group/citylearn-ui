import CardConsumptionDB from "components/utils/building/CardConsumptionDB";
import CardProductionDB from "components/utils/building/CardProductionDB";
import CardChargerDB from "components/utils/equipment/CardChargerDB";
import React, { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Tab,
  Tabs,
  Spinner,
  ListGroup,
  Collapse,
  Card,
  CardBody
} from "react-bootstrap";
import { FaIndustry, FaPlug, FaBuilding, FaChargingStation } from "react-icons/fa";

function UseCases() {
  const [activeTab, setActiveTab] = useState("0");
  const [ichargingData, setIchargingData] = useState(null);
  const [livingLabData, setLivingLabData] = useState(null);
  const [loading, setLoading] = useState(false);

  const [selectedHeadquartersGraph, setSelectedHeadquartersGraph] = useState({});
  const [selectedSimulationGraph, setSelectedSimulationGraph] = useState({});
  const [selectedGraph, setSelectedGraph] = useState(null);

  const fetchData = async (tabKey) => {
    setLoading(true);
    try {
      if (tabKey === "0" && !ichargingData) {
        const res = await fetch("/real-time-data/i-charging_headquarters?minutes=8600");
        const json = await res.json();
        setIchargingData(json);
        console.log(json)
      } else if (tabKey === "1" && !livingLabData) {
        const res = await fetch("/real-time-data/living_lab?minutes=8600");
        const json = await res.json();
        setLivingLabData(json);
        console.log(json)
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab]);

  return (
    <Container fluid>
      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-3"
      >
        <Tab eventKey={"0"} title={"ICharging Headquarters"}>
          <Row>
            <Col>
              {loading ?
                <Spinner animation="border" /> :
                <>
                  {ichargingData &&
                    <Row>
                      <Col md={3}>
                        <IChargingTreeList
                          data={ichargingData}
                          setSelectedGraph={setSelectedGraph} />
                      </Col>

                      <Col md={9}>
                        {/* Render selected graph */}
                        {selectedHeadquartersGraph && selectedHeadquartersGraph.data && (
                          <Card>
                            <CardBody>
                              AAAAA
                            </CardBody>
                          </Card>
                        )}

                        {selectedGraph && selectedGraph.title?.startsWith("Charger") && (
                          <Card>
                            <CardBody>
                              <CardChargerDB data={selectedGraph.data} title={selectedGraph.title} />
                            </CardBody>
                          </Card>
                        )}
                      </Col>
                    </Row>
                  }
                </>
              }
            </Col>
          </Row>
        </Tab>
        <Tab eventKey={"1"} title={"Living Lab"}>
          <Row>
            <Col>
              {loading ?
                <Spinner animation="border" /> :
                <>
                  {livingLabData &&
                    <Row>
                      <Col md={3}>
                        <DynamicTreeList
                          folderData={livingLabData}
                          setSelectedGraph={(graphData) => setSelectedSimulationGraph(graphData)} />
                      </Col>

                      <Col md={9}>
                        {/* Render selected graph */}
                        {selectedSimulationGraph && selectedSimulationGraph.data && (
                          <Card>
                            <CardBody>
                              {selectedSimulationGraph.title.includes("Production") && (
                                <CardProductionDB data={selectedSimulationGraph.data} title={selectedSimulationGraph.title} />
                              )}
                              {selectedSimulationGraph.title.includes("Consumption") && (
                                <CardConsumptionDB data={selectedSimulationGraph.data} title={selectedSimulationGraph.title} />
                              )}
                            </CardBody>
                          </Card>
                        )}
                      </Col>
                    </Row>
                  }
                </>
              }
            </Col>
          </Row>
        </Tab>
      </Tabs>
    </Container>
  );
}

const DynamicTreeList = ({ folderData, setSelectedGraph }) => {
  const [openBuildings, setOpenBuildings] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);

  const toggleSection = (id) => {
    setOpenBuildings((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleProductionClick = (building) => {
    setSelectedItem(`${building}_production`);
    setSelectedGraph({ title: `${building} Production`, data: folderData[building] });
  };

  const handleConsumptionClick = (building) => {
    setSelectedItem(`${building}_consumption`);
    setSelectedGraph({ title: `${building} Consumption`, data: folderData[building] });
  };

  return (
    <ListGroup as="div" variant="flush" className="border border-1" style={{ maxHeight: "875px", overflowY: "auto", overflowX: "hidden" }}>

      {Object.keys(folderData).sort().map((building) => (
        <React.Fragment key={building}>
          <ListGroup.Item action onClick={() => toggleSection(building)} aria-expanded={openBuildings[building] || false}
            className="d-flex align-items-center" style={{ fontWeight: "bold", backgroundColor: "#e9ecef" }}>
            <FaBuilding style={{ marginRight: "8px" }} />
            {building}
          </ListGroup.Item>
          <Collapse in={openBuildings[building]}>
            <div style={{ marginLeft: "1rem" }}>
              <ListGroup.Item action onClick={() => handleProductionClick(building)} active={selectedItem === `${building}_production`}>
                <FaIndustry style={{ marginRight: "8px" }} />
                Production
              </ListGroup.Item>
              <ListGroup.Item action onClick={() => handleConsumptionClick(building)} active={selectedItem === `${building}_consumption`}>
                <FaPlug style={{ marginRight: "8px" }} />
                Consumption
              </ListGroup.Item>
            </div>
          </Collapse>
        </React.Fragment>
      ))}

    </ListGroup>
  );
};

// Aggregated charger data by charger
const aggregateChargerData = (headquartersData) => {
  const chargerMap = {};

  headquartersData.forEach((entry) => {
    const { timestamp, charging_sessions } = entry;

    if (!charging_sessions) return;

    charging_sessions.forEach((session) => {
      const chargerId = session["Charger Id"];
      if (!chargerMap[chargerId]) {
        chargerMap[chargerId] = [];
      }

      chargerMap[chargerId].push({
        timestamp,
        EAT: session.EAT ?? 0,
        EOT: session.EOT ?? 0,
        EsocA: session.EsocA ?? 0,
        EsocD: session.EsocD ?? 0,
        power: session.power ?? 0,
        soc: session.soc ?? 0,
      });
    });
  });

  let x = Object.keys(chargerMap).map((chargerId) => ({
    chargerId,
    history: chargerMap[chargerId],
  }));

  console.log(x);
  return x;
};

const IChargingTreeList = ({ data, setSelectedGraph }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [chargersOpen, setChargersOpen] = useState(false);

  if (!data || !data["i-charging headquarters"]) return null;

  const headquartersData = data["i-charging headquarters"];
  const aggregatedChargers = aggregateChargerData(headquartersData);

  const firstEntry = headquartersData[0];
  const chargerList = firstEntry?.charging_sessions?.map(session => session["Charger Id"]) || [];

  const handleSelect = (type) => {
    setSelectedItem(type);
    setSelectedGraph({ title: `ICharging ${type}`, data: headquartersData });
  };

  const handleChargerClick = (chargerId) => {
    setSelectedItem(chargerId);

    const chargerData = aggregatedChargers.find(c => c.chargerId === chargerId);

    setSelectedGraph({
      title: `Charger ${chargerId}`,
      data: chargerData?.history || [],
    });
  };

  return (
    <ListGroup as="div" variant="flush" className="border border-1" style={{ maxHeight: "875px", overflowY: "auto" }}>
      <ListGroup.Item
        action
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="d-flex align-items-center"
        style={{ fontWeight: "bold", backgroundColor: "#e9ecef" }}
      >
        <FaBuilding style={{ marginRight: "8px" }} />
        ICharging Headquarters
      </ListGroup.Item>

      <Collapse in={isOpen}>
        <div style={{ marginLeft: "1rem" }}>
          <ListGroup.Item
            action
            onClick={() => handleSelect("Production")}
            active={selectedItem === "Production"}
          >
            <FaIndustry style={{ marginRight: "8px" }} />
            Production
          </ListGroup.Item>

          <ListGroup.Item
            action
            onClick={() => handleSelect("Consumption")}
            active={selectedItem === "Consumption"}
          >
            <FaPlug style={{ marginRight: "8px" }} />
            Consumption
          </ListGroup.Item>

          <ListGroup.Item
            action
            onClick={() => setChargersOpen(!chargersOpen)}
            aria-expanded={chargersOpen}
            className="d-flex align-items-center"
            style={{ fontWeight: "bold", backgroundColor: "#e9ecef" }}
          >
            <FaChargingStation style={{ marginRight: "8px" }} />
            Chargers
          </ListGroup.Item>

          <Collapse in={chargersOpen}>
            <div style={{ marginLeft: "1rem" }}>
              {[...new Set(chargerList)].sort().map(chargerId => (
                <ListGroup.Item
                  key={chargerId}
                  action
                  onClick={() => handleChargerClick(chargerId)}
                  active={selectedItem === chargerId}
                >
                  <FaChargingStation style={{ marginRight: "8px" }} />
                  {chargerId}
                </ListGroup.Item>
              ))}
            </div>
          </Collapse>
        </div>
      </Collapse>
    </ListGroup>
  );
};

export default UseCases;