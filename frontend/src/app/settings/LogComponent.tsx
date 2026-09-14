"use client";

import { useEffect, useRef, useState } from "react";

export default function LogComponent() {
  const [logs, setLogs] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const previousScrollHeightRef = useRef<number>(0);

  const fetchLogs = async (cursorParam: string | null) => {
    setIsLoading(true);
    try {
      const url = new URL(`http://${window.location.hostname}:7000/getLogs`);
      if (cursorParam) url.searchParams.set("cursor", cursorParam);
      const res = await fetch(url.toString());
      const data: { logs: string[]; cursor: string | null; hasMore: boolean } = await res.json();
      const newChunk = data.logs || [];

      setHasMore(data.hasMore);
      setCursor(data.cursor);

      if (newChunk.length === 0) {
        return;
      }

      // Save previous scroll height before DOM updates
      if (containerRef.current) {
        previousScrollHeightRef.current = containerRef.current.scrollHeight;
      }

      // Prepend older logs to the top
      setLogs((prev) => [...newChunk, ...prev]);
    } catch (err) {
      console.error("Error fetching logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load: fetch the newest logs and auto-scroll to bottom
  useEffect(() => {
    fetchLogs(null).then(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    });
  }, []);

  // Maintain scroll position after prepending older logs
  useEffect(() => {
    if (containerRef.current && previousScrollHeightRef.current > 0) {
      const newScrollHeight = containerRef.current.scrollHeight;
      const heightDifference = newScrollHeight - previousScrollHeightRef.current;
      containerRef.current.scrollTop += heightDifference;
      previousScrollHeightRef.current = 0;
    }
  }, [logs]);

  // Trigger loading when scrolling close to the top
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el || isLoading || !hasMore) return;

    if (el.scrollTop <= 80) {
      void fetchLogs(cursor);
    }
  };

  const scrollToBottom = () => {
    const el = containerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  };

  return (
    <div className="flex h-[600px] w-full flex-col rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-zinc-300 mt-4">
      <div className="flex justify-end gap-2   mb-2">
        <button onClick={() =>{setLogs([]); setCursor(null); setHasMore(true); void fetchLogs(null); }} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1 rounded cursor-pointer"><img src="/refresh.svg" alt="Refresh" /> Refresh</button>
        <button onClick={() => scrollToBottom()} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1 rounded cursor-pointer"><img src="/down-arrow.svg" alt="Scroll Down" /> Scroll Down</button>
      </div>
      <hr className="border-zinc-600 mb-2" />
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto space-y-1 select-text search-scrollbar"
      >
        {isLoading && (
          <div className="flex justify-center items-center h-full">
            <div className="log-loader"></div>
          </div>
        )}

        {!hasMore && (
          <div className="py-2 text-center border-b border-zinc-900 mb-2 text-red-300">
            — Reached beginning of logs —
          </div>
        )}

        {logs.map((line, idx) => (
          <div
            key={idx}
            className="whitespace-pre-wrap break-all hover:bg-zinc-900/60 px-1 py-0.5 rounded text-green-500"
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}