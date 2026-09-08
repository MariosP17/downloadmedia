"use client";
import { useEffect, useRef, useState } from "react";


type Props = {
    streamsnames: string[];
    counts: Record<string, number>;
};

export default function StreamScroller({ streamsnames, counts }: Props) {
    const [expanded, setExpanded] = useState(false);
    const scrollerRef = useRef<HTMLElement>(null);
    const [isPhone, setIsPhone] = useState(false);

    useEffect(() => {
        const handleOutsideClick = (event: PointerEvent) => {
            if (
                expanded &&
                scrollerRef.current &&
                !scrollerRef.current.contains(event.target as Node)
            ) {
                setExpanded(false);
            }
        };

        document.addEventListener("pointerdown", handleOutsideClick);
        return () => document.removeEventListener("pointerdown", handleOutsideClick);
    }, [expanded]);

    useEffect(() => {
    // Only runs in the browser, after mount
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    
    // Set initial value
    setIsPhone(mediaQuery.matches);

    // Listen for resize changes
    const handler = (e: MediaQueryListEvent) => setIsPhone(e.matches);
    mediaQuery.addEventListener("change", handler);

    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

    function isPhoneScreen() {
        return isPhone;
    }

    const scrollToFirstStream = (name: string) => {
        const firstStream = Array.from(
            document.querySelectorAll<HTMLElement>("[data-stream-name]")
        ).find((element) => element.dataset.streamName === name);

        const infoElement = document.querySelector<HTMLElement>("#info");
        const infoHeight = infoElement?.offsetHeight ?? 0;

        // Read the CSS variable (e.g., "0.25rem" or ".25rem")
        const spacingProp = getComputedStyle(document.documentElement)
        .getPropertyValue("--spacing")
        .trim() || "0.25rem";

        // Get root font size in pixels (defaults to 16px in browsers)
        const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

        // Convert rem value to pixels
        const spacingPx = parseFloat(spacingProp) * rootFontSize * 4;

        const offset = infoHeight + spacingPx;
        if (firstStream) {
            const elementPosition = firstStream.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.scrollY - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: "smooth"
            });
        }
    };

    return (
        <nav
            ref={scrollerRef}
            onMouseEnter={() => {setTimeout(() => {},700); setExpanded(true); }}
            onMouseLeave={() => { setExpanded(false); }}
            onClick={() => { if (isPhoneScreen()) {
                setExpanded(!expanded); 
                }}}
            aria-label="Stream types"
            className={` relative flex ${expanded ? "w-30" : "w-7"} flex-col rounded-lg ${expanded ? "max-h-[80vh]" : "max-h-20"} bg-zinc-900 border border-white border-opacity-10 cursor-pointer shadow-md overflow-hidden transition-[max-height,width] duration-[600ms] ease-in-out`}
        >
            <div id="stream-scroller" className={`overflow-x-hidden ${expanded ? "overflow-y-auto" : "overflow-y-hidden"} search-scrollbar transition-opacity duration-[600ms] ${expanded ? "opacity-100" : "pointer-events-none opacity-0"}`}>
                {streamsnames.map((name) => (
                    <button
                        key={name}
                        type="button"
                        onClick={() => { scrollToFirstStream(name); }}
                        className="cursor-pointer sm:w-30 w-20 flex-shrink-0 rounded-lg p-3 text-left text-sm text-gray-900 text-white transition-all hover:bg-zinc-800 hover:text-white hover:text-sm"
                    >
                        {name} <br></br> <span className="text-zinc-400"> {counts[name] > 1 ? `${counts[name]} streams` : `${counts[name]} stream`} </span>
                    </button>
                ))}
            </div>
            <div className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-[600ms] ${expanded ? "pointer-events-none opacity-0" : "opacity-100"}`}>
                {" "} <img src="/expand.svg" height="25px" width="25px" alt="scroller" /> {" "}
            </div>
        </nav>
    );
}