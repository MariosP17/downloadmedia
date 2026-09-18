"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { isVideoExtension,cleanExtension } from "../../../Props";

type ExistingSubtitle = {
	name: string;
	size: string;
};

type SubtitleResult = {
	id?: string;
	type?: string;
	attributes?: {
		files?: { file_name?: string, file_id?: number }[];
		feature_details?: { movie_name?: string };
		download_count?: number;
	};
};

type SubsModalProps = {
	pathname: string;
	ttid: string;
	onClose: () => void;
	onChanged?: () => void;
    isEpisode?: boolean;
    options: Record<string, any>
};

const apiUrl = (path: string) => `http://${window.location.hostname}:7000${path}`;

export default function SubsModal({ pathname, ttid, onClose, onChanged, isEpisode =false,options }: SubsModalProps) {
	const [existingSubs, setExistingSubs] = useState<ExistingSubtitle[]>([]);
	const [results, setResults] = useState<SubtitleResult[]>([]);
	const [language, setLanguage] = useState("en");
	const [loadingExisting, setLoadingExisting] = useState(true);
	const [searching, setSearching] = useState(false);
	const [deleting, setDeleting] = useState<string | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [subtitleToDelete, setSubtitleToDelete] = useState<string | null>(null);
	const [subtitleInfo, setSubtitleInfo] = useState<any>({});

	const loadExistingSubs = async () => {
		setLoadingExisting(true);
		try {
			const response = await fetch(
				apiUrl(`/getItems?folder=${encodeURIComponent(isEpisode ? pathname.split("/").slice(0, -1).join("/") : pathname)}&onlySubs=true`)
			);
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || "Could not load subtitles");
			setExistingSubs(
				(data.items || []).filter((item: ExistingSubtitle) => /\.(srt|sub|vtt|ass)$/i.test(item.name)).filter((item: ExistingSubtitle) => isEpisode ? item.name.includes(pathname.split(".")[0]?.split("/").pop() || "") : true)
			);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not load subtitles");
		} finally {
			setLoadingExisting(false);
		}
	};

	useEffect(() => {
		void loadExistingSubs(); // eslint-disable-line react-hooks/set-state-in-effect
	}, [pathname]);

	async function fetchSubtitleInfo() {
		try {
			const response = await fetch(apiUrl(`/getOpenSubtitlesInfo`));
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || "Could not fetch subtitle info");
			setSubtitleInfo(data.data || {});
		}
		catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not fetch subtitle info");
		}
	}
	useEffect(() => {
		void fetchSubtitleInfo();
	}, []);
	const deleteSubtitle = async () => {
		if (!subtitleToDelete) return;
		try {
			const response = await fetch(apiUrl("/deleteFile"), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ filePath: isEpisode ? `${pathname.split("/").slice(0, -1).join("/")}/${subtitleToDelete}` : `${pathname}/${subtitleToDelete}` }),
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || "Could not delete subtitle");
			setExistingSubs((current) => current.filter((subtitle) => subtitle.name !== subtitleToDelete));
			onChanged?.();
			toast.success("Subtitle deleted");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not delete subtitle");
		} finally {
			setDeleting(null);
            setDeleteModalOpen(false);
            setSubtitleToDelete(null);
		}
	};

	const searchSubtitles = async () => {
		if (!ttid) {
			toast.error("No title ID is available for subtitle search");
			return;
		}

		setSearching(true);
		try {
			const response = await fetch(
				apiUrl(`/getSubtitles?ttid=${encodeURIComponent(ttid)}&language=${language}`)
			);
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || "Could not search subtitles");
			setResults((data.subtitles || []).filter((subtitle: SubtitleResult) => subtitle.type === "subtitle"));
		} catch (error) {
			setResults([]);
			toast.error(error instanceof Error ? error.message : "Could not search subtitles");
		} finally {
			setSearching(false);
		}
	};

    const downloadSubtitle = async (fileId: number | undefined) => {
        if (fileId === undefined) {
            toast.error("Undefined file ID");
            return;
        }
        let videoItem = null;
        if (!isEpisode){
            const items = await fetch(apiUrl(`/getItems?folder=${encodeURIComponent(pathname)}`)).then(res => res.json());
            console.log("Fetched items for subtitle search:", items);
            videoItem = (items.items ?? []).filter((item: any) => isVideoExtension(item.name))[0];
        }
        if (!videoItem && !isEpisode) {
            toast.error("No video file found for the subtitle");
            return;
        }

        const mediaName = isEpisode ? `${pathname.split("/").pop()}-${language}.srt` : `${cleanExtension(videoItem.name)}-${language}.srt`;
        const filePath = isEpisode ? `${pathname.split("/").slice(0, -1).join("/")}/${mediaName}` : `${pathname}/${mediaName}`;
        try {
            console.log("Downloading subtitle with fileId:", fileId, "to filePath:", filePath);
            const response = await fetch(apiUrl("/downloadSubtitle"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ file_id: fileId, filepath: filePath }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Could not download subtitle");
            setExistingSubs((prev) => [...prev, { name: data.name, size: data.size }]);
            onChanged?.();
			await fetchSubtitleInfo();
            toast.success("Subtitle downloaded successfully");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not download subtitle");
        }
    };

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
			<div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl" onClick={(event) => event.stopPropagation()}>
				<div className="flex items-center justify-between border-b border-zinc-800 p-5">
					<div>
						<h2 className="text-lg font-semibold text-white">Manage subtitles</h2>
						<p className="mt-1 break-all text-xs text-zinc-500">{isEpisode ? pathname.split("/").pop() : pathname}</p>
					</div>
					<button type="button" onClick={onClose} className="text-xl text-zinc-400 hover:text-white cursor-pointer" aria-label="Close subtitles">✕</button>
				</div>

				<div className="overflow-y-auto p-5 search-scrollbar">
					<section>
						<h3 className="mb-3 text-sm font-semibold text-zinc-300">Existing subtitles</h3>
						{loadingExisting ? (
							<p className="text-sm text-zinc-500">Loading subtitles...</p>
						) : existingSubs.length === 0 ? (
							<p className="text-sm text-zinc-500">No subtitle files found.</p>
						) : (
							<div className="space-y-2">
								{existingSubs.map((subtitle) => (
									<div key={subtitle.name} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
										<div className="min-w-0">
											<p className="break-all text-sm text-zinc-200">{subtitle.name}</p>
											<p className="text-xs text-zinc-500">{subtitle.size}</p>
										</div>
										<button type="button" onClick={() => { setSubtitleToDelete(subtitle.name); setDeleteModalOpen(true); }} disabled={deleting === subtitle.name} className="shrink-0 rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-950/40 disabled:opacity-50 cursor-pointer">
											{deleting === subtitle.name ? "Deleting..." : "Delete"}
										</button>
									</div>
								))}
							</div>
						)}
					</section>

					<section className="mt-6 border-t border-zinc-800 pt-5">
						<h3 className="mb-3 text-sm font-semibold text-zinc-300">Search OpenSubtitles</h3>
						<div className="flex flex-col gap-2 sm:flex-row justify-between">
							<div className="flex gap-2">
								<div className="relative inline-flex w-fit self-start">
								<select value={language} onChange={(event) => setLanguage(event.target.value)} className="appearance-none bg-zinc-900 border border-zinc-700 hover:border-zinc-600 text-zinc-200 text-xs font-medium rounded-md pl-3 pr-8 py-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-zinc-500 focus:border-zinc-500 transition-colors [color-scheme:dark]">
									{(
										typeof options["subtitle_languages"] === "string"
											? JSON.parse(options["subtitle_languages"])
											: options["subtitle_languages"] || []
										).map((item: Record<string, string>) => {
										const [code, label] = Object.entries(item)[0];
										return (
											<option key={code} value={code} className="bg-zinc-900 text-zinc-200 py-1">
											{label}
											</option>
										);
										})}
								</select>
									{/* Clean Custom SVG Arrow */}
									<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-zinc-400">
										<svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
										<path 
											fillRule="evenodd" 
											d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" 
											clipRule="evenodd" 
										/>
										</svg>
									</div>
								</div>
								<button type="button" onClick={() => void searchSubtitles()} disabled={searching || !ttid} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">
									{searching ? "Searching..." : "Search"}
								</button>
							</div>
							<span className="text-xs text-zinc-500 self-center">Remaining downloads: {subtitleInfo?.remaining_downloads ?? 0}</span>
						</div>

						{results.length > 0 && (
							<div className="mt-4 space-y-2">
								{results.sort((a,b) => (b.attributes?.download_count || 0) - (a.attributes?.download_count || 0)).map((result, index) => {
									const attributes = result.attributes;
									const file = attributes?.files?.[0];
									return (
                                        <div key={file?.file_id ?? file?.file_name ?? Math.random()} className="flex justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
                                            <div>
                                                <p className="break-words text-sm text-zinc-200">{file?.file_name || "Unknown file"} </p>
                                                <p className="mt-1 break-words text-xs text-zinc-500">{attributes?.feature_details?.movie_name || "Unknown title"}</p>
                                            </div>
										<div className="flex gap-2">
											<span className="self-center text-xs self-end text-orange-300">Downloads: {attributes?.download_count ?? 0}</span>
											<button type="button" onClick={() => void downloadSubtitle(file?.file_id)} className="shrink-0 rounded-md px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 cursor-pointer">
												<img src="download.png" alt="Download" className="inline-block w-4 h-4 mr-1" />Download
											</button>
										</div>
                                        </div>
									);
								})}
							</div>
						)}
					</section>
				</div>
                {deleteModalOpen && (
                    <div onClick={() => setDeleteModalOpen(false)} className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div onClick={(e) => e.stopPropagation()} className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-xl p-5 flex flex-col shadow-2xl">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
                        <label className="block text-sm font-bold text-zinc-400 tracking-wider">Confirm Deletion</label>
                        <button 
                            onClick={() => setDeleteModalOpen(false)}
                            className="text-zinc-400 hover:text-white font-bold cursor-pointer text-sm"
                        >
                            ✕
                        </button>
                        </div>
                        <div className="mb-4">
                        <span className="block text-sm font-bold text-zinc-400 tracking-wider mb-1">Are you sure you want to delete this subtitle?</span>
                        <span className={`block text-center text-sm font-bold bg-black text-red-400 tracking-wider p-1 mb-1 w-full ${subtitleToDelete?.split(" ").some((word: string) => word.length >= 20) ? "break-all" : "break-words"}`}>{subtitleToDelete}</span>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                        <button 
                            onClick={(e) => {
                            setDeleteModalOpen(false);
                            deleteSubtitle();
                            }} 
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer"
                        >
                            Delete
                        </button>
                        <button 
                            onClick={() => setDeleteModalOpen(false)} 
                            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        </div>
                    </div>
                    </div>
                )}
			</div>
		</div>
	);
}
