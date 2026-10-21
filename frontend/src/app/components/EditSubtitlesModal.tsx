"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import Loader from "../loader";



type EditSubsProps = {
    cleanName: string;
    fullPath: string;
    onClose: () => void;
};

const apiUrl = (path: string) => `http://${window.location.hostname}:7000${path}`;

export default function EditSubtitlesModal({ cleanName, fullPath, onClose }: EditSubsProps) {
    const [content, setContent] = useState<string>("");
    const [loadedContent, setLoadedContent] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);

    useEffect(() => {
        const bodyOverflow = document.body.style.overflow;
        const rootOverflow = document.documentElement.style.overflow;
        const header = document.querySelector("#top-bar") as HTMLElement | null;
        const headerDisplay = header?.style.display; 

        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";
        if (header) header.style.display = "none";

        return () => {
            document.body.style.overflow = bodyOverflow;
            document.documentElement.style.overflow = rootOverflow;
            if (header) header.style.display = headerDisplay || "";
        };
    }, []);

    async function fetchSubtitleContent() {
        try {
            setLoading(true);
            const response = await fetch(apiUrl(`/getSubtitlesContent?filename=${encodeURIComponent(fullPath)}`));
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Could not fetch subtitle info");
            setContent(data.content || "");
            setLoadedContent(data.content || "");
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not fetch subtitle info");
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        void fetchSubtitleContent();
    }, []);

    

    const saveSubtitleContent = async () => {
        try {
            setSaving(true);
            const response = await fetch(apiUrl(`/saveSubtitlesContent`), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content, filename: fullPath }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Could not save subtitle info");
            toast.success("Subtitle saved successfully");
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not save subtitle info");
        }
        finally {
            await fetchSubtitleContent();
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                
                <div className="flex-shrink-0 border-b border-zinc-800 p-4 justify-between flex items-center">
                    <h2 className="text-lg font-semibold text-zinc-100">Edit Subtitles: <span className="text-blue-400">{cleanName}</span></h2>
                    <div className="flex gap-2"><button 
                        onClick={() => {onClose();}}
                        className="text-zinc-400 hover:text-white font-bold cursor-pointer text-sm"
                    >
                        ✕
                    </button></div>
                </div>
                <div className="flex-grow overflow-hidden p-4">
                    <textarea
                        id="subtitle-content"
                        className="resize-none w-full p-4 min-h-[70vh] search-scrollbar h-full bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 border border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter subtitle content..."
                        value={content}
                        disabled={loading || saving}
                        onChange={(e) => setContent(e.target.value)}
                    />
                </div>
                <div className="flex-shrink-0 border-t border-zinc-800 p-4 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="cursor-pointer px-4 py-2 bg-zinc-700 text-zinc-100 rounded-md hover:bg-zinc-600 transition-colors disabled:opacity-50"
                        disabled={loading || saving}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={saveSubtitleContent}
                        className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors disabled:opacity-50"
                        disabled={loading || saving || content === loadedContent}
                    >
                        {saving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
            {loading && <Loader/>}
        </div>
    );
}
