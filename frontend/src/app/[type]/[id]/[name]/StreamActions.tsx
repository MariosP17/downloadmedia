"use client";
import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";

type Props = {
  hash: string;
  filename?: string;
  title?: string;
  id: string;
  ttid: string;
  data: { progress: number; status: string };
};

type ServerDownloadState = "idle" | "loading" | "downloading" | "completed" | "failed" | "cancelling";

// Inner Helper Component: Recursive Folder Selection Row
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

// Main Downloader Component Module
export default function StreamActions({ hash, filename, title, id, ttid,data }: Props) {
  const [copiedServer, setCopiedServer] = useState(false);
  const [copiedDevice, setCopiedDevice] = useState(false);
  const [deviceLoading, setDeviceLoading] = useState(false);
  // Server download components/states
  const [serverState, _setServerState] = useState<ServerDownloadState>("idle");
  const [serverProgress, setServerProgress] = useState<number>(0);
  
  // Custom Selection Window / Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rootFolders, setRootFolders] = useState<string[]>([]);
  const [targetPath, setTargetPath] = useState(""); 
  const [targetName, setTargetName] = useState(filename || title || "");
  const [newFolderName, setNewFolderName] = useState("");

  const serverStateRef = useRef<ServerDownloadState>("idle");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const setServerState = (newState: ServerDownloadState) => {
    serverStateRef.current = newState;
    _setServerState(newState);
  };
  const activeRefreshRef = useRef<{ [path: string]: () => Promise<void> }>({});
  const getlink = (target: "server" | "device") => {
    const domain = target === "device" ? window.location.hostname + ":11470/" : "127.0.0.1:11470/";
    return "http://" + domain + hash + "/" + id + "?external=1&download=1";
  };

  const copy = async (target: "server" | "device") => {
    const text = getlink(target);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      if (target === "server") setCopiedServer(true);
      else setCopiedDevice(true);
      setTimeout(() => {
        setCopiedServer(false);
        setCopiedDevice(false);
      }, 1500);
      toast.success("Link copied to clipboard!");
    } catch (e) {
      toast.error("Failed to copy link.");
    }
  };

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

  const checkServerProgress = async () => {
    const currentLiveState = serverStateRef.current;
    try {
      const res = await fetch(`http://${window.location.hostname}:7000/progress/${hash}/${id}`);
      if (!res.ok) throw new Error("Progress unavailable");
      const data = await res.json();

      if (data.status === "Downloading" && serverStateRef.current !== "cancelling") {
        setServerState("downloading");
        if (data.progress >= 0 && data.progress <= 100) {
        setServerProgress(data.progress);
        }
        else if (data.progress == -2.0) {
          setServerState("failed");
          setServerProgress(0);
          if (intervalRef.current) clearInterval(intervalRef.current);
          toast.error("Download failed on server. Try another torrent");
        }
      } else if (data.status === "Completed") {
        setServerState("completed");
        setServerProgress(100);
        setTimeout(() => {
          setServerState("idle");
          setServerProgress(0);
        }, 3000);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    } catch (error) {
      const stateOnFailure = serverStateRef.current;
      if (stateOnFailure !== "cancelling" && stateOnFailure !== "completed" && stateOnFailure !== "idle") {
        setServerState("failed");
      } else if (stateOnFailure === "cancelling") {
        setServerState("idle");
        setServerProgress(0);
      }
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  };

  const openSelectionModal = async () => {
    setIsModalOpen(true);
    setTargetPath(""); // Starts with base root directory path selected
    await loadRootFolders();
  };

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

  const triggerCancellationTask = async () => {
    setServerState("cancelling");
    try {
      const cancelResponse = await fetch(`http://${window.location.hostname}:7000/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: hash, idx: String(id) }),
      });
      if (!cancelResponse.ok) throw new Error();
      toast.success("Cancel request sent!");
    } catch {
      toast.error("Failed to cancel process.");
      setServerState("downloading");
    }
  };

  const executeServerDownloadPipeline = async () => {
    // Both tracking fields are required
    if (!targetPath || !targetName.trim()) return;

    setIsModalOpen(false);
    setServerState("loading");
    setServerProgress(0);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Compute explicit absolute mounting location
    const destinationFolder = `/media/${targetPath}`;

    try {
      const response = await fetch(`http://${window.location.hostname}:7000/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ttid: ttid,
          identifier: hash,
          idx: String(id),
          path: destinationFolder,
          name: targetName.trim() // Strip manual trailing extension string if appended
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!response.ok) throw new Error();

      toast.success("Download started on your remote server!");
      intervalRef.current = setInterval(checkServerProgress, 1000);
    } catch (error: any) {
      clearTimeout(timeoutId);
      toast.error(error.name === "AbortError" ? "Server connections timed out." : "Failed to initiate server pipeline.");
      if (serverStateRef.current !== "cancelling") setServerState("failed");
    }
  };

  useEffect(() => {
    const checkInitialServerState = async () => {
      try {

        // If the server tells us it's downloading or already has progress cached
        if (data.status === "Downloading") {
          setServerState("downloading");
          setServerProgress(data.progress || 0);

          // Fire up the polling interval immediately so the UI stays synced
          if (!intervalRef.current) {
            intervalRef.current = setInterval(checkServerProgress, 1000);
          }
        } else if (data.status === "Completed") {
          setServerState("completed");
          setServerProgress(100);
          setTimeout(() => {
          setServerState("idle");
          setServerProgress(0);
        }, 3000);
        }
      } catch (error) {
        console.error("Failed to sync initial server state on load:", error);
      }
    };

    checkInitialServerState();

    // Cleanup: Clear interval when the component unmounts to prevent memory leaks
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [hash, id]);
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    
    // Safety fallback cleanup block
    return () => {
      document.body.style.overflow = "";
    };
  }, [isModalOpen]);
  
  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full">
        {/* Server Block Controls */}
        <div className="flex-1 flex flex-col items-stretch">
          <div className="text-xs text-zinc-400 mb-2 text-center sm:text-left">Server</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => copy("server")}
              className="flex-1 px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600 cursor-pointer text-sm text-center text-zinc-200"
            >
              {copiedServer ? "Copied" : "Copy Link"}
            </button>
            <button
              onClick={serverState === "downloading" ? triggerCancellationTask : openSelectionModal}
              disabled={serverState === "loading" || serverState === "completed" || serverState === "cancelling"}
              className={`flex-1 px-3 py-2 rounded text-sm text-white text-center transition-colors font-medium ${
                serverState === "completed"
                  ? "bg-blue-600 cursor-not-allowed"
                  : serverState === "loading" || serverState === "cancelling"
                  ? "bg-zinc-800 cursor-wait text-zinc-500"
                  : serverState === "downloading"
                  ? "bg-red-600 hover:bg-red-700 cursor-pointer"
                  : "bg-green-600 hover:bg-green-700 cursor-pointer"
              }`}
            >
              {serverState === "idle" && "Download"}
              {serverState === "loading" && "Starting..."}
              {serverState === "completed" && "Finished ✓"}
              {serverState === "failed" && "Retry Download"}
              {serverState === "downloading" && "Cancel"}
              {serverState === "cancelling" && "Canceling..."}
            </button>
          </div>
        </div>

        <div className="border-t border-zinc-800 sm:border-l sm:border-t-0 sm:h-12 my-2 sm:my-0" />

        {/* Local Device Elements */}
        <div className="flex-1 flex flex-col items-stretch">
          <div className="text-xs text-zinc-400 mb-2 text-center sm:text-left">Your Device</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => copy("device")}
              className="flex-1 px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600 cursor-pointer text-sm text-center text-zinc-200"
            >
              {copiedDevice ? "Copied" : "Copy Link"}
            </button>
            <button
              onClick={async () => {
                const url = getlink("device");
                setDeviceLoading(true);
                try {
                  await fetch(url, { method: "HEAD" });
                  window.location.href = url;
                } catch {
                  window.location.href = url;
                } finally {
                  setDeviceLoading(false);
                }
              }}
              className="flex-1 px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 cursor-pointer text-sm text-white text-center"
              disabled={deviceLoading}
            >
              {deviceLoading ? "Starting..." : "Download"}
            </button>
          </div>
        </div>
      </div>
      {/* <div className="border-t border-zinc-800 sm:border-l sm:border-t-0 sm:h-12 my-2 sm:my-0" /> */}

      {/* Progress Bar Display Render Segment */}
      {(serverState === "downloading" || serverState === "cancelling") && (
        <div className="w-full transition-all">
          <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-green-500 h-full transition-all duration-300 ease-out"
              style={{ width: `${serverProgress}%` }}
            />
          </div>
          <div className="text-xs text-zinc-400 mt-1.5 font-medium">
            {serverState === "cancelling" ? "Halting download pipelines..." : `Downloading... ${serverProgress}%`}
          </div>
        </div>
      )}

      {/* MODAL CONFIGURATION DIALOG LAYER */}
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

            {/* Tree View Scrolling Container */}
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

            {/* Inline Folder Creation Utility */}
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

            {/* Form Configuration Inputs Footer Block */}
            <div className="space-y-2 border-t border-zinc-800 pt-3">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Target Path (Read-Only)</label>
                <input
                  type="text"
                  readOnly
                  value={`/media/${targetPath}`}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-400 outline-none select-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Assigned Filename</label>
                <input
                  type="text"
                  placeholder="Provide explicit valid output name..."
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-green-600 transition-colors"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={executeServerDownloadPipeline}
                  disabled={!targetPath || !targetName.trim()}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 hover:cursor-pointer disabled:bg-zinc-800 text-white disabled:text-zinc-600 font-bold text-xs rounded-lg disabled:cursor-not-allowed transition-colors"
                >
                  Start Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}