"use client";
import FallbackImage from "./components/fallbackimg";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";

export default function SearchPage() {
  const moviesContainerRef = useRef<HTMLDivElement>(null);
  const seriesContainerRef = useRef<HTMLDivElement>(null);
  const [maxMoviesHeight, setMaxMoviesHeight] = useState<number>(0);
  const [maxSeriesHeight, setMaxSeriesHeight] = useState<number>(0);

  const [movies, setMovies] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [showMovies, setShowMovies] = useState(true);
  const [showSeries, setShowSeries] = useState(true);
  const router = useRouter();

  useEffect(() => {

    setMaxMoviesHeight(moviesContainerRef.current?.scrollHeight ?? 0);
    setMaxSeriesHeight(seriesContainerRef.current?.scrollHeight ?? 0);
    if (movies.length > 0 && series.length > 0) return;
    async function load() {
      setLoading(true);
      try {
        const movieRes = await fetch(
          `https://v3-cinemeta.strem.io/catalog/movie/top.json`
        );

        const seriesRes = await fetch(
          `https://v3-cinemeta.strem.io/catalog/series/top.json`
        );

        const movieData = await movieRes.json();
        const seriesData = await seriesRes.json();
        setMovies(movieData.metas);
        setSeries(seriesData.metas);
      } catch (e) {
        setMovies([]);
        setSeries([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [movies, series]);

  return (
    <main className="p-8 bg-zinc-950 min-h-screen text-white">

      <div className="space-y-8">
        {/* Movies tab */}
        <section onClick={() => setShowMovies((s) => !s)} className="relative bg-zinc-900 rounded-xl p-4 hover:bg-zinc-800 transition-colors cursor-pointer" style={{padding: "40px"}}>
          <h2 className="text-xl font-semibold mb-3">Movies</h2>

          <div
            ref={moviesContainerRef}
            id = "movies-container"
            className={`overflow-hidden transition-[max-height] duration-300 ease-in-out`} 
            style={{ maxHeight: showMovies ? `${maxMoviesHeight ?? 0}px` : 0 }}
          >
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="rounded-lg overflow-hidden bg-zinc-800 h-40 animate-pulse" />
                    <div className="h-3 bg-zinc-800 rounded w-3/4 animate-pulse" />
                  </div>
                ))
              ) : (
                movies.length > 0 ? movies.map((movie: any) => (
                  <div key={movie.id}>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setPageLoading(true);
                        router.push(`/movie/${encodeURIComponent(movie.id)}/${encodeURIComponent(movie.name)}`);
                      }}
                      className="rounded-lg overflow-hidden transition-transform transform hover:scale-105 duration-200 cursor-pointer"
                    >
                      <FallbackImage
                        src={movie.poster}
                        width={200}
                        height={300}
                        alt={movie.name}
                        className="poster"
                      />
                    </div>
                    <p className="mt-2">{movie.name}</p>
                  </div>
                )) : (
                  <div className="p-4 text-zinc-400">No top movies found</div>
                )
              )}
            </div>
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 bottom-4 text-white rounded-full w-10 h-10 flex items-center justify-center shadow pointer-events-none">
            <svg className={`w-5 h-5 transition-transform duration-200 ${showMovies ? 'rotate-180' : 'rotate-0'}`} viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
            </svg>
          </div>
        </section>

        {/* Series tab */}
        <section onClick={() => setShowSeries((s) => !s)} className="relative bg-zinc-900 rounded-xl p-4 hover:bg-zinc-800 transition-colors cursor-pointer" style={{padding: "40px"}}>
          <h2 className="text-xl font-semibold mb-3">Series</h2>

          <div
            ref={seriesContainerRef}
            id="series-container"
            className={`overflow-hidden transition-[max-height] duration-300 ease-in-out`} 
            style={{ maxHeight: showSeries ? `${maxSeriesHeight ?? 0}px` : 0 }}
          >
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="rounded-lg overflow-hidden bg-zinc-800 h-40 animate-pulse" />
                    <div className="h-3 bg-zinc-800 rounded w-3/4 animate-pulse" />
                  </div>
                ))
              ) : (
                series.length > 0 ? series.map((show: any) => (
                  <div key={show.id}>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setPageLoading(true);
                        router.push(`/series/${encodeURIComponent(show.id)}/${encodeURIComponent(show.name)}`);
                      }}
                      className="rounded-lg overflow-hidden transition-transform transform hover:scale-105 duration-200 cursor-pointer"
                    >
                      <FallbackImage src={show.poster} alt={show.name} className="poster object-cover rounded-lg" />
                    </div>
                    <p className="mt-2">{show.name}</p>
                  </div>
                )) : (
                  <div className="p-4 text-zinc-400">No top series found</div>
                )
              )}
            </div>
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 bottom-4 text-white rounded-full w-10 h-10 flex items-center justify-center shadow pointer-events-none">
            <svg className={`w-5 h-5 transition-transform duration-200 ${showSeries ? 'rotate-180' : 'rotate-0'}`} viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
            </svg>
          </div>
        </section>
      </div>
      {pageLoading && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <span className="loader"></span>
          <span className="ml-4 text-lg">Loading...</span>
        </div>
      )}
    </main>
  );
}