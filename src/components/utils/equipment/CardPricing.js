import React, { useState } from 'react';
import {
    ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Row, Col, Button } from "react-bootstrap";
import DateRangeSlider from "../components/DateRangeSlider";

// Helper functions to adjust timestamps to full days
const floorToMidnightUTC = (timestamp) => {
    const date = new Date(timestamp);

    if (date.getHours() != 0 || date.getMinutes() != 0 || date.getSeconds() != 0) {
        date.setUTCHours(0, 0, 0, 0);
    }

    return date.getTime();
};

const ceilToEndOfDayUTC = (timestamp) => {
    const date = new Date(timestamp);

    if (date.getHours() != 23 || date.getMinutes() != 59 || date.getSeconds() != 59) {
        date.setUTCHours(23, 59, 59, 999);
    }

    return date.getTime();
};

function CardPricing({ data, title }) {
    const updatedData = data.map((item) => ({
        ...item,
        'Time Step': item['timestamp'],
        timestamp: new Date(item['timestamp']).getTime()
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

    const handleApplyInterval = () => {
        const clamped = Math.max(baseIntervalMinutes, Math.min(60, intervalInput));
        setTimeInterval(clamped);
    };

    const handleSliderChange = (values) => setSliderValues(values);

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
        const keysToAverage = [
            'electricity_pricing-$/kWh',
            'electricity_pricing_predicted_1-$/kWh',
            'electricity_pricing_predicted_2-$/kWh',
            'electricity_pricing_predicted_3-$/kWh'
        ];

        const aggregated = { timestamp, 'Time Step': group[0]['Time Step'] };

        keysToAverage.forEach(key => {
            const values = group.map(item => parseFloat(item[key])).filter(val => !isNaN(val));
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

    const [visibleSeries, setVisibleSeries] = useState({
        'electricity_pricing-$/kWh': true,
        'electricity_pricing_predicted_1-$/kWh': true,
        'electricity_pricing_predicted_2-$/kWh': true,
        'electricity_pricing_predicted_3-$/kWh': true
    });

    const handleCheckboxChange = (seriesKey) => {
        setVisibleSeries((prev) => ({
            ...prev,
            [seriesKey]: !prev[seriesKey]
        }));
    };

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

            <div className='d-flex align-items-center mb-2'>
                <Row style={{ width: "100%" }}>
                    {Object.keys(visibleSeries).map((key) => (
                        <Col key={key} md={4}>
                            <label className='d-flex align-items-center'>
                                <input
                                    type="checkbox"
                                    checked={visibleSeries[key]}
                                    onChange={() => handleCheckboxChange(key)}
                                />
                                <span className='ml-2'>Show {key}</span>
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
                        tickFormatter={(tick) => tick.slice(0, 10)}
                        angle={-8}
                    />
                    <YAxis label={{ value: '$/kWh', angle: -90, position: 'insideLeft' }} />
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
                        formatter={(value, name) => [`${value?.toFixed(3)}`, name]}
                    />
                    <Legend />

                    {visibleSeries['electricity_pricing-$/kWh'] && (
                        <Line type="monotone" dataKey="electricity_pricing-$/kWh" stroke="#FF7300" dot={false} />
                    )}
                    {visibleSeries['electricity_pricing_predicted_1-$/kWh'] && (
                        <Line type="monotone" dataKey="electricity_pricing_predicted_1-$/kWh" stroke="#8884d8" dot={false} />
                    )}
                    {visibleSeries['electricity_pricing_predicted_2-$/kWh'] && (
                        <Line type="monotone" dataKey="electricity_pricing_predicted_2-$/kWh" stroke="#82ca9d" dot={false} />
                    )}
                    {visibleSeries['electricity_pricing_predicted_3-$/kWh'] && (
                        <Line type="monotone" dataKey="electricity_pricing_predicted_3-$/kWh" stroke="#0088FE" dot={false} />
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

export default CardPricing;
