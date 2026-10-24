"use client";
import toast from "react-hot-toast";
import { useState, useEffect } from "react";
import { MediaType } from "../../../Props";
import Loader from "../loader";

type SaveMediaButtonProps = {
  ttid: string,
  name: string,
  year: string,
  type: MediaType,
  poster_url: string,
  series_name?: string,
  episode_info?: string
};

export default function SaveMediaButton({ ttid, name, year, type, poster_url, series_name, episode_info }: SaveMediaButtonProps) {
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await fetch(`http://${window.location.hostname}:7000/addSavedMedia`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ ttid, name, year, type, poster_url, series_name, episode_info })
            });
            const result = await res.json();
            if (!result.success) throw new Error(result.message || "");
            window.dispatchEvent(new CustomEvent("saved-media-added", { detail: { ttid: ttid } }));
            toast.success("Media saved successfully!");
        } catch (e) {
            toast.error("Failed to save media. " + (e instanceof Error ? e.message : ""));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-6 h-6 mr-2 mt-1.5">
            <img
                onClick={handleSave}
                src="/savemedia.svg"
                alt={name}
                className="rounded hover:cursor-pointer hover:opacity-80"
              />
        {loading && <Loader />}
        </div>
    );
}