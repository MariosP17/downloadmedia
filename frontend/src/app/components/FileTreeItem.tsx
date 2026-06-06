"use client";

import { useState } from "react";

type TreeItemProps = {
  name: string;
  currentPath: string; // Tracks the accumulated path relative to /media
};

export default function FileTreeItem({ name, currentPath }: TreeItemProps) {
  const isFolder = name.endsWith("/");
  const cleanName = isFolder ? name.slice(0, -1) : name;
  
  // Calculate this item's full path parameter for the backend API query
  const itemPath = currentPath ? `${currentPath}/${cleanName}` : cleanName;

  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

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

  const handleToggle = async () => {
    if (!isFolder) return; // Files do nothing when clicked

    const nextOpenState = !isOpen;
    setIsOpen(nextOpenState);

    // Only hit the API the first time the folder opens to optimize network overhead
    if (nextOpenState && !hasFetched) {
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
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="select-none">
      {/* Row Item Layout Wrapper */}
      <div
        onClick={handleToggle}
        className={`flex items-center gap-3 py-1.5 px-2 rounded transition-colors ${
          isFolder ? "hover:bg-zinc-800 cursor-pointer text-zinc-200 hover:text-white" : "text-zinc-400"
        }`}
      >
        <img
          src={getIcon()}
          alt=""
          className="w-5 h-5 object-contain flex-shrink-0"
        />
        <span className="text-sm truncate font-medium">{cleanName}</span>
        {loading && <span className="text-xs text-zinc-500 animate-pulse">loading...</span>}
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
  );
}