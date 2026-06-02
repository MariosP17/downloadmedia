"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SearchDropdown from "./SearchDropdown";

export default function TopBar() {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.length < 1) return;
    setShowDropdown(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <header className="w-full bg-zinc-900 border-b border-zinc-800">
      <div className="max-w-6xl mx-auto px-4 py-3 relative">
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
          <Link href="/" className="flex items-center gap-3">
            <img src="/stremio.png" alt="Stremio" className="h-8 w-8 object-contain" />
          </Link>
        </div>

        <div className="flex items-center justify-center">
          <form onSubmit={handleSubmit} className="relative w-full max-w-2xl">
            <input
              id="search-input"
              value={query}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                setShowDropdown(v.length >= 3);
              }}
              onFocus={() => setShowDropdown(query.length >= 3)}
              placeholder="Search movies or series..."
              className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2 text-white text-sm outline-none"
            />

            {showDropdown && (
              <SearchDropdown
                query={query}
                onClose={() => setShowDropdown(false)}
              />
            )}
          </form>
        </div>
      </div>
    </header>
  );
}
