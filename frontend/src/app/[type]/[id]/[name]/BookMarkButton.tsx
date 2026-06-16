"use client";

import { toast } from "react-hot-toast";
import { useState, useEffect } from "react";
import { useSyncedLocalStorage } from "../../../Utils/useSyncedLocalStorage";

type BookmarkProps = {
  infoHash: string;
  fileIdx: number;
  type: string;
  ttid: string;
  filename?: string; // Optional filename for display purposes
  provider?: string; // Optional provider for display purposes
};

export default function BookmarkButton({ infoHash, fileIdx, ttid, type, filename, provider }: BookmarkProps) {
  // 1. Maintain bookmark status inside React State
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);
  const [rawbookmarks, setBookmarks] = useSyncedLocalStorage("stream_bookmarks");

  // Helper helper function to abstract localStorage lookups safely
  const getBookmarks = (): any[] => {
    // if (typeof window === "undefined") return []; // Guard clause for SSR
    try {
      return JSON.parse(localStorage.getItem("stream_bookmarks") || "[]");
    } catch {
      return [];
    }
  };

  // 2. Sync bookmark status on component mount or when target specs change
  useEffect(() => {
    const found = getBookmarks().some((b: any) => b.infoHash === infoHash && b.fileIdx === fileIdx && b.ttid === ttid && b.type === type && b.filename === filename && b.provider === provider);
    setIsBookmarked(found);
  }, [rawbookmarks]);

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevents clicking the button from triggering row actions
    const bookmarkData = { infoHash, fileIdx, ttid, type, filename, provider };
    const existing = getBookmarks();

    try {
      if (isBookmarked) {
        // Remove bookmark
        const updated = existing.filter((b: any) => !(b.infoHash === infoHash && b.fileIdx === fileIdx && b.ttid === ttid && b.type === type && b.filename === filename && b.provider === provider));
        console.log("Updated bookmarks after removal:", updated);
        setBookmarks(JSON.stringify(updated));
        setIsBookmarked(false); // Triggers visual re-render safely
        toast.success("Stream unbookmarked successfully.");
      } else {
        // Add bookmark
        existing.push(bookmarkData);
        console.log("Updated bookmarks after adding:", existing);
        setBookmarks(JSON.stringify(existing));
        setIsBookmarked(true); // Triggers visual re-render safely
        toast.success("Stream bookmarked successfully!");
      }
    } catch (error) {
      toast.error("Failed to update bookmark.");
    }
  };

  // 3. Conditionally swap image paths based natively on local state
  const currentIconSrc = isBookmarked ? "/bookmark_check.png" : "/bookmark_add.png";

  return (
    <button
      type="button"
      className="cursor-pointer hover:bg-zinc-600 active:bg-zinc-700/60 p-1.5 rounded-md transition-colors select-none group focus:outline-none"
      onClick={handleBookmarkClick}
      title="Bookmark this stream layout position"
    >
      <img 
        src={currentIconSrc}
        alt={isBookmarked ? "Bookmarked" : "Add Bookmark"} 
        className="w-5 h-5 object-contain" 
      />
    </button>
  );
}