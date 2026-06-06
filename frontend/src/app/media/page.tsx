"use client";

import { useEffect, useState } from "react";
import FileTreeItem from "../components/FileTreeItem";

export default function MediaExplorerPage() {
  const [rootItems, setRootItems] = useState<string[]>([]);
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const toggleMediaFolder = async () => {
    const nextState = !isMediaOpen;
    setIsMediaOpen(nextState);

    if (nextState && !hasInitialized) {
      setLoading(true);
      try {
        const res = await fetch(`http://${window.location.hostname}:7000/getItems?folder=`);
        if (!res.ok) throw new Error("Failed to load root files");
        
        const data = await res.json();
        setRootItems(data.items || []);
        setHasInitialized(true);
      } catch (error) {
        console.error("Error loading root media:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6 sm:p-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-100 mb-6 tracking-tight">
          File Browser
        </h1>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-xl">
          {/* Main Collapsed Media Root Row */}
          <div
            onClick={toggleMediaFolder}
            className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-zinc-800 cursor-pointer transition-colors text-zinc-100 font-semibold"
          >
            <img
              src={isMediaOpen ? "/open-folder.png" : "/folder.png"}
              alt="Root Directory"
              className="w-6 h-6 object-contain flex-shrink-0"
            />
            <span className="text-base">media</span>
            {loading && <span className="text-xs text-zinc-500 font-normal animate-pulse">loading root assets...</span>}
          </div>

          {/* Root Items Display Render Layer */}
          {isMediaOpen && (
            <div className="pl-6 border-l-2 border-zinc-800 ml-5 mt-2 space-y-1">
              {rootItems.length === 0 && !loading ? (
                <div className="text-sm text-zinc-500 py-2 italic pl-2">No accessible files found in root</div>
              ) : (
                rootItems.map((itemName) => (
                  <FileTreeItem
                    key={itemName}
                    name={itemName}
                    currentPath=""
                  />
                ))
              )}
              {loading && (
                    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
                    <span className="loader"></span>
                    <span className="ml-4 text-lg">Loading...</span>
                    </div>
                )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}