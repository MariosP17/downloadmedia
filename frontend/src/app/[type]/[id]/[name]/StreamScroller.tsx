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
    const [highlightedStream, setHighlightedStream] = useState<HTMLElement | null>(null);
    const [options, setOptions] = useState<any>(null);

    const apiUrl = (path: string) => `http://${window.location.hostname}:7000${path}`;
    
    useEffect(() => {
        async function fetchOptions() {
            try{
                const response = await fetch(apiUrl("/getOptions")).then(res => res.json());
                setOptions(response);
            } catch (error) {
                console.error("Failed to fetch options:", error);
            }
        }
        fetchOptions();
    }, []);

    useEffect(() => {
        if (highlightedStream) {
            highlightedStream.classList.add("border-white", "border-opacity-50");
            highlightedStream.classList.remove("border-transparent");
            highlightedStream.onmouseenter = () => {
                setHighlightedStream(null);
                highlightedStream.classList.remove("border-white", "border-opacity-50");
                highlightedStream.classList.add("border-transparent");
                highlightedStream.onmouseenter = null;

            };
            return () => {
                highlightedStream.classList.remove("border-white", "border-opacity-50");
                highlightedStream.classList.add("border-transparent");
            };
        }
    }, [highlightedStream]);

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
        const mediaQuery = window.matchMedia("(pointer: fine) and (hover: hover)");
        
        const update = () => setIsPhone(!mediaQuery.matches);
        update();

        mediaQuery.addEventListener("change", update);
        return () => mediaQuery.removeEventListener("change", update);
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

        const extra = options.sticky_media_info ? 20 : 15;
        // Convert rem value to pixels
        const spacingPx = (parseFloat(spacingProp) * rootFontSize +extra) * 4;

        const offset = options.sticky_media_info ? infoHeight + spacingPx : spacingPx;
        if (firstStream) {
            setHighlightedStream(null);
            setHighlightedStream(firstStream);
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