"use client";

import { AnimatePresence, motion, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import Loader from "../loader";
import toast from "react-hot-toast";
import FallbackImage from "./fallbackimg";
import { MediaType } from "../../../Props";

interface SavedMediaItem {
    ttid: string;
    name: string;
    type: number;
    poster_url: string;
    year: string;
    series_name?: string;
    episode_info?: string;
}

const SWIPE_DELETE_THRESHOLD = -140;

function SavedMediaCard({
  media,
  onNavigate,
  onDelete,
}: {
  media: SavedMediaItem;
  onNavigate: (media: SavedMediaItem) => void;
  onDelete: (media: SavedMediaItem) => Promise<boolean>;
}) {
  const x = useMotionValue(0);
  const deleteOpacity = useTransform(x, [-100, -20, 0], [1, 1, 0]);
  const [deleting, setDeleting] = useState(false);
  const dragged = useRef(false);
  const resetDragged = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDragEnd = async (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    if (resetDragged.current) clearTimeout(resetDragged.current);
    resetDragged.current = setTimeout(() => {
      dragged.current = false;
    }, 200);

    if (info.offset.x < SWIPE_DELETE_THRESHOLD) {
      setDeleting(true);
      const deleted = await onDelete(media);
      if (!deleted) {
        setDeleting(false);
      }
    }
  };

  return (
    <motion.div
      layout
      className="relative mb-2 overflow-hidden rounded bg-red-700"
    >

      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-end pr-5 text-white"
        style={{ opacity: deleteOpacity }}
        aria-hidden
      >
        <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
          <img src="/delete.png" alt="" className="h-6 w-6 brightness-0 invert" />
          Remove
        </span>
      </motion.div>
      <motion.div
        drag={deleting ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.9, right: 0.05 }}
        animate={deleting ? { x: "-100%" } : { x: 0 }}
        style={{ x }}
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
        className="relative rounded bg-zinc-800 p-2"
        onDragStart={() => {
          dragged.current = true;
        }}
        onDragEnd={handleDragEnd}
        onTap={(event) => {
          if (event.target instanceof HTMLElement && event.target.closest("button")) {
            return;
          }
          if (dragged.current) {
            if (resetDragged.current) clearTimeout(resetDragged.current);
            dragged.current = false;
            return;
          }
          onNavigate(media);
        }}
        >
        <p className="mb-1 text-zinc-200">
          {media.series_name || media.name}{" "}
          <span className="text-sm text-zinc-400">({media.year})</span>
        </p>
        {media.episode_info && (
          <p className="mb-2 text-sm text-zinc-400">
            {media.episode_info}{" "}
            <span className="text-sm text-white">{media.name}</span>
          </p>
        )}
        <div className="flex flex-col items-center">
          <FallbackImage className="max-h-62 w-auto" src={media.poster_url} alt={media.name} />
        </div>
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            aria-label={`Delete ${media.name}`}
            className="rounded p-1 hover:cursor-pointer hover:bg-zinc-700 hover:opacity-80"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setDeleting(true);
              void onDelete(media).then((deleted) => {
                if (!deleted) setDeleting(false);
              });
            }}
          >
            <img src="/delete.png" alt="" className="h-5 w-5" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function SavedBar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [render, setRender] = useState(false);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savedMedia, setSavedMedia] = useState<SavedMediaItem[]>([]);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const apiUrl = (path: string) => `http://${window.location.hostname}:7000${path}`;

  useEffect(() => {
    const fetchSavedMedia = async () => {
      try {
        setLoading(true);
        const response = await fetch(apiUrl("/getAllSavedMedia"));
        const data = await response.json();
        if (!data.success) {
          toast.error(data.message || "Failed to fetch saved media");
          if (onClose) onClose();
          throw new Error(data.message || "Failed to fetch saved media");
        }
        setSavedMedia(data.data);
        setRender(true);
        // Trigger enter transition on the next macro-task tick
        const id = setTimeout(() => setVisible(true), 200);
        return () => clearTimeout(id);
      } catch (error) {
        console.error("Failed to open saved bar:", error);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchSavedMedia();
    } else {
      // 1. Start the exit transition immediately
      setVisible(false);
      
      // 2. Wait for the CSS duration (200ms) before unmounting from DOM
      const id = setTimeout(() => setRender(false), 200);
      return () => clearTimeout(id);
    }
  }, [open]);

  // Use the render state instead of the open prop to control structural mount
  if (!render) return null;

  const navigateToMedia = async (media: SavedMediaItem) => {
    try {
      setLoading(true);
      window.location.href = `/${MediaType[media.type]}/${encodeURIComponent(media.ttid)}/${encodeURIComponent(media.name)}`;
    } catch (error) {
      console.error("Failed to navigate to media:", error);
      toast.error("Failed to navigate to media");
    } finally {
        setLoading(false);
    }
  };

  const deleteSavedMedia = async (media: SavedMediaItem): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await fetch(apiUrl(`/deleteSavedMedia`), {
        method: "DELETE",
        body: new URLSearchParams({ ttid: media.ttid })
      });
      const data = await response.json();
      if (!data.success) {
        toast.error(data.message || "Failed to delete saved media");
        throw new Error(data.message || "Failed to delete saved media");
      }
      setSavedMedia((prev) => prev.filter((item) => item.ttid !== media.ttid));
      window.dispatchEvent(new CustomEvent("saved-media-deleted", { detail: { ttid: media.ttid } }));
      toast.success("Saved media deleted successfully");
      return true;
    } catch (error) {
      console.error("Failed to delete saved media:", error);
      return false;
    } finally {
      setLoading(false);
    }
  };
  


  const deleteAllSavedMedia = async () => {
    try {
      setLoading(true);
      const response = await fetch(apiUrl("/clearSavedMedia"), {
        method: "DELETE"
      });
      const data = await response.json();
      if (!data.success) {
        toast.error(data.message || "Failed to delete all saved media");
        throw new Error(data.message || "Failed to delete all saved media");
      }
      setSavedMedia([]);
      window.dispatchEvent(new CustomEvent("saved-media-deleted-all"));
      toast.success("All saved media deleted successfully");
    } catch (error) {
      console.error("Failed to delete all saved media:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop Backdrop overlay */}
      <div
        className={`fixed inset-0 z-56 transition-opacity duration-200 ease-in-out ${
          visible ? "bg-black/50" : "bg-black/0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden
      />

      {/* Sidebar Navigation Panel */}
      <aside
        className={`fixed overflow-y-auto search-scrollbar right-0 top-0 h-full w-74 bg-zinc-900 border-l border-zinc-800 z-60 p-4 transform transition-transform duration-200 ease-in-out ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-lg">Saved Media</h2>
          <button
            onClick={onClose}
            aria-label="Close saved bar"
            className="text-zinc-200 hover:text-white hover:cursor-pointer"
          >
            ✕
          </button>
        </div>
        {savedMedia.length > 0 && (
        <div className="mb-4 flex items-center justify-end">
          <button id='delete-all' className='cursor-pointer rounded bg-red-700 px-3 py-1 text-sm font-semibold text-white hover:bg-red-800' onClick={async () => {
            setConfirmDeleteAll(true);
          }}>
            Delete All
          </button>
        </div>
        )}
    <nav className="mt-6">
    {savedMedia.length === 0 && !loading && (
        <p className="text-zinc-400 text-sm">No saved media.</p>
    )}
    {savedMedia.length > 0 && (
      <AnimatePresence initial={false}>
        {savedMedia.map((media) => (
          <SavedMediaCard
            key={media.ttid}
            media={media}
            onNavigate={(item) => void navigateToMedia(item)}
            onDelete={deleteSavedMedia}
          />
        ))}
      </AnimatePresence>
    )}
</nav>
{loading && <Loader />}
      </aside>
    {confirmDeleteAll && (
      <div onClick={() => {setConfirmDeleteAll(false);}} className="fixed inset-0 bg-black/70 z-60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div onClick={(e) => e.stopPropagation()} className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-xl p-5 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <label className="block text-sm font-bold text-zinc-400 tracking-wider">Confirm Deletion</label>
              <button 
                onClick={() => {setConfirmDeleteAll(false);}} 
                className="text-zinc-400 hover:text-white font-bold cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-2">
              <span className="block text-sm font-boldtext-zinc-400 tracking-wider mb-1">Are you sure you want to delete all saved media?</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={(e) => {deleteAllSavedMedia(); setConfirmDeleteAll(false);}}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 hover:cursor-pointer disabled:bg-zinc-800 text-white disabled:text-zinc-600 font-bold text-xs rounded-lg disabled:cursor-not-allowed transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => {setConfirmDeleteAll(false);}}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold text-zinc-300 cursor-pointer"
              >
                No
              </button>
            </div>
          </div>
        </div>
    )}
    </>
  );
}