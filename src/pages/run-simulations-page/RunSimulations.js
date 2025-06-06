import React, { useState, useRef, useEffect } from "react";
import {
    Button,
    Container,
    Row,
    Col,
    Card
} from "react-bootstrap";
import { ToastContainer, toast } from 'react-toastify';
import { FaPlay, FaUpload } from "react-icons/fa";

function RunSimulations() {
    const [schemaInfo, setSchemaInfo] = useState("");

    const [file, setFile] = useState("");
    const [availableFiles, setAvailableFiles] = useState([]);

    const [targetContainer, setTargetContainer] = useState("");
    const [availableHosts, setAvailableHosts] = useState([]);

    const fileInputRef = useRef(null);

    const [fileName, setFileName] = useState("");
    const handleFileName = async (e) => {
        const file = e.target.value;
        setFileName(file);
    };

    const handleSchemaUpload = async (event) => {
        const file = event.target.files[0];

        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const jsonData = JSON.parse(e.target.result);
                    setSchemaInfo(JSON.stringify(jsonData, null, 4));
                } catch (error) {
                    console.log("error");
                }
            };
            reader.readAsText(file);
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current.click();
    };

    useEffect(() => {
        fetchHosts();
        fetchFiles();
    }, []);

    const fetchHosts = async () => {
        try {
            const res = await fetch("hosts");
            const json = await res.json();
            if (json.available_hosts) {
                setAvailableHosts(json.available_hosts);
                setTargetContainer(json.available_hosts[0]?.host || "");
            }
        } catch (err) {
            console.error("Fetch error:", err);
        }
    };

    const fetchFiles = async () => {
        try {
            const res = await fetch("experiment-configs");
            const json = await res.json();
            if (json) {
                setAvailableFiles(json);
                setFile(json[0] || "");
            }
        } catch (err) {
            console.error("Fetch error:", err);
        }
    };

    const handleFileChange = (e) => {
        setFile(e.target.value);
    }

    const handleTargetChange = (e) => {
        setTargetContainer(e.target.value);
    }

    const handleRunSimulation = async () => {
        try {
            const jsonOutput = {
                config_path: file,
                target_host: targetContainer,
            };

            console.log(jsonOutput)

            const response = await fetch("run-simulation", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(jsonOutput)
            });

            if (response.ok) {
                toast.success('Simulation started successfully!', {
                    position: "top-right",
                    autoClose: 5000,
                    hideProgressBar: false
                });
            } else {
                toast.error('Error starting simulation!', {
                    position: "top-right",
                    autoClose: 5000,
                    hideProgressBar: false
                });
            }
        } catch (error) {
            toast.error('Error starting simulation!', {
                position: "top-right",
                autoClose: 5000,
                hideProgressBar: false
            });
        }
    };

    return (
        <>
            <Container fluid>
                <div className="d-flex justify-content-end gap-2">
                    {/* Hidden File Input */}
                    {/* <input
                        type="file"
                        accept=".json"
                        onChange={handleSchemaUpload}
                        ref={fileInputRef}
                        style={{ display: "none" }}
                    />

                    <Button
                        className="d-flex align-items-center"
                        variant="secondary"
                        onClick={handleUploadClick}
                    >
                        <FaUpload style={{ marginRight: "10px" }} />
                        Upload Schema
                    </Button> */}

                    <Button className="d-flex align-items-center" variant="primary" onClick={handleRunSimulation}>
                        <FaPlay style={{ marginRight: "10px" }} />
                        Run Simulation
                    </Button>
                    <ToastContainer />
                </div>

                <>
                    <Row className="mt-3">
                        <Col>
                            <Card.Title>File Name:</Card.Title>
                            <select value={file} onChange={handleFileChange} className="w-25"
                                style={{ padding: "5px 10px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "5px", width: "100%" }}
                                aria-label="File Name">
                                {availableFiles.map((file, index) => (
                                    <option key={index} value={file}>
                                        {file}
                                    </option>
                                ))}
                            </select>
                        </Col>
                    </Row>
                    <Row className="mt-3">
                        <Col>
                            <Card.Title>Target Container:</Card.Title>
                            <select value={targetContainer} onChange={handleTargetChange} className="w-25"
                                style={{ padding: "5px 10px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "5px", width: "100%" }}
                                aria-label="Target Container">
                                {availableHosts.map((host, index) => (
                                    <option key={index} value={host.name}>
                                        {host.name}
                                    </option>
                                ))}
                            </select>
                        </Col>
                    </Row>
                </>
            </Container>
        </>
    );
}

export default RunSimulations;
