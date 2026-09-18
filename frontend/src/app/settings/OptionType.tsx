"use client";
type OptionType = {
  typeKey: string;
  value: any;
  type: "<boolean>" | "<string>" | "<number>" | "<dropdown>";
  min?: number;
  max?: number;
  onChange?: (newValue: any) => void;
  options?: { [key: string]: any }[];
}
import { OptionsNames } from "../../../Props";

export default function OptionType({typeKey, value, type,min,max, onChange, options}: OptionType) {
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
            className="border border-zinc-700 rounded px-2 py-1 max-w-20 focus:outline-none focus:ring-1 focus:ring-zinc-500 focus:border-zinc-500 transition-colors [color-scheme:dark]"
          />
        </div>
      );
    case "<dropdown>":
      return (
      <div className="mb-4 flex justify-between ">
        <label 
          htmlFor={`${typeKey}_dropdown`} 
        >
          {OptionsNames[typeKey]}
        </label>

        <div className="relative">
          <select 
            id={`${typeKey}_dropdown`}
            value={value}
            onChange={(event) => onChange && onChange(event.target.value)}
            className="appearance-none bg-zinc-900 border border-zinc-700 hover:border-zinc-600 text-zinc-200 text-xs font-medium rounded-md pl-3 pr-8 py-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-zinc-500 focus:border-zinc-500 transition-colors [color-scheme:dark]"
          >
            {options && options.map((option) => (
              <option 
                key={option.key} 
                value={option.key} 
                className="bg-zinc-900 text-zinc-200 py-1"
              >
                {option.value}
              </option>
            ))}
          </select>

          {/* Clean Custom SVG Arrow */}
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-zinc-400">
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path 
                fillRule="evenodd" 
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" 
                clipRule="evenodd" 
              />
            </svg>
          </div>
        </div>
      </div>
    );
    case "<string>":
      return (
        <div className="mb-4 flex justify-between">
          <p>{OptionsNames[typeKey]}</p>
          <input 
            type="text" 
            value={value}
            onChange={(event) => onChange && onChange(event.target.value)}
            className="border border-zinc-700 rounded px-2 py-1 max-w-100 focus:outline-none focus:ring-1 focus:ring-zinc-500 focus:border-zinc-500 transition-colors [color-scheme:dark]"
          />
        </div>
      );
    default:
      return (
          <p>Unknown type</p>
      );
  }
}