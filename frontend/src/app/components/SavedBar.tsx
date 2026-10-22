"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Loader from "../loader";
import toast from "react-hot-toast";
import FallbackImage from "./fallbackimg";
import { MediaType } from "../../../Props";

interface SavedMediaItem {
    ttid: string;
    name: string;
    type: number;
    poster_url: string;
    year: number;
    series_name?: string;
    episode_info?: string;
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

  const deleteSavedMedia = async (media: SavedMediaItem) => {
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
      toast.success("Saved media deleted successfully");
    } catch (error) {
      console.error("Failed to delete saved media:", error);
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
        className={`fixed right-0 top-0 h-full w-74 bg-zinc-900 border-l border-zinc-800 z-60 p-4 transform transition-transform duration-200 ease-in-out ${
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

    <nav className="mt-6">
    {savedMedia.length === 0 && !loading && (
        <p className="text-zinc-400 text-sm">No saved media.</p>
    )}
    {savedMedia.length > 0 && savedMedia.map((media, _) => (
    <div key={media.ttid} className="mb-2 p-2 bg-zinc-800 rounded ">
        <div onClick={async() => {await navigateToMedia(media)}} key={media.ttid} className="cursor-pointer hover:bg-zinc-700/60 transition-colors duration-200">
            <p className="text-zinc-200 mb-1">{media.series_name || media.name} <span className="text-zinc-400 text-sm">({media.year})</span></p>
            {media.episode_info && (
                <p className="text-zinc-400 text-sm mb-2">{media.episode_info} <span className="text-white text-sm">{media.name}</span></p>
            )}
            <div className=" flex flex-col items-center">
                <FallbackImage className="mb-2 w-32 h-auto" src={media.poster_url} alt={media.name} />
            </div>
        </div>
        <div className="flex justify-end mt-2">
            <img
            src="/delete.png"
            alt="Delete"
            className="w-5 h-5 cursor-pointer hover:opacity-70"
            onClick={async (e) => {
                e.stopPropagation();
                await deleteSavedMedia(media);
             }}
            />
        </div>
    </div>
  ))}
</nav>
{loading && <Loader />}
      </aside>
    </>
  );
}