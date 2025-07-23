import React, { useState, useEffect, useRef } from "react";
import {
  Button,
  Card,
  Table,
  Container,
  Row,
  Col,
  Tab,
  Tabs,
  Modal,
  Form
} from "react-bootstrap";
import { FaUpload } from "react-icons/fa";
import SelectSimulationModal from "../../components/shared/SelectSimulationModal";
import Papa from "papaparse";

function KPIs() {
  const [show, setShow] = useState(false); // Initial modal state
  const [showCompare, setShowCompare] = useState(false); // Initial modal state

  const fileInputRef = useRef(null);
  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  // Select simulation and simulation to compare from in case of comparison flow
  const [selectedSimulations, setSelectedSimulations] = useState([]);
  const [simulationToCompareFrom, setSimulationToCompareFrom] = useState(null);
  const [simulationToCompareTo, setSimulationToCompareTo] = useState(null);

  const [comparisonSimulation, setComparisonSimulation] = useState({});

  // Files and parsed folder data
  const [simulationFolders, setSimulationFolders] = useState([]);
  const [parsedSimulations, setParsedSimulations] = useState({});
  const [fileMapByFolder, setFileMapByFolder] = useState({});

  const handleOpen = () => setShow(true); // Opens modal to select simulations
  const handleCompare = (simulation) => { // Opens modal to compare simulations
    setSimulationToCompareFrom(simulation);
    setShowCompare(true);
  }

  // Updates the selected simulations
  const handleSimulationSelection = (simulations) => {
    setSelectedSimulations(simulations);
  };

  // Generates a new tab with comparison result
  const handleSimulationComparison = (simulation) => {
    setSimulationToCompareTo(simulation);
    const X = parsedSimulations[simulation]; // New selected sim
    const Y = parsedSimulations[simulationToCompareFrom]; // Reference sim

    if (!X || !Y || X.length !== Y.length) {
      console.warn("Simulations are not comparable");
      return;
    }

    const result = X.map((xRow, index) => {
      const yRow = Y[index];

      // If the KPIs don't match, we skip this row
      if (xRow.KPI !== yRow.KPI) {
        console.warn(`Mismatched KPI at index ${index}: ${xRow.KPI} vs ${yRow.KPI}`);
        return { KPI: xRow.KPI, error: "KPI mismatch" };
      }

      const diffRow = { KPI: xRow.KPI };

      Object.keys(xRow).forEach((key) => {
        if (key === "KPI") return;

        const valX = parseFloat(xRow[key]);
        const valY = parseFloat(yRow[key]);

        // Only compute if both values are valid numbers
        if (!isNaN(valX) && !isNaN(valY)) {
          diffRow[key] = (valX - valY).toFixed(3);
        } else {
          diffRow[key] = ""; // Keep empty if non-numeric (like in your example)
        }
      });

      return diffRow;
    });

    setComparisonSimulation(result);
  };

  const handleFolderUpload = async (event) => {
    const files = Array.from(event.target.files);
    const folderNames = new Set();
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
    const parseSimulationInfo = async () => {
      const newParsed = {};

      for (const simulation of selectedSimulations) {
        // Skip if already parsed
        if (parsedSimulations[simulation]) continue;

        console.log(fileMapByFolder[simulation]?.['exported_kpis.csv'])
        const kpisFile = fileMapByFolder[simulation]?.['exported_kpis.csv'];
        if (kpisFile) {
          const text = await kpisFile.text();
          const result = Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
          });
          newParsed[simulation] = result.data;
        }
      }

      if (Object.keys(newParsed).length > 0) {
        setParsedSimulations(prev => ({ ...prev, ...newParsed }));
      }
      console.log(parsedSimulations)
    };

    if (selectedSimulations.length > 0 && Object.keys(fileMapByFolder).length > 0) {
      parseSimulationInfo();
    }
  }, [selectedSimulations, fileMapByFolder, parsedSimulations]);

  return (
    <>
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
          show={show} setShow={setShow}
          simulationList={simulationFolders}
        />

        {selectedSimulations.length > 0 &&
          <>
            <SelectSimulationCompareModal
              onSelectionChange={(sim) => handleSimulationComparison(sim)}
              showCompare={showCompare} setShowCompare={setShowCompare}
              simulationList={selectedSimulations.filter(s => s !== simulationToCompareFrom)}
            />

            <Tabs defaultActiveKey={selectedSimulations.sort()[0]} id="simulation-tabs" className="mt-3 mb-3">
              {selectedSimulations.sort().map((simulation, index) => (

                <Tab eventKey={simulation} title={simulation} key={index}>
                  <Row>
                    <Col md="12">
                      <Card className="card-plain table-plain-bg">
                        <Card.Header>
                          <div className="d-flex justify-content-between">
                            <div>
                              <Card.Title>KPIs for {simulation}</Card.Title>
                              <p className="card-category">Parsed from exported_kpis.csv</p>
                            </div>
                            {selectedSimulations.length > 1 && <Button variant="primary" onClick={() => handleCompare(simulation)}>Compare</Button>}
                          </div>

                        </Card.Header>
                        <Card.Body className="table-full-width table-responsive px-0">
                          <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                            <Table className="table-hover">
                              <thead>
                                <tr>
                                  {parsedSimulations[simulation] &&
                                    Object.keys(parsedSimulations[simulation][0])
                                      .sort((a, b) => {
                                        const getNum = str => parseInt(str.match(/\d+/)?.[0] ?? '0');
                                        return getNum(a) - getNum(b);
                                      })
                                      .map((header, idx) => (
                                        <th key={idx} className="border-0">{header}</th>
                                      ))}
                                </tr>
                              </thead>
                              <tbody>
                                {parsedSimulations[simulation] &&
                                  (() => {
                                    return parsedSimulations[simulation].map((row, rowIndex) => (
                                      <tr key={rowIndex}>
                                        {Object.keys(parsedSimulations[simulation][0])
                                          .sort((a, b) => {
                                            const getNum = str => parseInt(str.match(/\d+/)?.[0] ?? '0');
                                            return getNum(a) - getNum(b);
                                          }).map((key, colIndex) => (
                                            <td key={colIndex}>{row[key]}</td>
                                          ))}
                                      </tr>
                                    ));
                                  })()}
                              </tbody>
                            </Table>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                </Tab>

              ))}

              {comparisonSimulation.length > 0 &&
                <Tab eventKey={"comparison"} title={"Comparison"} key={"comparison"}>
                  <Row>
                    <Col md="12">
                      <Card className="card-plain table-plain-bg">
                        <Card.Header>
                          <div className="d-flex justify-content-between">
                            <div>
                              <Card.Title>Comparison between {simulationToCompareFrom} and {simulationToCompareTo}</Card.Title>
                            </div>
                          </div>

                        </Card.Header>
                        <Card.Body className="table-full-width table-responsive px-0">
                          <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                            <Table className="table-hover">
                              <thead>
                                <tr>
                                  {comparisonSimulation &&
                                    Object.keys(comparisonSimulation[0])
                                      .sort((a, b) => {
                                        const getNum = str => parseInt(str.match(/\d+/)?.[0] ?? '0');
                                        return getNum(a) - getNum(b);
                                      })
                                      .map((header, idx) => (
                                        <th key={idx} className="border-0">{header}</th>
                                      ))}
                                </tr>
                              </thead>
                              <tbody>
                                {comparisonSimulation &&
                                  (() => {
                                    const getColor = (value) => {
                                      const num = parseFloat(value);
                                      if (isNaN(num)) return "inherit";
                                      return num > 0 ? "green" : num < 0 ? "red" : "inherit";
                                    };

                                    return comparisonSimulation.map((row, rowIndex) => (
                                      <tr key={rowIndex}>
                                        {Object.keys(comparisonSimulation[0])
                                          .sort((a, b) => {
                                            const getNum = str => parseInt(str.match(/\d+/)?.[0] ?? '0');
                                            return getNum(a) - getNum(b);
                                          }).map((key, colIndex) => (
                                            <td key={colIndex} style={{
                                              color: getColor(row[key]),
                                              fontWeight: ['red', 'green'].includes(getColor(row[key])) ? 'bold' : 'normal'
                                            }}>
                                              {row[key]}
                                            </td>
                                          ))}
                                      </tr>
                                    ));
                                  })()
                                }
                              </tbody>
                            </Table>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                </Tab>
              }
            </Tabs>
          </>
        }

      </Container>
    </>
  );
}


function SelectSimulationCompareModal({ onSelectionChange, showCompare, setShowCompare, simulationList }) {
  const [selectedSimulation, setSelectedSimulation] = useState(null);

  useEffect(() => {
    if (showCompare) {
      setSelectedSimulation(null);
    }
  }, [showCompare]);

  const handleClose = () => setShowCompare(false);

  const handleSimulationChange = (simulation) => {
    setSelectedSimulation(simulation);
  };

  const handleConfirm = () => {
    onSelectionChange(selectedSimulation);
    handleClose();
  };

  return (
    <Modal show={showCompare} onHide={handleClose} backdrop="static" keyboard={false} size="md">
      <Modal.Header className="py-0 d-flex align-items-center">
        <Modal.Title>Select Simulation</Modal.Title>
        <Button variant="danger" type="button" size="xs" onClick={handleClose}>
          <i className="fa fa-times"></i>
        </Button>
      </Modal.Header>
      <Modal.Body className="pt-0">
        <Row>
          {simulationList.map((sim) => (
            <Col lg="4" sm="6" key={sim}>
              <Form.Check className="mb-1 pl-0">
                <Form.Check.Label>
                  <Form.Check.Input
                    type="radio"
                    name="simulationSelection"
                    checked={selectedSimulation === sim}
                    onChange={() => handleSimulationChange(sim)}
                  />
                  {sim}
                </Form.Check.Label>
              </Form.Check>
            </Col>
          ))}
        </Row>
      </Modal.Body>
      <div className="d-flex flex-row-reverse" style={{ padding: "25px", paddingTop: "15px", paddingBottom: "15px" }}>
        <Button
          variant="primary text-primary"
          onClick={handleConfirm}
          disabled={!selectedSimulation}
        >
          Confirm
        </Button>
      </div>
    </Modal>
  );
}


export default KPIs;
