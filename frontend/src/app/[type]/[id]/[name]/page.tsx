import type { Metadata } from "next";
import { headers } from "next/headers";
import FallbackImage from "../../../components/fallbackimg"
import StreamActions from "./StreamActions";
import SeasonsAccordion from "./SeasonsAccordion";
import BookMarkButton from "./BookMarkButton";


type Props = {
  params: {
    type: string;
    id: string;
    name: string;
  };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  return {
    title: `Download ${name}`,
  };
}

const normalizeSeasons = (data: any) => {
  let normalized: any[] = [];

  if (!data) return normalized;

  // Cinemeta meta endpoint provides a `videos` array with episode info
  if (Array.isArray(data.videos) && data.videos.length > 0) {
    const bySeason: Record<string, any[]> = {};
    data.videos.forEach((ep: any) => {
      const sn = ep.season ?? ep.seasonNumber ?? String(ep.season || 0);
      bySeason[sn] = bySeason[sn] || [];
      bySeason[sn].push(ep);
    });

    normalized = Object.keys(bySeason).map((k) => ({
      id: k,
      number: Number(k),
      name: k === "0" ? "Specials" : `Season ${k}`,
      episodes: bySeason[k],
    }));

    return normalized.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  }

  if (Array.isArray(data.seasons) && data.seasons.length > 0) {
    normalized = data.seasons.map((s: any) => ({
      id: s.id ?? s.number,
      number: s.number ?? s.id,
      name: s.name ?? `Season ${s.number}`,
      episodes: Array.isArray(s.episodes) ? s.episodes : s.items || [],
    }));
  } else if (Array.isArray(data.episodes) && data.episodes.length > 0) {
    const bySeason: Record<string, any[]> = {};
    data.episodes.forEach((ep: any) => {
      const sn = ep.season ?? ep.seasonNumber ?? "1";
      bySeason[sn] = bySeason[sn] || [];
      bySeason[sn].push(ep);
    });

    normalized = Object.keys(bySeason).map((k) => ({
      id: k,
      number: Number(k),
      name: `Season ${k}`,
      episodes: bySeason[k],
    }));
  } else if (Array.isArray(data.metas) && data.metas.length > 0 && data.metas[0].seasons) {
    normalized = data.metas[0].seasons.map((s: any) => ({
      id: s.id ?? s.number,
      number: s.number,
      name: s.name ?? `Season ${s.number}`,
      episodes: s.episodes || s.items || [],
    }));
  } else {
    // try to group metas by season
    const eps: any[] = (data.metas || []).filter((m: any) => m.type === "episode" || m.season || m.episode);
    if (eps.length > 0) {
      const bySeason: Record<string, any[]> = {};
      eps.forEach((ep: any) => {
        const sn = ep.season ?? ep.seasonNumber ?? "1";
        bySeason[sn] = bySeason[sn] || [];
        bySeason[sn].push(ep);
      });

      normalized = Object.keys(bySeason).map((k) => ({
        id: k,
        number: Number(k),
        name: `Season ${k}`,
        episodes: bySeason[k],
      }));
    }
  }

  return normalized.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
};
export default async function ItemPage({ params }: Props,hostname: string) {
  const { type, id, name } = await params;
  const headersList = await headers();
  const host = headersList.get("host")?.split(":")[0] || "localhost";
  hostname = host;
  // If this is a series id, try to fetch Cinemeta series metadata to show seasons/episodes
  let seriesData: any = null;
  if (type === "series" && !decodeURIComponent(id).includes(":")) {
    const seasonurl = `https://v3-cinemeta.strem.io/meta/series/${encodeURIComponent(id)}.json`;
    try {
      const res = await fetch(seasonurl);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();
        if (json && json.meta &&json.meta.videos) {
          seriesData = json.meta;
        }
      } catch (e) {
        console.error(`Failed to fetch series metadata from ${seasonurl}:`, e);
        // ignore and try next
      }
    let streamsData: any = {};
    const seasons = normalizeSeasons(seriesData);
    for (const season of seasons) {
      let dummyVideoId = seriesData.videos.find((v: any) => v.season === season.number && v.number === 1)?.id || seriesData.videos.filter((v: any) => v.season === season.number)?.[0]?.id || seriesData.videos[0]?.id;
      const seasontorrenturl = `https://torrentio.strem.fun/stream/series/${dummyVideoId}.json`;
      try {
        const res = await fetch(seasontorrenturl);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const json = await res.json();
          if (json && json.streams) {
            streamsData[season.number] = json.streams;
          }
        } catch (e) {
          console.error(`Failed to fetch series streams from ${seasontorrenturl}:`, e);
          // ignore and try next
        }
    }
    if (seasons.length > 0) {
      return (
        <main className="p-8 bg-zinc-950 min-h-screen text-white">
          <h1 className="text-2xl font-bold mb-6">Season results for {decodeURIComponent(name)}</h1>
  
          <SeasonsAccordion seasons={seasons} type={type} ttid={id} data={streamsData} />
        </main>
      );
    }
    else {
      return (
        <main className="p-8 bg-zinc-950 min-h-screen text-white">
          <h1 className="text-2xl font-bold mb-6">Season results for {decodeURIComponent(name)}</h1>
          <div className="text-zinc-400">No season/episode data found for {type} {decodeURIComponent(name)}</div>
        </main>
      );
    }
  }
  else{
    const url = `https://torrentio.strem.fun/stream/${encodeURIComponent(type)}/${decodeURIComponent(id)}.json`;
    let data: any = null;
    try {
      const res = await fetch(url);
      data = await res.json();
    } catch (e) {
      data = { error: "Failed to fetch data" };
    }
  
    const streams = Array.isArray(data?.streams) ? data.streams : [];
    const streamsWithProgress = await Promise.all(
    streams.map(async (s: any) => {
            const infoHash = s.infoHash || "";
            const filename = s.behaviorHints?.filename || "";
            const data = s.progressData;
      try {
        const res = await fetch(`http://${hostname}:7000/progress/${infoHash}/${s.fileIdx}`);
        const progressData = res.ok ? await res.json() : { progress: 0.0, status: "Not started or task not found" };
        return { ...s, progressData };
      } catch {
        return { ...s, progressData: { progress: 0.0, status: "Not started or task not found" } };
      }
    })
);
    return (
      <main className="p-8 bg-zinc-950 min-h-screen text-white">
        <h1 className="text-2xl font-bold mb-6">Torrentio results for {decodeURIComponent(name)}</h1>
  
        {streams.length === 0 ? (
          <div className="text-zinc-400">No streams available.</div>
        ) : (
          <div className="space-y-3">
          {streamsWithProgress.map((s: any, idx: number) => {
            
            

            return (
              <div
  key={`${s.infoHash}-${idx}`}
  className="flex flex-col sm:flex-row items-stretch sm:items-center bg-zinc-900 rounded-lg p-4 hover:bg-zinc-800 transition-colors gap-4 w-full overflow-hidden"
>
  {/* 1. Bookmark Button - First item in the flex engine flow */}
  <div className="flex items-center justify-between sm:justify-start flex-shrink-0">
    
    {/* Optional Mobile-Only Label to balance the top row space */}
    <span className="sm:hidden text-xs text-zinc-500 font-mono">{s.name}</span>
    <BookMarkButton 
      infoHash={s.infoHash} 
      fileIdx={s.fileIdx} 
      ttid={id}
      type={type}
      filename={s.behaviorHints?.filename}
      provider={s.title.match(/⚙️\s*([^\n]+)/)?.[1] ?? "-"}
    />
  </div>

  {/* 2. Metadata Info Block (Takes up remaining horizontal space) */}
  <div className="flex-1 min-w-0 w-full">
    <div className="flex flex-col gap-2">
      <div className="hidden sm:flex text-zinc-400 text-sm whitespace-pre-wrap break-words">{s.name}</div>
      <div className={`text-white font-semibold text-lg leading-tight ${s.title.split(" ").some((word: string) => word.length >= 20) ? "break-all" : "break-words"}`}>{s.title}</div>
      
      <div className="text-zinc-400 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1">👤 <strong className="text-white">{s.title.match(/👤\s*(\d+)/)?.[1] ?? "-"}</strong></span>
        <span className="flex items-center gap-1">💾 <strong className="text-white">{s.title.match(/💾\s*([\d.,]+\s*(?:GB|MB|KB|B))/i)?.[1] ?? (s.fileSize || "-")}</strong></span>
        <span className="flex items-center gap-1">⚙️ <span className="text-white">{s.title.match(/⚙️\s*([^\n]+)/)?.[1] ?? "-"}</span></span>
        {s.title.includes("🇪🇸") && (<span className="ml-2">🇪🇸</span>)}
      </div>
      
      <div className="text-zinc-500 text-xs break-all">{s.behaviorHints?.filename || s.infoHash}</div>
    </div>
  </div>

  {/* 3. Stream Actions (Stretches completely across the screen on phone viewports) */}
  <div className="w-full sm:w-auto flex items-center justify-stretch sm:justify-end mt-1 sm:mt-0 transition-colors rounded-md">
    <StreamActions hash={s.infoHash} filename={s.behaviorHints?.filename} title={s.title} id={s.fileIdx} ttid={id} data={s.progressData} />
  </div>
</div>
            );
          })}
        </div>
        )}
      </main>
    );

  }

}
