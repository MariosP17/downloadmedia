"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [render, setRender] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setRender(true);
      // Trigger enter transition on the next macro-task tick
      const id = setTimeout(() => setVisible(true), 200);
      return () => clearTimeout(id);
    } else {
      // 1. Start the exit transition immediately
      setVisible(false);
      
      // 2. Wait for the CSS duration (200ms) before unmounting from DOM
      const id = setTimeout(() => setRender(false), 200);
      return () => clearTimeout(id);
    }
  }, [open]);

  // Use the render state instead of the open prop to control structural mount
  if (!render) return null;

  return (
    <>
      {/* Backdrop Backdrop overlay */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-200 ease-in-out ${
          visible ? "bg-black/50" : "bg-black/0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden
      />

      {/* Sidebar Navigation Panel */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-zinc-900 border-r border-zinc-800 z-50 p-4 transform transition-transform duration-200 ease-in-out ${
          visible ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-lg">Menu</h2>
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="text-zinc-200 hover:text-white hover:cursor-pointer"
          >
            ✕
          </button>
        </div>

        <nav className="mt-6">
  <ul className="space-y-1">
    {/* Home Option */}
    <li>
      <Link
        href="/"
        onClick={onClose}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 text-zinc-200 hover:text-white transition-colors group"
      >
        <img
          src="/home.png"
          alt="Home"
          className="h-7 w-7 object-contain opacity-80 group-hover:opacity-100 transition-opacity"
        />
        <span className="text-sm font-medium">Home</span>
      </Link>
    </li>

    {/* Media Option */}
    <li>
      <Link
        href="/media"
        onClick={onClose}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 text-zinc-200 hover:text-white transition-colors group"
      >
        <img
          src="/media.png"
          alt="Media"
          className="h-7 w-7 object-contain opacity-80 group-hover:opacity-100 transition-opacity"
        />
        <span className="text-sm font-medium">Media</span>
      </Link>
    </li>
    {/* Batch Download Option */}
    <li>
      <Link
        href="/batch-download"
        onClick={onClose}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 text-zinc-200 hover:text-white transition-colors group"
      >
        <img
          src="/downloads.png"
          alt="Batch Download"
          className="h-7 w-7 object-contain opacity-80 group-hover:opacity-100 transition-opacity"
        />
        <span className="text-sm font-medium">Batch Download</span>
      </Link>
    </li>
    {/* Downloads Option */}
    <li>
      <Link
        href="/downloads"
        onClick={onClose}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 text-zinc-200 hover:text-white transition-colors group"
      >
        <img
          src="/downloading.png"
          alt="Downloads"
          className="h-7 w-7 object-contain opacity-80 group-hover:opacity-100 transition-opacity"
        />
        <span className="text-sm font-medium">Downloads</span>
      </Link>
    </li>
  </ul>
</nav>
      </aside>
    </>
  );
}