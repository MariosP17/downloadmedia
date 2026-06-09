"use client";
import FallbackImage from "../components/fallbackimg";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";

export default function DownloadsPage() {

    return (
        <main className="p-8 bg-zinc-950 min-h-screen text-white">
            <h1 className="text-2xl font-bold mb-4">Downloads</h1>
            <p className="text-zinc-400">Your active and completed downloads will appear here.</p>
        </main>
    );
}

