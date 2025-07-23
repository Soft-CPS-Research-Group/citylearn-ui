import React, { useState } from 'react';
import {
    ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    ReferenceLine, Line
} from 'recharts';
import { Row, Col, Button } from "react-bootstrap";
import DateRangeSlider from "../components/DateRangeSlider";

// Helper functions to adjust timestamps to full days
const floorToMidnightUTC = (timestamp) => {
    const date = new Date(timestamp);

    if(date.getHours() != 0 || date.getMinutes() != 0 || date.getSeconds() != 0) {
        date.setUTCHours(0, 0, 0, 0);
    }

    return date.getTime();
};

const ceilToEndOfDayUTC = (timestamp) => {
    const date = new Date(timestamp);

    if(date.getHours() != 23 || date.getMinutes() != 59 || date.getSeconds() != 59) {
        date.setUTCHours(23, 59, 59, 999);
    }

    return date.getTime();
};

function CardCharger({ data, title }) {
    const updatedData = data.map((item) => ({
        ...item,
        'Time Step': item['timestamp'],
        timestamp: new Date(item['timestamp']).getTime(),
        'Charger Consumption-kWh': item['Charger Consumption-kWh'] === "-1.00" ? null : parseFloat(item['Charger Consumption-kWh']),
        'Charger Production-kWh': item['Charger Production-kWh'] === "-1.00" ? null : parseFloat(item['Charger Production-kWh']),
        'EV Estimated SOC Arrival-%': (item['EV Estimated SOC Arrival-%'] === "-1.00" || item['EV Estimated SOC Arrival-%'] === "-0.1")
            ? null : parseFloat(item['EV Estimated SOC Arrival-%']) * 100,
        'EV Required SOC Departure-%': (item['EV Required SOC Departure-%'] === "-1.00" || item['EV Required SOC Departure-%'] === "-0.1")
            ? null : parseFloat(item['EV Required SOC Departure-%']) * 100,
        'EV SOC-%': (item['EV SOC-%'] === "-1.00" || item['EV SOC-%'] === "-0.1")
            ? null : parseFloat(item['EV SOC-%']) * 100
    }));

    const minTimestamp = floorToMidnightUTC(updatedData[0]?.timestamp || 0);
    const maxTimestamp = ceilToEndOfDayUTC(updatedData[updatedData.length - 1]?.timestamp || 0);

    const baseIntervalMinutes = updatedData.length > 1
        ? Math.round((updatedData[1].timestamp - updatedData[0].timestamp) / (60 * 1000))
        : 1;

    const pointsPerDay = Math.floor((24 * 60) / baseIntervalMinutes);
    const defaultDataPoints = pointsPerDay * 10;
    const defaultFilterEnd = ceilToEndOfDayUTC(updatedData[defaultDataPoints]?.timestamp || maxTimestamp);

    const [sliderValues, setSliderValues] = useState([minTimestamp, defaultFilterEnd]);
    const [timeInterval, setTimeInterval] = useState(baseIntervalMinutes);
    const [intervalInput, setIntervalInput] = useState(baseIntervalMinutes);

    const handleSliderChange = (values) => setSliderValues(values);

    const handleApplyInterval = () => {
        const clamped = Math.max(baseIntervalMinutes, Math.min(60, intervalInput));
        setTimeInterval(clamped);
    };

    const filteredData = updatedData.filter(
        (item) => item.timestamp >= sliderValues[0] && item.timestamp <= sliderValues[1]
    );

    const aggregateData = (data, intervalMinutes) => {
        if (!data.length) return [];

        const result = [];
        let groupStart = data[0].timestamp;
        let tempGroup = [];

        for (const item of data) {
            if (item.timestamp - groupStart < intervalMinutes * 60 * 1000) {
                tempGroup.push(item);
            } else {
                result.push(aggregateGroup(groupStart, tempGroup));
                groupStart = item.timestamp;
                tempGroup = [item];
            }
        }

        if (tempGroup.length > 0) {
            result.push(aggregateGroup(groupStart, tempGroup));
        }

        return result;
    };

    const aggregateGroup = (timestamp, group) => {
        const sumKeys = ['Charger Consumption-kWh', 'Charger Production-kWh'];
        const avgKeys = ['EV Estimated SOC Arrival-%', 'EV Required SOC Departure-%', 'EV SOC-%'];

        const aggregated = { timestamp, 'Time Step': group[0]['Time Step'] };

        sumKeys.forEach(key => {
            const values = group.map(item => item[key]).filter(val => val !== null);
            aggregated[key] = values.length > 0
                ? values.reduce((sum, v) => sum + v, 0)
                : null;
        });

        avgKeys.forEach(key => {
            const values = group.map(item => item[key]).filter(val => val !== null);
            aggregated[key] = values.length > 0
                ? values.reduce((sum, v) => sum + v, 0) / values.length
                : null;
        });

        return aggregated;
    };

    const getMidnightTicks = (data, intervalMinutes) => {
        if (!data.length) return [];
        const seen = new Set();
        const ticks = [];

        for (const item of data) {
            const d = new Date(item.timestamp);
            const isNearMidnight = d.getUTCHours() === 0 && d.getUTCMinutes() < intervalMinutes;

            if (isNearMidnight) {
                const midnightUTC = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
                const tick = midnightUTC.toISOString().slice(0, 19);
                if (!seen.has(tick)) {
                    seen.add(tick);
                    ticks.push(tick);
                }
            }
        }

        return ticks;
    };

    const aggregatedData = aggregateData(filteredData, timeInterval);
    const xAxisTicks = getMidnightTicks(aggregatedData, timeInterval);

    const departureMarkers = filteredData
        .filter(item => item['EV Departure Time'] === "0")
        .map(item => ({
            timestep: item['Time Step'],
            EVName: item['EV Name']
        }));

    const arrivalMarkers = filteredData
        .filter(item => item['EV Arrival Time'] === "0")
        .map(item => ({
            timestep: item['Time Step'],
            EVName: item['EV Name']
        }));

    const formatEVName = (name) => {
        if (!name) return "Unknown EV";
        return name.replace("Electric_Vehicle_", "EV");
    };

    const [visibleSeries, setVisibleSeries] = useState({
        'Charger Consumption-kWh': true,
        'Charger Production-kWh': true,
        'EV Estimated SOC Arrival-%': true,
        'EV Required SOC Departure-%': true,
        'EV SOC-%': true
    });

    const handleCheckboxChange = (seriesKey) => {
        setVisibleSeries(prev => ({
            ...prev,
            [seriesKey]: !prev[seriesKey]
        }));
    };

    return (
        <>
            <div className="d-flex justify-content-between align-items-center">
                <span className="mb-3">{title}</span>

                <div>
                    <label>
                        <span title={`Base interval: ${baseIntervalMinutes} minute(s)`}>
                            Interval (minutes):
                        </span>
                        <input
                            type="number"
                            min={baseIntervalMinutes}
                            max={60}
                            value={intervalInput}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setIntervalInput(Number.isNaN(val) ? baseIntervalMinutes : val);
                            }}
                            style={{ width: "80px", margin: "0 10px" }}
                        />
                    </label>
                    <Button
                        variant="secondary"
                        className="p-2"
                        onClick={handleApplyInterval}
                        disabled={
                            intervalInput < baseIntervalMinutes ||
                            intervalInput > 60 ||
                            intervalInput === timeInterval
                        }
                    >
                        Apply
                    </Button>
                </div>
            </div>

            <Row className="my-2">
                {Object.keys(visibleSeries).map((key) => (
                    <Col key={key} md={4}>
                        <label className="d-flex align-items-center">
                            <input
                                type="checkbox"
                                checked={visibleSeries[key]}
                                onChange={() => handleCheckboxChange(key)}
                            />
                            <span className="ml-2">Show {key}</span>
                        </label>
                    </Col>
                ))}
            </Row>

            <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={aggregatedData} stackOffset="sign">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="Time Step"
                        ticks={xAxisTicks}
                        tickFormatter={(tick) => tick.slice(0, 10)}
                        angle={-8}
                    />
                    <YAxis label={{ value: 'kWh', angle: -90, position: 'insideLeft' }} />
                    <YAxis
                        yAxisId="right"
                        orientation="right"
                        label={{ value: 'SOC %', angle: -90, position: 'insideRight' }}
                        domain={[0, 100]}
                    />
                    <Tooltip
                        labelFormatter={(label) => {
                            const date = new Date(label);
                            const formattedDate = date.toLocaleString("en-US", {
                                month: "short",
                                day: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                            });

                            // Find matching arrival and departure EVs
                            const arrivedEVs = arrivalMarkers
                                .filter(marker => marker.timestep === label)
                                .map(marker => formatEVName(marker.EVName));

                            const departedEVs = departureMarkers
                                .filter(marker => marker.timestep === label)
                                .map(marker => formatEVName(marker.EVName));

                            // Create message if an EV arrives or departs
                            let evMessage = "";
                            if (arrivedEVs.length > 0) {
                                evMessage += `${arrivedEVs.join(", ")} Arrived`;
                            }
                            if (departedEVs.length > 0) {
                                evMessage += `${departedEVs.join(", ")} Departed`;
                            }

                            return (
                                <>
                                    <span>{formattedDate}</span>
                                    {evMessage && <span style={{ fontWeight: "bold", marginTop: "4px" }}><br/>{evMessage}</span>}
                                </>
                            );
                        }}
                        formatter={(value, name) => [`${value} ${name.includes('%') ? '%' : 'kWh'}`, name]}
                    />
                    <Legend />

                    {visibleSeries['Charger Consumption-kWh'] && (
                        <Bar dataKey="Charger Consumption-kWh" stackId="a" fill="#8884d8" barSize={10} />
                    )}
                    {visibleSeries['Charger Production-kWh'] && (
                        <Bar dataKey="Charger Production-kWh" stackId="a" fill="#82ca9d" />
                    )}
                    {visibleSeries['EV Estimated SOC Arrival-%'] && (
                        <Line yAxisId="right" type="monotone" dataKey="EV Estimated SOC Arrival-%" stroke="#0088FE" />
                    )}
                    {visibleSeries['EV Required SOC Departure-%'] && (
                        <Line yAxisId="right" type="monotone" dataKey="EV Required SOC Departure-%" stroke="#FF7300" />
                    )}
                    {visibleSeries['EV SOC-%'] && (
                        <Line yAxisId="right" type="monotone" dataKey="EV SOC-%" stroke="#112424" />
                    )}

                    {departureMarkers.map((marker, idx) => (
                        <ReferenceLine
                            key={"departure_" + idx}
                            x={marker.timestep}
                            stroke="red"
                            strokeDasharray="5 5"
                            label={{ value: formatEVName(marker.EVName), fill: "red", fontSize: 12, fontWeight: "bold" }}
                        />
                    ))}

                    {arrivalMarkers.map((marker, idx) => (
                        <ReferenceLine
                            key={"arrival_" + idx}
                            x={marker.timestep}
                            stroke="blue"
                            strokeDasharray="5 5"
                            label={{ value: formatEVName(marker.EVName), fill: "blue", fontSize: 12, fontWeight: "bold" }}
                        />
                    ))}
                </ComposedChart>
            </ResponsiveContainer>

            <DateRangeSlider
                minTimestamp={minTimestamp}
                maxTimestamp={maxTimestamp}
                sliderValues={sliderValues}
                onSliderChange={handleSliderChange}
            />
        </>
    );
}

export default CardCharger;
