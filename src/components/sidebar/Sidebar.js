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
import React, { useEffect, Component } from "react";
import { useLocation, NavLink } from "react-router-dom";

import { Nav } from "react-bootstrap";

function Sidebar({ color, image, routes }) {
  const location = useLocation();

  const activeRoute = (routeName) => {
    return location.pathname.indexOf(routeName) > -1 ? "active" : "";
  };

  // 💡 Set page title based on current route
  useEffect(() => {
    const currentRoute = routes.find((route) =>
      location.pathname.includes(route.layout + route.path)
    );

    if (currentRoute && currentRoute.name) {
      document.title = `CityLearn | ${currentRoute.name}`;
    } else {
      document.title = "CityLearn";
    }
  }, [location.pathname, routes]);

  // Group routes by userType
  const groupedRoutes = routes.reduce((acc, route) => {
    if (!acc[route.userType]) acc[route.userType] = [];
    acc[route.userType].push(route);
    return acc;
  }, {});

  return (
    <div className="sidebar" data-image={image} data-color={color}>
      <div
        className="sidebar-background"
        style={{
          backgroundImage: "url(" + image + ")"
        }}
      />
      <div className="sidebar-wrapper d-flex flex-column p-0">
        <div className="logo d-flex align-items-center">
          <a target="_blank" href="http://www.citylearn.net/index.html" className="text-white">
            <p>CityLearn</p>
          </a>
        </div>

        <Nav>
          {Object.entries(groupedRoutes).map(([userType, userRoutes], index) => (
            <React.Fragment key={index}>
              {userRoutes.map((prop, key) => {
                if (!prop.redirect) {
                  return (
                    <li
                      className={
                        prop.upgrade
                          ? "active active-pro"
                          : activeRoute(prop.layout + prop.path)
                      }
                      key={key}
                    >
                      <NavLink
                        to={prop.layout + prop.path}
                        className="nav-link"
                        activeClassName="active"
                      >
                        <i className={prop.icon} />
                        <p>{prop.name}</p>
                      </NavLink>
                    </li>
                  );
                }
                return null;
              })}
            </React.Fragment>
          ))}
        </Nav>

        <div className="mt-auto text-center">
          <a
            href="https://github.com/Soft-CPS-Research-Group"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white mb-3 btn"
            style={{ fontSize: '18px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            Check out our GitHub!
          </a>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
