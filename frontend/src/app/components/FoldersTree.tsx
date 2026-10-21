"use client";
import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
// import Loader from "../../../loader";

// Inner Helper Component: Recursive Folder Selection Row
type FolderTreeItemProps = {
  name: string;
  size: string;
  numberOfItems: number;
  numberOfFolders: number;
  currentPath: string;
  selectedPath: string;
  onSelectPath: (path: string) => void;
  onRefreshParent?: () => void;
  activeRefreshRef: React.MutableRefObject<{ [path: string]: () => Promise<void> }>,
  expandedFolders?: string;
  exists?: boolean;
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

const closeAnyOpenMenu = () => {
  globalActiveCloseMenuFn?.();
};

export default function FolderTree({ name, size, numberOfItems, numberOfFolders, currentPath, selectedPath, onSelectPath, onRefreshParent, activeRefreshRef, expandedFolders, exists }: FolderTreeItemProps) {
  const cleanName = name.endsWith("/") ? name.slice(0, -1) : name;
  const itemPath = currentPath ? `${currentPath}/${cleanName}` : cleanName;
  const menuAnchorRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(exists &&expandedFolders != null && expandedFolders.split("/").includes(cleanName));
  const [newName, setNewName] = useState(cleanName);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [subFolders, setSubFolders] = useState<{ name: string; size: string; numberOfItems: number; numberOfFolders: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMenuReady, setIsMenuReady] = useState(false);
  const [menuPlacement, setMenuPlacement] = useState<"down" | "up">("down");
  const [configuration, setConfiguration] = useState<any>({});

  const isSelected = selectedPath === itemPath;
  useEffect(() => {
    const getConfiguration = async () => {
      const config = await fetch(`http://${window.location.hostname}:7000/getConfiguration`).then(res => res.json());
      setConfiguration(config);
    };
    getConfiguration();
  }, []);
  useEffect(() => {
    const fetchSubFoldersOnConditions = async () => {
        if (exists && expandedFolders != null && expandedFolders.split("/").includes(cleanName)) {
        fetchSubfolders(); // Fetch subfolders when the component mounts or when expandedFolders changes
        }
    }

    fetchSubFoldersOnConditions();
  }, [expandedFolders]);
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
    closeAnyOpenMenu();
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      await fetchSubfolders();
    }
  };

  const handleDeleteFolder = async (e: React.MouseEvent) => {
    e.stopPropagation();

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
  }, [isMenuOpen, menuPlacement]);

  useEffect(() => {
    const anchorElement = menuAnchorRef.current;
    if (!isMenuOpen || !anchorElement) return;

    const updatePlacement = () => {
      const anchorRect = anchorElement.getBoundingClientRect();
      const menuElement = anchorElement.querySelector<HTMLElement>("[data-folder-menu]");
      const estimatedMenuHeight = menuElement?.getBoundingClientRect().height ?? 88;

      let scrollParent: HTMLElement | null = anchorElement.parentElement;
      while (scrollParent) {
        const overflowY = window.getComputedStyle(scrollParent).overflowY;
        if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
          break;
        }
        scrollParent = scrollParent.parentElement;
      }

      const boundaryRect = scrollParent?.getBoundingClientRect();
      const bottomBoundary = boundaryRect?.bottom ?? window.innerHeight;
      const topBoundary = boundaryRect?.top ?? 0;

      const spaceBelow = bottomBoundary - anchorRect.bottom;
      const spaceAbove = anchorRect.top - topBoundary;

      setMenuPlacement(spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow ? "up" : "down");
    };

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);

    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [isMenuOpen]);
  return (
    <div className="select-none text-left">
      <div
        onClick={() => {
          closeAnyOpenMenu();
          onSelectPath(itemPath);
        }}
        className={`flex items-center justify-between group py-2 px-2 rounded cursor-pointer transition-colors ${
          isSelected ? "bg-green-600 text-white selected-path" : "hover:bg-zinc-800 text-zinc-300"
        }`}
      >
        {numberOfFolders > 0 && (
        <button 
          onClick={handleToggleExpand} 
          className="w-4 h-4 text-xs font-bold text-zinc-500 hover:text-zinc-200 transition-colors p-0.5 pr-5"
        >
          {isOpen ? "▼" : "▶"}
        </button>
        )}
        <div className="flex items-center gap-2 overflow-x-auto truncate min-w-0 flex-1">
          <img
            src={isOpen ? "/open-folder.png" : "/folder.png"}
            alt=""
            className="w-4 h-4 object-contain flex-shrink-0"
          />
          <div>
            <span className="text-sm font-medium break-words whitespace-normal">
              {cleanName}
            </span>
            {loading && <span className="text-xs text-zinc-500 animate-pulse">...</span>}
            {!loading && numberOfFolders == 0 && (
              <span className={`text-xs pl-1 no-break ${isSelected ? "text-white" : "text-zinc-500"} font-mono`}>
                ({numberOfItems} {numberOfItems === 1 ? "file" : "files"})
              </span>
            )}
            {!loading && numberOfFolders == numberOfItems  && numberOfFolders != 0 && (
                <span className={`text-xs pl-1 no-break ${isSelected ? "text-white" : "text-zinc-500"} font-mono`}>
                  ({numberOfFolders} {numberOfFolders === 1 ? "folder" : "folders"})
                </span>
              )}
          </div>
        </div>

        {/* --- THREE DOTS OPTIONS DROPDOWN CONTEXT MENU --- */}
        <div className="relative flex-shrink-0 ml-2" ref={menuAnchorRef}>
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
              data-folder-menu
              className={`absolute right-0 w-28 bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl py-1 z-30 transform-gpu transition-all duration-150 ease-out ${isMenuReady ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-1"} ${menuPlacement === "up" ? "bottom-full mb-1 origin-bottom-right" : "mt-1 origin-top-right"}`}
            >
            {itemPath !== configuration["MoviesFolder"] && itemPath !== configuration["TVShowsFolder"] &&
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                  setIsRenameModalOpen(true); // Open the rename modal
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <img src="/edit.png" alt="Rename" className="w-4 h-4" />
                Rename
              </button>
            }
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                  setIsDeleteModalOpen(true); // Open the delete confirmation modal
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
            subFolders.map(({ name, size, numberOfItems, numberOfFolders }) => (
              <FolderTree
                key={name}
                name={name}
                size={size}
                numberOfItems={numberOfItems}
                numberOfFolders={numberOfFolders}
                currentPath={itemPath}
                selectedPath={selectedPath}
                onSelectPath={onSelectPath}
                onRefreshParent={fetchSubfolders}
                activeRefreshRef={activeRefreshRef}
                expandedFolders={expandedFolders}
                exists={exists}
              />
            ))
          )}
        </div>
      )}
      {isDeleteModalOpen && (
        <div onClick={() => {setIsDeleteModalOpen(false);}} className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div onClick={(e) => e.stopPropagation()} className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-xl p-5 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <label className="block text-sm font-bold text-zinc-400 tracking-wider">Confirm Deletion</label>
              <button 
                onClick={() => {setIsDeleteModalOpen(false);}} 
                className="text-zinc-400 hover:text-white font-bold cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4">
              <span className="block text-sm font-boldtext-zinc-400 tracking-wider mb-1">Are you sure you want to delete this folder and all its contents?</span>
              <span className={`block text-center text-sm font-bold bg-black text-red-400 tracking-wider p-1 mb-1 w-full ${itemPath.split(" ").some((word: string) => word.length >= 20) ? "break-all" : "break-words"}`}>{itemPath}</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={(e) => {handleDeleteFolder(e); setIsDeleteModalOpen(false);}}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 hover:cursor-pointer disabled:bg-zinc-800 text-white disabled:text-zinc-600 font-bold text-xs rounded-lg disabled:cursor-not-allowed transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => {setIsDeleteModalOpen(false);}}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold text-zinc-300 cursor-pointer"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
      {isRenameModalOpen && (
        <div onClick={() => {setIsRenameModalOpen(false); setNewName(cleanName);}} className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div onClick={(e) => e.stopPropagation()} className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-xl p-5 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <label className="block text-sm font-boldtext-zinc-400 tracking-wider">Rename Folder</label>
              <button 
                onClick={() => {setIsRenameModalOpen(false); setNewName(cleanName);}} 
                className="text-zinc-400  hover:text-white font-bold cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4">
              <input 
                type="text" 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)} 
                className="block text-sm font-bold bg-black text-zinc-400 tracking-wider p-1 mb-1 w-full"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={(e) => {handleRenameFolder(e); setIsRenameModalOpen(false);}}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 hover:cursor-pointer disabled:bg-zinc-800 text-white disabled:text-zinc-600 font-bold text-xs rounded-lg disabled:cursor-not-allowed transition-colors"
              >
                Rename
              </button>
              <button
                onClick={() => {setIsRenameModalOpen(false); setNewName(cleanName);}}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold text-zinc-300 cursor-pointer"
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