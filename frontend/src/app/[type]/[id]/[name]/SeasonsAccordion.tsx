"use client";
import React, { useRef, useState, useEffect } from "react";
import FallbackImage from "../../../components/fallbackimg";
import { useRouter } from "next/navigation";
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { toast } from "react-hot-toast";
import { useSyncedLocalStorage } from "../../../Utils/useSyncedLocalStorage";

type Props = {
  seasons: any[];
  type: string;
  ttid: string; // Optional ttid for future use, currently unused in this component
  paramsOpenSeason?: string; // Optional prop to open a specific season initially
};

const SvgAddAllIcon = {
 "default": "M120-320v-80h280v80H120Zm0-160v-80h440v80H120Zm0-160v-80h440v80H120Zm520 480v-160H480v-80h160v-160h80v160h160v80H720v160h-80Z",
 "checked": "M120-320v-80h320v80H120Zm0-160v-80h480v80H120Zm0-160v-80h480v80H120Zm534 440L512-342l56-56 86 84 170-170 56 58-226 226Z"
};

export default function SeasonsAccordion({ seasons, type, ttid, paramsOpenSeason }: Props) {
  const [openSeasonId, setOpenSeasonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [openAddAllModal, setOpenAddAllModal] = useState(false);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [activeSeasonForModal, setActiveSeasonForModal] = useState(null);
  const [bookmarks, setBookmarks] = useSyncedLocalStorage(`stream_bookmarks`, "[]");
  const [data, setData] = useState<{ [seasonId: string]: any[] }>({});
  const [svgPaths, setSvgPaths] = useState<{ [key: string]: string }>(() => {
    const initialPaths: { [key: string]: string } = {};
    
    // Guard clause in case seasons data hasn't arrived yet during initial mount
    if (seasons && Array.isArray(seasons)) {
      seasons.forEach((season) => {
        // SvgAddAllIcon.default can sometimes be a string (base64/url) 
        // or a React Component depending on your bundler config.
        // We string-coerce it just in case to match your type definition.
        initialPaths[String(season.id)] = String(SvgAddAllIcon.default);
      });
    }
    
    return initialPaths;
  });
  const router = useRouter();


  // 1. On mount: Hydrate open selection from sessionStorage safely
  useEffect(() => {
    // Generate a unique storage key tied to this show's type / first season ID if available
    const storageKey = `accordion_open_season_${ttid}`;
    const savedId = sessionStorage.getItem(storageKey);
    if (savedId) {
      setOpenSeasonId(savedId);
    }
  }, [seasons, type]);

  useEffect(() => {
    if (paramsOpenSeason) {
      setOpenSeasonId(paramsOpenSeason);
    }
    const element = document.getElementById(`season-content-${paramsOpenSeason}`);
    if (element) {
      setTimeout(() => {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 400);
    }
  }, [paramsOpenSeason]);

  useEffect(() => {
    if (openAddAllModal) {
      // Disable background scrolling
      document.body.style.overflow = 'hidden';
    } else {
      // Re-enable background scrolling
      document.body.style.overflow = 'unset';
    }

    // Cleanup function in case the component unmounts while a modal is open
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [openAddAllModal]);

  const addAllEpisodesToBatch = async (key: string) => {
  const toastId = toast.loading(<span>Adding all episodes to batch...</span>);
  const [seasonid,hash,ttid,episodesNum] = key.split(",");
  let episodesadded = 0;
  let infoMessage = "";
  for (let i = 1; i <= parseInt(episodesNum); i++) {
    try {
      const response = await fetch(`https://torrentio.strem.fun/stream/series/${decodeURIComponent(ttid)}:${seasonid}:${i}.json`);
      if (!response.ok) {
        toast.error(`Failed to fetch episode ${i} of season ${seasonid}.`, { id: toastId });
        continue; // Skip to the next episode if this one fails
      }
      const result = await response.json();
      const stream = result.streams.find((stream: any) => stream.infoHash === hash);
      if (!stream) {
        // If no matching stream is found, log a warning and continue to the next episode
        continue;
      }
      const freshBookmarks = JSON.parse(localStorage.getItem("stream_bookmarks") || "[]");
      const bookmarkStream = { infoHash: stream.infoHash, fileIdx: stream.fileIdx, ttid: encodeURIComponent(decodeURIComponent(ttid)+":"+seasonid+":"+i),type: "series", filename: stream.behaviorHints?.filename || "Raw Output Stream", provider: stream.title.match(/⚙️\s*([^\n]+)/)?.[1] ?? "-"};
      if (freshBookmarks.some((b: any) => b.infoHash === bookmarkStream.infoHash && b.fileIdx === bookmarkStream.fileIdx && b.ttid === bookmarkStream.ttid && b.type === bookmarkStream.type && b.filename === bookmarkStream.filename && b.provider === bookmarkStream.provider)) {
        // If the episode is already bookmarked, skip to the next one
        console.log(`Episode ${i} of season ${seasonid} is already bookmarked, skipping.`);
        infoMessage = `\nSome episodes were already bookmarked and were skipped.`;
        continue;
      }
      const updatedBookmarks = [...freshBookmarks, bookmarkStream];
      setBookmarks(JSON.stringify(updatedBookmarks));
      console.log(`Added episode ${i} of season ${seasonid} to batch:`, bookmarkStream);
      toast.loading(`Episode ${i} added to batch!`, { id: toastId });
      episodesadded++;
      } catch (error) {
        console.error("Error adding all episodes to batch:", error);
        toast.error("Error adding episode to batch!", { id: toastId });
      }
    }
    if (episodesadded == parseInt(episodesNum)) {
      toast.success(<div>{episodesadded} episodes added to batch!<br/><span className="text-blue-500 hover:underline cursor-pointer" onClick={() => {router.push("/batch-download");toast.dismiss(toastId)}}>View Bookmarks</span></div>, { id: toastId });
      setSvgPaths((prev) => ({
        ...prev,
        [seasonid]: SvgAddAllIcon.checked
      }));
    }
    else 
    {
        toast(<div>{episodesadded} episodes added to batch.{infoMessage}<br/><span className="text-blue-500 hover:underline cursor-pointer" onClick={() => {router.push("/batch-download");toast.dismiss(toastId)}}>View Bookmarks</span></div>, {
          id: toastId,
          icon: (<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5a96ce"><path d="M444-288h72v-240h-72v240Zm61.5-322.29q10.5-10.29 10.5-25.5t-10.29-25.71q-10.29-10.5-25.5-10.5t-25.71 10.29q-10.5 10.29-10.5 25.5t10.29 25.71q10.29 10.5 25.5 10.5t25.71-10.29ZM480.28-96Q401-96 331-126t-122.5-82.5Q156-261 126-330.96t-30-149.5Q96-560 126-629.5q30-69.5 82.5-122T330.96-834q69.96-30 149.5-30t149.04 30q69.5 30 122 82.5T834-629.28q30 69.73 30 149Q864-401 834-331t-82.5 122.5Q699-156 629.28-126q-69.73 30-149 30Z"/></svg>),
        });
    }
    setOpenAddAllModal(false);
    setActiveSeasonForModal(null);
  };
  // 3. Handle state shifts and save configurations straight to local cache arrays
  const toggle = (id: string) => {
    const storageKey = `accordion_open_season_${ttid}`;
    
    setOpenSeasonId((prev) => {
      const nextState = prev === id ? null : id;
      if (nextState === null) {
        sessionStorage.removeItem(storageKey);
      } else {
        sessionStorage.setItem(storageKey, nextState);
      }
      return nextState;
    });
  };

  const setDataForSeason = async (season : any) => {
    const seasonId = String(season.id);
    if (data[seasonId]) {
      // Data for this season is already fetched and cached
      return;
    }
    let dummyVideoId = season.episodes.find((e: any) => e.season === season.number && e.number === 1)?.id || season.episodes.filter((e: any) => e.season === season.number)?.[0]?.id || season.episodes[0]?.id;
    let seasontorrenturl = `https://torrentio.strem.fun/stream/series/${dummyVideoId}.json`;
    try {
      const res = await fetch(seasontorrenturl);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();
        if (json) {
          if (json.streams.length === 0) {
            let dummyVideoId = season.episodes.find((e: any) => e.season === season.number && e.number === 2)?.id || season.episodes.filter((e: any) => e.season === season.number)?.[1]?.id || season.episodes[1]?.id;
            seasontorrenturl = `https://torrentio.strem.fun/stream/series/${dummyVideoId}.json`;
            const res = await fetch(seasontorrenturl);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const json = await res.json();
              if (json && json.streams) {
                setData((prevData) => ({
                  ...prevData,
                  [seasonId]: json.streams,
                }));
              }
          }
          else {
            setData((prevData) => ({
              ...prevData,
              [seasonId]: json.streams,
            }));
          }
        }
      } catch (e) {
        console.error(`Failed to fetch series streams from ${seasontorrenturl}:`, e);
        // ignore and try next
      }
  };

  const ShowBasicData = (stream: any,object: boolean = false) => {
    if (!stream) return "Select an option";
    const provider = stream.title.match(/⚙️\s*([^\n]+)/)?.[1] ?? "-";
    const size = stream.title.match(/💾\s*([\d.,]+\s*(?:GB|MB|KB|B))/i)?.[1] ?? (stream.fileSize || "-");
    const roundedSize = size.replace(/([\d.,]+)/, (match : any) => {
      const num = parseFloat(match.replace(/,/g, ''));
      if (isNaN(num)) return match;

      let rounded;
      
      if (num < 100) {
        // For numbers under 100
        rounded = Math.round(num * 2) / 2;
      } else {
        // For larger numbers (like 401, 445, 472), round to the nearest 50 
        rounded = Math.round(num / 50) * 50;
      }
      
      return rounded.toLocaleString();
    });
    if (!object) {
      return `${stream.name}-${provider} (≈${roundedSize})`;
    }
    return {hash: stream.infoHash, name: stream.name, provider: provider, Size: "≈" + roundedSize};
  }

  return (
  <div className="space-y-8">
    {/* 1. THE SEASONS LOOP (Clean & Free of Modal DOM Bloat) */}
    {seasons.map((season, idx) => {
      const isOpen = openSeasonId === String(season.id);
      return (
        <section id={`season-content-${season.id}`}
          key={season.id}
          onClick={() => toggle(String(season.id))}
          className="relative bg-zinc-900 rounded-xl p-4 hover:bg-zinc-800 transition-colors cursor-pointer"
          style={{ padding: 40 }}
        > 
          <div className="justify-between flex items-center mb-4">
            <button
              type="button"
              className="cursor-pointer hover:bg-zinc-600 active:bg-zinc-700/60 p-1.5 rounded-md transition-colors select-none group focus:outline-none"
              onClick={(e) => {
                e.stopPropagation();
                setDataForSeason(season); // Fetch and set data for the selected season
                // Pass the whole season object (or just season.id) to your state
                setActiveSeasonForModal(season.id); 
                setOpenAddAllModal(true);
              }}
              title="Add all episodes of this season to batch"
            >
              <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF"><path d={svgPaths[season.id]}/></svg>
            </button>
            <div className="text-zinc-400 text-sm">
              {season.episodes.length} {season.episodes.length === 1 ? "episode" : "episodes"}
            </div>
          </div>
          <h2 className="text-xl font-semibold mb-3 text-center">{season.name}</h2>

          <div
            style={{ display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 300ms ease-in-out' }}
          >
            <div className="overflow-hidden">
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
                      <p className="mt-2 text-sm font-medium">{ename}</p>
                      {(ep.description || ep.overview) && <p className="mt-1 text-xs text-zinc-400">{ep.description || ep.overview}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 bottom-4 text-white rounded-full w-10 h-10 flex items-center justify-center shadow pointer-events-none">
            <svg className={`w-5 h-5 transition-transform duration-200 ${isOpen ? "rotate-180" : "rotate-0"}`} viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
            </svg>
          </div>
        </section>
      );
    })}

    {/* 2. THE MODAL (Moved completely outside the loop) */}
    {openAddAllModal && activeSeasonForModal && (
      <div onClick={(e) => {setOpenAddAllModal(false); setActiveSeasonForModal(null); }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-md [backdrop-filter:blur(8px)]">
        <div onClick={(e) => e.stopPropagation()} className="bg-zinc-900 border border-zinc-800 w-full max-w-xl rounded-xl p-5 flex flex-col shadow-2xl max-h-[85vh] search-scrollbar">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
            <h3 className="text-base font-bold text-white">Select Stream Target ({seasons.find((s) => s.id === activeSeasonForModal)?.name})</h3>
            <button 
              onClick={() => { setOpenAddAllModal(false); setActiveSeasonForModal(null); }} 
              className="text-zinc-400 hover:text-white font-bold cursor-pointer text-sm"
            >
              ✕
            </button>
          </div>

          {/* FIXED Body Wrapper: Boosted max-height & added grid centering styles */}
          <div className="flex-1 bg-zinc-950 p-6 rounded-lg border border-zinc-800 max-h-[60vh] flex flex-col items-center justify-center ">
            
            {/* Dropdown Container Element */}
            <div className="w-full max-w-s flex flex-col gap-1.5 mx-auto">
              <label className="text-zinc-400 text-xs font-medium pl-1">Stream</label>

              <Menu as={"div" as React.ElementType} className="relative inline-block text-left w-full">
                {/* Trigger Button */}
                <MenuButton className="w-full inline-flex justify-between items-center gap-x-1.5 rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800/80 transition-colors focus:outline-none focus:border-green-600 cursor-pointer">
                  <span>{selectedHash?.split(",")[0] === activeSeasonForModal ? ShowBasicData(data[activeSeasonForModal]?.find((s: any) => s.infoHash === selectedHash?.split(",")[1])).toString() : "Select an option"}</span>
                  <svg className="h-4 w-4 text-zinc-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.168l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </MenuButton>

                {/* Dropdown Menu Items */}
                <MenuItems
                  transition
                  className="absolute left-0 z-50 mt-1 w-full origin-top-left rounded-lg bg-zinc-900 border border-zinc-800 shadow-xl focus:outline-none py-1 max-h-48 overflow-y-auto search-scrollbar transition ease-out duration-100 data-[closed]:scale-95 data-[closed]:opacity-0"
                >
                  {data[activeSeasonForModal] == undefined && (
                    <div className="p-4">
                      <div className="animate-pulse">
                        <div className="h-4 bg-zinc-800 rounded mb-2 w-3/4" />
                        <div className="h-10 bg-zinc-800 rounded mb-2" />
                        <div className="h-10 bg-zinc-800 rounded mb-2" />
                      </div>
                    </div>
                  )}
                  {data[activeSeasonForModal]?.map((stream: any) => (ShowBasicData(stream, true))).map((item: any) => (
                    <MenuItem key={item.hash}>
                      <button
                        type="button"
                        onClick={() => setSelectedHash(`${activeSeasonForModal},${item.hash}`)}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer block
                          ${selectedHash?.split(",")[0] === activeSeasonForModal && selectedHash?.split(",")[1] === item.hash 
                            ? "bg-green-600 text-white font-semibold" 
                            : "text-zinc-300 data-[focus]:bg-zinc-800 data-[focus]:text-white"
                          }`}
                      >
                        {item.name} - {item.provider} ({item.Size})
                      </button>
                    </MenuItem>
                  ))}
                </MenuItems>
              </Menu>
            </div>

          </div>

          {/* Footer Controls */}
          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={() => { setOpenAddAllModal(false); setActiveSeasonForModal(null); }}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold text-zinc-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() =>addAllEpisodesToBatch((selectedHash || "")+","+ttid+","+seasons.find((s) => s.id === activeSeasonForModal)?.episodes.length)}
              disabled={selectedHash === "" || selectedHash === null || selectedHash.split(",")[0] != activeSeasonForModal || selectedHash.split(",")[1] === undefined}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 hover:cursor-pointer disabled:bg-zinc-800 text-white disabled:text-zinc-600 font-bold text-xs rounded-lg disabled:cursor-not-allowed transition-colors"
            >
              Add All Episodes to Batch
            </button>
          </div>

        </div>
      </div>
    )}

    {/* 3. GLOBAL LOADING OVERLAY */}
    {loading && (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
        <span className="loader"></span>
        <span className="ml-4 text-lg">Loading...</span>
      </div>
    )}
  </div>
  );
}