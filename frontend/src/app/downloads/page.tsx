"use client";
import FallbackImage from "../components/fallbackimg";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";

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

  useEffect(() => {
    // Function to fetch the progress store from your API
    const fetchProgress = async () => {
      try {
        const res = await fetch(`http://${window.location.hostname}:7000/getProgressStore`);
        if (!res.ok) throw new Error("Failed to fetch progress store");
        
        const data: ProgressStoreResponse = await res.json();
        setDownloads(data);

        // Check if there are active items left to download
        const downloadArray = Object.values(data);
        const hasActiveDownloads = downloadArray.some(
          (item) => item.progress < 100 && item.status !== "cancelled" && item.status !== "paused"
        );

        // If the store is completely empty or everything is done/cancelled, clear interval
        if (downloadArray.length === 0 || !hasActiveDownloads) {
          stopPolling();
        } else if (!intervalRef.current) {
          // If there are active downloads and we aren't polling yet, start polling
          startPolling();
        }
      } catch (error) {
        console.error("Error updating download progress:", error);
      }
    };

    const startPolling = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => {
        fetchProgress();
      }, 1000); // Polls every 1 second
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // Initial fetch on mount
    fetchProgress();

    // Clean up interval when component unmounts
    return () => stopPolling();
  }, []);

  const downloadItems = Object.values(downloads).map(async (item) => {
    const type = (decodeURIComponent(item.ttid).includes(":") ? "series" : "movie");
    const season = type === "series" ? decodeURIComponent(item.ttid).split(":")[1] : null;
    const number = type === "series" ? decodeURIComponent(item.ttid).split(":")[2] : null;
    const res = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${decodeURIComponent(item.ttid).split(":")[0]}.json`);
    if (!res.ok) throw new Error("Failed to fetch metadata");
    const data = await res.json();
    item.name = type === "movie" ? data.meta?.name : data.meta?.videos.find((v: any) => v.season === season && v.number === number )?.name;
    item.thumbnail = type === "movie" ? data.meta?.poster : data.meta?.videos.find((v: any) => v.season === season && v.number === number )?.thumbnail;
    return item;
  });

  const resolvedDownloadItems = Promise.all(downloadItems);


  // Helper to construct your internal navigation route based on media type
  const handleNavigation = (item: DownloadItem) => {
    const itemName = item.name ?? "Media";
    if (item.type === "movie") {
      router.push(`/movie/${encodeURIComponent(item.ttid)}/${encodeURIComponent(itemName)}`);
    } else {
      router.push(`/series/${encodeURIComponent(item.ttid)}/${encodeURIComponent(itemName)}`);
    }
  };

  return (
    <main className="p-8 bg-zinc-950 min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-2">Downloads</h1>
      <p className="text-zinc-400 mb-8">Your active and completed downloads will appear here.</p>

      {downloadItems.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 bg-zinc-900/30 rounded-xl border border-zinc-800">
          No active or completed downloads found.
        </div>
      ) : (
        <div className="space-y-4 max-w-4xl">
          {resolvedDownloadItems.then((items) => items.map((item) => {
            const isCompleted = item.progress >= 100;
            const displayName = item.name ?? `ID: ${decodeURIComponent(item.ttid)}`;

            return (
              <div 
                key={decodeURIComponent(item.ttid)} 
                className="flex items-center gap-4 p-4 bg-zinc-900 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors"
              >
                {/* Thumbnail Section */}
                <div className="w-24 h-14 relative flex-shrink-0 bg-zinc-800 rounded-md overflow-hidden">
                  <FallbackImage 
                    src={item.thumbnail || "/no-poster-16-9.jpg"} 
                    fallback="/no-poster-16-9.jpg" 
                    alt={displayName}
                  />
                </div>

                {/* Content & Progress Bar Section */}
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => handleNavigation(item)}
                    className="text-left font-medium text-zinc-100 hover:text-blue-400 hover:underline transition-colors block truncate max-w-full text-base"
                  >
                    {displayName}
                  </button>

                  <div className="mt-2 flex items-center gap-3">
                    {/* Visual Progress Bar track */}
                    <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${isCompleted ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(Math.max(item.progress, 0), 100)}%` }}
                      ></div>
                    </div>
                    {/* Progress Percentage Text */}
                    <span className="text-xs text-zinc-400 font-mono w-10 text-right">
                      {item.progress.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex-shrink-0 ml-2">
                  {isCompleted ? (
                    <span className="px-2.5 py-1 text-xs font-semibold bg-green-500/10 text-green-400 rounded-full border border-green-500/20">
                      Ready
                    </span>
                  ) : item.status === "cancelled" ? (
                    <span className="px-2.5 py-1 text-xs font-semibold bg-red-500/10 text-red-400 rounded-full border border-red-500/20">
                      Cancelled
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 text-xs font-semibold bg-blue-500/10 text-blue-400 animate-pulse rounded-full border border-blue-500/20">
                      Syncing
                    </span>
                  )}
                </div>
              </div>
            );
          }))}
        </div>
      )}
    </main>
  );
}