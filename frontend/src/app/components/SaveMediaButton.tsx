"use client";
import toast from "react-hot-toast";
import { useState, useEffect } from "react";
import { MediaType } from "../../../Props";
import Loader from "../loader";

type SaveMediaButtonProps = {
  ttid: string,
  name: string,
  year: number,
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
            toast.success("Media saved successfully!");
        } catch (e) {
            toast.error("Failed to save media. " + (e instanceof Error ? e.message : ""));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <img
                onClick={handleSave}
                src="/savemedia.svg"
                alt={name}
                className="mr-3 w-6 h-6 rounded hover:cursor-pointer hover:opacity-80"
              />
        {loading && <Loader />}
        </div>
    );
}