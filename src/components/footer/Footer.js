/*!

=========================================================
* Light Bootstrap Dashboard React - v2.0.1
=========================================================

* Product Page: https://www.creative-tim.com/product/light-bootstrap-dashboard-react
* Copyright 2022 Creative Tim (https://www.creative-tim.com)
* Licensed under MIT (https://github.com/creativetimofficial/light-bootstrap-dashboard-react/blob/master/LICENSE.md)

* Coded by Creative Tim

=========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

*/
import React, { Component } from "react";
import { Container } from "react-bootstrap";

class Footer extends Component {
  render() {
    return (
      <footer className="footer px-0 px-lg-3">
        <Container fluid>
          <div className="d-flex align-items-center justify-content-between gap-4">
            <div className="d-flex align-items-center gap-4">
              <a href="https://www2.isep.ipp.pt/softcps/" target="_blank" rel="noopener noreferrer">
                <img src="/logos/softCPS.png" alt="SoftCPS Logo" style={{ height: '40px', objectFit: 'contain' }} />
              </a>
              <a href="https://opeva.eu/" target="_blank" rel="noopener noreferrer">
                <img src="/logos/logoopeva.jpg" alt="Opeva Logo" style={{ height: '40px', objectFit: 'contain' }} />
              </a>
            </div>

            <div>
              <p className="copyright text-center">
                © {new Date().getFullYear()}{" "}
                <a target="_blank" href="http://www.citylearn.net/index.html">CityLearn</a>
              </p>
            </div>
          </div>

        </Container>
      </footer>
    );
  }
}

export default Footer;
