"use client";
import Options from "./Options";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { initiator } from "../../../Props";
import { Tooltip } from 'react-tooltip'
import  Loader  from "../loader";
import LogComponent from "./LogComponent";

type ArchiveJob = {
  job_id: string;
  status: string;
  progress: number;
  total_bytes: number;
  processed_bytes: number;
  folder_name: string;
  error?: string | null;
};

type ProgressEntry = {
  progress: number;
  ttid?: string;
};

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** unitIndex).toFixed(unitIndex ? 1 : 0)} ${units[unitIndex]}`;
};

const progressLabel = (progress: number) => progress === -2 ? "Failed" : progress === -1 ? "Cancelled" : progress >= 100 ? "Complete" : "Downloading";

export default function SettingsPage() {
  const [progressStore, setProgressStore] = useState<Record<string, ProgressEntry>>({});
  const [batchProgressStore, setBatchProgressStore] = useState<Record<string, ProgressEntry>>({});
  const [archiveJobs, setArchiveJobs] = useState<ArchiveJob[]>([]);
  const [subtitlesInfo, setSubtitlesInfo] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [isRefreshingLibraries, setIsRefreshingLibraries] = useState(false);
  const [isCleaningArchives, setIsCleaningArchives] = useState(false);
  const [clearingStore, setClearingStore] = useState<"progress" | "batch" | null>(null);
  const [refreshLibrariesLog, setRefreshLibrariesLog] = useState<{ lastRefreshed: string; lastRefreshedBy: string } | null>(null);

  const apiUrl = (path: string) => `http://${window.location.hostname}:7000${path}`;

  const fetchSubtitlesInfo = async () => {
            const res = await fetch(apiUrl("/getOpenSubtitlesInfo"));
            const data = (await res.json())?.data ?? {};
            setSubtitlesInfo(data);
  };

  const loadOperationalState = async () => {
    setIsLoading(true);
    setIsLoadingPage(true);
    try {
      const [progressResponse, batchProgressResponse, archiveJobsResponse] = await Promise.all([
        fetch(apiUrl("/getProgressStore")),
        fetch(apiUrl("/getBatchProgressStore")),
        fetch(apiUrl("/archiveJobs")),
      ]);

      if (!progressResponse.ok || !batchProgressResponse.ok || !archiveJobsResponse.ok) {
        throw new Error("Could not retrieve operational state");
      }

      const [progressData, batchProgressData, archiveJobsData] = await Promise.all([
        progressResponse.json(),
        batchProgressResponse.json(),
        archiveJobsResponse.json(),
      ]);

      setProgressStore(progressData);
      setBatchProgressStore(batchProgressData);
      setArchiveJobs(archiveJobsData);
    } catch (error) {
      console.error("Failed to load settings state:", error);
      toast.error("Failed to load operational state.");
    } finally {
      setIsLoading(false);
      setIsLoadingPage(false);
    }
  };

  useEffect(() => {
    void loadOperationalState();
    void loadRefreshLibrariesLog();
    void fetchSubtitlesInfo();
  }, []);

  const refreshLibraries = async () => {
    setIsRefreshingLibraries(true);
    setIsLoadingPage(true);
    try {
      const response = await fetch(apiUrl("/refreshLibraries"),{ 
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ initiator: "settings" })
      });
      if (!response.ok) throw new Error("Failed to refresh libraries");
      loadRefreshLibrariesLog();
      toast.success("Libraries refreshed.");
    } catch (error) {
      console.error("Failed to refresh libraries:", error);
      toast.error("Failed to refresh libraries.");
    } finally {
      setIsRefreshingLibraries(false);
      setIsLoadingPage(false);
    }
  };

  const loadRefreshLibrariesLog = async () => {
    try {
      const response = await fetch(apiUrl("/getRefreshLibrariesLog"));
      if (!response.ok) throw new Error("Failed to load refresh libraries log");
      const data = await response.json();
      setRefreshLibrariesLog(data);
    } catch (error) {
      console.error("Failed to load refresh libraries log:", error);
      toast.error("Failed to load refresh libraries log.");
    }
  };

  const cleanupArchiveJobs = async () => {
    setIsCleaningArchives(true);
    try {
      const response = await fetch(apiUrl("/cleanupArchiveJobs"), { method: "POST" });
      if (!response.ok) throw new Error("Failed to clean archive jobs");
      await loadOperationalState();
      toast.success("Expired archive jobs cleaned up.");
    } catch (error) {
      console.error("Failed to clean archive jobs:", error);
      toast.error("Failed to clean archive jobs.");
    } finally {
      setIsCleaningArchives(false);
    }
  };

  const clearStore = async (store: "progress" | "batch") => {
    setClearingStore(store);
    try {
      const endpoint = store === "progress" ? "/clearProgressStore" : "/clearBatchProgressStore";
      const response = await fetch(apiUrl(endpoint), { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to clear store");
      await loadOperationalState();
      toast.success(`Cleared ${data.cleared} ${store} entries.`);
    } catch (error) {
      console.error(`Failed to clear ${store} store:`, error);
      toast.error(error instanceof Error ? error.message : "Failed to clear store.");
    } finally {
      setClearingStore(null);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white sm:p-12">
      {isLoadingPage && <Loader />}
      {!isLoadingPage && !isLoading && 
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-5">
            <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
            <button
              type="button"
              onClick={() => { loadOperationalState(); loadRefreshLibrariesLog(); fetchSubtitlesInfo(); }}
              disabled={isLoading}
              className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? "Loading..." : "Refresh State"}
            </button>
          </div>
          <section className="mb-8">
            <h2 className="text-xl font-bold text-zinc-100">Options</h2>
            <Options />
          </section>

          <section className="mb-8 flex justify-between">
            <h2 className="text-xl font-bold text-zinc-100">Stores</h2>
            <div className="flex">
              <div className="mr-5 justify-end flex flex-col">
                <p className="mt-2 text-sm text-zinc-500 text-right">
                  Last refreshed: {refreshLibrariesLog?.lastRefreshed ? new Date(refreshLibrariesLog.lastRefreshed).toLocaleString("en-GB", {
                    timeZone: "Europe/Athens",
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true,
                  }).replace(",","").toUpperCase() : "N/A"}
                </p>
                <p className="mt-2 text-sm text-zinc-500 text-right">
                  Initiated by: {refreshLibrariesLog?.lastRefreshedBy ? initiator[refreshLibrariesLog.lastRefreshedBy] ?? "N/A" : "N/A"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void refreshLibraries()}
                disabled={isRefreshingLibraries}
                className="min-h-20 rounded-lg border border-blue-900/70 bg-blue-950/30 px-4 text-left text-sm font-medium text-blue-100 transition-colors hover:bg-blue-950/50 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {isRefreshingLibraries ? "Refreshing libraries..." : "Refresh Libraries"}
              </button>
            </div>
          </section>

          <section className="mb-8 space-y-5">
            <StorePanel title="Download Progress" entries={progressStore} emptyMessage="No download progress entries." isClearing={clearingStore === "progress"} hasActive={Object.values(progressStore).some(entry => 0 <= entry.progress && entry.progress < 100)} onClear={() => void clearStore("progress")} />
            <StorePanel title="Batch Progress" entries={batchProgressStore} emptyMessage="No batch progress entries." isClearing={clearingStore === "batch"} hasActive={Object.values(batchProgressStore).some(entry => 0 <= entry.progress && entry.progress < 100)} onClear={() => void clearStore("batch")} />
            <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/70">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3"><div className="flex items-center gap-2"><h2 className="text-sm font-semibold text-zinc-200">Archive Jobs</h2><span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{archiveJobs.length}</span></div><button type="button" data-tooltip-id="archive-tooltip" data-tooltip-place="right" data-tooltip-content={!archiveJobs.length ? "No entries to clear" : archiveJobs.some(job => 0 <= job.progress && job.progress < 100) ? "Can't clean up jobs with active progress" : ""} onClick={() => void cleanupArchiveJobs()} disabled={isCleaningArchives || !archiveJobs.length || archiveJobs.some(job => 0 <= job.progress && job.progress < 100)} className="h-8 rounded border border-amber-900/70 px-3 text-xs font-medium text-red-300 transition-colors enabled:hover:bg-amber-950/50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">{isCleaningArchives ? "Cleaning..." : "Clean Up Jobs"}</button>{(archiveJobs.some(job => 0 <= job.progress && job.progress < 100) || !archiveJobs.length) && <Tooltip id='archive-tooltip'/>}</div>
              {!archiveJobs.length ? <p className="px-4 py-6 text-sm text-zinc-500">No archive jobs.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b border-zinc-800 bg-zinc-950/50 text-xs uppercase text-zinc-500"><tr><th className="px-4 py-3 font-medium">Folder</th><th className="px-4 py-3 font-medium">Progress</th><th className="px-4 py-3 font-medium">Bytes</th><th className="px-4 py-3 font-medium">State</th><th className="px-4 py-3 font-medium">Error</th></tr></thead><tbody className="divide-y divide-zinc-800/80">{archiveJobs.map((job) => <tr key={job.job_id}><td className="max-w-48 truncate px-4 py-3 text-zinc-300" title={job.folder_name}>{job.folder_name || "Unnamed folder"}</td><td className="px-4 py-3 tabular-nums text-zinc-300">{job.progress.toFixed(0)}%</td><td className="px-4 py-3 text-xs text-zinc-400">{formatBytes(job.processed_bytes)} / {formatBytes(job.total_bytes)}</td><td className="px-4 py-3"><span className="rounded bg-zinc-800 px-2 py-1 text-xs font-medium capitalize text-zinc-300">{job.status}</span></td><td className="max-w-56 truncate px-4 py-3 text-xs text-red-300" title={job.error || undefined}>{job.error || "-"}</td></tr>)}</tbody></table></div>}
            </div>
          </section>
          <section>
            <h2 className="text-xl font-bold text-zinc-100">Logs</h2>
            {subtitlesInfo && <div className="text-sm text-zinc-400 text-right">Remaining subtitle downloads {subtitlesInfo?.remaining_downloads}</div>}
            <LogComponent/>
          </section>
        </div>
      }
    </main>
  );
}

function StorePanel({ title, entries, emptyMessage, isClearing, hasActive, onClear }: { title: string; entries: Record<string, ProgressEntry>; emptyMessage: string; isClearing: boolean; hasActive: boolean; onClear: () => void }) {
  const rows = Object.entries(entries);
  return <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/70"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3"><div className="flex items-center gap-2"><h2 className="text-sm font-semibold text-zinc-200">{title}</h2><span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{rows.length}</span></div><button type="button" data-tooltip-id="my-tooltip" data-tooltip-place="right" data-tooltip-content={hasActive ? "Can't clear store because there are active downloads" : !rows.length ? "No entries to clear" : ""} onClick={onClear} disabled={isClearing || !rows.length || hasActive} className="h-8 rounded border border-red-900/70 px-3 text-xs font-medium text-red-300 transition-colors enabled:hover:bg-red-950/50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">{isClearing ? "Clearing..." : "Clear Store"}</button>{(hasActive || !rows.length) && <Tooltip id="my-tooltip" />}</div>{!rows.length ? <p className="px-4 py-6 text-sm text-zinc-500">{emptyMessage}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="border-b border-zinc-800 bg-zinc-950/50 text-xs uppercase text-zinc-500"><tr><th className="px-4 py-3 font-medium">Task</th><th className="px-4 py-3 font-medium">Media ID</th><th className="px-4 py-3 font-medium">Progress</th><th className="px-4 py-3 font-medium">State</th></tr></thead><tbody className="divide-y divide-zinc-800/80">{rows.map(([taskId, entry]) => <tr key={taskId}><td className="max-w-64 truncate px-4 py-3 font-mono text-xs text-zinc-400" title={taskId}>{taskId}</td><td className="px-4 py-3 font-mono text-xs text-zinc-400">{entry.ttid || "-"}</td><td className="px-4 py-3 tabular-nums text-zinc-300">{entry.progress >= 0 ? `${entry.progress.toFixed(0)}%` : "-"}</td><td className="px-4 py-3"><span className="rounded bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-300">{progressLabel(entry.progress)}</span></td></tr>)}</tbody></table></div>}</div>;
}