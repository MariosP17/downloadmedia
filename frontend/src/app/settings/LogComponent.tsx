"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export default function LogComponent() {
  const [logs, setLogs] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [searchText, setSearchText] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDetailsElement>(null);
  const previousScrollHeightRef = useRef<number>(0);
  const selectedDateRef = useRef<string>("");
  const scrollToBottomAfterLoadRef = useRef(false);
  const requestVersionRef = useRef(0);
  const previousSearchTextRef = useRef(searchText);
  const activeSearch = appliedSearch;
  const visibleLogs = logs;

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        actionsRef.current.open = false;
      }
    };

    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  const parseDate = (value: string) => {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (value: string) => {
    if (!value) return "";
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  };

  const fetchLogs = useCallback(async (
    cursorParam: string | null,
    dateParam: string | undefined,
    searchParam: string,
    requestVersion: number
  ) => {
    const effectiveDate = dateParam !== undefined ? dateParam : selectedDateRef.current;
    setIsLoading(true);
    try {
      let nextCursor = cursorParam;
      let hasMorePages = true;
      let newChunk: string[] = [];

      do {
        const url = new URL(`http://${window.location.hostname}:7000/getLogs`);
        if (nextCursor) url.searchParams.set("cursor", nextCursor);
        if (effectiveDate) url.searchParams.set("date", effectiveDate);
        if (searchParam) url.searchParams.set("search", searchParam);
        const res = await fetch(url.toString());
        const data: { logs: string[]; cursor: string | null; hasMore: boolean } = await res.json();
        if (requestVersion !== requestVersionRef.current) return;
        newChunk = data.logs || [];
        nextCursor = data.cursor;
        hasMorePages = data.hasMore;

        setHasMore(data.hasMore);
        setCursor(data.cursor);
      } while (newChunk.length === 0 && hasMorePages && nextCursor);

      if (newChunk.length === 0) {
        return;
      }

      // Save previous scroll height before DOM updates
      if (requestVersion === requestVersionRef.current && containerRef.current) {
        previousScrollHeightRef.current = containerRef.current.scrollHeight;
      }

      // Prepend older logs to the top
      if (requestVersion === requestVersionRef.current) {
        setLogs((prev) => [...newChunk, ...prev]);
      }
    } catch (err) {
      if (requestVersion === requestVersionRef.current) {
        console.error("Error fetching logs:", err);
      }
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const handleDateChange = (date: Date | null) => {
    const formattedDate = formatDate(date);
    const requestVersion = ++requestVersionRef.current;
    setSelectedDate(formattedDate);
    selectedDateRef.current = formattedDate;
    setLogs([]);
    setCursor(null);
    setHasMore(true);
    previousScrollHeightRef.current = 0;
    scrollToBottomAfterLoadRef.current = true;
    void fetchLogs(null, formattedDate, appliedSearch, requestVersion);
  };

  // Initial load: fetch the newest logs and auto-scroll to bottom
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      scrollToBottomAfterLoadRef.current = true;
      void fetchLogs(null, undefined, "", requestVersionRef.current);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [fetchLogs]);

  useEffect(() => {
    if (previousSearchTextRef.current === searchText) return;
    previousSearchTextRef.current = searchText;

    const query = searchText.trim();
    if (query.length > 0 && query.length < 3) return;

    const timeout = window.setTimeout(() => {
      const requestVersion = ++requestVersionRef.current;
      setAppliedSearch(query);
      setLogs([]);
      setCursor(null);
      setHasMore(true);
      previousScrollHeightRef.current = 0;
      void fetchLogs(null, selectedDateRef.current, query, requestVersion);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [fetchLogs, searchText]);

  // Maintain scroll position after prepending older logs
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (scrollToBottomAfterLoadRef.current && !isLoading) {
      el.scrollTop = el.scrollHeight;
      if (el.scrollHeight > el.clientHeight || !hasMore) {
        scrollToBottomAfterLoadRef.current = false;
      }
    } else if (previousScrollHeightRef.current > 0) {
      const newScrollHeight = el.scrollHeight;
      const heightDifference = newScrollHeight - previousScrollHeightRef.current;
      el.scrollTop += heightDifference;
      previousScrollHeightRef.current = 0;
    }
  }, [hasMore, isLoading, logs]);

  // Load older pages when the current logs do not fill the scroll area.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const el = containerRef.current;
      if (el && !isLoading && hasMore && cursor && el.scrollHeight <= el.clientHeight) {
        void fetchLogs(cursor, selectedDateRef.current, appliedSearch, requestVersionRef.current);
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [appliedSearch, cursor, fetchLogs, hasMore, isLoading, logs]);

  // Trigger loading when scrolling close to the top
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el || isLoading || !hasMore) return;

    if (el.scrollTop <= 80) {
      void fetchLogs(cursor, selectedDateRef.current, appliedSearch, requestVersionRef.current);
    }
  };

  const scrollToBottom = () => {
    if (actionsRef.current) {
      actionsRef.current.open = false;
    }
    const el = containerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  };

  const refreshLogs = () => {
    if (actionsRef.current) {
      actionsRef.current.open = false;
    }
    const requestVersion = ++requestVersionRef.current;
    setLogs([]);
    setCursor(null);
    setHasMore(true);
    previousScrollHeightRef.current = 0;
    scrollToBottomAfterLoadRef.current = true;
    void fetchLogs(null, selectedDateRef.current, appliedSearch, requestVersion);
  };

  return (
    <div className="flex h-[600px] w-full flex-col rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-zinc-300 mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <label htmlFor="log-date" className="text-zinc-400">Date:</label>
          <DatePicker
            id="log-date"
            selected={parseDate(selectedDate)}
            onChange={handleDateChange}
            dateFormat="dd/MM/yyyy"
            placeholderText="Pick a date"
            className="bg-zinc-900 border border-zinc-700 text-zinc-300 px-2 py-1 rounded text-xs focus:outline-none focus:border-zinc-500"
            // calendarClassName="!bg-zinc-900 !border-zinc-700"
          />
          {selectedDate && (
            <button
              onClick={() => handleDateChange(null)}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-200 px-2 py-1 rounded text-xs cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex min-w-48 flex-1 items-center gap-2 sm:max-w-xs">
          <label htmlFor="log-search" className="sr-only">Search logs</label>
          <input
            id="log-search"
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search logs (3+ characters)"
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
          {searchText.trim().length > 0 && searchText.trim().length < 3 && (
            <span className="whitespace-nowrap text-zinc-500">Type 3+ characters</span>
          )}
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <button
            onClick={refreshLogs}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1 rounded cursor-pointer"
          >
            <img src="/refresh.svg" alt="Refresh" /> Refresh
          </button>
          <button
            onClick={() => scrollToBottom()}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1 rounded cursor-pointer"
          >
            <img src="/down-arrow.svg" alt="Scroll Down" /> Scroll Down
          </button>
        </div>
        <details ref={actionsRef} className="relative sm:hidden">
          <summary className="cursor-pointer list-none text-zinc-300 p-1 bg-zinc-800 rounded-full hover:bg-zinc-700">
            <img src="/more.svg" alt="Actions" />
          </summary>
          <div className="absolute right-0 z-10 mt-1 flex min-w-max flex-col gap-1 rounded border border-zinc-700 bg-zinc-900 p-1 shadow-lg">
            <button
              onClick={refreshLogs}
              className="flex items-center gap-2 rounded px-3 py-1 text-left text-zinc-300 hover:bg-zinc-800"
            >
              <img src="/refresh.svg" alt="Refresh" /> Refresh
            </button>
            <button
              onClick={scrollToBottom}
              className="flex items-center gap-2 rounded px-3 py-1 text-left text-zinc-300 hover:bg-zinc-800"
            >
              <img src="/down-arrow.svg" alt="Scroll Down" /> Scroll Down
            </button>
          </div>
        </details>
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

        {!isLoading && visibleLogs.length === 0 && (
          <div className="py-8 text-center text-zinc-500">
            {activeSearch
              ? `No logs matching "${searchText.trim()}"`
              : selectedDate
                ? `No logs found for ${formatDisplayDate(selectedDate)}`
                : "No logs found"}
          </div>
        )}

        {!hasMore && visibleLogs.length > 0 && (
          <div className="py-2 text-center border-b border-zinc-900 mb-2 text-red-300">
            — Reached beginning of logs —
          </div>
        )}

        {visibleLogs.map((line, idx) => (
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