'use client';
import FallbackImage from "../components/fallbackimg";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

type StorageItem = {
  infoHash: string;
  fileIdx: number;
  ttid: string;
  title?: string;
  filename?: string;
  type: string;
};

type HydratedItem = StorageItem & {
  posterUrl: string;
  displayName: string;
  itemType: string;
};

export default function BatchDownloadPage() {
  const [items, setItems] = useState<HydratedItem[]>([]);
  const [pageLoading, setPageLoading] = useState<boolean>(true);

  // 1. Fetch metadata context from Cinemeta and hook into local storage items
  useEffect(() => {
    const loadAndHydrateData = async () => {
      try {
        setPageLoading(true);
        const rawStorage = localStorage.getItem("stream_bookmarks");
        if (!rawStorage) {
          setItems([]);
          return;
        }

        const parsedItems: StorageItem[] = JSON.parse(rawStorage);
        const hydratedList: HydratedItem[] = [];

        // Cache meta targets to prevent making duplicate network requests for the same show/movie ttid
        const metaCache: { [key: string]: { poster: string; name: string; type: string; videos?: any[] } } = {};

        for (const item of parsedItems) {
          // Isolate base IMDB ID if it's formatted like a series sub-segment (e.g. tt12345:1:1)
          const baseImdbId = item.ttid.split(":")[0];
          let posterUrl = "/fallback-poster.png"; 
          let displayName = item.title || "Unknown Title";
          let itemType = item.type;

          if (!metaCache[baseImdbId]) {
            // Check Cinemeta Catalog dynamically across movie or series categories
            let metaRes = await fetch(`https://v3-cinemeta.strem.io/meta/${itemType}/${baseImdbId}.json`);
            let metaData = await metaRes.json();


            if (metaData.meta) {
              metaCache[baseImdbId] = {
                poster: metaData.meta.poster || "/fallback-poster.png",
                name: metaData.meta.name,
                type: metaData.meta.type,
                videos: metaData.meta.videos || []
              };
            }
          }

          // Hydrate data attributes from the metadata index cache values
          if (metaCache[baseImdbId]) {
            const cached = metaCache[baseImdbId];
            posterUrl = cached.poster;
            itemType = cached.type === "series" ? "series" : "movie";

            if (itemType === "series") {
              // Try to map exact episode structural sub-names if matching metadata keys align
              const matchingVideo = cached.videos?.find(v => v.id === item.ttid || (v.season === 1 && v.number === item.fileIdx));
              if (matchingVideo) {
                displayName = `${cached.name} - S${matchingVideo.season}E${matchingVideo.number} : ${matchingVideo.title}`;
              } else {
                displayName = cached.name;
              }
            } else {
              displayName = cached.name;
            }
          }

          hydratedList.push({
            ...item,
            posterUrl,
            displayName,
            itemType
          });
        }

        setItems(hydratedList);
      } catch (err) {
        console.error("Failed hydrating batch assets from Cinemeta:", err);
        toast.error("Error building batch tracking details.");
      } finally {
        setPageLoading(false);
      }
    };

    loadAndHydrateData();
  }, []);

  // 2. Remove an explicit node entry from storage allocations
  const handleRemoveItem = (infoHash: string, fileIdx: number) => {
    const updated = items.filter(i => !(i.infoHash === infoHash && i.fileIdx === fileIdx));
    setItems(updated);

    // Sync state modification changes straight back down to browser storage arrays
    const rawStorage = updated.map(({ infoHash, fileIdx, ttid, title, filename }) => ({
      infoHash, fileIdx, ttid, title, filename
    }));
    localStorage.setItem("stream_bookmarks", JSON.stringify(rawStorage));
    toast.success("Item cleared from batch queue.");
  };

  // 3. Fire download API pipelines upstream on port 7000
  const handleDownloadItem = async (item: HydratedItem) => {
    const cleanFilename = item.filename || item.title || "downloaded_stream";
    const toastId = toast.loading(`Starting download context for ${item.displayName}...`);

    try {
      const res = await fetch(`http://${window.location.hostname}:7000/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: item.infoHash,
          idx: String(item.fileIdx),
          path: "/media", // Standard fallback default mounting path target
          name: cleanFilename.trim()
        })
      });

      if (!res.ok) throw new Error("Server transmission error rejected entry processing");

      toast.success(`${item.displayName} started processing! Check dashboard details.`, { id: toastId });
    } catch (err) {
      toast.error(`Download failed to initiate for ${item.displayName}`, { id: toastId });
    }
  };

  return (
    <main className="p-8 bg-zinc-950 min-h-screen text-white flex flex-col max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Batch Download Dashboard</h1>
        <p className="text-zinc-400 text-sm">Review, purge, or process multiple streaming selections cached inside your client bookmarks.</p>
      </div>

      {pageLoading ? (
       <div className="flex-1 border-2 border-dashed border-zinc-800 rounded-xl p-12 text-center text-zinc-500 my-auto animate-pulse">
            <p className="text-sm font-semibold text-zinc-400">Loading your batch queue...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 border-2 border-dashed border-zinc-800 rounded-xl p-12 text-center text-zinc-500 my-auto">
          <p className="text-sm font-semibold text-zinc-400">Your batch queue is currently empty.</p>
          <p className="text-xs text-zinc-600 mt-1">Bookmark streams from the content finder views to stack downloads here.</p>
        </div>
      ) : (
        /* Scrollable Container Panel Area mapping list layout dimensions */
        <div className="flex-1 overflow-y-auto max-h-[70vh] bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-3 search-scrollbar">
          {items.map((item, index) => (
            <div 
              key={`${item.infoHash}-${item.fileIdx}-${index}`}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-zinc-900 border border-zinc-800/60 rounded-xl gap-4 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* FallbackImage thumbnail component hook */}
                <div className="w-12 h-18 rounded-lg overflow-hidden bg-zinc-950 flex-shrink-0 relative border border-zinc-800">
                  <FallbackImage 
                    src={item.posterUrl} 
                    alt="poster metadata" 
                    className="object-cover w-full h-full"
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white truncate" title={item.displayName}>
                    {item.displayName}
                  </h3>
                  <p className="text-xs text-zinc-400 truncate mt-0.5" title={item.filename || item.title}>
                    <span className="text-zinc-600 font-mono">File:</span> {item.filename || item.title || "Raw Stream Index Output"}
                  </p>
                  <p className="text-[10px] text-zinc-600 font-mono tracking-tight truncate mt-1">
                    HASH: {item.infoHash} | IDX: {item.fileIdx}
                  </p>
                </div>
              </div>

              {/* Functional Interaction buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t border-zinc-800 sm:border-0 pt-3 sm:pt-0">
                <button
                  onClick={() => handleRemoveItem(item.infoHash, item.fileIdx)}
                  className="px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                >
                  Remove
                </button>
                <button
                  onClick={() => handleDownloadItem(item)}
                  className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                   Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}