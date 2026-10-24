"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import SearchDropdown from "./SearchDropdown";

type SavedMedia = {
  ttid: string;
};

export default function TopBar({
  onToggleSidebar,
  onToggleSaved,
}: {
  onToggleSidebar?: () => void;
  onToggleSaved?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [savedMedia, setSavedMedia] = useState<SavedMedia[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchSavedMedia = async () => {
      try {
        const res = await fetch(`http://${window.location.hostname}:7000/getAllSavedMedia`);
        const data = await res.json();
        if (data.success === false) throw new Error(data.message || "Failed to fetch saved media");
        setSavedMedia(data.data || []);
      } catch (error) {
        console.error("Error fetching saved media:", error);
      }
    };

    const handleSavedMediaDeleted = (event: Event) => {
      const { ttid } = (event as CustomEvent<{ ttid?: string }>).detail ?? {};
      if (!ttid) return;
      setSavedMedia((current) => current.filter((media) => media.ttid !== ttid));
    };

    const handleSavedMediaAdded = (event: Event) => {
      const { ttid } = (event as CustomEvent<SavedMedia>).detail ?? {};
      if (!ttid) return;
      setSavedMedia((current) => (
        current.some((media) => media.ttid === ttid)
          ? current
          : [...current, { ttid }]
      ));
    };

    void fetchSavedMedia();
    window.addEventListener("saved-media-deleted", handleSavedMediaDeleted);
    window.addEventListener("saved-media-added", handleSavedMediaAdded);
    window.addEventListener("saved-media-deleted-all", () => {
      setSavedMedia([]);
    });
    return () => {
      window.removeEventListener("saved-media-deleted", handleSavedMediaDeleted);
      window.removeEventListener("saved-media-added", handleSavedMediaAdded);
      window.removeEventListener("saved-media-deleted-all", () => {
        setSavedMedia([]);
      })
    };
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.length < 1) return;
    setShowDropdown(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <header id="top-bar" className="sticky top-0 w-full bg-zinc-900 border-b border-zinc-800 z-55">
  <div className=" mx-auto px-4 py-3 flex items-center justify-between gap-4">
    
    {/* Logo + Sidebar Button Container */}
    <div className="flex items-center gap-2 flex-shrink-0">
      <div>
        <Link href="/" className="flex items-center">
          <img src="/stremio.png" alt="Stremio" className="h-8 w-8 object-contain" />
        </Link>
      </div>
      <button
        aria-label="Open sidebar"
        onClick={() => onToggleSidebar && onToggleSidebar()}
        className="p-1 rounded-md hover:bg-zinc-800 hover:cursor-pointer text-zinc-200"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </div>

    {/* Search Container - Grows to fill space but respects the logo */}
    <div className="flex-1 flex justify-center max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="relative w-full">
        <input
          id="search-input"
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setShowDropdown(v.trim().length >= 3);
          }}
          onFocus={() => setShowDropdown(query.trim().length >= 3)}
          placeholder="Search movies or series..."
          className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2 text-white text-sm outline-none"
        />

        {showDropdown && (
          <SearchDropdown
            query={query}
            onClose={() => setShowDropdown(false)}
          />
        )}
      </form>
    </div>

    {/* Invisible spacer to perfectly center the search bar on desktop */}
    <div className="hidden md:block w-8 flex-shrink-0" aria-hidden="true" />
     <button
        aria-label="Open saved"
        onClick={() => onToggleSaved && onToggleSaved()}
        className="p-1 rounded-md hover:bg-zinc-800 hover:cursor-pointer text-zinc-200"
      >
        <span className="relative inline-flex">
          <img src="/bookmarks.svg" alt="Bookmarks" className="h-7 w-7 object-contain" />
          <AnimatePresence>
            {savedMedia.length > 0 && (
              <motion.span
                initial={{ opacity: 0, scale: 0.3, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.3, y: -4 }}
                transition={{ type: "spring", stiffness: 500, damping: 20 }}
                className="absolute -right-2 -top-2 min-w-5 rounded-full bg-purple-600 px-1 text-center text-xs leading-5 text-white"
              >
                <span className="font-bold">{savedMedia.length}</span>
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </button>

  </div>
</header>
  );
}
