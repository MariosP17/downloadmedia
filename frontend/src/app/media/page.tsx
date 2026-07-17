"use client";

import { useEffect, useState,useRef } from "react";
import { toast } from "react-hot-toast";
import FileTreeItem from "../components/FileTreeItem";
import { AnimatedNumber } from "../components/AnimatedNumber";

const parseSizeToBytes = (value: string) => {
  const match = value.trim().match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i);
  if (!match) return 0;

  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount)) return 0;

  const unit = match[2].toUpperCase();
  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
  };

  return amount * (multipliers[unit] ?? 0);
};

export default function MediaExplorerPage() {
  const [rootItems, setRootItems] = useState<{ name: string; size: string; numberOfItems: number, numberOfFolders: number }[]>([]);
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [usageStats, setUsageStats] = useState<{ total: string; used: string; usedStremio: string }>({ total: "0 B", used: "0 B", usedStremio: "0 B" });
  const activeRefreshRef = useRef<{ [path: string]: () => Promise<void> }>({});

  useEffect(() => {
    fetchUsageStats();
  }, []);
  
  const fetchUsageStats = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:7000/getUsageStats`);
      if (!res.ok) throw new Error("Failed to fetch usage stats");
      const data = await res.json();
      setUsageStats(data);
    } catch (error) {
      console.error("Error fetching usage stats:", error);
    }
  };
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
        toast.error("Failed to load root media items.");
      } finally {
        setLoading(false);
      }
    }
  };

  const refreshLibraries = async (e: React.MouseEvent<HTMLButtonElement>) => {
    try{
      e.preventDefault(); // Prevent the default action of the click event
      e.stopPropagation(); // Prevent the click from propagating to the parent div
      const res = await fetch(`http://${window.location.hostname}:7000/refreshLibraries`)
      if (!res.ok) throw new Error("Failed to refresh libraries");
      toast.success("Libraries refreshed successfully!");
    } catch (error) {
      console.error("Error refreshing libraries:", error);
      toast.error("Failed to refresh libraries.");
    }
  };

  const usagePercent = usageStats ? (() => {
    const totalBytes = parseSizeToBytes(usageStats.total);
    const usedBytes = parseSizeToBytes(usageStats.used);
    if (!totalBytes) return 0;
    return Math.max(0, Math.min(100, (usedBytes / totalBytes) * 100));
  })() : 0;

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6 sm:p-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-100 mb-6 tracking-tight">
          File Browser
        </h1>
        <div className="flex items-end justify-between z-50 text-zinc-100 pb-4">
          <button
            onClick={(e) => refreshLibraries(e)}
            className="text-zinc-100 text-xs hover:text-white focus:outline-none cursor-pointer flex items-center gap-2 font-semibold transition-colors bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-lg shadow-md h-10 flex-shrink-0"
          >
            <img
              src="refresh-libraries.svg"
              alt="Refresh Libraries"
              className="w-5 h-5 object-contain flex-shrink-0"
            />
            Refresh Libraries
          </button>
          <div className="flex items-center gap-3">
            {usageStats ? (
              <div className="flex items-center gap-3 rounded-xl py-2">
                <div className="flex flex-col text-left">
                  <span className="text-xs text-zinc-400"><AnimatedNumber value={Number(usageStats.used.split(' ')[0] || 0)} />{usageStats.used.split(' ')[1] || ''} /<span className="text-white"><AnimatedNumber value={Number(usageStats.total.split(' ')[0] || 0)} /> {usageStats.total.split(' ')[1] || ''}</span></span>
                </div>
                <div className="relative h-16 w-16">
                  <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
                    <circle
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="text-zinc-800"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${usagePercent} ${100 - usagePercent}`}
                      className="text-green-500 transition-all duration-700 ease-out"
                      style={{ strokeDasharray: `${usagePercent} 100` }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
                    <span className="text-[11px] text-zinc-400">
                      <AnimatedNumber value={Number(usagePercent)} />%
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div />
            )}
          </div>
        </div>
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
            <div className="sm:pl-6 border-l-2 border-zinc-800 sm:ml-5 ml-2 mt-2 space-y-1">
              {rootItems.length === 0 && !loading ? (
                <div className="text-sm text-zinc-500 py-2 italic pl-2">No accessible files found in root</div>
              ) : (
                rootItems.map(({ name, size, numberOfItems, numberOfFolders }) => (
                  <FileTreeItem
                    key={name}
                    name={name}
                    size={size}
                    numberOfItems={numberOfItems}
                    numberOfFolders={numberOfFolders}
                    currentPath=""
                    refreshStats={fetchUsageStats}
                    activeRefreshRef={activeRefreshRef}
                    onRefreshParent={async () => {
                      setLoading(true);
                      try {
                        const res = await fetch(`http://${window.location.hostname}:7000/getItems?folder=`);
                        if (!res.ok) throw new Error("Failed to refresh root files");
                        
                        const data = await res.json();
                        setRootItems(data.items || []);
                      } catch (error) {
                        console.error("Error refreshing root media:", error);
                        toast.error("Failed to refresh root media items.");
                      } finally {
                        setLoading(false);
                      }
                    }}
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