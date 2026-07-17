"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";

type TreeItemProps = {
  name: string;
  size: string; // Size of the item (for files) or total size of contents (for folders)
  numberOfItems: number; // Number of items inside the folder
  numberOfFolders: number; // Number of folders inside the folder
  currentPath: string; // Tracks the accumulated path relative to /media
  refreshStats:() => void; // Callback to refresh the size of the parent folder
  onRefreshParent?: () => void; // Callback to tell the parent directory to refresh its list
  activeRefreshRef: React.MutableRefObject<{ [path: string]: () => Promise<void> }>;
}

export default function FileTreeItem({ name, size, numberOfItems, numberOfFolders, currentPath, refreshStats, onRefreshParent, activeRefreshRef }: TreeItemProps) {
  const isFolder = name.endsWith("/");
  const cleanName = isFolder ? name.slice(0, -1) : name;
  
  // Calculate this item's full path parameter for the backend API query
  const itemPath = currentPath ? `${currentPath}/${cleanName}` : cleanName;

  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState(cleanName);
  const [children, setChildren] = useState<{ name: string; size: string; numberOfItems: number, numberOfFolders: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMenuReady, setIsMenuReady] = useState(false);

  // Reference hook assigned to the dropdown container to check for outside clicks
  const menuRef = useRef<HTMLDivElement>(null);

  // 1. Outside Click Listener Effect
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      // If the clicked HTML element is NOT inside our menu container, close it
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) {
      setIsMenuReady(false);
      return;
    }

    setIsMenuReady(false);
    const animationFrame = window.requestAnimationFrame(() => {
      setIsMenuReady(true);
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [isMenuOpen]);

  useEffect(() => {
    return () => {
      if (isFolder && activeRefreshRef.current) {
        delete activeRefreshRef.current[itemPath];
      }
    };
  }, [itemPath, isFolder, activeRefreshRef]);

  // Helper function to fetch folder contents (moved out to reuse during refreshes)
  const fetchDirectoryContents = async (setLoadingInternal: boolean = true) => {
    if (setLoadingInternal) setLoading(true);
    try {
      const res = await fetch(
        `http://${window.location.hostname}:7000/getItems?folder=${encodeURIComponent(itemPath)}`
      );
      if (!res.ok) throw new Error("Could not retrieve contents");
      
      const data = await res.json();
      setChildren(data.items || []);
      setHasFetched(true);

      if (isFolder) {
        // Register this folder's refresh function in the activeRefreshRef for cascading refreshes
        activeRefreshRef.current[itemPath] = () => fetchDirectoryContents(false);
      }

    } catch (err) {
      console.error("Failed fetching directory items:", err);
      toast.error("Failed to load folder updates.");
    } finally {
      if (setLoadingInternal) setLoading(false);
    }
  };

  const RefreshAllChildren = async () => {
    try {
      // 1. Fetch only subfolders for the current folder path
      const res = await fetch(
        `http://${window.location.hostname}:7000/getItems?folder=${encodeURIComponent(itemPath)}&showFiles=false`
      );
      if (!res.ok) throw new Error("Could not retrieve contents");
      
      const data = await res.json();
      const childrenNames = data.items?.map((item: any) => item.name) || [];
      
      const childrenPaths = childrenNames.map((subName: string) => {
        const cleanSubName = subName.endsWith("/") ? subName.slice(0, -1) : subName;
        return itemPath ? `${itemPath}/${cleanSubName}` : cleanSubName;
      });

      // 2. --- FIXED: Deep Recursive Cascade ---
      // Instead of just looking for the function, we dispatch network commands 
      // to force every subfolder branch to run its own RefreshAllChildren layout routine
      await Promise.all(
        childrenPaths.map(async (childPath: string) => {
          // A. Trigger the component refresh if it's currently open/mounted in the DOM
          const registeredRefreshFn = activeRefreshRef.current[childPath];
          if (registeredRefreshFn) {
            await registeredRefreshFn();
          }

          // B. Crucial: Force the backend API request cascade to dig deeper into this child's subfolders
          try {
            const childRes = await fetch(
              `http://${window.location.hostname}:7000/getItems?folder=${encodeURIComponent(childPath)}&showFiles=false`
            );
            if (childRes.ok) {
              const childData = await childRes.json();
              const nestedChildren = childData.items || [];
              
              if (nestedChildren.length > 0) {
                // If this child has folders of its own, make a temporary recursive call to dig deeper
                await RefreshNestedSubTree(childPath);
              }
            }
          } catch (e) {
            console.warn(`Failed cascading deep tree refresh at path: ${childPath}`, e);
          }
        })
      );
    } catch (err) {
      console.error("Failed fetching directory items:", err);
    }
  };

  // --- ADD THIS HELPER FUNCTION INSIDE YOUR COMPONENT ---
  // This cleanly handles recursion over paths that might not be mounted in the React tree yet
  const RefreshNestedSubTree = async (targetPath: string): Promise<void> => {
    try {
      const res = await fetch(
        `http://${window.location.hostname}:7000/getItems?folder=${encodeURIComponent(targetPath)}&showFiles=false`
      );
      if (!res.ok) return;
      
      const data = await res.json();
      const subNames = data.items?.map((item: any) => item.name) || [];
      
      await Promise.all(
        subNames.map(async (subName: string) => {
          const cleanSub = subName.endsWith("/") ? subName.slice(0, -1) : subName;
          const deepPath = `${targetPath}/${cleanSub}`;
          
          // Trigger the UI if open
          if (activeRefreshRef.current[deepPath]) {
            await activeRefreshRef.current[deepPath]();
          }
          
          // Recurse downwards continuously
          await RefreshNestedSubTree(deepPath);
        })
      );
    } catch (err) {
      console.error("Nested tree refresh loop failed:", err);
    }
  };

  const handleToggle = async () => {
    if (!isFolder) return; // Files do nothing when clicked

    const nextOpenState = !isOpen;
    setIsOpen(nextOpenState);

    if (nextOpenState && !hasFetched) {
      await fetchDirectoryContents();
    }
  };

  const handleDeleteItem = async (e: React.MouseEvent, isFolderInternal: boolean) => {
    e.stopPropagation();

    try {
      let res;
      if (!isFolderInternal) {
        res = await fetch(`http://${window.location.hostname}:7000/deleteFile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filePath: itemPath })
        });
      } else {
        res = await fetch(`http://${window.location.hostname}:7000/deleteFolder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folder: itemPath })
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Deletion failed");

      toast.success(`${isFolderInternal ? "Folder" : "File"} deleted successfully!`);
      
      // Execute parent structural array sync
      if (onRefreshParent) onRefreshParent();
      if (refreshStats) refreshStats();
    } catch (err: any) {
      toast.error(`Could not delete ${isFolderInternal ? "folder" : "file"}: ${err.message || "Is it empty?"}`);
    }
  };

  const handleRenameItem = async (e: React.MouseEvent, isFolderInternal: boolean) => {
    e.stopPropagation();
    if (newItemName && newItemName.trim() && newItemName.trim() !== cleanName) {
      try {
        let res;
        if (!isFolderInternal) {
          res = await fetch(`http://${window.location.hostname}:7000/renameFile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filePath: itemPath, newName: newItemName.trim() })
          });
        } else {
          res = await fetch(`http://${window.location.hostname}:7000/renameFolder`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder: itemPath, newName: newItemName.trim() })
          });
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Rename failed");

        toast.success(`${isFolderInternal ? "Folder" : "File"} renamed successfully!`);
        
        // Execute parent structural array sync
        if (onRefreshParent) onRefreshParent();
      } catch (err: any) {
        toast.error(`Could not rename ${isFolderInternal ? "folder" : "file"}: ${err.message || "Name conflict?"}`);
      }
    }
  };

  const handleDownload = (e: React.MouseEvent, isFolderInternal: boolean) => {
    e.stopPropagation();
    
    if (isFolderInternal) {
      toast.error("Folder download is not supported.");
      return;
    }

    try {
      // 1. Create a hidden, throwaway HTML form element
      const form = document.createElement("form");
      form.method = "POST";
      form.action = `http://${window.location.hostname}:7000/downloadFileToClient`;
      form.style.display = "none";

      // 2. Add the filePath parameter to match application/x-www-form-urlencoded
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "filePath";
      input.value = itemPath; // The variable holding your path
      form.appendChild(input);

      // 3. Append to body, trigger the native stream download, and remove immediately
      document.body.appendChild(form);
      form.submit();
      form.remove();

      // This alert fires instantly now!
      toast.success("Download started!");
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Failed to initiate file download.");
    }
  };

  const handleRefreshFolder = async (e: React.MouseEvent, isFolderInternal: boolean) => {
    e.stopPropagation();
    if (!isFolderInternal) return;
    setLoading(true);
    try{
      await fetchDirectoryContents(false);
      await RefreshAllChildren();
      if (refreshStats) refreshStats();
    }
    catch (err) {
      console.error("Failed to refresh folder:", err);
      toast.error("Failed to refresh folder contents.");
    }
    finally {
      setLoading(false);
    }
  };
  // Helper function to pick the correct asset token based on extensions
  const getIcon = () => {
    if (isFolder) {
      return isOpen ? "/open-folder.png" : "/folder.png";
    }

    const ext = cleanName.split(".").pop()?.toLowerCase() || "";
    
    const docExtensions = ["txt", "pdf", "srt", "vtt", "sub", "doc", "docx"];
    const videoExtensions = ["mp4", "mkv", "avi", "mov", "wmv", "flv", "webm"];
    const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"];

    if (docExtensions.includes(ext)) return "/document.png";
    if (videoExtensions.includes(ext)) return "/video.png";
    if (imageExtensions.includes(ext)) return "/image.png";
    
    return "/unknown.png";
  };

  const regex = /\b(?:S(\d{1,2})E|(\d{1,2})X)(\d{1,2})\b/gi;
  const match = regex.exec(cleanName);

  return (
    <div className="select-none">
      {/* Row Item Layout Wrapper */}
      <div
        onClick={handleToggle}
        className={`flex items-center gap-3 py-1.5 px-2 rounded transition-colors ${
          isFolder ? "hover:bg-zinc-800 cursor-pointer text-zinc-200 hover:text-white" : "text-zinc-400"
        }`}>
        {!isFolder && match && (
          <span className="text-xs text-zinc-500 font-mono">
            S{match[1] || match[2]}-E{match[3]}
          </span>
        )}
        <img
          src={getIcon()}
          alt=""
          className="w-5 h-5 object-contain flex-shrink-0"
        />
        <span className="text-sm font-medium overflow-x-auto whitespace-nowrap scrollbar-none">
          {cleanName}
        </span>
        {loading && <span className="text-xs text-zinc-500 animate-pulse">loading...</span>}
        <span className="text-xs text-zinc-500 font-mono">
          {size}
        </span>
        {/* --- THREE DOTS OPTIONS DROPDOWN CONTEXT MENU --- */}
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation(); // Stops folder open/close toggles
              setIsMenuOpen(!isMenuOpen);
            }}
            className={`flex w-7 h-7 items-center justify-center rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer ${isFolder ? "hover:bg-zinc-900" : "hover:bg-zinc-800"}`}
            title={isFolder ? "Folder Actions" : "File Actions"}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </button>

          {/* Floating Actions Overlay Box */}
          {isMenuOpen && (
            <div 
              onClick={(e) => e.stopPropagation()}
              className={`absolute right-0 mt-1 w-28 bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl py-1 z-30 transform-gpu transition-all duration-150 ease-out origin-top-right ${isMenuReady ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-1"}`}
            >
              {!isFolder && (
                <button
                  onClick={(e) => {
                    setIsMenuOpen(false);
                    handleDownload(e, isFolder);
                  }}
                className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <img src="/download.png" alt="Download" className="w-4 h-4" />
                Download
              </button>
              )}
              {isFolder && (
                <button
                  onClick={(e) => {
                    setIsMenuOpen(false);
                    handleRefreshFolder(e, isFolder);
                  }}
                className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <img src="/refresh.svg" alt="Refresh" className="w-4 h-4" />
                Refresh
              </button>
              )}
              <button
                onClick={(e) => {
                  setIsMenuOpen(false);
                  setIsRenameModalOpen(true);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <img src="/edit.png" alt="Rename" className="w-4 h-4" />
                Rename
              </button>

              <button
                onClick={(e) => {
                  setIsMenuOpen(false);
                  setIsDeleteModalOpen(true);
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

      {/* Nested Children Tree Sub-Loop Render Block */}
      {isFolder && isOpen && (
        <div className="sm:pl-6 border-l border-zinc-800 sm:ml-4 ml-1 mt-0.5 space-y-0.5">
          {children.length === 0 && !loading ? (
            <div className="text-xs text-zinc-600 py-1 pl-2 italic">Empty folder</div>
          ) : (
            children.map(({ name, size, numberOfItems, numberOfFolders }) => (
              <FileTreeItem
                key={name}
                size={size}
                numberOfItems={numberOfItems}
                numberOfFolders={numberOfFolders}
                name={name}
                currentPath={itemPath}
                // Recursively link the reload pipeline downwards 
                onRefreshParent={fetchDirectoryContents}
                refreshStats={refreshStats}
                activeRefreshRef={activeRefreshRef}
              />
            ))
          )}
          {loading && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
              <span className="loader"></span>
              <span className="ml-4 text-lg text-white">Loading...</span>
            </div>
          )}
        </div>
      )}
      {/* --- DELETE CONFIRMATION MODAL --- */}
      {isDeleteModalOpen && (
        <div onClick={() => setIsDeleteModalOpen(false)} className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div onClick={(e) => e.stopPropagation()} className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-xl p-5 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <label className="block text-sm font-bold text-zinc-400 tracking-wider">Confirm Deletion</label>
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-zinc-400 hover:text-white font-bold cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>
            <div className="mb-4">
              <span className="block text-sm font-bold text-zinc-400 tracking-wider mb-1">Are you sure you want to delete this {isFolder ? "folder and all its contents" : "file"}?</span>
              <span className={`block text-center text-sm font-bold bg-black text-red-400 tracking-wider p-1 mb-1 w-full ${itemPath.split(" ").some((word: string) => word.length >= 20) ? "break-all" : "break-words"}`}>{itemPath}</span>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button 
                onClick={(e) => {
                  setIsDeleteModalOpen(false);
                  handleDeleteItem(e, isFolder);
                }} 
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer"
              >
                Delete
              </button>
              <button 
                onClick={() => setIsDeleteModalOpen(false)} 
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* --- RENAME MODAL --- */}
      {isRenameModalOpen && (
        <div onClick={() => {setIsRenameModalOpen(false); setNewItemName(cleanName);}} className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div onClick={(e) => e.stopPropagation()} className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-xl p-5 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <label className="block text-sm font-bold text-zinc-400 tracking-wider">Rename {isFolder ? "Folder" : "File"}</label>
              <button 
                onClick={() => {setIsRenameModalOpen(false); setNewItemName(cleanName);}}
                className="text-zinc-400 hover:text-white font-bold cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold text-zinc-400 tracking-wider mb-1">New Name</label>
              <input 
                type="text" 
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button 
                onClick={(e) => {
                  setIsRenameModalOpen(false);
                  handleRenameItem(e, isFolder);
                }} 
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer"
              >
                Rename
              </button>
              <button 
                onClick={() => {setIsRenameModalOpen(false); setNewItemName(cleanName);}} 
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}