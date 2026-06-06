"use client";
import React, { useRef, useState, useEffect } from "react";
import FallbackImage from "../../../components/fallbackimg";
import { useRouter } from "next/navigation";

type Props = {
  seasons: any[];
  type: string;
};

export default function SeasonsAccordion({ seasons, type }: Props) {
  const [openSeasonId, setOpenSeasonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const refs = useRef<Array<HTMLDivElement | null>>([]);
  const router = useRouter();
  useEffect(() => {
    if (openSeasonId !== null) {
      const idx = seasons.findIndex((s) => String(s.id) === String(openSeasonId));
      const el = refs.current[idx];
      if (el) el.style.maxHeight = `${el.scrollHeight}px`;
    }
  }, [openSeasonId, seasons]);

  const toggle = (id: string, idx: number) => {
    setOpenSeasonId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-8">
      {seasons.map((season, idx) => {
        const isOpen = openSeasonId === String(season.id);
        return (
          <section
            key={season.id}
            onClick={() => toggle(season.id, idx)}
            className="relative bg-zinc-900 rounded-xl p-4 hover:bg-zinc-800 transition-colors cursor-pointer"
            style={{ padding: 40 }}
          >
            <h2 className="text-xl font-semibold mb-3 text-center">{season.name}</h2>

            <div
              className={`overflow-hidden transition-[max-height] duration-300 ease-in-out`}
              ref={(el) => { refs.current[idx] = el }}
              style={{ maxHeight: isOpen ? `${refs.current[idx]?.scrollHeight ?? 0}px` : 0 }}
            >
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
                {(season.episodes || []).map((ep: any) => {
                  const eid = ep.id ?? ep._id ?? ep.imdb_id ?? ep.tvdb_id ?? ep.name ?? ep.title;
                  const ename = ep.name ?? ep.title ?? `Episode ${ep.episode ?? ep.number ?? ""}`;
                  return (
                    <div key={eid}>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setLoading(true);
                          router.push(`/series/${encodeURIComponent(ep.id)}/${encodeURIComponent(ename)}`);
                        }}
                        className="rounded-lg overflow-hidden transition-transform transform hover:scale-105 duration-200 cursor-pointer"
                      >
                        <FallbackImage src={ep.thumbnail || ep.poster || ep.cover || "/no-poster-16-9.jpg"} fallback="/no-poster-16-9.jpg" alt={ename} />
                      </div>
                      <p className="mt-2">{ename}</p>
                      {(ep.description || ep.overview) && <p className="mt-1 text-xs text-zinc-400">{ep.description || ep.overview}</p>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="absolute left-1/2 -translate-x-1/2 bottom-4 text-white rounded-full w-10 h-10 flex items-center justify-center shadow pointer-events-none">
              <svg className={`w-5 h-5 transition-transform duration-200 ${isOpen ? "rotate-180" : "rotate-0"}`} viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
              </svg>
            </div>
            {loading && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
                  <span className="loader"></span>
                  <span className="ml-4 text-lg">Loading...</span>
                </div>
              )}
          </section>
        );
      })}
    </div>
  );
}
