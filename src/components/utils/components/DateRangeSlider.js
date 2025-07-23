import React from "react";
import Slider from "rc-slider";
import "rc-slider/assets/index.css";
import dayjs from "dayjs";

const DateRangeSlider = ({ minTimestamp, maxTimestamp, sliderValues, onSliderChange }) => {
  const formatDate = (timestamp) => dayjs(timestamp).format("YYYY-MM-DD");

  const step = 24 * 60 * 60 * 1000; // Step = 1 day

  return (
    <div className="p-6 w-600px mx-auto">
      <div className="d-flex justify-content-between mb-2">
        <span>Start: {formatDate(sliderValues[0])}</span>
        <span>End: {formatDate(sliderValues[1])}</span>
      </div>

      <Slider
        range
        min={minTimestamp}
        max={maxTimestamp}
        value={sliderValues}
        onChange={onSliderChange}
        step={step}
      />
    </div>
  );
};

export default DateRangeSlider;
