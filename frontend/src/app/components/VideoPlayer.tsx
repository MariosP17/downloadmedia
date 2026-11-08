"use client"

import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";
import { getApiUrl } from "../Actions/RestApiConfig";
import Loader from "../loader";
import { toast } from "react-hot-toast";

interface VideoPlayerProps {
    videopath: string;
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

const PLAYER_CONTROLS_HIDE_DELAY = 3000;
const TOUCH_TRANSITION_DELAY = 300;

export default function VideoPlayer({ videopath }: VideoPlayerProps) {
    const [loading, setLoading] = useState(true);
    const [videourl, setVideourl] = useState<string | null>(null);
    const [videoSubs, setVideoSubs] = useState<Subtitle[]>([]);
    const [delayTracker, setDelayTracker] = useState<number>(0);
    const [showDelaySettings, setShowDelaySettings] = useState(false);
    const [activeSubtitleKey, setActiveSubtitleKey] = useState<string | null>(null);
    const [subtitleDelays, setSubtitleDelays] = useState<Record<string, number>>({});
    const [playerControlsVisible, setPlayerControlsVisible] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const delaySettingsRef = useRef<HTMLDivElement | null>(null);
    const playerRef = useRef<HTMLDivElement | null>(null);
    const controlsFadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const touchTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasStartedPlaybackRef = useRef(false);
    
    
    useEffect(() => {
        const abortController = new AbortController();
        const videoElement = videoRef.current;
        let cancelled = false;

        const fetchVideoUrl = async () => {
            try {
                const videoUrl = `${await getApiUrl(window.location.hostname, window.location.protocol)}/stream?filePath=${encodeURIComponent(videopath)}`;
                if (cancelled) return;
                setVideourl(videoUrl);
            } catch (error) {
                if (cancelled) return;
                console.error("Error fetching video URL:", error);
                toast.error("Failed to fetch video URL. Please try again later.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        const fetchVideoSubs = async () => {
            try {
                const subsUrl = `${await getApiUrl(window.location.hostname, window.location.protocol)}/subtitles?filePath=${encodeURIComponent(videopath)}`;
                const response = await fetch(subsUrl, { signal: abortController.signal });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data: SubtitleResponse[] = await response.json();
                const baseUrl = await getApiUrl(window.location.hostname, window.location.protocol);
                if (cancelled) return;
                const subsData: Subtitle[] = await Promise.all(data.map(async (sub) => ({
                    url: sub.index != undefined ? baseUrl + `/subtitle/embedded?videoPath=${encodeURIComponent(videopath)}&trackIndex=${sub.index}` : baseUrl + `/subtitle?filePath=${encodeURIComponent(sub.filepath)}`,
                    lang: sub.lang,
                    label: sub.label
                })));
                if (cancelled) return;
                setVideoSubs(subsData || []);
            } catch (error) {
                if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
                console.error("Error fetching video subtitles:", error);
                toast.error(`Failed to fetch video subtitles. ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        };
        fetchVideoSubs();
        fetchVideoUrl();
        // document.getElementById("video-player-popup")?.addEventListener("click", (e) => {
        //     e.stopPropagation();
        //     setShowDelaySettings(false);
        // });

        const topbar = document.getElementById("top-bar");
        const topbarDisplay = topbar ? topbar.style.display : null;
        const documentoverflow = document.body.style.overflow;
        if (topbar) topbar.style.display = "none";
        document.body.style.overflow = "hidden";
        return () => {
            cancelled = true;
            abortController.abort();
            if (videoElement) {
                videoElement.pause();
                videoElement.querySelectorAll("source, track").forEach((element) => element.removeAttribute("src"));
            }
            if (topbar) topbar.style.display = topbarDisplay || "block";
            document.body.style.overflow = documentoverflow || "auto";
            // document.getElementById("video-player-popup")?.removeEventListener("click", (e) => {
            //     e.stopPropagation();
            //     setShowDelaySettings(false);
            // });
        };
    }, [videopath]);

    const getSubtitleKey = (track: TextTrack) => `${track.language}:${track.label}`;

    const applySubtitleDelay = useCallback((track: TextTrack, delay: number) => {
        if (!track.cues) return false;

        const currentDelay = subtitleDelays[getSubtitleKey(track)] ?? 0;
        const delta = +(delay - currentDelay).toFixed(1);
        if (delta === 0) return true;

        for (let index = 0; index < track.cues.length; index++) {
            const cue = track.cues[index];
            cue.startTime += delta;
            cue.endTime += delta;
        }
        return true;
    }, [subtitleDelays]);

    const applyActiveSubtitleDelay = (delay: number) => {
        const video = videoRef.current;
        const activeTrack = video && Array.from(video.textTracks).find((track) => track.mode === "showing");
        if (!activeTrack || !applySubtitleDelay(activeTrack, delay)) return;

        const key = getSubtitleKey(activeTrack);
        setSubtitleDelays((current) => ({ ...current, [key]: delay }));
        setDelayTracker(delay);
        setActiveSubtitleKey(key);
    };

    const adjustSubtitleDelay = (deltaInSeconds: number) => {
        const currentDelay = activeSubtitleKey ? subtitleDelays[activeSubtitleKey] ?? 0 : 0;
        applyActiveSubtitleDelay(+(currentDelay + deltaInSeconds).toFixed(1));
    };

    const resetSubtitleDelay = () => applyActiveSubtitleDelay(0);

    const revealPlayerControls = () => {
        if (!isPlaying) return;

        setPlayerControlsVisible(true);
        if (controlsFadeTimeoutRef.current) {
            clearTimeout(controlsFadeTimeoutRef.current);
        }
        if (!isPlaying) return;
        controlsFadeTimeoutRef.current = setTimeout(() => {
            setPlayerControlsVisible(false);
        }, PLAYER_CONTROLS_HIDE_DELAY);
    };

    const handlePlay = () => {
        setIsPlaying(true);
        if (controlsFadeTimeoutRef.current) {
            clearTimeout(controlsFadeTimeoutRef.current);
        }
        setPlayerControlsVisible(false);
        hasStartedPlaybackRef.current = true;
    };

    const handlePause = () => {
        setIsPlaying(false);
        if (controlsFadeTimeoutRef.current) {
            clearTimeout(controlsFadeTimeoutRef.current);
        }
        setPlayerControlsVisible(true);
    };

    const toggleTouchControls = (event: TouchEvent<HTMLDivElement>) => {
        if (delaySettingsRef.current?.contains(event.target as Node)) return;

        setShowDelaySettings(false);
        if (!isPlaying) {
            setPlayerControlsVisible(true);
            return;
        }

        if (touchTransitionTimeoutRef.current) {
            clearTimeout(touchTransitionTimeoutRef.current);
        }
        touchTransitionTimeoutRef.current = setTimeout(() => {
            setPlayerControlsVisible((visible) => {
                if (controlsFadeTimeoutRef.current) {
                    clearTimeout(controlsFadeTimeoutRef.current);
                }

                if (!visible) {
                    controlsFadeTimeoutRef.current = setTimeout(() => {
                        setPlayerControlsVisible(false);
                    }, PLAYER_CONTROLS_HIDE_DELAY);
                }

                return !visible;
            });
        }, TOUCH_TRANSITION_DELAY);
    };

    const hideControlsOnMouseLeave = () => {
        if (isPlaying && !showDelaySettings) {
            if (controlsFadeTimeoutRef.current) {
                clearTimeout(controlsFadeTimeoutRef.current);
            }
            setPlayerControlsVisible(false);
        }
    };

    const toggleFullscreen = async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            } else {
                await playerRef.current?.requestFullscreen();
            }
        } catch (error) {
            console.error("Could not change fullscreen mode:", error);
            toast.error("Could not change fullscreen mode.");
        }
    };

    useEffect(() => {
        const updateFullscreenState = () => {
            setIsFullscreen(document.fullscreenElement === playerRef.current);
            if (videoRef.current && !videoRef.current.paused) {
                setPlayerControlsVisible(true);
                if (controlsFadeTimeoutRef.current) {
                    clearTimeout(controlsFadeTimeoutRef.current);
                }
                controlsFadeTimeoutRef.current = setTimeout(() => {
                    setPlayerControlsVisible(false);
                }, PLAYER_CONTROLS_HIDE_DELAY);
            }
        };
        document.addEventListener("fullscreenchange", updateFullscreenState);
        return () => document.removeEventListener("fullscreenchange", updateFullscreenState);
    }, []);

    useEffect(() => {
        if (controlsFadeTimeoutRef.current) {
            clearTimeout(controlsFadeTimeoutRef.current);
        }

        if (!videourl || showDelaySettings || !isPlaying) return;

        controlsFadeTimeoutRef.current = setTimeout(() => {
            setPlayerControlsVisible(false);
        }, PLAYER_CONTROLS_HIDE_DELAY);

        return () => {
            if (controlsFadeTimeoutRef.current) {
                clearTimeout(controlsFadeTimeoutRef.current);
            }
        };
    }, [isPlaying, showDelaySettings, videourl]);

    useEffect(() => () => {
        if (controlsFadeTimeoutRef.current) {
            clearTimeout(controlsFadeTimeoutRef.current);
        }
        if (touchTransitionTimeoutRef.current) {
            clearTimeout(touchTransitionTimeoutRef.current);
        }
    }, []);

    useEffect(() => {
        const closeSettingsOnOutsideClick = (event: MouseEvent) => {
            if (delaySettingsRef.current && !delaySettingsRef.current.contains(event.target as Node)) {
                setShowDelaySettings(false);
            }
        };

        document.addEventListener("mousedown", closeSettingsOnOutsideClick);
        return () => document.removeEventListener("mousedown", closeSettingsOnOutsideClick);
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const updateActiveSubtitle = () => {
            const activeTrack = Array.from(video.textTracks).find((track) => track.mode === "showing");
            if (!activeTrack) return;

            const key = getSubtitleKey(activeTrack);
            const savedDelay = subtitleDelays[key] ?? 0;
            setActiveSubtitleKey(key);
            setDelayTracker(savedDelay);

            if (activeTrack.cues) {
                applySubtitleDelay(activeTrack, savedDelay);
            }
        };

        video.textTracks.addEventListener("change", updateActiveSubtitle);
        updateActiveSubtitle();
        return () => video.textTracks.removeEventListener("change", updateActiveSubtitle);
    }, [applySubtitleDelay, subtitleDelays, videoSubs]);

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            {loading || !videourl ? <Loader /> : (
                <div>
                <div
                    ref={playerRef}
                    className={`relative bg-black ${isFullscreen ? "h-screen w-screen" : ""}`}
                    onClick={() => setShowDelaySettings(false)}
                    onMouseEnter={revealPlayerControls}
                    onMouseMove={revealPlayerControls}
                    onMouseLeave={hideControlsOnMouseLeave}
                    onTouchStart={toggleTouchControls}
                >
                    <video
                        className={`block ${isFullscreen ? "h-full w-full object-contain" : ""}`}
                        width="100%"
                        controls
                        controlsList="nofullscreen"
                        autoPlay
                        playsInline={/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)}
                        crossOrigin="anonymous"
                        ref={videoRef}
                        onPlay={handlePlay}
                        onPause={handlePause}
                    >
                        <source src={videourl} type="video/mp4"/>
                        Your browser does not support the video tag.
                        {videoSubs && videoSubs.length > 0 && videoSubs.map((sub, index) => (
                            <track key={index} src={sub.url} kind="subtitles" srcLang={sub.lang} label={sub.label} default={index === 0} />
                        ))}
                    </video>

                    <div
                        ref={delaySettingsRef}
                        className={`absolute right-3 top-3 transition-opacity duration-300 ${playerControlsVisible || showDelaySettings ? "opacity-100" : "pointer-events-none opacity-0"}`}
                    >
                        <button
                            type="button"
                            onClick={(e) => {e.stopPropagation(); revealPlayerControls(); setShowDelaySettings((visible) => !visible);}}
                            className="cursor-pointer rounded-md border border-zinc-700 bg-zinc-900/90 p-2 text-zinc-200 shadow transition hover:border-zinc-500 hover:bg-zinc-800"
                            aria-expanded={showDelaySettings}
                            aria-controls="subtitle-delay-settings"
                            aria-label="Subtitle settings"
                            title="Subtitle settings"
                        >
                            <svg
                                aria-hidden="true"
                                className="h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth="1.8"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9M4.5 6h1.5M4.5 12h9M16.5 12h3M10.5 18h9M4.5 18h1.5" />
                                <circle cx="8" cy="6" r="1.5" />
                                <circle cx="14" cy="12" r="1.5" />
                                <circle cx="8" cy="18" r="1.5" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {e.stopPropagation(); revealPlayerControls(); void toggleFullscreen();}}
                            className="ml-2 cursor-pointer rounded-md border border-zinc-700 bg-zinc-900/90 p-2 text-zinc-200 shadow transition hover:border-zinc-500 hover:bg-zinc-800"
                            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                        >
                            <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                                {isFullscreen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v4.5H4.5M15 4.5v4.5h4.5M9 19.5V15H4.5M15 19.5V15h4.5" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15" />
                                )}
                            </svg>
                        </button>

                        {showDelaySettings && (
                            <div onClick={(e) => e.stopPropagation()}
                                id="subtitle-delay-settings"
                                className="absolute right-0 top-11 z-10 w-72 rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-zinc-200 shadow-xl"
                            >
                                <div className="mb-3 flex items-center justify-between">
                                    <span className="text-sm font-medium">Subtitle delay</span>
                                    <span className="font-mono text-sm text-zinc-400">{delayTracker.toFixed(1)}s</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => adjustSubtitleDelay(-0.5)}
                                        className="rounded-md border border-zinc-700 px-2 py-1.5 text-sm hover:bg-zinc-800"
                                    >
                                        -0.5s
                                    </button>
                                    <button
                                        type="button"
                                        onClick={resetSubtitleDelay}
                                        className="rounded-md border border-zinc-700 px-2 py-1.5 text-sm hover:bg-zinc-800"
                                    >
                                        Reset
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => adjustSubtitleDelay(0.5)}
                                        className="rounded-md border border-zinc-700 px-2 py-1.5 text-sm hover:bg-zinc-800"
                                    >
                                        +0.5s
                                    </button>
                                </div>
                                <p className="mt-2 text-xs text-zinc-500">Delay is saved separately for each subtitle.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            )
            }
        </div>
    );
}