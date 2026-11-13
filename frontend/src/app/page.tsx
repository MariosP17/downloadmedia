"use client";
import FallbackImage from "./components/fallbackimg";
import ContextMenu from "./components/CustomContextMenu";
import { useEffect, useState, useRef } from "react";
import { MediaType } from "../../Props"
import { getApiUrl } from "./Actions/RestApiConfig";
import { toast } from "react-hot-toast";

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
  const [menu, setMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    media: any | null;
    type: MediaType | null;
  }>({
    isOpen: false,  
    x: 0,
    y: 0,
    media: null,
    type: null
  });
  const pointerTypeRef = useRef<string | null>(null);

  const handleSavedMediaDeleted = (event: Event) => {
    const { ttid } = (event as CustomEvent<{ ttid?: string }>).detail ?? {};
    if (!ttid) return;

    setSeries((prev) =>
      prev.map((item) =>
        item.id === ttid ? { ...item, isInSaved: false } : item
      )
    );

    setMovies((prev) =>
      prev.map((item) =>
        item.id === ttid ? { ...item, isInSaved: false } : item
      )
    );
  };

  const handleSavedMediaDeletedAll = () => {
    setSeries((prev) => prev.map((s) => ({ ...s, isInSaved: false })));
    setMovies((prev) => prev.map((m) => ({ ...m, isInSaved: false })));
  };

  useEffect(() => {
    window.addEventListener("saved-media-deleted", handleSavedMediaDeleted);
    window.addEventListener("saved-media-deleted-all", handleSavedMediaDeletedAll);
    return () => {
      window.removeEventListener("saved-media-deleted", handleSavedMediaDeleted);
      window.removeEventListener("saved-media-deleted-all", handleSavedMediaDeletedAll);
    };
  }, []);


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

        const allSavedMediaResponse = await fetch(`${await getApiUrl(window.location.hostname, window.location.protocol)}/getSavedMediaIds?type=moviesandseries`);
        const allSavedMediaData = await allSavedMediaResponse.json();
        if (!allSavedMediaData.success) {
          toast.error(`Failed to load saved media IDs: ${allSavedMediaData.message || 'Unknown error'}`);
        }
        const moviesIds = allSavedMediaData.data.movies || [];
        const seriesIds = allSavedMediaData.data.series || [];
        const movieData = await movieRes.json();
        const seriesData = await seriesRes.json();
        for (const movie of movieData.metas) {
          const isInSaved = isMediaInSaved(movie.id, moviesIds);
          movie.isInSaved = isInSaved;
        }
        for (const series of seriesData.metas) {
          const isInSaved = isMediaInSaved(series.id, seriesIds);
          series.isInSaved = isInSaved;
        }
        setMovies(movieData.metas);
        setSeries(seriesData.metas);
      } catch (e) {
        setMovies([]);
        setSeries([]);
      } finally {
        setLoading(false);
      }
    }

    const isMediaInSaved = (ttid: string, ids: string[]) => {
      return ids.includes(ttid);
    };

    const loadOpenTabsFromSessionStorage = () => {
      const storedShowMovies = sessionStorage.getItem("showMovies");
      const storedShowSeries = sessionStorage.getItem("showSeries");

      if (storedShowMovies !== null) {
        setShowMovies(storedShowMovies === "true");
      }

      if (storedShowSeries !== null) {
        setShowSeries(storedShowSeries === "true");
      }
    }
    load();
    loadOpenTabsFromSessionStorage();
  }, [movies, series]);

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerTypeRef.current = e.pointerType;
  };

  const handleContextMenu = (e: React.MouseEvent, media: any) => {
    if (pointerTypeRef.current !== 'mouse') return; // Only trigger for mouse events
    e.preventDefault();
    e.stopPropagation();
    setMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      media: media,
      type: media.type === "movie" ? MediaType.movie : MediaType.series
    });
  };

  return (
    <main className="p-8 bg-zinc-950 min-h-screen text-white">

      <div className="space-y-8">
        {/* Movies tab */}
        <section onClick={() => { sessionStorage.setItem("showMovies", String(!showMovies)); setShowMovies((s) => !s); }} className="relative bg-zinc-900 rounded-xl p-4 hover:bg-zinc-800 transition-colors cursor-pointer" style={{padding: "40px"}}>
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
                    <a href={`/movie/${encodeURIComponent(movie.id)}/${encodeURIComponent(movie.name)}`}>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        // setPageLoading(true);
                        // router.push(`/movie/${encodeURIComponent(movie.id)}/${encodeURIComponent(movie.name)}`);
                      }}
                      onContextMenu={(e) => handleContextMenu(e, movie)}
                      onPointerDown={handlePointerDown}
                      className="rounded-lg overflow-hidden transition-transform transform hover:scale-105 duration-200 cursor-pointer"
                    >
                      <div className="relative">
                        <FallbackImage
                          src={movie.poster}
                          width={200}
                          height={300}
                          alt={movie.name}
                          className="poster"
                        />
                        <img src="/check.svg" alt="Context Menu" className={`rounded-full bg-white absolute top-2 right-2 w-6 h-6 ${movie.isInSaved ? 'opacity-100' : 'opacity-0'} transition-opacity` } />
                      </div>
                    </div>
                    </a>
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
        <section onClick={() =>{ sessionStorage.setItem("showSeries", String(!showSeries));setShowSeries((s) => !s)}} className="relative bg-zinc-900 rounded-xl p-4 hover:bg-zinc-800 transition-colors cursor-pointer" style={{padding: "40px"}}>
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
                    <a href={`/series/${encodeURIComponent(show.id)}/${encodeURIComponent(show.name)}`}>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        // setPageLoading(true);
                        // router.push(`/series/${encodeURIComponent(show.id)}/${encodeURIComponent(show.name)}`);
                      }}
                      onContextMenu={(e) => handleContextMenu(e, show)}
                      onPointerDown={handlePointerDown}
                      className="rounded-lg overflow-hidden transition-transform transform hover:scale-105 duration-200 cursor-pointer"
                    > 
                      <div className="relative">
                        <FallbackImage src={show.poster} alt={show.name} className="poster object-cover rounded-lg" />
                        <img src="/check.svg" alt="Context Menu" className={`rounded-full bg-white absolute top-2 right-2 w-6 h-6 ${show.isInSaved ? 'opacity-100' : 'opacity-0'} transition-opacity` } />
                      </div>
                    </div>
                    </a>
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
      {menu.isOpen && (
        <ContextMenu x={menu.x} y={menu.y} media={menu.media} type={menu.type || MediaType.movie} CloseMenu={() => setMenu({x: 0, y: 0, media: null, isOpen: false, type: null})} isInSaved={menu.media.isInSaved} ChangeMediaSavedStatus={(ttid, status, season) => {
          if (series.filter((s) => s.id === ttid).length > 0) {
            setSeries((prev) => prev.map((s) => s.id === ttid ? { ...s, isInSaved: status } : s));
          } else if (movies.filter((m) => m.id === ttid).length > 0) {
            setMovies((prev) => prev.map((m) => m.id === ttid ? { ...m, isInSaved: status } : m));
          }
        }} />
      )}
      {pageLoading && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <span className="loader"></span>
          <span className="ml-4 text-lg">Loading...</span>
        </div>
      )}
    </main>
  );
}