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
  episode_info?: string,
  initiallySaved?: boolean,
};

export default function SaveMediaButton({ ttid, name, year, type, poster_url, series_name, episode_info, initiallySaved = false }: SaveMediaButtonProps) {
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(initiallySaved);

    useEffect(() => {
        const handleSavedMediaAdded = (event: Event) => {
            const { ttid: addedTtid } = (event as CustomEvent<{ ttid?: string }>).detail ?? {};
            if (addedTtid === ttid) setSaved(true);
        };
        const handleSavedMediaDeleted = (event: Event) => {
            const { ttid: deletedTtid } = (event as CustomEvent<{ ttid?: string }>).detail ?? {};
            if (deletedTtid === ttid) setSaved(false);
        };
        const handleSavedMediaDeletedAll = () => setSaved(false);

        window.addEventListener("saved-media-added", handleSavedMediaAdded);
        window.addEventListener("saved-media-deleted", handleSavedMediaDeleted);
        window.addEventListener("saved-media-deleted-all", handleSavedMediaDeletedAll);
        return () => {
            window.removeEventListener("saved-media-added", handleSavedMediaAdded);
            window.removeEventListener("saved-media-deleted", handleSavedMediaDeleted);
            window.removeEventListener("saved-media-deleted-all", handleSavedMediaDeletedAll);
        };
    }, [ttid]);

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
            setSaved(true);
            window.dispatchEvent(new CustomEvent("saved-media-added", { detail: { ttid: ttid } }));
            toast.success("Media saved successfully!");
        } catch (e) {
            toast.error("Failed to save media. " + (e instanceof Error ? e.message : ""));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setLoading(true);
        try {
            const res = await fetch(`http://${window.location.hostname}:7000/deleteSavedMedia`, {
                method: "DELETE",
                body: new URLSearchParams({ ttid })
            });
            const result = await res.json();
            if (!result.success) throw new Error(result.message || "");
            setSaved(false);
            window.dispatchEvent(new CustomEvent("saved-media-deleted", { detail: { ttid } }));
            toast.success("Saved media deleted successfully");
        } catch (e) {
            toast.error("Failed to delete saved media. " + (e instanceof Error ? e.message : ""));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-6 h-6 mr-4 mt-1.5">
            <button
                type="button"
                onClick={saved ? handleDelete : handleSave}
                disabled={loading}
                aria-label={saved ? `Remove ${name} from saved media` : `Save ${name}`}
                className="rounded hover:cursor-pointer hover:opacity-80 disabled:pointer-events-none disabled:opacity-50"
            >
                <img
                    src={saved ? "/delete-saved-media.svg" : "/savemedia.svg"}
                    alt=""
                    className="h-6 w-6"
                />
            </button>
            {loading && <Loader />}
        </div>
    );
}