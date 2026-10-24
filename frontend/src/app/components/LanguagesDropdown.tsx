"use client"

import { useState, useEffect } from "react";

type LanguagesDropdownProps = {
  value: string;
  onChange?: (newValue: string) => void;
};

export function LanguagesDropdown({ value, onChange }: LanguagesDropdownProps) {
  const [languages, setLanguages] = useState<{ name: string; code: string }[]>([]);

  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const res = await fetch(`http://${window.location.hostname}:7000/getLanguages`);
        const data = await res.json();
        if (data.success === false) throw new Error(data.message || "Failed to fetch languages");
        setLanguages(data.data || []);
      } catch (error) {
        console.error("Error fetching languages:", error);
      }
    };

    void fetchLanguages();
  }, []);

  return (
    <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange && onChange(e.target.value)}
      className="appearance-none bg-zinc-900 border border-zinc-700 hover:border-zinc-600 text-zinc-200 text-xs font-medium rounded-md pl-3 pr-8 py-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-zinc-500 focus:border-zinc-500 transition-colors [color-scheme:dark]"
    >
      <option value="">Select a language</option>
      {languages.map((language) => (
        <option key={language.code} value={language.code}>
          {language.name}
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
    
  );
}
