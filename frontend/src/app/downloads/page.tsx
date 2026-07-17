"use client";
import FallbackImage from "../components/fallbackimg";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "react-hot-toast";

// Define the shape of a single download item based on your API structure
type DownloadItem = {
  ttid: string;
  name?: string;       // Name of the movie or episode
  type?: "movie" | "series"; 
  progress: number;    // E.g., a number from 0 to 100
  status?: "downloading" | "completed" | "cancelled" | "paused";
  thumbnail?: string;
};

type ProgressStoreResponse = {
  [key: string]: DownloadItem;
};



export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<ProgressStoreResponse>({});
    const router = useRouter();
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const fetchProgress = async (lastFetch: boolean = false) => {
      try {
        setInitialLoad(true);
        const res = await fetch(`http://${window.location.hostname}:7000/getProgressStore`);
        if (!res.ok) throw new Error("Failed to fetch progress store");
        
        const data: ProgressStoreResponse = await res.json();
        setDownloads(data);

        // Check if there are active items left to download
        const downloadArray = Object.values(data);
        const hasActiveDownloads = downloadArray.some(
          (item) => item.progress < 100 && item.progress >= 0
        );

        // If the store is completely empty or everything is done/cancelled, clear interval
        if (downloadArray.length === 0 || !hasActiveDownloads) {
          if (!lastFetch)
            fetchProgress(true); // Fetch one last time to ensure UI is up-to-date
          stopPolling();
        } else if (!intervalRef.current) {
          // If there are active downloads and we aren't polling yet, start polling 
          startPolling();
        }
      } catch (error) {
        console.error("Error updating download progress:", error);
      }
      finally {
        setInitialLoad(false);
      }
    };
    
    const startPolling = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => {
        fetchProgress();
      }, 1000); // Polls every 1 second
    };

    const stopPolling = () => {
      // if (removeFromStore && keys.length > 0) {
      //   removeDownloadsFromStore(keys);
      // }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    const removeDownloadsFromStore = async (keys: string[]) => {
      try {
        for (const key of keys) {
          const [hash, idx] = key.split("_");
          const res = await fetch(`http://${window.location.hostname}:7000/progress/${hash}/${idx}`);
          if (!res.ok && res.status !== 500 && res.status !== 404) {
            console.error(`Failed to remove download ${key} from store`);
            return;
          }
          fetchProgress();
        }
      } catch (error) {
        console.error("Error removing downloads from store:", error);
      }
      finally {
        // After removing, fetch the updated progress store
        fetchProgress();
      }
    };
    useEffect(() => {
      // Function to fetch the progress store from your API
  
      

      // Initial fetch on mount
      fetchProgress();
      // Clean up interval when component unmounts
      return () => stopPolling();
    }, []);
  
    // Enrich downloads with metadata fetched from Cinemeta
    const [itemsWithMetaMap, setItemsWithMetaMap] = useState<{ [key: string]: DownloadItem }>({});
    const [loadingMeta, setLoadingMeta] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);
    const [seriesNames, setSeriesNames] = useState<{ [key: string]: string }>({});
    const [storedTorrents, setStoredTorrents] = useState<{ [key: string]: string }>({});
  
    useEffect(() => {
      let cancelled = false;
  
      const enrich = async () => {
        const itemsKeys = Object.keys(downloads);
        const items = Object.values(downloads);
        if (items.length === 0) {
          setItemsWithMetaMap({});
          return;
        }

        setLoadingMeta(true);
        try {
          const newItemsKeys = itemsKeys.filter((key) => !itemsWithMetaMap[key]);
          const newItems = newItemsKeys.map((key) => downloads[key]);
          const enriched = await Promise.all(
            newItems.map(async (item) => {
              const type = decodeURIComponent(item.ttid).includes(":") ? "series" : "movie";
              const parts = decodeURIComponent(item.ttid).split(":");
              const id = parts[0];
              const season = type === "series" ? parseInt(parts[1]) : null;
              const number = type === "series" ? parseInt(parts[2]) : null;
              
              try {
                const res = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${id}.json`);
                if (!res.ok) return item;
                const data = await res.json();
                if (type === "series") {
                  // Store series name for later use
                  if (seriesNames[id] === null || seriesNames[id] === undefined) {
                    setSeriesNames((prev) => ({ ...prev, [id]: data.meta?.name }));
                  }
                }
                return {
                  ...item,
                  name: type === "movie"
                    ? data.meta?.name
                    : data.meta?.videos.find((v: any) => v.season === season && v.number === number)?.name,
                  thumbnail: type === "movie"
                    ? data.meta?.poster
                    : data.meta?.videos.find((v: any) => v.season === season && v.number === number)?.thumbnail
                } as DownloadItem;
              } catch (err) {
                return item;
              }
            })
          );
          if (!cancelled) {
            setItemsWithMetaMap((prev) => {
              Object.keys(prev).forEach((key) => {
                if (!downloads[key]) {
                  delete prev[key];
                }
                else if (downloads[key] && prev[key]) {
                  prev[key] = { "ttid": prev[key].ttid, "progress": downloads[key].progress, "name": prev[key].name, "thumbnail": prev[key].thumbnail, "status": downloads[key].status };
                }
              });
              const newMap = { ...prev };
              newItemsKeys.forEach((key, idx) => {
                newMap[key] = enriched[idx];
              });
              return newMap;
            });
          }
        } finally {
          if (!cancelled) setLoadingMeta(false);
        }
      };
  
      enrich();
      return () => { cancelled = true; };
    }, [downloads]);
  
    // Helper to construct your internal navigation route based on media type
    const handleNavigation = (name: string, ttid: string, type: string, season: string = "") => {
      const itemName = name ?? "Media";
        router.push(`/${type}/${encodeURIComponent(ttid)}/${encodeURIComponent(itemName)}${season !=""  ? `?season=${season}` : ""}`);
    };
    useEffect(() => {
    if (itemsWithMetaMap && Object.keys(itemsWithMetaMap).length > 0) {
      Object.keys(itemsWithMetaMap).forEach((storeKey) => {
        // Fires the fetches silently in the background
        getTorrentTitleFromStoreKey(storeKey);
      });
    }
  }, [itemsWithMetaMap]);
    const getTorrentTitleFromStoreKey = async (storeKey: string): Promise<string> => {
      if (storedTorrents[storeKey.split("_")[0]]) {
        return storedTorrents[storeKey.split("_")[0]];
      }
      const item = downloads[storeKey];
      if (!item) return "";
      const id = decodeURIComponent(item.ttid);
      const type = id.includes(":") ? "series" : "movie";
      const hash = storeKey.split("_")[0];
      if (!hash) return "";
      try{
        const res2 = await fetch(`https://torrentio.strem.fun/stream/${type}/${id}.json`);
                if (!res2.ok) return "-";
                const data2 = await res2.json();
                const torrent = data2.streams.find((s: any) => s.infoHash === hash)?.title.match(/⚙️\s*([^\n]+)/)?.[1] ?? "-";
                setStoredTorrents((prev) => ({ ...prev, [hash]: torrent }));
                return torrent;
      }
      catch(err){
        console.error("Error fetching torrent title:", err);
        return "-";
      }
    };

    const handleCancelOrClearDownload = async (storeKey: string, isDownloading: boolean) => {
      const [hash, idx] = storeKey.split("_");
      if (isDownloading) {
        try {
          const res = await fetch(`http://${window.location.hostname}:7000/cancel`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ identifier: hash, idx: idx})
          });
          if (!res.ok) throw new Error("Failed to cancel download");
          fetchProgress();
          toast.success("Download cancelled successfully.");
        } catch (error) {
          console.error("Error cancelling download:", error);
          toast.error("Failed to cancel download.");
        }
        return;
      }

      try {
        const res = await fetch(`http://${window.location.hostname}:7000/progress/${hash}/${idx}`);
        if (!res.ok && res.status !== 500 && res.status !== 404) {
          console.error(`Failed to remove download ${storeKey} from store`);
          return;
        }
        fetchProgress();
      } catch (error) {
        console.error("Error removing download from store:", error);
      }
    };

    const handleCancelBatch = async (storeKeys: string[]) => {
      for (const storekey of storeKeys){
        try {
          const res = await fetch(`http://${window.location.hostname}:7000/cancel`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ identifier: storekey.split("_")[0], idx: storekey.split("_")[1]})
          });
          if (!res.ok){
            console.error(`Failed to cancel ${storekey} download in batch downloads`);
            continue;
          }
          fetchProgress();
        } catch (error) {
          console.error(`Error cancelling download ${storekey} in batch downloads:`, error);
          toast.error(`Failed to cancel download ${storekey}.`);
        }
    }
    toast.success("Running downloads have been cancelled.");
    };

  return (
      <main className="p-8 bg-zinc-950 min-h-screen text-white">
        <h1 className="text-2xl font-bold mb-2">Downloads</h1>
        <p className="text-zinc-400 mb-8">Your active and completed downloads will appear here.</p>
  
        {Object.values(downloads).length === 0 ? (
          <div className="space-y-4 max-w-4xl items-center mx-auto">
            <div className={`text-center py-12 text-zinc-500 bg-zinc-900/30 rounded-xl border border-zinc-800 border-dashed ${initialLoad && 'animate-pulse'}`}>
              {initialLoad ? "Loading..." : "No active or completed downloads found."}
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl items-center mx-auto">
            <div className="flex justify-end gap-2">
            {Object.values(downloads).some((download) => download.progress < 100 && download.progress >= 0) && (
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    const keys = Object.keys(downloads) //.filter((key) => downloads[key].progress < 100 && downloads[key].progress >= 0);
                    if (keys.length > 0) {
                      handleCancelBatch(keys);
                    }
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#FFFFFF"><path d="M873-88 609-352 495-238 269-464l56-58 170 170 56-56-414-414 56-58 736 736-56 56ZM269-238 43-464l56-56 170 170 56 56-56 56Zm452-226-56-56 196-196 58 54-198 198ZM607-578l-56-56 86-86 56 56-86 86Z"/></svg>
                    Cancel Downloads
                  </div>
                </button>
              </div>
          )}
          {Object.values(downloads).some((download) => download.progress == 100 || download.progress == -2.0 || download.progress == -1.0) && (
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    const keys = Object.keys(downloads) //.filter((key) => downloads[key].progress < 100 && downloads[key].progress >= 0);
                    if (keys.length > 0) {
                      removeDownloadsFromStore(keys);
                    }
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#FFFFFF"><path d="m644-448-56-58 122-94-230-178-94 72-56-58 150-116 360 280-196 152Zm115 114-58-58 73-56 66 50-81 64Zm33 258L632-236 480-118 120-398l66-50 294 228 94-73-57-56-37 29-360-280 83-65L55-811l57-57 736 736-56 56ZM487-606Z"/></svg>
                    Clear
                  </div>
                </button>
              </div>
          )}
          </div>
            <AnimatePresence initial={false} mode="popLayout">
            {(Object.keys(itemsWithMetaMap).length > 0 && !loadingMeta) && Object.keys(itemsWithMetaMap).map( (storeKey) => {
              const source = itemsWithMetaMap[storeKey];
              const ttid = decodeURIComponent(source?.ttid);
              const progress = source?.progress;
              const name = source?.name;
              const thumbnail = source?.thumbnail;
              const status = source?.status;
              const type = decodeURIComponent(ttid).includes(":") ? "series" : "movie";
              // Extract the hash from your key to match your state dictionary
              const hash = storeKey.split("_")[0];

              // Synchronously read from your state cache, fallback to a placeholder text string
              const torrentTitle = storedTorrents[hash] || "Resolving stream metadata...";
              if (!ttid || progress === undefined || progress === null) return null;
              const isCompleted = progress >= 100;
              const isCancelled = progress == -1.0;
              const isFailed = progress == -2.0;
              const isDownloading = !isCompleted && !isCancelled && !isFailed;
              const displayName = name ?? `ID: ${decodeURIComponent(ttid)}`;
              const seriesOrMovieName = type === "movie" ? displayName : seriesNames[decodeURIComponent(ttid).split(":")[0]] ?? displayName;
              const thumbnailUrl = thumbnail;
  
              return (
                  <motion.div
                  key={storeKey}
                    layout
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.98 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  // --- FIXED: Stack vertically on phones, layout horizontally on desktop screens ---
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 p-4 bg-zinc-900 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors w-full min-w-0 overflow-hidden"
                >
                  {/* Top Meta Row (Visible as a row on mobile, blends in on desktop) */}
                  <div className="flex items-center justify-between sm:contents">
                    {/* Thumbnail Section */}
                    <div className={`${type === "series" ? "w-36 h-20" : "w-20 h-28"} relative flex-shrink-0 bg-zinc-800 rounded-md overflow-hidden border border-zinc-800`}>
                      <FallbackImage 
                        src={thumbnailUrl} 
                        fallback="/no-poster-16-9.jpg" 
                        alt={displayName}
                      />
                    </div>

                    {/* Status Badge (Stays aligned on the top right corner on phones) */}
                    <div className="flex-shrink-0 sm:order-last sm:ml-2">
                      {isCompleted ? (
                        <span className="px-2.5 py-1 text-xs font-semibold bg-green-500/10 text-green-400 rounded-full border border-green-500/20 whitespace-nowrap">
                          Finished
                        </span>
                      ) : isCancelled ? (
                        <span className="px-2.5 py-1 text-xs font-semibold bg-red-500/10 text-red-400 rounded-full border border-red-500/20 whitespace-nowrap">
                          Cancelled
                        </span>
                      ) : isFailed ? (
                        <span className="px-2.5 py-1 text-xs font-semibold bg-red-500/10 text-red-400 rounded-full border border-red-500/20 whitespace-nowrap">
                          Failed
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 text-xs font-semibold bg-blue-500/10 text-blue-400 animate-pulse rounded-full border border-blue-500/20 whitespace-nowrap">
                          Downloading
                        </span>
                      )}
                    </div>
                      <div className="flex-shrink-0 sm:order-last sm:ml-2">
                        <span onClick={() => handleCancelOrClearDownload(storeKey, isDownloading)} title={isDownloading ? "Cancel Download" : "Clear"} className="px-2.5 py-1 text-sm font-semibold text-red-400 whitespace-nowrap cursor-pointer transition-colors hover:text-red-300">✕</span>
                      </div>
                  </div>

                  {/* Content & Progress Bar Section */}
                  <div className="flex-1 min-w-0 w-full">
                    <p
                      onClick={() => handleNavigation(seriesOrMovieName, ttid.split(":")[0],type, type === "series" ? ttid.split(":")[1] : "")}
                      // --- FIXED: Removed 'truncate', added 'break-words' and 'whitespace-normal' so long titles wrap nicely ---
                      className="text-left cursor-pointer text-zinc-100 hover:text-blue-400 hover:underline transition-colors block break-words whitespace-normal max-w-full leading-snug"
                    >
                      {seriesOrMovieName}
                    </p>
                    <span className="text-zinc-400 text-xs">⚙️{torrentTitle}</span>
                    {(type === "series") && 
                      <p
                        onClick={() => handleNavigation(displayName, ttid, type)}
                        // --- FIXED: Removed 'truncate', added 'break-words' and 'whitespace-normal' so long titles wrap nicely ---
                        className="text-left cursor-pointer text-xs text-zinc-400 hover:text-blue-400 hover:underline transition-colors block break-words whitespace-normal max-w-full leading-snug"
                      >
                      <span className="text-sm font-semibold">S{ttid.split(":")[1].padStart(2, '0')}E{ttid.split(":")[2].padStart(2, '0')} </span>{displayName} 
                      </p>
                      
                    }
                    <div className="mt-2 flex items-center gap-3 w-full">
                      {/* Visual Progress Bar track */}
                      <div className={`flex-1 ${isDownloading ? 'bg-zinc-800' : 'bg-red-800'} rounded-full h-2 overflow-hidden`}>
                        <div 
                          className={`h-full transition-all duration-300 ${isCompleted ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                        ></div>
                      </div>
                      {/* Progress Percentage Text */}
                      <span className="text-xs text-zinc-400 font-mono w-12 text-right flex-shrink-0">
                        {progress >= 0 ? `${progress.toFixed(2)}%` : null}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            </AnimatePresence>
          </div>
        )}
      </main>
    );
}