"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";

type TreeItemProps = {
  name: string;
  currentPath: string; // Tracks the accumulated path relative to /media
  onRefreshParent?: () => void; // Callback to tell the parent directory to refresh its list
};

export default function FileTreeItem({ name, currentPath, onRefreshParent }: TreeItemProps) {
  const isFolder = name.endsWith("/");
  const cleanName = isFolder ? name.slice(0, -1) : name;
  
  // Calculate this item's full path parameter for the backend API query
  const itemPath = currentPath ? `${currentPath}/${cleanName}` : cleanName;

  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  // Helper function to fetch folder contents (moved out to reuse during refreshes)
  const fetchDirectoryContents = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `http://${window.location.hostname}:7000/getItems?folder=${encodeURIComponent(itemPath)}`
      );
      if (!res.ok) throw new Error("Could not retrieve contents");
      
      const data = await res.json();
      setChildren(data.items || []);
      setHasFetched(true);
    } catch (err) {
      console.error("Failed fetching directory items:", err);
      toast.error("Failed to load folder updates.");
    } finally {
      setLoading(false);
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
    if (!confirm(`Are you sure you want to delete "${cleanName}"?`)) return;

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
    } catch (err: any) {
      toast.error(`Could not delete ${isFolderInternal ? "folder" : "file"}: ${err.message || "Is it empty?"}`);
    }
  };

  const handleRenameItem = async (e: React.MouseEvent, isFolderInternal: boolean) => {
    e.stopPropagation();
    const newName = prompt("Enter new name:", cleanName);
    if (newName && newName.trim() && newName.trim() !== cleanName) {
      try {
        let res;
        if (!isFolderInternal) {
          res = await fetch(`http://${window.location.hostname}:7000/renameFile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filePath: itemPath, newName: newName.trim() })
          });
        } else {
          res = await fetch(`http://${window.location.hostname}:7000/renameFolder`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder: itemPath, newName: newName.trim() })
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
        }`}
      >
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

        {/* --- THREE DOTS OPTIONS DROPDOWN CONTEXT MENU --- */}
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation(); // Stops folder open/close toggles
              setIsMenuOpen(!isMenuOpen);
            }}
            className="flex w-7 h-7 items-center justify-center rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer hover:bg-zinc-900"
            title="Folder Actions"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </button>

          {/* Floating Actions Overlay Box */}
          {isMenuOpen && (
            <div 
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 mt-1 w-28 bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl py-1 z-30 animate-in fade-in zoom-in-95 duration-100"
            >
              <button
                onClick={(e) => {
                  setIsMenuOpen(false);
                  handleRenameItem(e, isFolder);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <img src="/edit.png" alt="Rename" className="w-4 h-4" />
                Rename
              </button>
              
              <button
                onClick={(e) => {
                  setIsMenuOpen(false);
                  handleDeleteItem(e, isFolder);
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
        <div className="pl-6 border-l border-zinc-800 ml-4 mt-0.5 space-y-0.5">
          {children.length === 0 && !loading ? (
            <div className="text-xs text-zinc-600 py-1 pl-2 italic">Empty folder</div>
          ) : (
            children.map((childName) => (
              <FileTreeItem
                key={childName}
                name={childName}
                currentPath={itemPath}
                // Recursively link the reload pipeline downwards 
                onRefreshParent={fetchDirectoryContents}
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
    </div>
  );
}