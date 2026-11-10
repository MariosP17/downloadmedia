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

     async function getName(cleanName: string, path: string) : Promise<string | undefined> {
        try {
            const { title, year } = parseTitleAndYear(name);
            if (!title) return undefined;
            const omdbUrl = `${await getApiUrl(window.location.hostname, window.location.protocol)}/getOmdbData?t=${encodeURIComponent(title)}${year ? `&y=${year}` : ""}&type=${type}&season=${episodeInfo?.season}&episode=${episodeInfo?.episode}`;
            const OMDBResponse = await fetch(omdbUrl);
            const OMDBData = await OMDBResponse.json();
            if (!OMDBData || OMDBData.Response === "False") {
              toast.error("Error getting ttid and title for " + cleanName);
              return undefined;
            }
            if (OMDBData.seriesID && OMDBData.Title) {
              return OMDBData.Title ;
            }
            else {
                toast.error("Error getting ttid and title for " + cleanName);
                return undefined;
            }
        } catch (error) {
        toast.error("Error getting ttid and title for " + cleanName);
        console.error("Error getting ttid and title for media:", error);
        return undefined;
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
        const title = await getName(name.replace(/\s*\(\d{4}\).*$/, ""), videopath);
        if ( title === undefined) {
            console.error("Episode name is undefined. Cannot fetch episode name.");
            toast.error("Episode name is undefined. Cannot fetch episode name.");
            return undefined;
        }
        return title;
      }
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

                // player.setting.add();
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
                player.setting.add({
                    html: "Subtitle Configuration",
                    icon: `
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" height="24px" width="24px" fill="#FFFFFF">
                            <path d="M7.27,36.73q0,0 0-0.17t0-0.44q0-9.21 0-14.25t0-7.39t0-2.78t0-0.43q0,0 0,0.17t0,0.44V36.12t0,0.08t0,0.54Zm7.58-12.52V21.94H12.58v2.27h2.27Zm9.2,0q0.34-0.64 0.71-1.18t0.78-1.09H18.12v2.27h5.93Zm-1.52,6.12q0-0.04 0.01-0.09t0.01-0.09q0-0.54 0.03-1.06t0.11-1.02H12.58v2.27h9.95ZM26.3,39H7.88Q6.7,39 5.85,38.15T5,36.12V11.88Q5,10.7 5.85,9.85T7.88,9H40.12q1.18,0 2.03,0.85T43,11.88v8.56q-0.55-0.46-1.09-0.83t-1.18-0.69V11.88q0-0.27-0.17-0.44t-0.44-0.17H7.88q-0.27,0-0.44,0.17T7.27,11.88V36.12q0,0.27 0.17,0.44t0.44,0.17H24.41q0.4,0.64 0.88,1.21T26.3,39Zm9.76,0H34.15l-0.37-2.88q-0.94-0.21-1.77-0.67T30.5,34.28l-2.42,0.66L27.2,33.48l2.12-1.85q-0.25-0.7-0.25-1.48t0.25-1.5l-2.1-1.87L28.1,25.3l2.4,0.68q0.66-0.74 1.5-1.18t1.78-0.66l0.37-2.88h1.91l0.35,2.88q0.94,0.21 1.77,0.65t1.51,1.17l2.4-0.66l0.88,1.45l-2.1,1.87q0.25,0.72 0.25,1.51t-0.25,1.49l2.12,1.85L42.1,34.94l-2.42-0.66Q39,35 38.17,35.46T36.4,36.12L36.06,39Zm-0.98-5.05q1.59,0 2.7-1.12t1.11-2.69q0-1.59-1.11-2.7t-2.69-1.11t-2.7,1.11t-1.12,2.69t1.12,2.7t2.69,1.12Z"/>
                        </svg>
                    `,
                    selector: [
                    {
                        width: 300,
                        html: "Subtitle delay",
                        position: "right",
                        icon: `
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="24px" width="24px" fill="#FFFFFF">
                                <path d="M15.47,16.53l1.05-1.05L12.75,11.7V7h-1.5v5.3l4.22,4.22ZM12,21.5q-1.97,0-3.71-0.75T5.28,18.72T3.25,15.71T2.5,12T3.25,8.3T5.28,5.28T8.29,3.25T12,2.5T15.7,3.25t3.02,2.03t2.03,3.02T21.5,12T20.75,15.7t-2.03,3.02t-3.02,2.03T12,21.5ZM12,12Zm0,8q3.33,0 5.66-2.34T20,12q0-3.33-2.34-5.66T12,4Q8.68,4 6.34,6.34T4,12t2.34,5.66T12,20Z"/>
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
                    },
                    {
                        html: 'Subtitle Size',
                        icon: `
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="24px" width="24px" fill="#FFFFFF">
                                <path d="M16.52,17.79V11.17l-1.85,1.85l-1.05-1.05l3.65-3.65l3.65,3.65l-1.05,1.05l-1.85-1.85v6.62h-1.5Zm-12.94,0L7.52,7.17H9.05l3.96,10.62h-1.5l-1-2.89H6.07L5.06,17.79H3.58Zm2.96-4.15h3.52L8.31,8.76H8.23L6.53,13.64Z"/>
                            </svg>
                        `,
                        tooltip: 'Medium', // Default display value
                        selector: [
                            { html: 'Small (20px)', size: '20px' },
                            { html: 'Medium (30px)', size: '30px', default: true },
                            { html: 'Large (40px)', size: '40px' },
                            { html: 'Extra Large (50px)', size: '50px' }
                        ],
                        onSelect: function (item) {
                            // Apply the new font size
                            player.subtitle.style('fontSize', item.size);
                            // Update the menu tooltip to show the current selection
                            // item.tooltip = item.html.split(' ')[0]; 
                            return item.html.replace(/\((.*px)\)/, ''); // Return only the size part for the tooltip
                        }
                    },
                    {
                        // 2. Subtitle Color Option
                        html: 'Subtitle Color',
                        icon: `
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="24px" width="24px" fill="#FFFFFF"><path d="M2.5,24V20.27h19V24H2.5Zm3.37-7L11.13,3.5h1.73L18.13,17h-1.8l-1.35-3.62H9.01L7.63,17H5.87Zm3.67-5.1h4.89L12.05,5.6H11.93l-2.4,6.3Z"/></svg>
                        `,
                        tooltip: 'White',
                        selector: [
                            { html: 'White', color: '#FFFFFF', default: true },
                            { html: 'Yellow', color: '#FFFF00' },
                            { html: 'Cyan', color: '#00FFFF' }
                        ],
                        onSelect: function (item) {
                            // Apply the new color
                            player.subtitle.style('color', item.color);
                            
                            item.tooltip = item.html;
                            return item.html;
                        }
                }
            ]
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
