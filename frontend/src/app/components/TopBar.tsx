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
  <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
    
    {/* Logo Container - Shrinks slightly if needed, never disappears */}
    <div className="flex-shrink-0">
      <Link href="/" className="flex items-center">
        <img src="/stremio.png" alt="Stremio" className="h-8 w-8 object-contain" />
      </Link>
    </div>

    {/* Search Container - Grows to fill space but respects the logo */}
    <div className="flex-1 flex justify-center max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="relative w-full">
        <input
          id="search-input"
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setShowDropdown(v.trim().length >= 3);
          }}
          onFocus={() => setShowDropdown(query.trim().length >= 3)}
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

    {/* Invisible spacer to perfectly center the search bar on desktop */}
    <div className="hidden md:block w-8 flex-shrink-0" aria-hidden="true" />

  </div>
</header>
  );
}
