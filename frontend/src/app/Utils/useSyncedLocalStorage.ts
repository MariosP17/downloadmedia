import { useState, useEffect } from "react";

export function useSyncedLocalStorage(key: string, initialFallback: string = "[]") {
  // Read initial data safely on mount
  const [value, setValue] = useState<string>(initialFallback);

  useEffect(() => {
    // 1. Get initial value once mounted on the client
    const saved = localStorage.getItem(key);
    if (saved) setValue(saved);

    // 2. Listen for changes made in OTHER tabs/windows
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        setValue(e.newValue || initialFallback);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [key, initialFallback]);

  // 3. Custom setter that alerts the CURRENT window instantly too
  const updateValue = (newValue: string) => {
    localStorage.setItem(key, newValue);
    setValue(newValue);
    window.dispatchEvent(new Event("storage")); 
  };

  return [value, updateValue] as const;
}