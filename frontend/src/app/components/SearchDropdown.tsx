"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FallbackImage from "./fallbackimg";

export default function SearchDropdown({
  query,
  onClose,
}: {
  query: string;
  onClose?: () => void;
}) {
  const [movies, setMovies] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [active, setActive] = useState<"movies" | "series">("movies");
  const [loading, setLoading] = useState(false);
  const scrollRef = (null as unknown) as { current: HTMLDivElement | null };
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (query.length < 3) {
      setMovies([]);
      setSeries([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const movieRes = await fetch(
          `https://v3-cinemeta.strem.io/catalog/movie/top/search=${encodeURIComponent(query)}.json`
        );

        const seriesRes = await fetch(
          `https://v3-cinemeta.strem.io/catalog/series/top/search=${encodeURIComponent(query)}.json`
        );

        const movieData = await movieRes.json();
        const seriesData = await seriesRes.json();

        if (!cancelled) {
          setMovies(movieData.metas || []);
          setSeries(seriesData.metas || []);
        }
      } catch (e) {
        if (!cancelled) {
          setMovies([]);
          setSeries([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  // reset scroll to top when switching active tab
  useEffect(() => {
    if (scrollEl) scrollEl.scrollTop = 0;
  }, [active, scrollEl]);

  // close on outside click
  useEffect(() => {
    const el = document;
    function onDocClick(e: MouseEvent) {
      const path = e.composedPath ? e.composedPath() : (e as any).path || [];
      // find dropdown element
      const dropdown = document.querySelector(".search-dropdown-root");
      const input = document.getElementById("search-input");
      if (!dropdown) return;
      if (path.includes(dropdown) || (input && path.includes(input))) return;
      if (onClose) onClose();
    }

    el.addEventListener("mousedown", onDocClick);
    return () => el.removeEventListener("mousedown", onDocClick);
  }, [onClose]);

  if (query.length < 3) return null;

  return (
    <div className="search-dropdown-root absolute left-1/2 top-full transform -translate-x-1/2 w-full max-w-2xl mt-2 bg-zinc-900 border border-zinc-800 rounded-xl z-50">
      <div className="p-2 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="relative w-40 bg-zinc-900 rounded-full p-1">
            <div
              className={`absolute top-1/2 left-0 w-1/2 h-8 bg-zinc-800 rounded-full transform -translate-y-1/2 transition-transform duration-200 ${
                active === "series" ? "translate-x-full" : "translate-x-0"
              } `}
            />

            <div className="relative flex">
              <button
                type="button"
                aria-pressed={active === "movies"}
                onClick={() => setActive("movies")}
                className={`relative z-10 flex-1 text-center px-3 py-1 rounded-full transition-colors duration-200 ${
                  active === "movies" ? "text-white" : "text-zinc-400"
                } hover:cursor-pointer `}
              >
                Movies
              </button>

              <button
                type="button"
                aria-pressed={active === "series"}
                onClick={() => setActive("series")}
                className={`relative z-10 flex-1 text-center px-3 py-1 rounded-full transition-colors duration-200 ${
                  active === "series" ? "text-white" : "text-zinc-400"
                } hover:cursor-pointer `}
              >
                Series
              </button>
            </div>
          </div>

          <div className="text-zinc-400 text-sm">
            {active === "movies" ? `${movies.length} results` : `${series.length} results`}
          </div>
        </div>
      </div>

      <div className="relative">
        {loading ? (
          <div className="p-4">
            <div className="animate-pulse">
              <div className="h-4 bg-zinc-800 rounded mb-2 w-3/4" />
              <div className="h-10 bg-zinc-800 rounded mb-2" />
              <div className="h-10 bg-zinc-800 rounded mb-2" />
            </div>
          </div>
        ) : (
          <div
            ref={(el) => setScrollEl(el)}
            className="search-scrollbar overflow-y-auto max-h-80 px-2 py-1"
          >
            <div className={`${active === "movies" ? "block" : "hidden"}`}>
              {movies.length >0 ? movies.map((item: any) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (onClose) onClose();
                    router.push(`/movie/${encodeURIComponent(item.id)}/${encodeURIComponent(item.name)}`);
                  }}
                  className="flex items-center gap-3 p-3 hover:bg-zinc-800 cursor-pointer"
                >
                  <FallbackImage
                    src={item.poster || "/no-poster.jpg"}
                    alt={item.name}
                    className="w-12 h-16 object-cover rounded-md transition-transform transform hover:scale-105 duration-200"
                  />
                  <div className="text-white">{item.name}</div>
                </div>
              )) : (
                <div className="p-4 text-zinc-400">No movies found for "{query}"</div>
              )}
            </div>

            <div className={`${active === "series" ? "block" : "hidden"}`}>
              {series.length > 0 ? series.map((item: any) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (onClose) onClose();
                    router.push(`/series/${encodeURIComponent(item.id)}/${encodeURIComponent(item.name)}`);
                  }}
                  className="flex items-center gap-3 p-3 hover:bg-zinc-800 cursor-pointer"
                >
                  <FallbackImage
                    src={item.poster || "/no-poster.jpg"}
                    alt={item.name}
                    className="w-12 h-16 object-cover rounded-md transition-transform transform hover:scale-105 duration-200"
                  />
                  <div className="text-white">{item.name}</div>
                </div>
              )) : (
                <div className="p-4 text-zinc-400">No series found for "{query}"</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}