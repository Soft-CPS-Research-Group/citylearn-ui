import React, { useState } from 'react';
import {
    ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line
} from 'recharts';
import DateRangeSlider from "../components/DateRangeSlider";
import { Button } from "react-bootstrap";

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

function CardBattery({ data, title }) {
    const updatedData = data.map((item) => ({
        ...item,
        'Time Step': item['timestamp'],
        timestamp: new Date(item['timestamp']).getTime(),
        'Battery Soc-%': (item['Battery Soc-%'] === "-1.00" || item['Battery Soc-%'] === "-0.1")
            ? null : parseFloat(item['Battery Soc-%']) * 100
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
        const validSOC = group.filter(i => i['Battery Soc-%'] !== null).map(i => i['Battery Soc-%']);
        const avgSOC = validSOC.length ? validSOC.reduce((sum, i) => sum + i, 0) / validSOC.length : null;
        const totalDischarge = group.reduce((sum, i) => sum + Number(i['Battery (Dis)Charge-kWh'] || 0), 0);

        return {
            timestamp,
            'Time Step': group[0]['Time Step'],
            'Battery Soc-%': avgSOC,
            'Battery (Dis)Charge-kWh': totalDischarge,
        };
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
        'Battery (Dis)Charge-kWh': true,
        'Battery Soc-%': true
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
                {Object.keys(visibleSeries).map((key) => (
                    <label key={key} className='d-flex align-items-center mr-3'>
                        <input
                            type="checkbox"
                            checked={visibleSeries[key]}
                            onChange={() => handleCheckboxChange(key)}
                        />
                        <span className='ml-2'>Show {key}</span>
                    </label>
                ))}
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
                    <YAxis label={{ value: 'kWh', angle: -90, position: 'insideLeft' }} />
                    <YAxis
                        yAxisId="right"
                        orientation="right"
                        domain={[0, 100]}
                        label={{ value: 'SOC %', angle: -90, position: 'insideRight' }}
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
                        formatter={(value, name) => [
                            name.includes('%')
                                ? `${(value).toFixed(1)} %`
                                : `${value.toFixed(3)} kWh`,
                            name
                        ]}
                    />
                    <Legend />
                    {visibleSeries['Battery (Dis)Charge-kWh'] && (
                        <Bar dataKey="Battery (Dis)Charge-kWh" stackId="a" fill="#8884d8" />
                    )}
                    {visibleSeries['Battery Soc-%'] && (
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="Battery Soc-%"
                            stroke="#FF7300"
                            dot={false}
                        />
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

export default CardBattery;
