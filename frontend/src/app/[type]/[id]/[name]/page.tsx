import type { Metadata } from "next";
import { headers } from "next/headers";
import FallbackImage from "../../../components/fallbackimg"
import StreamActions from "./StreamActions";
import SeasonsAccordion from "./SeasonsAccordion";
import BookMarkButton from "./BookMarkButton";
import ScrollToTopButton from "./ScrollToTopButton";
import StreamScroller from "./StreamScroller";
import { MediaType, qualityPriority } from "../../../../../Props";
import SaveMediaButton from "../../../components/SaveMediaButton";
import{ getApiUrl } from "../../../Actions/RestApiConfig";

type Props = {
  params: {
    type: string;
    id: string;
    name: string;
  };
  searchParams: {
    season?: string;
  };
};

const getAllSavedMediaIds = async (): Promise<Set<string>> => {
  try {
    const headersList = await headers();
    const host = headersList.get("host")?.split(":")[0] || "localhost";
    const protocol = headersList.get("x-forwarded-proto") || "http";
    const res = await fetch(`${await getApiUrl(host, protocol)}/getSavedMediaIds?type=episodes`);
    const data = await res.json();
    if (data.success !== true) {
      throw new Error(data.message || 'Failed to fetch saved media IDs');
    }
    return new Set(data.data);
  } catch (error) {
    console.error('Error checking saved status:', error);
    return new Set(); // Return an empty set on error
  }
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  return {
    title: `Download ${name}`,
  };
}

const allSavedMediaIdsCache: Set<string> = await getAllSavedMediaIds(); // Cache to store all saved media IDs


const isMediaInSaved = (ttid: string): boolean => {
  return allSavedMediaIdsCache.has(ttid);
};

const normalizeSeasons = async (data: any) => {
  let normalized: any[] = [];

  if (!data) return normalized;

  // Cinemeta meta endpoint provides a `videos` array with episode info
  if (Array.isArray(data.videos) && data.videos.length > 0) {
    const bySeason: Record<string, any[]> = {};
    for (const ep of data.videos) {
      const isInSavedMedia = isMediaInSaved(ep.id);
      const sn = ep.season ?? ep.seasonNumber ?? String(ep.season || 0);
      bySeason[sn] = bySeason[sn] || [];
      const episodeWithSavedStatus = { ...ep, isInSaved: isInSavedMedia };
      bySeason[sn].push(episodeWithSavedStatus);
    };
    
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

async function MediaInfo({ data, id }: { data: any; id: string }) {
  
  async function getMovieOmdbData() {
    const headersList = await headers();
    const host = headersList.get("host")?.split(":")[0] || "localhost";
    const protocol = headersList.get("x-forwarded-proto") || "http";
    const omdbUrl = `${await getApiUrl(host,protocol)}/getOmdbData?t=${encodeURIComponent(data.imdb_id)}`;
    const omdbData = await fetch(omdbUrl)
    if (!omdbData.ok) {
      throw new Error((await omdbData.json()).error || "Failed to fetch OMDB data");
    }
    return omdbData.json();
  }

  const headersList = await headers();
  const host = headersList.get("host")?.split(":")[0] || "localhost";
  const protocol = headersList.get("x-forwarded-proto") || "http";
  const ret = await fetch(`${await getApiUrl(host,protocol)}/savedMediaExists?ttid=${(id)}`).then(res => res.json()).catch(() => false);
  const isInSavedMedia = ret.data === true;
  if (!data) return null;
  const decodedId = decodeURIComponent(id);
  const type = data.type || data.mediaType || data.category;
  const episodeData = type==="movie" ? null : data.videos.filter((v: any) => v.id == decodedId)[0];
  let omdbData = null;
  if (episodeData){
    try {
      const omdbUrl = `${await getApiUrl(host,protocol)}/getOmdbData?t=${data.imdb_id}&season=${episodeData.season}&episode=${episodeData.episode}`;
      const omdbret = await fetch(omdbUrl)
      if (!omdbret.ok) {
        throw new Error((await omdbret.json()).error || "Failed to fetch OMDB data");
      }
      omdbData = await omdbret.json();
    } catch (error) {
      console.error("Error fetching OMDB data:", error);
    }
  }
  const posterUrl = episodeData ? episodeData.thumbnail || episodeData.poster || null : data.poster || data.posterUrl || null;
  const name = (data.name || data.title || data.originalTitle || data.originalName || "Unknown Title");
  const episodeName = episodeData ? (episodeData.name || episodeData.title || episodeData.originalTitle || episodeData.originalName || "Unknown Episode Title") : null;
  const seasonAndEpisode = episodeData ? `S${episodeData.season?.toString().padStart(2, "0") || "00"}E${episodeData.episode?.toString().padStart(2, "0") || "00"}` : null;
  const cast = Array.isArray(data.cast) ? data.cast.slice(0, 3) : [];
  const releaseYear = episodeData == null ? (data.releaseInfo || data.year || data.released?.slice(0, 4)) : (new Intl.DateTimeFormat("en-UK", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                }).format(new Date(episodeData.released || episodeData.airDate)).replace(",", ""));
  let rating = episodeData == null ? (data.imdbRating || data.rating) : (parseFloat(episodeData.rating) === 0 ? omdbData?.imdbRating || omdbData?.Rating : episodeData.rating);
  const duration = type === "movie" ? data.runtime || data.duration || data.runtimeMinutes : !episodeData ? null : omdbData?.Runtime || null;
  const description = episodeData == null ? (data.description || data.plot || data.overview || data.summary) : (episodeData.description);
  let link = episodeData == null ? data.links?.filter((l:any) => l.category === "imdb")[0]?.url ?? `https://www.imdb.com/title/${omdbData?.imdbId || omdbData?.imdbID || omdbData?.imdb}/` : `https://www.imdb.com/title/${omdbData?.imdbId || omdbData?.imdbID || omdbData?.imdb}/`;
  if ((!rating || rating === 0 || rating === null || rating === "N/A" || rating === undefined) && type === "movie") {
    try {
    const omdbData = await getMovieOmdbData();
    if (omdbData && omdbData.imdbRating && omdbData.imdbRating !== "N/A") {
      rating = omdbData.imdbRating;
    }
    if (!link || link === "N/A") {
      link = omdbData?.imdbID ? `https://www.imdb.com/title/${omdbData.imdbID}/` : null;
    }
    }
    catch (error) {
      console.error("Error fetching OMDB data:", error);
    }
  }
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900 p-4 shadow-md flex">
      <div>
      <SaveMediaButton ttid={decodedId} name={episodeName || name} year={episodeData == null ?releaseYear : new Date(episodeData.released || episodeData.airDate).getFullYear()} type={type === "movie" ? MediaType.movie : MediaType.series} poster_url={posterUrl} series_name={episodeData == null ? undefined : name} episode_info={seasonAndEpisode || undefined} initiallySaved={isInSavedMedia} />
    </div>
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <div>
        <span className={`text-2xl font-bold text-white`}><a href={(type === "series" && episodeData) ? `/series/${encodeURIComponent(decodedId.split(":")[0])}/${encodeURIComponent(name)}` : undefined} className={` ${(type === "series" && episodeData) && "hover:text-blue-400 transition-colors cursor-pointer"}`}>{name}</a> <span className="ml-2 text-sm text-zinc-400">{releaseYear}</span></span>
        <h3 className="text-xl font-semibold text-white"><span className="text-zinc-300 italic text-lg">{seasonAndEpisode}</span> {episodeName}</h3>
        </div>
      </div>
      <div className="mt-2 flex flex-col flex-wrap gap-y-1 text-sm text-zinc-300">
        {cast.length > 0 && <span> <b>Cast:</b> {cast.join(", ")}</span>}
        {((rating && rating >0) || duration) && <span className="flex">{rating && rating !=0 && <span className="flex"><a href={link} target="_blank" rel="noopener noreferrer"><img src='../../../../../../imdb.png' alt='IMDb' className={`w-10 h-5 mr-2 ${link ? 'cursor-pointer' : ''}`} /></a> {rating}</span>}{rating && duration &&<>&nbsp; • &nbsp;</>}{duration && <> <b>Duration:</b> &nbsp;{duration}</>}</span>}
        {description && <p className="mt-2 text-sm text-zinc-300">{description}</p>}
      </div>
      </div>
    </div>
  );
}

export default async function ItemPage({ params, searchParams }: Props) {
  const { type, id, name } = await params;
  const { season } = await searchParams;
  const headersList = await headers();
  const host = headersList.get("host")?.split(":")[0] || "localhost";
  const protocol = headersList.get("x-forwarded-proto") || "http";
  let mediaData: any = null;
  if ((type === "movie" || type === "series")) {
    const metadataUrl = `https://v3-cinemeta.strem.io/meta/${encodeURIComponent(type)}/${encodeURIComponent(decodeURIComponent(id).split(":")[0])}.json`;
    try {
      const res = await fetch(metadataUrl);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();
      mediaData = json?.meta ?? null;
      } catch (e) {
        console.error(`Failed to fetch metadata from ${metadataUrl}:`, e);
        // ignore and try next
      }
  }
  const options = await fetch(`${await getApiUrl(host,protocol)}/getOptions`).then(res => res.json());
  const configuration = await fetch(`${await getApiUrl(host,protocol)}/getConfiguration`).then(res => res.json());

  if (type === "series" && !decodeURIComponent(id).includes(":")) {
    const seasons = await normalizeSeasons(mediaData);

    if (type === "series" && seasons.length > 0) {
      return (
        <main className="p-8 bg-zinc-950 min-h-screen text-white">
            <div id="info" className={`mb-6 z-10 ${options["sticky_media_info"] ? "sticky top-20" : ""}`}>
            <MediaInfo data={mediaData} id={id} />
          </div>
          <h1 className="text-2xl font-bold mb-6">Season results for {decodeURIComponent(name)}</h1>
  
          <SeasonsAccordion seasons={seasons} type={type} ttid={id} series_name={decodeURIComponent(name)} paramsOpenSeason={season} options={options} config={configuration} />
        </main>
      );
    }
    else if (type === "series") {
      return (
        <main className="p-8 bg-zinc-950 min-h-screen text-white">
          <div id="info" className={`mb-6 z-10 ${options["sticky_media_info"] ? "sticky top-20" : ""}`}>
            <MediaInfo data={mediaData} id={id} />
          </div>
          <h1 className="text-2xl font-bold mb-6">Season results for {decodeURIComponent(name)}</h1>
          <div className="text-zinc-400">No season/episode data found for {type} {decodeURIComponent(name)}</div>
        </main>
      );
    }
  }
  else {
    const url = `https://torrentio.strem.fun/stream/${encodeURIComponent(type)}/${decodeURIComponent(id)}.json`;
    let data: any = null;
    try {
      const res = await fetch(url);
      data = await res.json();
    } catch (e) {
      data = { error: "Failed to fetch data" };
    }
    
    const convertFileSizeToBytes = (sizeMatch: RegExpMatchArray | null): number | null => {
      if (!sizeMatch || sizeMatch.length < 2) return null;
      const sizeStr = sizeMatch[1].replace(/,/g, '').trim();
      const unit = sizeStr.match(/[a-zA-Z]+$/)?.[0] || '';
      const value = parseFloat(sizeStr.replace(/[a-zA-Z]+$/, ''));
  
      switch (unit.toUpperCase()) {
        case 'GB':
          return value * 1024 * 1024 * 1024;
        case 'MB':
          return value * 1024 * 1024;
        case 'KB':
          return value * 1024;
        case 'B':
          return value;
        default:
          return null; // Unknown unit
      }
    };

    const streams = Array.isArray(data?.streams) ? data.streams : [];
    const streamsWithProgress = await Promise.all(
      streams.sort((a: any, b: any) => {
      const rankA = qualityPriority[a.name] ?? 999;
      const rankB = qualityPriority[b.name] ?? 999;

      // Primary: defined quality tier
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      const sizeA = convertFileSizeToBytes(a.title.match(/💾\s*([\d.,]+\s*(?:GB|MB|KB|B))/i));
      const sizeB = convertFileSizeToBytes(b.title.match(/💾\s*([\d.,]+\s*(?:GB|MB|KB|B))/i));
      // Secondary: Size (descending)
      if (sizeA && sizeB) {
        return (sizeA - sizeB) * (!options["sort_streams_by_size"] ? 0 : options["sort_streams_by_size"] === "No" ? 0 : options["sort_streams_by_size"] === "Ascending" ? 1 : -1);
      }
      // Fallback: Alphabetical order
      return a.name.localeCompare(b.name);
    }).map(async (s: any) => {
      const infoHash = s.infoHash || "";
      const filename = s.behaviorHints?.filename || "";
      const data = s.progressData;
      try {
        const res = await fetch(`${ await getApiUrl(host,protocol)}/progress/${infoHash}/${s.fileIdx}`);
        const progressData = res.ok ? await res.json() : { progress: 0.0, status: "Not started or task not found" };
        return { ...s, progressData };
      } catch {
        return { ...s, progressData: { progress: 0.0, status: "Not started or task not found" } };
      }
    })
);
    return (
      <main className="px-8 pt-8 bg-zinc-950 min-h-screen text-white">
        <div id="info" className={`mb-6 z-10 ${options["sticky_media_info"] ? "sticky top-20" : ""}`}>
          <MediaInfo data={mediaData} id={id} />
        </div>
  
        {streams.length === 0 ? (
          <div className="text-zinc-400">No streams available.</div>
        ) : (
          <div className="space-y-3 flex">
            <div className="w-full">
            {streamsWithProgress.map((s: any, idx: number) => {
              return (
                <div
                key={`${s.infoHash}-${idx}`}
                data-stream-name={s.name}
                className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center bg-zinc-900 rounded-lg p-4 hover:bg-zinc-800 transition-colors duration-300 gap-4 w-full overflow-hidden border border-transparent"
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
                  <StreamActions hash={s.infoHash} filename={s.behaviorHints?.filename} title={s.title} id={s.fileIdx} ttid={id} data={s.progressData} opts={options} config={configuration} />
                </div>
              </div>
              );
            })}
          </div>
          {options["sticky_streams_scroller"] && streamsWithProgress.length > 1 && (
          <div className="fixed top-29 right-6 z-51">
            <StreamScroller 
              streamsnames={Array.from(new Set(streamsWithProgress.map(s => s.name)))} 
              counts={streamsWithProgress.reduce((acc, s) => {
                acc[s.name] = (acc[s.name] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)} 
              opts={options}
              config={configuration}
            />
          </div>
          )} 
        </div>
        )}
        <ScrollToTopButton />
      </main>
    );

  }

}
