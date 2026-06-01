"use client";
import FallbackImage from "../components/fallbackimg";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function SearchPage() {
  const params = useSearchParams();
  const query = params.get("q") || "";

  const [movies, setMovies] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [showMovies, setShowMovies] = useState(true);
  const [showSeries, setShowSeries] = useState(true);

  useEffect(() => {
    if (!query) return;

    async function load() {
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
    }

    load();
  }, [query]);

  return (
    <main className="p-8 bg-zinc-950 min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-8">Results for "{query}"</h1>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl">Movies</h2>
        <button
          onClick={() => setShowMovies((s) => !s)}
          className="text-zinc-400 hover:text-white"
        >
          {showMovies ? "Hide" : "Show"}
        </button>
      </div>

      {showMovies && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-12">
          {movies.map((movie: any) => (
            <div key={movie.id}>
              <Link href={`/movie/${encodeURIComponent(movie.id)}/${encodeURIComponent(movie.name)}`}>
                {/* <a className="block"> */}
                  <div className="rounded-lg overflow-hidden transition-transform transform hover:scale-105 duration-200">
                    <FallbackImage
                      src={movie.poster}
                      width={200}
                      height={300}
                      alt={movie.name}
                      className="poster"
                    />
                  </div>
                  <p>{movie.name}</p>
                {/* </a> */}
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl">Series</h2>
        <button
          onClick={() => setShowSeries((s) => !s)}
          className="text-zinc-400 hover:text-white"
        >
          {showSeries ? "Hide" : "Show"}
        </button>
      </div>

      {showSeries && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {series.map((show: any) => (
            <div key={show.id}>
              <Link href={`/series/${encodeURIComponent(show.id)}/${encodeURIComponent(show.name)}`}>
                {/* <a className="block"> */}
                  <div className="rounded-lg overflow-hidden transition-transform transform hover:scale-105 duration-200">
                    <FallbackImage src={show.poster} alt={show.name} className="poster object-cover rounded-lg" />
                  </div>
                  <p>{show.name}</p>
                {/* </a> */}
              </Link>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}