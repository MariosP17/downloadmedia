"use client";
import FallbackImage from "../components/fallbackimg";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, Suspense } from "react";

// 1. Child Component: Performs data fetching and hooks into search parameters safely
function SearchResultsList() {
  const params = useSearchParams();
  const query = params.get("q") || "";

  const [movies, setMovies] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [maxMoviesHeight, setMaxMoviesHeight] = useState<number>(0);
  const [maxSeriesHeight, setMaxSeriesHeight] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  
  const [showMovies, setShowMovies] = useState(true);
  const [showSeries, setShowSeries] = useState(true);
  
  // React elements mapping references replacing old document.getElementById selectors
  const moviesContainerRef = useRef<HTMLDivElement>(null);
  const seriesContainerRef = useRef<HTMLDivElement>(null);
  
  const router = useRouter();

  useEffect(() => {
    if (!query) return;

    async function load() {
      setLoading(true);
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
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [query]);

  useEffect(() => {
    setMaxMoviesHeight(moviesContainerRef.current?.scrollHeight ?? 0);
    setMaxSeriesHeight(seriesContainerRef.current?.scrollHeight ?? 0);
  }, [movies, series]);

  return (
    <>
      <h1 className="text-3xl font-bold mb-8">Results for "{query}"</h1>

      <div className="space-y-8">
        {/* Movies section */}
        <section 
          onClick={() => setShowMovies((s) => !s)} 
          className="relative bg-zinc-900 rounded-xl hover:bg-zinc-800 transition-colors cursor-pointer" 
          style={{ padding: "40px" }}
        >
          <h2 className="text-xl font-semibold mb-3">Movies</h2>

          <div
            ref={moviesContainerRef}
            className="overflow-hidden transition-[max-height] duration-300 ease-in-out" 
            style={{ 
              maxHeight: showMovies 
                ? `${maxMoviesHeight ?? 0}px` 
                : "0px" 
            }}
          >
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="rounded-lg overflow-hidden bg-zinc-800 h-40 animate-pulse" />
                    <div className="h-3 bg-zinc-800 rounded w-3/4 animate-pulse" />
                  </div>
                ))
              ) : movies.length > 0 ? (
                movies.map((movie: any) => (
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
                ))
              ) : (
                <div className="p-4 text-zinc-400 col-span-full">No movies found for "{query}"</div>
              )}
            </div>
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 bottom-4 text-white rounded-full w-10 h-10 flex items-center justify-center shadow pointer-events-none">
            <svg className={`w-5 h-5 transition-transform duration-200 ${showMovies ? 'rotate-180' : 'rotate-0'}`} viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
            </svg>
          </div>
        </section>

        {/* Series section */}
        <section 
          onClick={() => setShowSeries((s) => !s)} 
          className="relative bg-zinc-900 rounded-xl hover:bg-zinc-800 transition-colors cursor-pointer" 
          style={{ padding: "40px" }}
        >
          <h2 className="text-xl font-semibold mb-3">Series</h2>

          <div
            ref={seriesContainerRef}
            className="overflow-hidden transition-[max-height] duration-300 ease-in-out" 
            style={{ 
              maxHeight: showSeries 
                ? `${maxSeriesHeight ?? 0}px` 
                : "0px" 
            }}
          >
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="rounded-lg overflow-hidden bg-zinc-800 h-40 animate-pulse" />
                    <div className="h-3 bg-zinc-800 rounded w-3/4 animate-pulse" />
                  </div>
                ))
              ) : series.length > 0 ? (
                series.map((show: any) => (
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
                ))
              ) : (
                <div className="p-4 text-zinc-400 col-span-full">No series found for "{query}"</div>
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
    </>
  );
}

// 2. Export Layout Parent Boundary Shell
// This ensures Next.js pre-renders your core structure cleanly while isolating search parameters.
export default function SearchPage() {
  return (
    <main className="p-8 bg-zinc-950 min-h-screen text-white">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <span className="text-zinc-500 animate-pulse text-lg font-medium">Mounting query layouts...</span>
        </div>
      }>
        <SearchResultsList />
      </Suspense>
    </main>
  );
}