"use client";

import React, { useEffect, useState,useRef } from "react";

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  const btnref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 100);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (btnref) {
        setTimeout(() => {
            btnref.current?.blur();
        }, 500);
        }
  };

  return (
    <button
      ref={btnref}
      onClick={handleClick}
      aria-label="Scroll to top"
      className={
        `fixed bottom-6 right-6 z-50 transition-all duration-300 ease-out ` +
        (visible
          ? "translate-x-0 opacity-100"
          : "translate-x-6 opacity-0 pointer-events-none") +
        " bg-indigo-600 hover:bg-indigo-500 text-white rounded-full p-3 shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
      }
    >
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF">
        <path d="M440-240v-368L296-464l-56-56 240-240 240 240-56 56-144-144v368h-80Z"/>
      </svg>
    </button>
  );
}
