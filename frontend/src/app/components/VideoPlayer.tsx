"use client"

import { useEffect, useRef, useState } from "react";
import { getApiUrl } from "../Actions/RestApiConfig";
import Loader from "../loader";

interface VideoPlayerProps {
    videopath: string;
}

export default function VideoPlayer({ videopath }: VideoPlayerProps) {
    const [loading, setLoading] = useState(true);
    const [videourl, setVideourl] = useState<string>("");
    
    
    useEffect(() => {
        const fetchVideoUrl = async () => {
            try {
                const videoUrl = `${await getApiUrl(window.location.hostname, window.location.protocol)}/stream?filePath=${encodeURIComponent(videopath)}`;
                setVideourl(videoUrl);
            } catch (error) {
                console.error("Error fetching video URL:", error);
            }
            finally {
                setLoading(false);
            }
        };

        fetchVideoUrl();


        const topbar = document.getElementById("top-bar");
        const topbarDisplay = topbar ? topbar.style.display : null;
        const documentoverflow = document.body.style.overflow;
        if (topbar) topbar.style.display = "none";
        document.body.style.overflow = "hidden";
        return () => {
            if (topbar) topbar.style.display = topbarDisplay || "block";
            document.body.style.overflow = documentoverflow || "auto";
        };
    }, []);

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {loading ? <Loader /> : 
        <video width="100%" controls autoPlay>
            <source src={videourl} type="video/mp4" />
            Your browser does not support the video tag.
        </video>
        }
        </div>
    );
}