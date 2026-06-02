"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SearchDropdown from "./components/SearchDropdown";

export default function Home() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (query.length < 3) return;

    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="w-full max-w-2xl px-4 relative">
      </div>
    </main>
  );
}