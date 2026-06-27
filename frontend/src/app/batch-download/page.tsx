'use client';
import FallbackImage from "../components/fallbackimg";
import { useEffect, useState,useRef } from "react";
import { toast } from "react-hot-toast";
import { useSyncedLocalStorage } from "../Utils/useSyncedLocalStorage";
import { useRouter } from "next/navigation";

type StorageItem = {
  infoHash: string;
  fileIdx: number;
  ttid: string;
  title?: string;
  filename?: string;
  type: string;
  provider?: string;
};

type HydratedItem = StorageItem & {
  posterUrl: string;
  displayName: string;
  itemType: string;
  episodeTitle: string;
};

type SeriesItem={
  ttid: string;
  posterUrl: string;
  displayName: string;}

// Dummy / Interface placeholder for custom recursive file paths wrapper configuration tracker
type FolderTreeItemProps = {
  name: string;
  currentPath: string;
  selectedPath: string;
  onSelectPath: (path: string) => void;
  onRefreshParent?: () => void;
  activeRefreshRef: React.MutableRefObject<{ [path: string]: () => Promise<void> }>; // Add this
};

let globalActiveCloseMenuFn: (() => void) | null = null;

const registerGlobalMenu = (closeFn: () => void) => {
  if (globalActiveCloseMenuFn && globalActiveCloseMenuFn !== closeFn) {
    globalActiveCloseMenuFn(); // Close the previously opened menu instantly
  }
  globalActiveCloseMenuFn = closeFn;
};

const clearGlobalMenu = (closeFn: () => void) => {
  if (globalActiveCloseMenuFn === closeFn) {
    globalActiveCloseMenuFn = null;
  }
};

type ServerStatus = "Downloading" | "Failed" | "Completed";

function FolderTreeItem({ name, currentPath, selectedPath, onSelectPath, onRefreshParent, activeRefreshRef }: FolderTreeItemProps) {
  const cleanName = name.endsWith("/") ? name.slice(0, -1) : name;
  const itemPath = currentPath ? `${currentPath}/${cleanName}` : cleanName;
  
  const [isOpen, setIsOpen] = useState(false);
  const [subFolders, setSubFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isSelected = selectedPath === itemPath;

  const fetchSubfolders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://${window.location.hostname}:7000/getItems?folder=${encodeURIComponent(itemPath)}&showFiles=false`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSubFolders(data.items || []);
      
      // Save this specific folder's reload function into the shared global ref map
      activeRefreshRef.current[itemPath] = fetchSubfolders;
    } catch {
      toast.error(`Failed to load folders inside ${cleanName}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleExpand = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering path selection when clicking the icon arrow
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      await fetchSubfolders();
    }
  };

  const handleDeleteFolder = async (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log(`Attempting to delete folder at path: ${itemPath}`); // Debug log for deletion path
    if (!confirm(`Are you sure you want to delete "${cleanName}"?`)) return;

    try {
      const res = await fetch(`http://${window.location.hostname}:7000/deleteFolder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: itemPath })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Deactivation failed");

      toast.success("Folder deleted successfully!");
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      toast.error(`Could not delete folder: ${err.message || "Is it empty?"}`);
    }
  };

  const handleRenameFolder = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newName = prompt("Enter new folder name:", cleanName);
    if (newName && newName.trim()) {
      try {
      const res = await fetch(`http://${window.location.hostname}:7000/renameFolder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: itemPath, newName: newName.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Deactivation failed");

      toast.success("Folder renamed successfully!");
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      toast.error(`Could not rename folder: ${err.message || "Name conflict?"}`);
    }
    }
  };

  useEffect(() => {
  if (isMenuOpen) {
    const closeMenu = () => setIsMenuOpen(false);
    registerGlobalMenu(closeMenu);

    // Close on any outside click anywhere on the page
    window.addEventListener("click", closeMenu);
    return () => {
      window.removeEventListener("click", closeMenu);
      clearGlobalMenu(closeMenu);
    };
  }
}, [isMenuOpen]);
  return (
    <div className="select-none text-left">
      <div
        onClick={() => onSelectPath(itemPath)}
        className={`flex items-center justify-between group py-2 px-2 rounded cursor-pointer transition-colors ${
          isSelected ? "bg-green-600 text-white" : "hover:bg-zinc-800 text-zinc-300"
        }`}
      >
        <div className="flex items-center gap-2 truncate min-w-0 flex-1">
          <button 
            onClick={handleToggleExpand} 
            className="w-4 h-4 text-xs font-bold text-zinc-500 hover:text-zinc-200 transition-colors p-0.5"
          >
            {isOpen ? "▼" : "▶"}
          </button>
          <img
            src={isOpen ? "/open-folder.png" : "/folder.png"}
            alt=""
            className="w-4 h-4 object-contain flex-shrink-0"
          />
          <span className="text-sm font-medium break-words whitespace-normal">
            {cleanName}
          </span>
          {loading && <span className="text-xs text-zinc-500 animate-pulse">...</span>}
        </div>

        {/* --- THREE DOTS OPTIONS DROPDOWN CONTEXT MENU --- */}
        <div className="relative flex-shrink-0 ml-2">
          {/* Trigger Button: Visible on Mobile, on Hover for Desktop */}
          <button
            onClick={(e) => {
              e.stopPropagation(); // Stops the folder row row from selecting/toggling
              setIsMenuOpen(!isMenuOpen);
            }}
            className={"flex w-7 h-7 items-center justify-center rounded-lg " + (isSelected ? "bg-green-600" : "hover:bg-zinc-900") + " text-zinc-400 hover:text-white"+(isSelected ? " hover:bg-green-500" : "") +" transition-colors cursor-pointer"}
            title="Folder Actions"
          >
            {/* SVG vertical dots icon */}
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </button>

          {/* Floating Actions Overlay Box */}
          {isMenuOpen && (
            <div 
              onClick={(e) => e.stopPropagation()} // Stop menu background clicks from expanding folder rows
              className="absolute right-0 mt-1 w-28 bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl py-1 z-30 animate-in fade-in zoom-in-95 duration-100"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                  handleRenameFolder(e); // Safely fires your existing rename routine
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <img src="/edit.png" alt="Rename" className="w-4 h-4" />
                Rename
              </button>
              
              <button
                onClick={(e) => {
                  setIsMenuOpen(false);
                  handleDeleteFolder(e); // Safely fires your existing delete routine
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <img src="/delete.png" alt="Delete" className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="pl-4 border-l border-zinc-800 ml-3.5 mt-0.5 space-y-0.5">
          {subFolders.length === 0 && !loading ? (
            <div className="text-xs text-zinc-600 py-1 pl-2 italic">No subdirectories</div>
          ) : (
            subFolders.map((subName) => (
              <FolderTreeItem
                key={subName}
                name={subName}
                currentPath={itemPath}
                selectedPath={selectedPath}
                onSelectPath={onSelectPath}
                onRefreshParent={fetchSubfolders}
                activeRefreshRef={activeRefreshRef}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function BatchDownloadPage() {
  const router = useRouter();
  const [items, setItems] = useState<HydratedItem[]>([]);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [pageLoading, setPageLoading] = useState<boolean>(true);
  const [bookmarks, setBookmarks] = useSyncedLocalStorage("stream_bookmarks");
  const [seriesTabs, setSeriesTabs] = useState<SeriesItem[]>([]);
  const [serverStatus, setServerStatus] = useState<ServerStatus>("Completed");
  const [serverProgress, setServerProgress] = useState<number>(0);

  // Bottom action bar & target server tree variables configuration states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetPath, setTargetPath] = useState<string>(""); 
  const [rootFolders, setRootFolders] = useState<string[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const [isOn, setIsOn] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const activeRefreshRef = useRef<{ [path: string]: () => Promise<void> }>({});

  const loadRootFolders = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:7000/getItems?folder=&showFiles=false`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRootFolders(data.items || []);
    } catch {
      toast.error("Failed to map target media folder pathways.");
    }
  };

  const fetchProgress = async () => {
    try {
    const res = await fetch(`http://${window.location.hostname}:7000/getBatchProgressStore`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    if (data && Object.keys(data).length > 0) {
      let allTaskIds: string[] = Object.keys(data);
      setTaskIds(allTaskIds);
      console.log("Fetched interval task IDs:", intervalRef.current);
      if (!intervalRef.current) intervalRef.current = setInterval(async () => await checkBatchProgress(allTaskIds), 1000);
    }
  } catch (err) {
    console.error("Failed to fetch batch progress store:", err);
    toast.error("Error occurred while fetching batch progress store.");
  }
  };
  // 1. Fetch metadata context from Cinemeta and hook into local storage items
  useEffect(() => {
    const loadAndHydrateData = async () => {
      try {
        setPageLoading(true);
        fetchProgress();
        const rawStorage = bookmarks;
        if (!rawStorage) {
          setItems([]);
          setCheckedItems(new Set<string>());
          return;
        }

        const parsedItems: StorageItem[] = JSON.parse(rawStorage);
        const hydratedList: HydratedItem[] = [];
        const metaCache: { [key: string]: { poster: string; name: string; type: string; videos?: any[] } } = {};
        if (!parsedItems.some(item => item.type === "series")) {
          setSeriesTabs([]);
        }
        let innerseriesTabs : SeriesItem[] = [];
        for (const item of parsedItems) {
          item.ttid = decodeURIComponent(item.ttid); 
          const baseImdbId = item.ttid.split(":")[0];
          let posterUrl = "/no-poster-16-9.jpg"; 
          let displayName = item.title || "Unknown Title";
          let episodeTitle = "";
          let itemType = item.type;

          if (!metaCache[baseImdbId]) {
            let metaRes = await fetch(`https://v3-cinemeta.strem.io/meta/${itemType}/${baseImdbId}.json`);
            let metaData = await metaRes.json();

            if (metaData.meta) {
              metaCache[baseImdbId] = {
                poster: metaData.meta.poster || "/no-poster-16-9.jpg",
                name: metaData.meta.name,
                type: metaData.meta.type,
                videos: metaData.meta.videos || []
              };
            }
          }

          if (metaCache[baseImdbId]) {
            const cached = metaCache[baseImdbId];
            posterUrl = cached.poster;
            itemType = cached.type === "series" ? "series" : "movie";

            if (itemType === "series") {
              const matchingVideo = cached.videos?.find(v => 
                v.id === item.ttid || 
                (v.season === parseInt(item.ttid.split(":")[1]) && v.number === parseInt(item.ttid.split(":")[2]))
              );
              if (matchingVideo) {
                displayName = `${cached.name}`;
                episodeTitle = `S${matchingVideo.season}E${matchingVideo.number} : ${matchingVideo.name}`;
                posterUrl = matchingVideo.poster || matchingVideo.thumbnail || posterUrl;
              } else {
                displayName = cached.name;
              }
            } else {
              displayName = cached.name;
            }
          }

          if (itemType === "series") {
            if (innerseriesTabs.filter(tab => tab.ttid === item.ttid.split(':')[0]).length === 0) {
              innerseriesTabs.push({
                ttid: item.ttid.split(':')[0],
                posterUrl : metaCache[baseImdbId]?.poster || "/no-poster-16-9.jpg",
                displayName
              });
            }
          }
          hydratedList.push({
            ...item,
            posterUrl,
            displayName,
            itemType,
            episodeTitle
          });
        }
        setSeriesTabs(innerseriesTabs);
        setItems(hydratedList);
        // --- FIXED: Smart check-by-default for new items, preserve unchecks for old ones ---
        setCheckedItems((prevChecked) => {
          // 1. If it's the absolute first load of the page, check everything by default
          // if (prevChecked.size === 0) {
          //   return new Set(hydratedList.map(item => `${item.infoHash}-${item.fileIdx}`));
          // }

          // 2. Build a quick lookup array of items we were already displaying before this tick
          const existingInfoHashesIndexes = new Set(items.map(item => `${item.infoHash}-${item.fileIdx}`));
          const updatedSet = new Set<string>();

          hydratedList.forEach((item) => {
            const key = `${item.infoHash}-${item.fileIdx}`;
            
            // 3. If the torrent/movie infoHash is brand new to the list, check it by default!
            if (!existingInfoHashesIndexes.has(key)) {
              updatedSet.add(key);
            } 
            // 4. If it was already on the screen before, strictly respect the user's previous selection
            else if (prevChecked.has(key)) {
              updatedSet.add(key);
            }
          });

          return updatedSet;
        });
      } catch (err) {
        console.error("Failed hydrating batch assets from Cinemeta:", err);
        toast.error("Error building batch tracking details.");
      } finally {
        setPageLoading(false);
      }
    };

    loadAndHydrateData();
  }, [bookmarks]);

  // This effect focuses 100% on ensuring NO zombie timers survive when leaving the page
useEffect(() => {
  // We leave the setup block empty because we only care about the exit cleanup phase
  
  return () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };
}, []); // Empty brackets ensure this cleanup is securely bound to the page-exit event

const handleRemoveItems = (itemsToRemove: HydratedItem[]) => {
  const updated = JSON.parse(bookmarks || "[]").filter(
    (i: any) => !itemsToRemove.some(item => item.infoHash === i.infoHash && item.fileIdx === i.fileIdx)
  );
  
  // 1. Update the master items list configuration
  setItems(updated);
  
  // --- FIXED: Remove only the targets from your current checked choices ---
  setCheckedItems((prevChecked) => {
    const updatedSet = new Set(prevChecked);
    itemsToRemove.forEach((item) => {
      updatedSet.delete(`${item.infoHash}-${item.fileIdx}`);
    });
    return updatedSet;
  });
  
  setBookmarks(JSON.stringify(updated));
  toast.success("Selected items cleared from batch queue.");
};

// 2. Remove an explicit node entry from storage allocations
const handleRemoveItem = (infoHash: string, fileIdx: number) => {
  const updated = JSON.parse(bookmarks || "[]").filter(
    (i: any) => !(i.infoHash === infoHash && i.fileIdx === fileIdx)
  );
  
  // 1. Update the master items list configuration
  setItems(updated);
  
  // --- FIXED: Safely delete just this single key from your current checked choices ---
  setCheckedItems((prevChecked) => {
    const updatedSet = new Set(prevChecked);
    updatedSet.delete(`${infoHash}-${fileIdx}`);
    return updatedSet;
  });
  
  setBookmarks(JSON.stringify(updated));
  toast.success("Item cleared from batch queue.");
};

  
  // 3. Load top-level directories configurations
  const openLocationSelectorModal = async () => {
    setIsModalOpen(true);
    try {
      const res = await fetch(`http://${window.location.hostname}:7000/getItems?folder=&showFiles=false`);
      if (res.ok) {
        const data = await res.json();
        setRootFolders(data.items || []);
      }
    } catch {
      toast.error("Failed to map destination options from target server.");
    }
  };

  // 4. Handle inline custom directory builds inside modal
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    // The relative path for the new folder
    const pathValue = targetPath ? `${targetPath}/${newFolderName.trim()}` : newFolderName.trim();

    try {
      const res = await fetch(`http://${window.location.hostname}:7000/createFolder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: pathValue })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Directory assembly aborted");

      toast.success("Folder created!");
      setNewFolderName("");

      // --- THE FIX ---
      // If we are inside a subfolder, trigger that subfolder's specific refresh function.
      // If we are at the root level (""), trigger the root folder loader.
      if (targetPath && activeRefreshRef.current[targetPath]) {
        await activeRefreshRef.current[targetPath]();
      } else {
        await loadRootFolders();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed creating folder.");
    }
  };

  // 5. Fire all queued downloads sequentially to backend
  const handleBatchDownloadExecute = async () => {
    if (serverStatus === "Completed") {
      if (targetPath === null) return;
      if (checkedItems.size === 0) {
        toast.error("No items selected for batch download.");
        return;
      }

      try{
        const res = await fetch(`http://${window.location.hostname}:7000/batchDownload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.filter(item => checkedItems.has(`${item.infoHash}-${item.fileIdx}`)).map(item => ({
              identifier: item.infoHash,
              idx: item.fileIdx,
              name: item.filename ||"Raw Stream Index Output",
              ttid: item.ttid
            })),
            path: targetPath
          })
        });
        if (!res.ok){
        throw new Error(`HTTP error! status: ${res.status}`);
        }  
        const data = await res.json();
        const innertaskIds = data.task_ids || [];
        setTaskIds(innertaskIds);
        // 1. Grab a single, fresh copy of the data directly from local storage
        let freshBookmarks: any[] = [];
        try {
          freshBookmarks = JSON.parse(localStorage.getItem("stream_bookmarks") || "[]");
        } catch {
          freshBookmarks = [];
        }

        // 2. Filter out ALL items that match the checked keys in one single step
        const updatedBookmarks = freshBookmarks.filter((item: any) => {
          const itemKey = `${item.infoHash}-${item.fileIdx}`;
          return !checkedItems.has(itemKey); // Keep it ONLY if it is NOT checked
        });

        // 3. Update all your states exactly ONCE
        setItems(updatedBookmarks);
        setCheckedItems(new Set()); // Clear checked list since they are gone
        setBookmarks(JSON.stringify(updatedBookmarks));

        // 4. Send a single, clean notification toast
        toast.success("Batch download request sent.");
        intervalRef.current = setInterval(async () =>await checkBatchProgress(innertaskIds), 1000);
      } catch (err) {
        console.error("Failed to execute batch download:", err);
        toast.error("Error occurred while executing batch download.");
      }
    }
    else if (serverStatus === "Downloading") {
      try{
        console.log("Cancelling batch download for task IDs:", taskIds);
        const res = await fetch(`http://${window.location.hostname}:7000/cancelBatch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task_ids: taskIds })
        });
      }
      catch (err) {
        console.error("Failed to cancel batch download:", err);
        toast.error("Error occurred while cancelling batch download.");
      }
    }

  };

  const checkBatchProgress = async (taskIds: string[]) => {
    try {
      const res = await fetch(`http://${window.location.hostname}:7000/batchProgress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_ids: taskIds })
      });
      
      console.log("Task IDs being checked for progress:", taskIds);

      if (!res.ok) {
        const activeInterval = intervalRef.current;
        if (activeInterval) {
          clearInterval(activeInterval);
          intervalRef.current = null;
        }
        if (res.status === 404) {
          // --- FIXED: Localized clear strategy protects against null references ---
          setServerStatus("Completed");
          setServerProgress(0);
        }
        else if(res.status === 500) {
          toast.error("Server error while checking batch progress. Please check server logs.");
          setServerStatus("Completed");
          setServerProgress(0);
        }
        return;
      }

      const data = await res.json();

      if (data && data.progress !== undefined && data.status !== undefined) {
        if (data.status === "Downloading") {
          setServerProgress(data.progress);
          setServerStatus("Downloading");
          return;
        }

        // --- FIXED: TERMINAL STATES HANDLER (Failed, Completed, Cancelled) ---
        console.log("Batch download terminal state reached:", data.status);
        
        // Grab a snapshot token immediately so we bypass any parent nullification changes
        const activeInterval = intervalRef.current;
        if (activeInterval) {
          console.log("Batch download has reached a terminal state. Stopping progress checks cleanly.");
          clearInterval(activeInterval);
          intervalRef.current = null; // Clear it out safely *after* the browser stops the loop instance
        }

        if (data.status === "Failed") {
          toast.error("Batch download failed. Please check the server logs for details.");
          setServerStatus("Completed");
          setServerProgress(0);
        } 
        else if (data.status === "Completed") {
          toast.success("Batch download completed successfully.");
          setServerStatus("Completed");
          setServerProgress(0);
        } 
        else if (data.status === "Cancelled" || data.status === "Not Found") {
          toast.success("Batch download cancelled.");
          setServerStatus("Completed");
          setServerProgress(0);
        }
      }
    } catch (err) {
      console.error("Failed to check batch progress:", err);
    }
  };

  const handleCheckboxChange = (infoHash: string, fileIdx: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const key = `${infoHash}-${fileIdx}`;
    const updatedSet = new Set(checkedItems);
    if (e.target.checked) {
      updatedSet.add(key);
    } else {
      updatedSet.delete(key);
    }
    setCheckedItems(updatedSet);
  };

  const handleToggle = () => {
    setIsOn(!isOn);
  };

  return (
    <main className="pt-8 bg-zinc-950 max-w-screen max-h-screen text-white flex flex-col mx-auto relative p-3">
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
        <>
          {/* Scrollable Container Panel Area mapping list layout dimensions */}
          <div className="overflow-y-auto bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-3 search-scrollbar" style={{ height: window.innerHeight - 390+"px" }}>
          <div className="grid justify-end gap-4 mb-3">
            <div className="toggle-container">
            <span><b>Group By:</b>&nbsp;&nbsp;Season</span>
            
            <label className="switch">
              {/* Hidden checkbox that holds the actual state */}
              <input 
                type="checkbox" 
                checked={isOn} 
                onChange={handleToggle} 
              />
              {/* The visual slider track and ball */}
              <span className="slider"></span>
            </label>
            
            <span>Torrent</span>
          </div>
        </div>
          {seriesTabs.map((seriesItem: any, seriesIdx: number) => {
          // Filter your master items queue to isolate only the episodes belonging to this specific series
          const seriesEpisodes = items.filter(
            (item) => item.itemType === "series" && item.displayName === seriesItem.displayName
          );
          const seriesSeasonsorSeriesTorrents = !isOn 
            ? Array.from(new Set(seriesEpisodes.map(ep => ep.ttid.split(':')[1]))).sort((a, b) => parseInt(a) - parseInt(b))
            : seriesEpisodes.map(ep => ({ hash: ep.infoHash, provider: ep.provider })).filter((ep, index, self) => 
                index === self.findIndex(e => e.hash === ep.hash && e.provider === ep.provider)
              );
          const seriesTorrents = Array.from(new Set(seriesEpisodes.map(ep => ep.infoHash)));
          const isAllEpisodesChecked = seriesEpisodes.every(ep => checkedItems.has(`${ep.infoHash}-${ep.fileIdx}`));
          return (
            <div 
              key={`${seriesItem.displayName}-${seriesItem.posterUrl}-${seriesIdx}`}
              className="bg-zinc-900 border border-zinc-800/60 rounded-xl p-4 space-y-4 hover:border-zinc-700 transition-colors"
            >
              {/* Show Title Header Block */}
              <div className="flex items-center gap-4 border-b border-zinc-800">
                <div className="min-w-0">
                <FallbackImage 
                  src={seriesItem.posterUrl} 
                  alt="poster metadata" 
                  fallback="/no-poster-16-9.jpg"
                  className="object-cover w-12 h-18 rounded-lg border border-zinc-800 flex-shrink-0"
                />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 
                    className="text-base font-bold text-white text-ellipsis hover:cursor-pointer hover:text-blue-400" 
                    title={seriesItem.displayName} 
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/series/${encodeURIComponent(seriesItem.ttid.split(':')[0])}/${encodeURIComponent(seriesItem.displayName)}`);
                    }}>
                      {seriesItem.displayName}
                    </h3>
                  <p className="text-xs text-zinc-500 font-medium mt-0.5">
                    {seriesEpisodes.length} {seriesEpisodes.length === 1 ? "Episode" : "Episodes"} queued
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:border-0 pt-3 sm:pt-0">
                  <button
                    type="button"
                    onClick={() => handleRemoveItems(seriesEpisodes)}
                    className="px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                  <input 
                  type="checkbox"
                  // 1. Compute state configurations dynamically
                  checked={seriesEpisodes.every(ep => checkedItems.has(`${ep.infoHash}-${ep.fileIdx}`))}
                  ref={(el) => {
                    if (el) {
                      const checkedCount = seriesEpisodes.filter(ep => checkedItems.has(`${ep.infoHash}-${ep.fileIdx}`)).length;
                      // It becomes indeterminate if some are checked, but not all of them
                      el.indeterminate = checkedCount > 0 && checkedCount < seriesEpisodes.length;
                    }
                  }}
                  onChange={(e) => {
                    const updatedSet = new Set(checkedItems);
                    if (e.target.checked) {
                      seriesEpisodes.forEach(ep => updatedSet.add(`${ep.infoHash}-${ep.fileIdx}`));
                    } else {
                      seriesEpisodes.forEach(ep => updatedSet.delete(`${ep.infoHash}-${ep.fileIdx}`));
                    }
                    setCheckedItems(updatedSet);
                  }}
                  // 2. CSS updates: Added 'indeterminate:bg-zinc-700' and 'indeterminate:after:content-["-"]'
                  className="appearance-none w-5 h-5 bg-zinc-800 border border-zinc-700 rounded focus:ring-green-500 focus:ring-2 hover:cursor-pointer transition-all relative checked:bg-green-600 indeterminate:bg-yellow-500 flex items-center justify-center after:text-white after:text-xs after:font-bold checked:after:content-['✓'] indeterminate:after:content-['-'] after:leading-none"
                />
                  </div>
              </div>

              {/* Inner Nested Episodes Sub-List Tracking Area */}
              <div className="space-y-3 pl-2">
                {seriesSeasonsorSeriesTorrents.map((seasonOrTorrent, seasonIdx) => (
                  <div key={`${seriesItem.displayName}-season-${seasonOrTorrent}-${seasonIdx}`} className="space-y-2">
                    <div className="flex items-center gap-4 border-b border-zinc-800">
                    <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-semibold text-zinc-300 mt-2 ${!isOn ? 'hover:cursor-pointer hover:text-blue-400' : ''}`} onClick={!isOn ? () => {router.push(`/series/${seriesItem.ttid}/${encodeURIComponent(seriesItem.displayName)}?season=${seasonOrTorrent}`)} : () => {}} >{!isOn ? (parseInt(seasonOrTorrent.toString()) > 0 ? `Season ${seasonOrTorrent}` : 'Specials') : (typeof seasonOrTorrent === 'object' && seasonOrTorrent !== null
                        ? seasonOrTorrent.provider + ` (${seasonOrTorrent.hash.slice(0, 8)}...)`
                        : 'Unknown Provider')}</h4>
                     <p className="text-xs text-zinc-500 font-medium mt-0.5">
                    {seriesEpisodes.filter(ep => !isOn ? ep.ttid.split(':')[1] === seasonOrTorrent : ep.infoHash === (typeof seasonOrTorrent === 'object' && seasonOrTorrent !== null ? seasonOrTorrent.hash : "Hash")).length} {seriesEpisodes.filter(ep => !isOn ? ep.ttid.split(':')[1] === seasonOrTorrent : ep.infoHash === (typeof seasonOrTorrent === 'object' && seasonOrTorrent !== null ? seasonOrTorrent.hash : "Hash")).length === 1 ? "Episode" : "Episodes"} queued
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:border-0 pt-3 sm:pt-0 pr-2">
                  <button
                    type="button"
                    onClick={() => handleRemoveItems(seriesEpisodes.filter( ep => !isOn ? ep.ttid.split(':')[1] === seasonOrTorrent : ep.infoHash === (typeof seasonOrTorrent === 'object' && seasonOrTorrent !== null ? seasonOrTorrent.hash : "Hash")))}
                    className="px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                    <input 
                  type="checkbox"
                  // 1. Compute state configurations dynamically
                  checked={seriesEpisodes.filter(ep => !isOn ? ep.ttid.split(':')[1] === seasonOrTorrent : ep.infoHash === (typeof seasonOrTorrent === 'object' && seasonOrTorrent !== null ? seasonOrTorrent.hash : "Hash")).every(ep => checkedItems.has(`${ep.infoHash}-${ep.fileIdx}`))}
                  ref={(el) => {
                    if (el) {
                      const checkedCount = seriesEpisodes.filter(ep => !isOn ? ep.ttid.split(':')[1] === seasonOrTorrent : ep.infoHash === (typeof seasonOrTorrent === 'object' && seasonOrTorrent !== null ? seasonOrTorrent.hash : "Hash")).filter(ep => checkedItems.has(`${ep.infoHash}-${ep.fileIdx}`)).length;
                      // It becomes indeterminate if some are checked, but not all of them
                      el.indeterminate = checkedCount > 0 && checkedCount < seriesEpisodes.filter(ep => !isOn ? ep.ttid.split(':')[1] === seasonOrTorrent : ep.infoHash === (typeof seasonOrTorrent === 'object' && seasonOrTorrent !== null ? seasonOrTorrent.hash : "Hash")).length;
                    }
                  }}
                  onChange={(e) => {
                    const updatedSet = new Set(checkedItems);
                    if (e.target.checked) {
                      seriesEpisodes.filter(ep => !isOn ? ep.ttid.split(':')[1] === seasonOrTorrent : ep.infoHash === (typeof seasonOrTorrent === 'object' && seasonOrTorrent !== null ? seasonOrTorrent.hash : "Hash")).forEach(ep => updatedSet.add(`${ep.infoHash}-${ep.fileIdx}`));
                    } else {
                      seriesEpisodes.filter(ep => !isOn ? ep.ttid.split(':')[1] === seasonOrTorrent : ep.infoHash === (typeof seasonOrTorrent === 'object' && seasonOrTorrent !== null ? seasonOrTorrent.hash : "Hash")).forEach(ep => updatedSet.delete(`${ep.infoHash}-${ep.fileIdx}`));
                    }
                    setCheckedItems(updatedSet);
                  }}
                  // 2. CSS updates: Added 'indeterminate:bg-zinc-700' and 'indeterminate:after:content-["-"]'
                  className="appearance-none w-5 h-5 bg-zinc-800 border border-zinc-700 rounded focus:ring-green-500 focus:ring-2 hover:cursor-pointer transition-all relative checked:bg-green-600 indeterminate:bg-yellow-500 flex items-center justify-center after:text-white after:text-xs after:font-bold checked:after:content-['✓'] indeterminate:after:content-['-'] after:leading-none"
                />
                </div>
                </div>
                  <div className="space-y-3 pl-5 border-l-2 border-zinc-800" >
                {seriesEpisodes.filter(ep => !isOn ? ep.ttid.split(':')[1] === seasonOrTorrent : ep.infoHash === (typeof seasonOrTorrent === 'object' && seasonOrTorrent !== null ? seasonOrTorrent.hash : "Hash")).map((episodeItem, epIdx) => (
                  <div 
                    key={`${episodeItem.infoHash}-${episodeItem.fileIdx}-${epIdx}`}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-zinc-950/60 border border-zinc-800/40 rounded-xl gap-4 transition-colors"
                  >
                    <div className="w-full flex items-center gap-4 flex-1 min-w-0">
                      {/* Thumbnail Container (Using landscape layout for individual episode clips) */}
                      <div className="w-18 h-12 rounded-lg overflow-hidden bg-zinc-900 flex-shrink-0 relative border border-zinc-800">
                        <FallbackImage 
                          src={episodeItem.posterUrl} 
                          alt="episode metadata" 
                          fallback="/no-poster-16-9.jpg"
                          className="object-cover w-full h-full"
                        />
                      </div>
                        
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs text-zinc-400 truncate ${isOn ? 'hover:cursor-pointer hover:text-blue-400' : ''}`} title={episodeItem.filename || episodeItem.title} onClick={isOn ? () => {router.push(`/series/${seriesItem.ttid}/${encodeURIComponent(seriesItem.displayName)}?season=${seasonOrTorrent}`)} : () => {}}>
                          { !isOn ? `⚙️ ${episodeItem.provider || "Unknown Provider"}` : parseInt(episodeItem.ttid.split(':')[1]) > 0 ? `Season ${episodeItem.ttid.split(':')[1]}` : `Specials`}
                        </p>
                        
                        {episodeItem.episodeTitle && (
                          <h4 
                            className="text-sm font-semibold text-zinc-200 truncate mt-0.5 hover:cursor-pointer hover:text-blue-400" 
                            title={episodeItem.episodeTitle} 
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/series/${encodeURIComponent(episodeItem.ttid)}/${encodeURIComponent(seriesItem.displayName)}`);
                            }}
                          >
                            {episodeItem.episodeTitle}
                          </h4>
                        )}
                        
                        <p className="text-xs text-zinc-500 truncate mt-0.5" title={episodeItem.filename || episodeItem.title}>
                          <span className="text-zinc-600 font-mono">File:</span> {episodeItem.filename || episodeItem.title || "Raw Stream Index Output"}
                        </p>
                        <p className="text-[10px] text-zinc-600 font-mono tracking-tight truncate mt-1">
                          HASH: {episodeItem.infoHash} | IDX: {episodeItem.fileIdx}
                        </p>
                      </div>
                    </div>

                    {/* Interaction Row Controls */}
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end border-t border-zinc-800/60 sm:border-0 pt-2 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(episodeItem.infoHash, episodeItem.fileIdx)}
                        className="px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                      >
                        Remove
                      </button>
                      <input
                        type="checkbox"
                        checked={checkedItems.has(`${episodeItem.infoHash}-${episodeItem.fileIdx}`)}
                        onChange={(e) => handleCheckboxChange(episodeItem.infoHash, episodeItem.fileIdx)(e)}
                        className="appearance-none w-5 h-5 bg-zinc-800 border border-zinc-700 rounded focus:ring-green-500 focus:ring-2 hover:cursor-pointer transition-all relative checked:bg-green-600 flex items-center justify-center after:text-white after:text-xs after:font-bold checked:after:content-['✓']"
                      />
                    </div>
                  </div>
                ))}
                </div>
              </div>
                ))}
            </div>
            </div>
          );
        })}
            {items.filter(item => item.itemType === "movie").map((item, index) => (
              <div 
                key={`${item.infoHash}-${item.fileIdx}-${index}`}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-zinc-900 border border-zinc-800/60 rounded-xl gap-4 hover:border-zinc-700 transition-colors"
              >
                <div className="w-full flex items-center gap-4 flex-1 min-w-0">
                  <div className={`${item.itemType === "movie" ? "w-12 h-18" : "w-18 h-12"} rounded-lg overflow-hidden bg-zinc-950 flex-shrink-0 relative border border-zinc-800`}>
                    <FallbackImage 
                      src={item.posterUrl} 
                      alt="poster metadata" 
                      fallback="/no-poster-16-9.jpg"
                      className="object-cover w-full h-full"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm break-words text-white truncate hover:cursor-pointer hover:text-blue-400" title={item.displayName} onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/${item.itemType}/${encodeURIComponent(item.ttid.split(':')[0])}/${encodeURIComponent(item.displayName)}`);
                    }}>
                      {item.displayName}
                    </h3>
                    <p className="text-xs text-zinc-400 truncate mt-0.5" title={item.filename || item.title}>
                      <span className="text-zinc-600 font-mono"></span>⚙️ {item.provider}
                    </p>
                    {item.itemType == "series" && (
                      <p className="text-xs break-all text-zinc-400 truncate mt-0.5 hover:cursor-pointer hover:text-blue-400" title={item.episodeTitle} onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/${item.itemType}/${encodeURIComponent(item.ttid)}/${encodeURIComponent(item.displayName)}`);
                      }}>
                        <span className="text-zinc-600 font-mono"></span> {item.episodeTitle}
                      </p>
                    )}
                    <p className="text-xs text-zinc-400 truncate mt-0.5" title={item.filename || item.title}>
                      <span className="text-zinc-600 break-all font-mono">File:</span> {item.filename || item.title || "Raw Stream Index Output"}
                    </p>
                    <p className="text-[10px] text-zinc-600 font-mono tracking-tight truncate mt-1">
                      HASH: {item.infoHash} | IDX: {item.fileIdx}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t border-zinc-800 sm:border-0 pt-3 sm:pt-0">
                  <button
                    onClick={() => handleRemoveItem(item.infoHash, item.fileIdx)}
                    className="px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    onChange={handleCheckboxChange(item.infoHash, item.fileIdx)}
                    className="appearance-none w-5 h-5 bg-zinc-800 border border-zinc-700 rounded focus:ring-green-500 focus:ring-2 hover:cursor-pointer transition-all relative checked:bg-green-600 flex items-center justify-center after:text-white after:text-xs after:font-bold checked:after:content-['✓']"
                  />
                </div>
                  {/* <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t border-zinc-800 sm:border-0 pt-3 sm:pt-0"> */}
                  {/* </div> */}
              </div>
            ))}
          </div>

        </>
      )}
          {/* --- BOTTOM TAB ACTION EXECUTIVE BAR --- */}
          {/* (serverStatus === "Downloading" || items.length > 0) &&  */}
        {!pageLoading && (
          <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-xl">
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Target Server Base Directory</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={targetPath === null ? "No target directory path chosen..." : `/media/${targetPath}`}
                  className={`w-full bg-zinc-950 border rounded-lg px-3 py-2 text-xs outline-none transition-colors ${
                    targetPath === null ? "text-zinc-600 border-zinc-800 italic" : "text-green-400 border-green-900/60 font-semibold"
                  }`}
                />
                <button
                  onClick={openLocationSelectorModal}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 rounded-lg whitespace-nowrap transition-colors cursor-pointer"
                >
                  Choose Location
                </button>
              </div>
              <br />
              <div className="flex items-end justify-center pt-2 sm:pt-0">
                <button
                  onClick={handleBatchDownloadExecute}
                  disabled={(targetPath === "" && serverStatus !== "Downloading") || (checkedItems.size === 0 && serverStatus !== "Downloading")}
                  className={`w-full hover:cursor-pointer sm:w-auto px-6 py-3 ${serverStatus === "Completed" ? "bg-green-600 hover:bg-green-700" : serverStatus === "Downloading" ? "bg-red-600 hover:bg-red-700" : "bg-zinc-800"} disabled:bg-zinc-800 text-white disabled:text-zinc-600 font-bold text-sm rounded-xl disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center gap-2`}
                >
                  {serverStatus === "Completed" ? `Start Batch Download (${checkedItems.size} items)` : serverStatus === "Downloading" ? "Cancel" : serverStatus === "Failed" ? "Retry Batch Download" : `Start Batch Download (${checkedItems.size} items)`}
                </button>
              </div>
                {(serverStatus === "Downloading") && (
                  <div className="pt-2 w-full transition-all">
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-green-500 h-full transition-all duration-300 ease-out"
                        style={{ width: `${serverProgress}%` }}
                      />
                    </div>
                    <div className="text-center text-sm text-zinc-400">
                      {(serverProgress).toFixed(2)}%
                    </div>
                  </div>
                )}
            </div>

          </div>
        )}

      {/* --- SELECTION DIALOGUE OVERLAY LAYER --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-xl rounded-xl p-5 flex flex-col shadow-2xl max-h-[85vh] search-scrollbar">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-white">Select Server Target Destination</h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-zinc-400 hover:text-white font-bold cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-zinc-950 p-3 rounded-lg border border-zinc-800 space-y-1 max-h-[40vh]">
              <div 
                onClick={() => setTargetPath("")}
                className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition-all font-semibold ${
                  targetPath === "" ? "bg-green-600 text-white" : "hover:bg-zinc-800 text-zinc-200"
                }`}
              >
                <img src="/folder.png" alt="" className="w-4 h-4 object-contain" />
                <span className="text-sm">media /</span>
              </div>
              
              <div className="pl-3 border-l border-zinc-800 ml-2 space-y-0.5">
                {rootFolders.map((dirName) => (
                  <FolderTreeItem
                    key={dirName}
                    name={dirName}
                    currentPath=""
                    selectedPath={targetPath}
                    onSelectPath={setTargetPath}
                    onRefreshParent={loadRootFolders}
                    activeRefreshRef={activeRefreshRef}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2 mt-3 mb-4">
              <input
                type="text"
                placeholder="New subdirectory name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-zinc-700"
              />
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="bg-zinc-800 hover:bg-zinc-700 hover:cursor-pointer text-zinc-200 px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                + Create
              </button>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-800 pt-3">
              <button
                onClick={() => {
                  setTargetPath(""); 
                  setIsModalOpen(false);
                }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold text-zinc-300 cursor-pointer"
              >
                Clear Selection
              </button>
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={targetPath === ""}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-zinc-800 text-white disabled:text-zinc-600 font-bold text-xs rounded-lg disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Confirm Destination
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}