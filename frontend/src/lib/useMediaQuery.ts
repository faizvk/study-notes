import { useEffect, useState } from "react";

/** Subscribe to a CSS media query; re-renders when it flips. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** True below Tailwind's `lg` breakpoint (1024px) — our "mobile/tablet" cutoff. */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 1023px)");
}
