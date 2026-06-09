"use client"; // Marks this specific boundary safely for browser interactivity

import { toast } from "react-hot-toast";
import {useRef,useEffect} from "react";

type BookmarkProps = {
  infoHash: string;
  fileIdx: number;
  type: string; // Optional type for future extensibility (e.g. "movie" or "series")
  ttid: string;
  icon: string; // Optional custom icon for the bookmark button

};

export default function BookmarkButton({ infoHash, fileIdx, ttid,type, icon }: BookmarkProps) {
  const bookMarkIconRef = useRef<HTMLImageElement>(null);

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevents clicking the button from triggering row actions

    const bookmarkData = { infoHash, fileIdx, ttid, type };
    // --- INSERT YOUR BOOKMARK STATE SAVING LOGIC HERE ---
    // Example: localStorage or custom fetch API
    try {
      const existing = JSON.parse(localStorage.getItem("stream_bookmarks") || "[]");
      if (isBookmarked(infoHash, fileIdx)) {
        const updated = existing.filter((b: any) => !(b.infoHash === infoHash && b.fileIdx === fileIdx));
        localStorage.setItem("stream_bookmarks", JSON.stringify(updated));
        if (bookMarkIconRef.current) {
          bookMarkIconRef.current.src = "/bookmark_add.png";
        }
        toast.success("Stream unbookmarked successfully.");
      }
      else {
        existing.push(bookmarkData);
        localStorage.setItem("stream_bookmarks", JSON.stringify(existing));
        if (bookMarkIconRef.current) {
          bookMarkIconRef.current.src = "/bookmark_check.png";
        }
        toast.success("Stream bookmarked successfully!");
      }
    } catch {
      toast.error("Failed to save bookmark.");
    }
  };
  useEffect(() => {
    // Sync icon state on mount in case bookmarks were changed elsewhere
    if (bookMarkIconRef.current) {
      bookMarkIconRef.current.src = isBookmarked(infoHash, fileIdx) ? "/bookmark_check.png" : "/bookmark_add.png";
    }
  }, []);
  const isBookmarked = (hash: string, fileIdx: number) => {
    try {
      const bookmarks = JSON.parse(localStorage.getItem("stream_bookmarks") || "[]");
      return bookmarks.some((b: any) => b.infoHash === hash && b.fileIdx === fileIdx);
    } catch {
      return false;
    }
  }

  return (
    <div 
      className="absolute top-3 right-3 cursor-pointer hover:bg-zinc-800 active:bg-zinc-700/60 p-1.5 rounded-md transition-colors z-10 select-none group" 
      onClick={handleBookmarkClick}
      title="Bookmark this stream layout position"
    >
      <img 
        ref={bookMarkIconRef}
        src={icon}
        alt="Bookmark" 
        className="w-5 h-5 object-contain" 
        />
    </div>
  );
}