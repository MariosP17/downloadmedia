"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchDropdown({
  query,
}: {
  query: string;
}) {
  const [movies, setMovies] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [showMovies, setShowMovies] = useState(true);
  const [showSeries, setShowSeries] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (query.length < 3) {
      setMovies([]);
      setSeries([]);
      return;
    }

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

        setMovies(movieData.metas || []);
        setSeries(seriesData.metas || []);
      } catch (e) {
        setMovies([]);
        setSeries([]);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  if (query.length < 3) return null;

  return (
    <div className="absolute w-full mt-2 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden z-50">
      <div className="grid grid-cols-2">
        <div>
          <div className="flex items-center justify-between p-3 font-bold text-white border-b border-zinc-800">
            <span>Movies</span>
            <button
              aria-label="toggle movies"
              onClick={() => setShowMovies((s) => !s)}
              className="text-zinc-400 hover:text-white"
            >
              {showMovies ? "✕" : "▸"}
            </button>
          </div>

          {showMovies && movies.slice(0, 8).map((item: any) => (
            <div
              key={item.id}
              onClick={() => router.push(`/movie/${encodeURIComponent(item.id)}/${encodeURIComponent(item.name)}`)}
              className="flex items-center gap-3 p-3 hover:bg-zinc-800 cursor-pointer"
            >
              <img
                src={item.poster || "/no-poster.jpg"}
                alt={item.name}
                className="w-12 h-16 object-cover rounded-md transition-transform transform hover:scale-105 duration-200"
              />
              <div className="text-white">{item.name}</div>
            </div>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between p-3 font-bold text-white border-b border-zinc-800">
            <span>Series</span>
            <button
              aria-label="toggle series"
              onClick={() => setShowSeries((s) => !s)}
              className="text-zinc-400 hover:text-white"
            >
              {showSeries ? "✕" : "▸"}
            </button>
          </div>

          {showSeries && series.slice(0, 8).map((item: any) => (
            <div
              key={item.id}
              onClick={() => router.push(`/series/${encodeURIComponent(item.id)}/${encodeURIComponent(item.name)}`)}
              className="flex items-center gap-3 p-3 hover:bg-zinc-800 cursor-pointer"
            >
              <img
                src={item.poster || "/no-poster.jpg"}
                alt={item.name}
                className="w-12 h-16 object-cover rounded-md transition-transform transform hover:scale-105 duration-200"
              />
              <div className="text-white">{item.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}