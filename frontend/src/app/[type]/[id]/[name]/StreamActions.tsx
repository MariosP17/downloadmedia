"use client";
import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";

type Props = {
  hash: string;
  filename?: string;
  title?: string;
  id: string;
};

type ServerDownloadState = "idle" | "loading" | "downloading" | "completed" | "failed";

export default function StreamActions({ hash, filename, title, id }: Props) {
  const [copiedServer, setCopiedServer] = useState(false);
  const [copiedDevice, setCopiedDevice] = useState(false);
  const [deviceLoading, setDeviceLoading] = useState(false);

  // Server download polling states
  const [serverState, setServerState] = useState<ServerDownloadState>("idle");
  const [serverProgress, setServerProgress] = useState<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const getlink = (target: "server" | "device") => {
    const domain = target === "device" ? window.location.hostname + ":11470/" : "127.0.0.1:11470/";
    return "http://" + domain + hash + "/" + id + "?external=1&download=1";
  };

  const copy = async (target: "server" | "device") => {
    const text = getlink(target);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // fallback for older mobile browsers
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      if (target === "server") setCopiedServer(true);
      else setCopiedDevice(true);
      setTimeout(() => {
        setCopiedServer(false);
        setCopiedDevice(false);
      }, 1500);
      toast.success("Link copied to clipboard!");
    } catch (e) {
      toast.error("Failed to copy link. Please try manually copying: " + text+ "\nError: " + (e as Error).message, {
        duration: 4000,
      });
    }
  };

  // Polls the Flask server progress route
  const checkServerProgress = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:7000/progress/${hash}/${id}`);
      if (!res.ok) throw new Error("Progress unavailable");

      const data = await res.json();

      if (data.status === "Downloading") {
        setServerState("downloading");
        setServerProgress(data.progress);
      } else if (data.status === "Completed") {
        setServerState("completed");
        setServerProgress(100);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    } catch (error) {
      console.error("Error polling progress:", error);
      setServerState("failed");
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  };

  // Triggers the POST request to start downloading on the server
  const handleServerDownload = async () => {
    if (serverState === "loading" || serverState === "downloading") return;

    setServerState("loading");
    setServerProgress(0);

    // 1. Initialize the AbortController
    const controller = new AbortController();
    
    // 2. Start a 5-second countdown timer to trigger the abort
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 5000);

    try {
      const response = await fetch(`http://${window.location.hostname}:7000/download`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: hash,
          idx: String(id),
        }),
        // 3. Attach the abort signal to this fetch request
        signal: controller.signal,
      });

      // 4. Clear the timer immediately since the server responded before 5 seconds
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error("Server rejected download request");

      toast.success("Download started on server!");
      // Begin polling every 1000ms (1 second)
      intervalRef.current = setInterval(checkServerProgress, 1000);
    } catch (error: any) {
      // 5. Always clear the timeout in the catch block too just in case, 
      // then check if the error was a deliberate timeout abort
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        console.error("Server download request timed out.");
        // 2. Toast notification for timeout
        toast.error("Server connection timed out. Is the backend running?", {
          duration: 4000,
        });
      } else {
        console.error("Server download failed to start:", error);
        // 3. Toast notification for other failures
        toast.error(`Failed to start download: ${error.message || "Unknown Error"}`);
      }
      
      setServerState("failed");
    }
  };

  // Memory cleanup safety net
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full">
        {/* Server Block */}
        <div className="flex-1 flex flex-col items-stretch">
          <div className="text-xs text-zinc-400 mb-2 text-center sm:text-left">Server</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => copy("server")}
              className="flex-1 px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600 hover:cursor-pointer text-sm text-center"
              title="Copy server download link"
            >
              {copiedServer ? "Copied" : "Copy Link"}
            </button>
            <button
              onClick={handleServerDownload}
              disabled={serverState === "loading" || serverState === "downloading" || serverState === "completed"}
              className={`flex-1 px-3 py-2 rounded text-sm text-white text-center transition-colors ${
                serverState === "completed"
                  ? "bg-blue-600 cursor-not-allowed"
                  : serverState === "downloading" || serverState === "loading"
                  ? "bg-zinc-800 cursor-wait"
                  : "bg-green-600 hover:bg-green-700 cursor-pointer"
              }`}
              title="Download on server"
            >
              {serverState === "idle" && "Download"}
              {serverState === "loading" && "Starting..."}
              {serverState === "downloading" && `Downloading (${serverProgress}%)`}
              {serverState === "completed" && "Finished ✓"}
              {serverState === "failed" && "Retry Download"}
            </button>
          </div>
        </div>

        {/* Vertical/Horizontal Spacer Line */}
        <div className="border-t border-zinc-800 sm:border-l sm:border-t-0 sm:h-12 my-2 sm:my-0" />

        {/* Your Device Block */}
        <div className="flex-1 flex flex-col items-stretch">
          <div className="text-xs text-zinc-400 mb-2 text-center sm:text-left">Your Device</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => copy("device")}
              className="flex-1 px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600 hover:cursor-pointer text-sm text-center"
              title="Copy device download link"
            >
              {copiedDevice ? "Copied" : "Copy Link"}
            </button>
            <button
              onClick={async () => {
                const url = getlink("device");
                setDeviceLoading(true);
                try {
                  const resp = await fetch(url, { method: "HEAD" });
                  window.location.href = url;
                } catch (e) {
                  window.location.href = url;
                } finally {
                  setDeviceLoading(false);
                }
              }}
              className={`flex-1 px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 hover:cursor-pointer text-sm text-white text-center ${
                deviceLoading ? "opacity-50 cursor-not-allowed" : ""
              }`}
              title="Download on your device"
              disabled={deviceLoading}
            >
              {deviceLoading ? "Starting..." : "Download"}
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar Display Container - Shows at the bottom if active */}
      {serverState === "downloading" && (
        <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden transition-all">
          <div
            className="bg-green-500 h-full transition-all duration-300 ease-out"
            style={{ width: `${serverProgress}%` }}
          />
        </div>
      )}
    </div>
  );
}