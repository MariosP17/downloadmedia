"use client";

import { useEffect, useRef, useState } from "react";
import Artplayer from "artplayer";
import { getApiUrl } from "../Actions/RestApiConfig";
import Loader from "../loader";
import { toast } from "react-hot-toast";

interface ArtPlayerProps {
    videopath: string;
    name: string;
    type: string;
    episodeInfo?: { season: number; episode: number };
}

type Subtitle = {
    url: string;
    lang: string;
    label: string;
};

type SubtitleResponse = {
    filepath: string;
    lang: string;
    label: string;
    index?: number;
};

export default function ArtPlayerPlayer({ videopath, name, type, episodeInfo }: ArtPlayerProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const isPhone = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const playerRef = useRef<Artplayer | null>(null);
    const [loading, setLoading] = useState(true);

     async function getTtid(cleanName: string, path: string) {
        try {
            const { title, year } = parseTitleAndYear(name);
            if (!title) return;
            const omdbUrl = `${await getApiUrl(window.location.hostname, window.location.protocol)}/getOmdbData?t=${encodeURIComponent(title)}${year ? `&y=${year}` : ""}&type=${type}`;
            const OMDBResponse = await fetch(omdbUrl);
            const OMDBData = await OMDBResponse.json();
            if (!OMDBData || OMDBData.Response === "False") {
              toast.error("Error getting ttid for " + cleanName);
              return;
            }
            if (OMDBData.imdbID) {
              const season = episodeInfo ? episodeInfo.season : undefined;
              const episode = episodeInfo ? episodeInfo.episode : undefined;
              const finalttid =  OMDBData.imdbID
              return finalttid;
            }
        } catch (error) {
        toast.error("Error getting ttid for " + cleanName);
        console.error("Error getting ttid for media:", error);
        }
    }

    function parseTitleAndYear(input: string): { title: string; year: string | null } {
    // Matches optional '(' or '[', followed by 19xx/20xx, followed by optional ')' or ']'
    const yearPattern = /[([]?\b((?:19|20)\d{2})\b[)\]]?/;

    const match = input.match(yearPattern);

    if (!match) {
      return {
        title: input.trim(),
        year: null,
      };
    }

    const year = match[1]; // Captured 4-digit year

    const title = input
      .replace(match[0], "") // Removes the year along with its surrounding brackets/parentheses
      .replace(/[._]/g, " ") // Converts dots/underscores to spaces (common in scene releases)
      .replace(/\s+/g, " ")  // Collapses leftover multi-spaces into a single space
      .trim();

    return { title, year };
  }

  const getEpisodeName =async (episodeInfo?: { season: number; episode: number }): Promise<string | undefined> => {
    if (episodeInfo?.season !== undefined && episodeInfo?.episode !== undefined) {
      const ttid = await getTtid(name.replace(/\s*\(\d{4}\).*$/, ""), videopath);
      const ret = await fetch(`${await getApiUrl(window.location.hostname, window.location.protocol)}/getEpisodeName?ttid=${encodeURIComponent(ttid || "")}&season=${episodeInfo.season}&episode=${episodeInfo.episode}`);
      if (!ret.ok) {
        toast.error((await ret.json()).error || "Failed to fetch episode name");
        console.error("Error fetching episode name:", ret.statusText);
        return undefined;
      }
      const data = await ret.json();
      if (data && data.episodeName) {
        return data.episodeName;
      } else {
        toast.error("Episode name not found in response");
        console.error("Episode name not found in response");
        return undefined;
      }
    }
    return undefined;
  };

    const getUrl = async (apiUrl: string) => {
        if (!isPhone) {
            return `${apiUrl}/stream?filePath=${encodeURIComponent(videopath)}`;
        } else {
            const MovieOrEpisodeName = type === "movie" ? name.replace(/\s*\(\d{4}\).*$/, "") : await getEpisodeName(episodeInfo);
            if (!MovieOrEpisodeName) {
                toast.error("Movie or Episode name is not provided");
                console.error("Movie or Episode name is not provided");
                return `${apiUrl}/stream?filePath=${encodeURIComponent(videopath)}`;
            }
            try{
                const response = await fetch(`${apiUrl}/getJellyfinMediaId?name=${encodeURIComponent(MovieOrEpisodeName)}&type=${encodeURIComponent(type === "movie" ? "Movie" : "Episode")}&seriesName=${encodeURIComponent(name.replace(/\s*\(\d{4}\).*$/, "") || "")}`, { method: "GET" });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => null);
                    throw new Error(errorData?.error || "Failed to get Jellyfin media ID");
                }
                const data = await response.json();
                if (data && data.media_id) {
                    const mediaId = encodeURIComponent(data.media_id);
                    const streamParams = new URLSearchParams({
                        MediaSourceId: data.media_id,
                        VideoCodec: "h264,vp9",
                        AudioCodec: "aac,opus,flac",
                        AudioStreamIndex: "2",
                        VideoBitrate: "3975984",
                        AudioBitrate: "384000",
                        MaxFramerate: "23.976025",
                        SegmentContainer: "mp4",
                        MinSegments: "1",
                        TranscodingMaxAudioChannels: "2",
                        RequireAvc: "false",
                        EnableAudioVbrEncoding: "true",
                        "hevc-level": "120",
                        "hevc-videobitdepth": "10",
                        "hevc-profile": "main10",
                        "vp9-rangetype": "SDR",
                        "h264-profile": "high,main,baseline,constrainedbaseline",
                        "h264-rangetype": "SDR",
                        "h264-level": "52",
                        "h264-deinterlace": "true",
                        TranscodeReasons: "VideoCodecNotSupported,AudioCodecNotSupported,VideoProfileNotSupported",
                    });
                    return `${apiUrl}/jellyfin-stream/videos/${mediaId}/master.m3u8?${streamParams.toString()}`;
                } else {
                    throw new Error("Media ID not found in response");
                }

            }
            catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                toast.error(`Unable to start Jellyfin playback: ${message}`);
                console.error("Error fetching Jellyfin media ID:", error);
                return `${apiUrl}/stream?filePath=${encodeURIComponent(videopath)}`;
            }
        }
    };

    useEffect(() => {
        const abortController = new AbortController();
        let cancelled = false;

        const createPlayer = async (apiUrl: string) => {
            if (cancelled || !containerRef.current) return;

            const player = new Artplayer({
                container: containerRef.current,
                url: await getUrl(apiUrl),
                type: "mp4",
                autoplay: true,
                fullscreen: true,
                playbackRate: true,
                setting: true,
                theme: "#3d21bb",
            });
            playerRef.current = player;
            setLoading(false);
        };

        const initialise = async () => {
            try {
                const apiUrl = await getApiUrl(window.location.hostname, window.location.protocol);
                await createPlayer(apiUrl);

                const response = await fetch(
                    `${apiUrl}/subtitles?filePath=${encodeURIComponent(videopath)}`,
                    { signal: abortController.signal },
                );
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data: SubtitleResponse[] = await response.json();
                const videoSubs = data.map((sub) => ({
                    url: sub.index !== undefined
                        ? `${apiUrl}/subtitle/embedded?videoPath=${encodeURIComponent(videopath)}&trackIndex=${sub.index}`
                        : `${apiUrl}/subtitle?filePath=${encodeURIComponent(sub.filepath)}`,
                    lang: sub.lang,
                    label: sub.label,
                }));
                const player = playerRef.current;
                if (!player || cancelled || videoSubs.length === 0) return;

                await player.subtitle.switch(videoSubs[0].url, {
                    name: videoSubs[0].label,
                    type: "vtt",
                });
                // let subtitleDelay = 0;
                // const cueTimes = new WeakMap<TextTrackCue, { start: number; end: number }>();

                player.setting.add({
                    width: 300,
                    html: "Subtitle delay",
                    position: "right",
                    icon: `
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/>
                            <path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                        </svg>
                    `,
                    tooltip: ``,
                    onClick(item, _element, event) {
                        event.stopPropagation();
                        return item.tooltip ?? "";
                    },
                    mounted(_panel, item) {
                        const tooltip = item.$tooltip;
                        if (!tooltip) {
                            console.error("Could not initialize subtitle delay tooltip");
                            return;
                        }

                        const controls = document.createElement("span");
                        controls.dataset.delayControls = "";
                        controls.style.display = "inline-flex";
                        controls.style.alignItems = "center";
                        controls.style.gap = "3px";
                        controls.style.marginLeft = "6px";

                        // const updateDelay = (delay: number) => {
                        //     subtitleDelay = Number(delay.toFixed(1));
                        //     const cues = player.subtitle.cues;

                        //     if (cues) {
                        //         for (let index = 0; index < cues.length; index++) {
                        //             const cue = cues[index];
                        //             const original = cueTimes.get(cue) ?? {
                        //                 start: cue.startTime,
                        //                 end: cue.endTime,
                        //             };
                        //             cueTimes.set(cue, original);
                        //             cue.startTime = original.start + subtitleDelay;
                        //             cue.endTime = original.end + subtitleDelay;
                        //         }
                        //     }

                        //     const value = item.$tooltip?.querySelector("[data-delay-value]");
                        //     if (value) value.textContent = `${subtitleDelay.toFixed(1)}s`;
                        // };

                        const updateDelay = (delay: number) => {
                            const nextDelay = Number(delay.toFixed(1));
                            if (nextDelay < -10 || nextDelay > 10) return; // Limit delay between -10s and +10s
                            player.subtitleOffset = nextDelay;
                            const appliedDelay = player.subtitleOffset;
                            const value = item.$tooltip?.querySelector("[data-delay-value]");
                            if (value) value.textContent = `${appliedDelay.toFixed(1)}s`;
                        };

                        const createButton = (label: string, delay: number, ariaLabel: string) => {
                            const button = document.createElement("button");
                            button.type = "button";
                            button.textContent = label;
                            button.setAttribute("aria-label", ariaLabel);
                            button.className = "art-subtitle-delay-button";
                            button.dataset.delay = String(delay);
                            return button;
                        };

                        const createLabel = (text: string, ariaLabel: string) => {
                            const label = document.createElement("span");
                            label.textContent = text;
                            label.setAttribute("aria-label", ariaLabel);
                            label.dataset.delayValue = "";
                            return label;
                        };

                        const decrease = createButton("-", -0.5, "Decrease subtitle delay");
                        const label = createLabel(
                            `${player.subtitleOffset.toFixed(1)}s`,
                            "Current subtitle delay",
                        );
                        const increase = createButton("+", 0.5, "Increase subtitle delay");
                        const reset = createButton("Reset", 0, "Reset subtitle delay");
                        reset.dataset.delay = "reset";
                        controls.append(decrease);
                        controls.append(label);
                        controls.append(increase);
                        controls.append(reset);
                        tooltip.append(controls);
                        item.$item.addEventListener("click", (event : any) => {
                            event.stopPropagation();
                            const target = event.target;
                            if (!(target instanceof HTMLElement)) return;
                            const button = target.closest<HTMLButtonElement>("button[data-delay]");
                            if (!button) return;
                            updateDelay(button.dataset.delay === "reset"
                                ? 0
                                : player.subtitleOffset + Number(button.dataset.delay));
                        }, true);
                    },
                });
                player.subtitle.show = true;
                const subtitleByLabel = new Map(videoSubs.map((sub) => [sub.label, sub]));
                player.setting.add({
                    width: 200,
                    html: "Subtitle",
                    tooltip: videoSubs[0].label,
                    selector: [
                        {
                            html: "Display",
                            tooltip: "Show",
                            switch: true,
                            onSwitch(item) {
                                item.tooltip = item.switch ? "Hide" : "Show";
                                player.subtitle.show = !item.switch;
                                return !item.switch;
                            },
                        },
                        ...videoSubs.map((sub, index) => ({
                            default: index === 0,
                            html: sub.label,
                            url: sub.url,
                        })),
                    ],
                    onSelect(item) {
                        const subtitle = subtitleByLabel.get(item.html);
                        if (subtitle) {
                            void player.subtitle.switch(subtitle.url, {
                                name: subtitle.label,
                                type: "vtt",
                            });
                            player.subtitle.show = true;
                        }
                        return item.html;
                    },
                });
            } catch (error) {
                if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
                console.error("Error loading Artplayer subtitles:", error);
            }
        };

        void initialise();
        return () => {
            cancelled = true;
            abortController.abort();
            playerRef.current?.destroy(false);
            playerRef.current = null;
        };
    }, [videopath]);

    return (
        <div className="relative w-full">
            {loading && <Loader />}
            <div ref={containerRef} className="aspect-video w-full" />
        </div>
    );
}
