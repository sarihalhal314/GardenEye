import { useEffect, useState } from "react";

/**
 * Fetches an image URL with the ngrok-skip-browser-warning header, since a
 * plain <img src="..."> tag can't set custom headers and will otherwise hit
 * ngrok's free-tier interstitial page on first load (shows as a broken
 * image instead of the photo). Returns a local blob URL to use as <img src>.
 *
 * Usage:
 *   const photoSrc = useImageWithHeaders(reading.photoUrl);
 *   <img src={photoSrc ?? undefined} alt="Tree photo" />
 *
 * Returns null while loading or if the URL is falsy/fetch fails - render
 * your own placeholder/fallback in that case.
 */
export function useImageWithHeaders(url: string | null | undefined): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setBlobUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    async function load() {
      try {
        const response = await fetch(url as string, {
          headers: { "ngrok-skip-browser-warning": "true" },
        });
        if (!response.ok) {
          throw new Error(`Image fetch failed: ${response.status}`);
        }
        const blob = await response.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch {
        if (!cancelled) setBlobUrl(null);
      }
    }

    load();

    return () => {
      cancelled = true;
      // Release the blob URL when the component unmounts or the source
      // URL changes, so we don't leak memory across repeated tree views.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return blobUrl;
}
