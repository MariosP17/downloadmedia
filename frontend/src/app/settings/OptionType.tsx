"use client";
type OptionType = {
  typeKey: string;
  value: any;
  type: "<boolean>" | "<string>" | "<number>";
  onChange?: (newValue: any) => void;
}
import { OptionsNames } from "../../../Props";

export default function OptionType({typeKey, value, type, onChange}: OptionType) {
  const handleToggle = (newValue: boolean) => {
    if (onChange) {
      onChange(newValue);
    }
  };

  if (type === "<boolean>") {
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
  }
  else{
    return (
        <p>Unknown type</p>
    );
  }
}