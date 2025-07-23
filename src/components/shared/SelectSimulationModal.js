import React, { useState } from "react";
import { Button, Row, Col, Form, Modal } from "react-bootstrap";
import CreateSimulationModal from "./CreateSimulationModal";

function SelectSimulationModal({ onSelectionChange, show, setShow, simulationList }) {
    const [showCreate, setShowCreate] = useState(false); // Initial modal state
    const [selectedSimulations, setSelectedSimulations] = useState([]); // Selected simulations list

    const handleOpenCreate = () => setShowCreate(true); // Opens simulation creation modal

    const handleClose = () => setShow(false); // Close selection modal
    const handleCloseCreate = () => setShowCreate(false); // Close creation modal

    const handleSimulationChange = (simulation) => {
        setSelectedSimulations((prevSelected) => {
            let newSelected;
            if (prevSelected.includes(simulation)) {
                newSelected = prevSelected.filter((item) => item !== simulation); // Unselect
            } else {
                newSelected = [...prevSelected, simulation]; // Select
            }
            return newSelected;
        });
    };

    const handleConfirm = () => {
        onSelectionChange(selectedSimulations);
        handleClose();
    };

    return (
        <Modal show={show} onHide={handleClose} backdrop="static" keyboard={false} size="md">
            <Modal.Header className="py-0 d-flex align-items-center">
                <Modal.Title>Select Simulations</Modal.Title>
                <Button variant="danger" type="button" size="xs" onClick={handleClose}>
                    <i className="fa fa-times"></i>
                </Button>
            </Modal.Header>
            <Modal.Body className="pt-0">
                <Row>
                    <SimulationList simulationList={simulationList} onSimulationChange={handleSimulationChange} selectedSimulations={selectedSimulations} />
                </Row>
                <CreateSimulationModal show={showCreate} onClose={handleCloseCreate} />
            </Modal.Body>
            <Modal.Footer className="d-flex flex-row-reverse">
                <Button variant="primary text-primary" onClick={handleConfirm}
                    disabled={selectedSimulations.length == 0}>Confirm</Button>
            </Modal.Footer>
        </Modal>
    );
}

function SimulationList({ simulationList, onSimulationChange, selectedSimulations }) {
    const simulations = [];

    simulationList.forEach((sim) => {
        simulations.push(
            <Col lg="4" sm="6" key={sim}>
                <Form.Check className="mb-1 pl-0">
                    <Form.Check.Label>
                        <Form.Check.Input
                            type="checkbox"
                            checked={selectedSimulations.includes(sim)}
                            onChange={() => onSimulationChange(sim)}
                        />
                        <span className="form-check-sign"></span>
                        {sim}
                    </Form.Check.Label>
                </Form.Check>
            </Col>
        );
    });
    return simulations;
}

export default SelectSimulationModal;
