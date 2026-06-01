import type { Metadata } from "next";
import FallbackImage from "../../../components/fallbackimg"

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
export default async function ItemPage({ params }: Props) {
  const { type, id, name } = await params;
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
    const seasons = normalizeSeasons(seriesData);
  
    if (seasons.length > 0) {
      return (
        <main className="p-8 bg-zinc-950 min-h-screen text-white">
          <h1 className="text-2xl font-bold mb-6">Season results for {decodeURIComponent(name)}</h1>
  
          <div className="space-y-4">
            {seasons.map((season) => (
              <details key={season.id} className="bg-zinc-900 rounded-lg" data-open={false}>
                <summary className="p-4 flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="text-white font-semibold">{season.name}</div>
                    <div className="text-zinc-400 text-sm">{(season.episodes || []).length} episodes</div>
                  </div>
                  <div className="text-zinc-400">▸</div>
                </summary>
  
                <div className="p-4 border-t border-zinc-800">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    {(season.episodes || []).map((ep: any) => {
                      const eid = ep.id ?? ep._id ?? ep.imdb_id ?? ep.tvdb_id ?? ep.name ?? ep.title;
                      const ename = ep.name ?? ep.title ?? `Episode ${ep.episode ?? ep.number ?? ""}`;
                      return (
                        <a key={eid} href={`/${encodeURIComponent(type)}/${encodeURIComponent(eid)}/${encodeURIComponent(String(ename))}`} className="block">
                          <div className="rounded-lg overflow-hidden transition-transform transform hover:scale-105 duration-150">
                            <FallbackImage src={ep.thumbnail || ep.poster || ep.cover || "/no-poster-16-9.jpg"} fallback="/no-poster-16-9.jpg" alt={ename} className="w-full h-40 object-cover rounded-lg" />
                          </div>
                          <p className="mt-2 text-sm text-white">{ename}</p>
                          { (ep.description || ep.overview) && (
                            <p className="mt-1 text-xs text-zinc-400">{ep.description || ep.overview}</p>
                          ) }
                        </a>
                      );
                    })}
                  </div>
                </div>
              </details>
            ))}
          </div>
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
  
    return (
      <main className="p-8 bg-zinc-950 min-h-screen text-white">
        <h1 className="text-2xl font-bold mb-6">Torrentio results for {decodeURIComponent(name)}</h1>
  
        {streams.length === 0 ? (
          <div className="text-zinc-400">No streams available.</div>
        ) : (
          <div className="space-y-4">
            {streams.map((s: any, idx: number) => {
              const sName = s.name || "Stream";
              const title = s.title || "";
              const infoHash = s.infoHash || "";
              const filename = s.behaviorHints?.filename || "";
              const magnet = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(filename || title)}`;
  
              return (
                <div
                  key={`${infoHash}-${idx}`}
                  className="flex items-center justify-between bg-zinc-900 rounded-lg p-4"
                >
                  <div className="flex items-start gap-4">
                    <div>
                      <div className="text-zinc-300 text-sm whitespace-pre-line leading-tight">{sName}</div>
                    </div>
  
                    <div>
                      <div className="text-white font-semibold text-lg leading-tight">{title}</div>
                      <div className="text-zinc-400 text-sm mt-1 flex items-center gap-3">
                        <span className="flex items-center gap-1">👤 <strong className="text-white">{title.match(/👤\s*(\d+)/)?.[1] ?? "-"}</strong></span>
                        <span className="flex items-center gap-1">💾 <strong className="text-white">{title.match(/💾\s*([^\s]+)/)?.[1] ?? (s.fileSize || "-")}</strong></span>
                        <span className="flex items-center gap-1">⚙️ <span className="text-white">{title.match(/⚙️\s*([^\n]+)/)?.[1] ?? "-"}</span></span>
                        {title.includes("🇪🇸") && (<span className="ml-2">🇪🇸</span>)}
                      </div>
  
                      <div className="text-zinc-500 text-xs mt-2">{filename || infoHash}</div>
                    </div>
                  </div>
  
                  <div className="flex items-center gap-4">
                    <a
                      href={magnet}
                      className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500 hover:bg-green-600 transition-colors"
                      title="Open in torrent client"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-4.586 2.573A1 1 0 018 12.82V7.18a1 1 0 011.166-.986l4.586 2.573a1 1 0 010 1.802z" />
                      </svg>
                    </a>
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
