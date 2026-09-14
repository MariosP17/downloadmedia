"use client";
type OptionType = {
  typeKey: string;
  value: any;
  type: "<boolean>" | "<string>" | "<number>";
  min?: number;
  max?: number;
  onChange?: (newValue: any) => void;
}
import { OptionsNames } from "../../../Props";

export default function OptionType({typeKey, value, type,min,max, onChange}: OptionType) {
  const handleToggle = (newValue: boolean) => {
    if (onChange) {
      onChange(newValue);
    }
  };

  switch (type) {
    case "<boolean>":
    return (
      <div className="mb-4 flex justify-between">
        <p>{OptionsNames[typeKey]}</p>
        <label className="switch">
          {/* Hidden checkbox that holds the actual state */}
          <input 
            type="checkbox" 
            checked={value}
            onChange={(event) => handleToggle(event.target.checked)}
          />
          {/* The visual slider track and ball */}
          <span className="slider-options"></span>
        </label>
      </div>
    );
    case "<number>":
      return (
        <div className="mb-4 flex justify-between">
          <p>{OptionsNames[typeKey]}</p>
          <input 
            type="number" 
            value={value}
            onChange={(event) => onChange && onChange(Number(event.target.value))}
            min={min}
            max={max}
            className="border rounded px-2 py-1"
          />
        </div>
      );
    default:
      return (
          <p>Unknown type</p>
      );
  }
}