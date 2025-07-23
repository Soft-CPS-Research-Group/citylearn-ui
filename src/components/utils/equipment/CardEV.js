import React, { useState } from 'react';
import {
    ComposedChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import DateRangeSlider from "../components/DateRangeSlider";
import { Row, Col, Button } from "react-bootstrap";

function CardEV({ data, title }) {
    const updatedData = data.map((item) => ({
        ...item,
        'Time Step': item['timestamp'],
        timestamp: new Date(item['timestamp']).getTime(),
        'electric_vehicle_estimated_soc_arrival': item['electric_vehicle_estimated_soc_arrival'] === "-0.1" ? null : Number(item['electric_vehicle_estimated_soc_arrival']),
        'electric_vehicle_required_soc_departure': item['electric_vehicle_required_soc_departure'] === "-0.1" ? null : Number(item['electric_vehicle_required_soc_departure']),
        'electric_vehicle_soc': item['electric_vehicle_soc'] === "-1.0" ? null : Number(item['electric_vehicle_soc']),
    }));

    const minTimestamp = updatedData[0]?.timestamp || 0;
    const maxTimestamp = updatedData[updatedData.length - 1]?.timestamp || 0;

    const baseIntervalMinutes = updatedData.length > 1
        ? Math.round((updatedData[1].timestamp - updatedData[0].timestamp) / (60 * 1000))
        : 1;

    const pointsPerDay = Math.floor((24 * 60) / baseIntervalMinutes);
    const defaultDataPoints = pointsPerDay * 10;
    const defaultFilterEnd = updatedData[defaultDataPoints]?.timestamp || maxTimestamp;
    const [sliderValues, setSliderValues] = useState([minTimestamp, defaultFilterEnd]);

    const [timeInterval, setTimeInterval] = useState(baseIntervalMinutes);
    const [intervalInput, setIntervalInput] = useState(baseIntervalMinutes);

    const handleSliderChange = (values) => {
        setSliderValues(values);
    };

    const handleApplyInterval = () => {
        const clamped = Math.max(baseIntervalMinutes, Math.min(60, intervalInput));
        setTimeInterval(clamped);
    };

    const filteredData = updatedData.filter(
        (item) => item.timestamp >= sliderValues[0] && item.timestamp <= sliderValues[1]
    );

    const aggregateEVData = (data, intervalMinutes) => {
        if (!data.length) return [];

        const result = [];
        let groupStart = data[0].timestamp;
        let tempGroup = [];

        for (const item of data) {
            if (item.timestamp - groupStart < intervalMinutes * 60 * 1000) {
                tempGroup.push(item);
            } else {
                const avg = (key) =>
                    tempGroup.filter(i => i[key] !== null && i[key] !== undefined).length
                        ? tempGroup.reduce((sum, i) => sum + Number(i[key] || 0), 0) /
                          tempGroup.filter(i => i[key] !== null && i[key] !== undefined).length
                        : null;

                result.push({
                    timestamp: groupStart,
                    'Time Step': tempGroup[0]['Time Step'],
                    'electric_vehicle_estimated_soc_arrival': avg('electric_vehicle_estimated_soc_arrival'),
                    'electric_vehicle_required_soc_departure': avg('electric_vehicle_required_soc_departure'),
                    'electric_vehicle_soc': avg('electric_vehicle_soc'),
                });

                groupStart = item.timestamp;
                tempGroup = [item];
            }
        }

        if (tempGroup.length > 0) {
            const avg = (key) =>
                tempGroup.filter(i => i[key] !== null && i[key] !== undefined).length
                    ? tempGroup.reduce((sum, i) => sum + Number(i[key] || 0), 0) /
                      tempGroup.filter(i => i[key] !== null && i[key] !== undefined).length
                    : null;

            result.push({
                timestamp: groupStart,
                'Time Step': tempGroup[0]['Time Step'],
                'electric_vehicle_estimated_soc_arrival': avg('electric_vehicle_estimated_soc_arrival'),
                'electric_vehicle_required_soc_departure': avg('electric_vehicle_required_soc_departure'),
                'electric_vehicle_soc': avg('electric_vehicle_soc'),
            });
        }

        return result;
    };

    const aggregatedData = aggregateEVData(filteredData, timeInterval);

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

    const xAxisTicks = getMidnightTicks(aggregatedData, timeInterval);

    const [visibleSeries, setVisibleSeries] = useState({
        'electric_vehicle_estimated_soc_arrival': true,
        'electric_vehicle_required_soc_departure': true,
        'electric_vehicle_soc': true
    });

    const handleCheckboxChange = (seriesKey) => {
        setVisibleSeries((prevState) => ({
            ...prevState,
            [seriesKey]: !prevState[seriesKey],
        }));
    };

    const formatYAxis = (tick) => tick * 100;

    return (
        <>
            <div className='d-flex justify-content-between align-items-center'>
                <span className="mb-3">{title}</span>
                <div>
                    <label>
                        <span title={`Base interval from data: ${baseIntervalMinutes} minute(s)`}>
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
                            style={{ width: "80px", marginLeft: "5px", marginRight: "10px" }}
                        />
                    </label>
                    <Button
                        className="p-2"
                        variant="secondary"
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

            <div style={{ marginBottom: '10px' }}>
                <Row>
                    {Object.keys(visibleSeries).map((key) => (
                        <Col key={key}>
                            <label className='d-flex align-items-center'>
                                <input
                                    type="checkbox"
                                    checked={visibleSeries[key]}
                                    onChange={() => handleCheckboxChange(key)}
                                />
                                <span style={{ marginLeft: '5px' }}>Show {key.toUpperCase()}</span>
                            </label>
                        </Col>
                    ))}
                </Row>
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={aggregatedData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="Time Step"
                        ticks={xAxisTicks}
                        angle={-8}
                        tickFormatter={(tick) => tick.slice(0, 10)}
                    />
                    <YAxis
                        tickFormatter={formatYAxis}
                        label={{ value: '%', angle: -90, position: 'insideLeft' }}
                        domain={[0, 1]}
                    />
                    <Tooltip
                        labelFormatter={(label) => {
                            const date = new Date(label);
                            return date.toLocaleString("en-US", {
                                month: "short",
                                day: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                            });
                        }}
                        formatter={(value, name) => [`${(value * 100).toFixed(1)} %`, `${name}`]}
                    />
                    <Legend />
                    {visibleSeries['electric_vehicle_estimated_soc_arrival'] && (
                        <Line type="monotone" dataKey="electric_vehicle_estimated_soc_arrival" stroke="#8884d8" />
                    )}
                    {visibleSeries['electric_vehicle_required_soc_departure'] && (
                        <Line type="monotone" dataKey="electric_vehicle_required_soc_departure" stroke="#82ca9d" />
                    )}
                    {visibleSeries['electric_vehicle_soc'] && (
                        <Line type="monotone" dataKey="electric_vehicle_soc" stroke="#ff7300" />
                    )}
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

export default CardEV;
