import React, { useState } from "react";
import {
    ResponsiveContainer,
    ComposedChart,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    Bar
} from "recharts";
import { Button } from "react-bootstrap";
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

function CardProduction({ data, title }) {
    const updatedData = data.map((item) => ({
        ...item,
        'Time Step': item['timestamp'],
        timestamp: new Date(item['timestamp']).getTime()
    }));

    const minTimestamp = floorToMidnightUTC(updatedData[0]?.timestamp) || 0;
    const maxTimestamp = ceilToEndOfDayUTC(updatedData[updatedData.length - 1]?.timestamp) || 0;

    // Calculate base interval for an input
    const baseIntervalMinutes = updatedData.length > 1
        ? Math.round((updatedData[1].timestamp - updatedData[0].timestamp) / (60 * 1000))
        : 1;

    const pointsPerDay = Math.floor((24 * 60) / baseIntervalMinutes);
    const defaultDataPoints = pointsPerDay * 10; // 10 days
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
                result.push({
                    timestamp: groupStart,
                    'Time Step': tempGroup[0]['Time Step'],
                    'Energy Production from PV-kWh': tempGroup.reduce((sum, i) => sum + Number(i['Energy Production from PV-kWh']), 0),
                    'Energy Production from EV-kWh': tempGroup.reduce((sum, i) => sum + Number(i['Energy Production from EV-kWh']), 0),
                });
                groupStart = item.timestamp;
                tempGroup = [item];
            }
        }

        if (tempGroup.length > 0) {
            result.push({
                timestamp: groupStart,
                'Time Step': tempGroup[0]['Time Step'],
                'Energy Production from PV-kWh': tempGroup.reduce((sum, i) => sum + Number(i['Energy Production from PV-kWh']), 0),
                'Energy Production from EV-kWh': tempGroup.reduce((sum, i) => sum + Number(i['Energy Production from EV-kWh']), 0),
            });
        }

        return result;
    };

    const aggregatedData = aggregateData(filteredData, timeInterval);

    const getMidnightTicks = (data, intervalMinutes) => {
        if (!data.length) return [];
        const seen = new Set();
        const ticks = [];
    
        for (const item of data) {
            const d = new Date(item.timestamp);
            const isNearMidnight = d.getUTCHours() === 0 && d.getUTCMinutes() < intervalMinutes;
    
            if (isNearMidnight) {
                const midnightUTC = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
                
                // Get the tick, and store it if it hasn't been added before
                const tick = midnightUTC.toISOString().slice(0,19); // Converts to ISO format string
                if (!seen.has(tick)) {
                    seen.add(tick);
                    ticks.push(tick);
                }
            }
        }
    
        return ticks;
    };

    const xAxisTicks = getMidnightTicks(aggregatedData, timeInterval);

    return (
        <>
            <div className='d-flex justify-content-between align-items-center'>
                <span className="mb-3">{title}</span>

                <div style={{ marginBottom: "1rem" }}>
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
                            style={{ width: "80px", marginRight: "10px", marginLeft: "5px" }}
                        />
                    </label>
                    <Button
                        className="p-2"
                        variant="secondary"
                        onClick={handleApplyInterval}
                        disabled={
                            intervalInput < baseIntervalMinutes ||
                            intervalInput > 60
                        }
                    >
                        Apply
                    </Button>
                </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={aggregatedData} stackOffset="sign">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="Time Step"
                        ticks={xAxisTicks}
                        tickFormatter={(tick) => tick.slice(0, 10)}
                        angle={-8}
                    />
                    <YAxis label={{ value: "kWh", angle: -90, position: "insideLeft" }} />
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
                        formatter={(value, name) => [`${value.toFixed(3)} kWh`, name]}
                    />
                    <Legend />
                    <Bar dataKey="Energy Production from PV-kWh" stackId="a" fill="#8884d8" />
                    <Bar dataKey="Energy Production From EV-kWh" stackId="a" fill="#82ca9d" />
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

export default CardProduction;
