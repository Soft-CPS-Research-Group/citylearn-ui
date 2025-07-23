import React, { useState } from "react";
import { Button, Row, Col, Form, Modal } from "react-bootstrap";

const CreateSimulationModal = props => {
    const { show, onClose } = props;
    const [validated, setValidated] = useState(false);

    const handleSubmit = (event) => {
        const form = event.currentTarget;
        if (form.checkValidity() === false) {
            event.preventDefault();
            event.stopPropagation();
        }

        setValidated(true);
    };

    return (
        <Modal show={show} onHide={onClose} backdrop="static" keyboard={false} size="lg">
            <Modal.Header className="py-0 d-flex align-items-center">
                <Modal.Title>Create Simulation</Modal.Title>
                <Button variant="danger" type="button" size="xs" onClick={onClose}>
                    <i className="fa fa-times"></i>
                </Button>
            </Modal.Header>
            <Modal.Body className="pt-0">
                <Row>
                    <Col>
                        <Form validated={validated} onSubmit={handleSubmit}>
                            <Form.Group className="mb-3" controlId="exampleForm.ControlInput1">
                                <Form.Label>Email address</Form.Label>
                                <Form.Control type="text" />
                            </Form.Group>
                            <Form.Group className="mb-3" controlId="exampleForm.ControlTextarea1">
                                <Form.Label>Example textarea</Form.Label>
                                <Form.Control as="textarea" rows={3} />
                            </Form.Group>
                            <div className="d-flex flex-row-reverse">
                                <Button variant="primary text-primary" onClick={onClose} disabled={validated == false}>Save</Button>
                            </div>
                        </Form>
                    </Col>
                </Row>
            </Modal.Body>
        </Modal>
    );
}

export default CreateSimulationModal;
