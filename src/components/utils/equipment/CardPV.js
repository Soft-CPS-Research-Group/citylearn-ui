import React, { useState } from 'react';

//USAR ESTA LIBRARY
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function CardPV({ data, title }) {
    const [visibleSeries, setVisibleSeries] = useState({
        pv: true,
        uv: true,
        amt: true,
    });

    const handleCheckboxChange = (seriesKey) => {
        setVisibleSeries((prevState) => ({
            ...prevState,
            [seriesKey]: !prevState[seriesKey],
        }));
    };

    return (
        <>
            <h5>{title}</h5>
            <div className='d-flex align-items-center' style={{ marginBottom: '10px' }}>
                {/* Array of series keys and labels */}
                {['pv', 'uv', 'amt'].map((key) => (
                    <label key={key} className='d-flex align-items-center' style={{ marginLeft: key !== 'pv' ? '10px' : '0' }}>
                        <input
                            type="checkbox"
                            checked={visibleSeries[key]}
                            onChange={() => handleCheckboxChange(key)}
                        />
                        <span style={{ marginLeft: '5px' }}>Show {key.toUpperCase()}</span>
                    </label>
                ))}
            </div>
            <ResponsiveContainer width={"100%"} height={300}>
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {visibleSeries.pv && (
                        <Bar dataKey="pv" stackId="a" fill="#8884d8" />
                    )}
                    {visibleSeries.uv && (
                        <Bar dataKey="uv" stackId="a" fill="#82ca9d" />
                    )}
                    {visibleSeries.amt && (
                        <Bar dataKey="amt" stackId="a" fill="#ff7300" />
                    )}
                </BarChart>
            </ResponsiveContainer>
        </>
    );
}

export default CardPV;