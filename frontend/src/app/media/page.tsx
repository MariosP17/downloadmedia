"use client";

import { useEffect, useState,useRef } from "react";
import { toast } from "react-hot-toast";
import FileTreeItem from "../components/FileTreeItem";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { getApiUrl } from "../Actions/RestApiConfig";

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
export type Config = {
  [key: string]: any;
};
export default function MediaExplorerPage() {
  const [rootItems, setRootItems] = useState<{ name: string; size: string; numberOfItems: number, numberOfFolders: number,path: string }[]>([]);
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [usageStats, setUsageStats] = useState<{ total: string; used: string; usedStremio: string }>({ total: "0 B", used: "0 B", usedStremio: "0 B" });
  const [config, setConfig] = useState<Config>({});
  const [options, setOptions] = useState<{ [key: string]: any }[]>([]);
  const activeRefreshRef = useRef<{ [path: string]: () => Promise<void> }>({});

  useEffect(() => {
    fetchUsageStats();
    fetchConfig();
    fetchOptions();
  }, []);
  
  const fetchUsageStats = async () => {
    try {
      const res = await fetch(`${await getApiUrl(window.location.hostname, window.location.protocol)}/getUsageStats`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed to fetch usage stats");
      const data = await res.json();
      setUsageStats(data);
    } catch (error) {
      console.error("Error fetching usage stats:", error);
      toast.error(`Failed to fetch usage stats. ${error}`);
    }
  };

  const fetchConfig = async () => {
    try {
      setLoadingConfig(true);
      const res = await fetch(`${await getApiUrl(window.location.hostname, window.location.protocol)}/getConfiguration`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed to fetch config");
      const data = await res.json();
      setConfig(data);
    } catch (error) {
      console.error("Error fetching config:", error);
      toast.error(`Failed to fetch config. ${error}`);
    }
    finally {
      setLoadingConfig(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const res = await fetch(`${await getApiUrl(window.location.hostname, window.location.protocol)}/getOptions`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed to fetch options");
      const data = await res.json();
      setOptions(data || []);
    } catch (error) {
      console.error("Error fetching options:", error);
      toast.error(`Failed to fetch options. ${error}`);
    }
  };

  const toggleMediaFolder = async () => {
    if (loading || loadingConfig) return; // Prevent toggling while loading
    const nextState = !isMediaOpen;
    setIsMediaOpen(nextState);

    if (nextState && !hasInitialized) {
      setLoading(true);
      try {
        const res1 = await fetch(`${await getApiUrl(window.location.hostname, window.location.protocol)}/getFolderInfo?folder=${config["MoviesFolder"]}`);
        if (!res1.ok) throw new Error((await res1.json()).error || "Failed to load root media");
        
        const data1 = await res1.json();
        const res2 = await fetch(`${await getApiUrl(window.location.hostname, window.location.protocol)}/getFolderInfo?folder=${config["TVShowsFolder"]}`);
        if (!res2.ok) throw new Error((await res2.json()).error || "Failed to load root media");
        
        const data2 = await res2.json();
        const data = [data1, data2];
        setRootItems(data || []);
        setHasInitialized(true);
      } catch (error) {
        console.error("Error loading root media:", error);
        toast.error(`Failed to load root media items. ${error}`);
      } finally {
        setLoading(false);
      }
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

        <div className="flex items-end justify-end z-50 text-zinc-100 pb-4">
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
            className={`flex items-center gap-3 py-2 px-3 rounded-lg ${loading || loadingConfig ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-zinc-800'} transition-colors text-zinc-100 font-semibold`}
          >
            <img
              src={isMediaOpen ? "/open-folder.png" : "/folder.png"}
              alt="Root Directory"
              className="w-6 h-6 object-contain flex-shrink-0"
            />
            <span className={`text-base ${loadingConfig ? 'text-zinc-500 animate-pulse' : 'text-zinc-100'}`}>{loadingConfig ? 'Loading...' : 'Libraries'}</span>
            {loading && <span className="text-xs text-zinc-500 font-normal animate-pulse">loading root assets...</span>}
          </div>

          {/* Root Items Display Render Layer */}
          {isMediaOpen && (
            <div className="sm:pl-6 border-l-2 border-zinc-800 sm:ml-5 ml-2 mt-2 space-y-1">
              {rootItems.length === 0 && !loading ? (
                <div className="text-sm text-zinc-500 py-2 italic pl-2">No accessible files found in root</div>
              ) : (
                rootItems.map(({ name, size, numberOfItems, numberOfFolders,path }) => (
                  <FileTreeItem
                    key={name}
                    name={name}
                    size={size}
                    numberOfItems={numberOfItems}
                    numberOfFolders={numberOfFolders}
                    opts={options}
                    config={config}
                    currentPath={path}
                    isRoot={true}
                    refreshStats={fetchUsageStats}
                    activeRefreshRef={activeRefreshRef}
                    onRefreshParent={async () => {
                      setLoading(true);
                      try {
                        const res1 = await fetch(`${await getApiUrl(window.location.hostname, window.location.protocol)}/getFolderInfo?folder=${config["MoviesFolder"]}`);
                        if (!res1.ok) throw new Error("Failed to refresh root files");
                        
                        const data1 = await res1.json();
                        const res2 = await fetch(`${await getApiUrl(window.location.hostname, window.location.protocol)}/getFolderInfo?folder=${config["TVShowsFolder"]}`);
                        if (!res2.ok) throw new Error("Failed to refresh root files");
                        
                        const data2 = await res2.json();
                        const data = [data1, data2];
                        setRootItems(data);
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