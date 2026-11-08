"use client";

import { useEffect, useRef, useState } from "react";
import Artplayer from "artplayer";
import { getApiUrl } from "../Actions/RestApiConfig";
import Loader from "../loader";

interface ArtPlayerProps {
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

export default function ArtPlayerPlayer({ videopath }: ArtPlayerProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const playerRef = useRef<Artplayer | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const abortController = new AbortController();
        let cancelled = false;

        const createPlayer = async (apiUrl: string) => {
            if (cancelled || !containerRef.current) return;

            const player = new Artplayer({
                container: containerRef.current,
                url: `${apiUrl}/stream?filePath=${encodeURIComponent(videopath)}`,
                type: "mp4",
                autoplay: true,
                fullscreen: true,
                playbackRate: true,
                setting: true,
                theme: "#facc15",
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
                player.setting.add({
                    html: "Subtitles",
                    selector: [
                        { html: "Off", onSelect: () => player.subtitle.url = "" },
                        ...videoSubs.map((sub) => ({
                            html: sub.label,
                            onSelect: () => player.subtitle.switch(sub.url, {
                                name: sub.label,
                                type: "vtt",
                            }),
                        })),
                    ],
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
        <div className="w-full">
        {loading && <Loader />}
            <div ref={containerRef} className="aspect-video w-full" />
        </div>
    );
}
