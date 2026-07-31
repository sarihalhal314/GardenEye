import { useEffect, useState } from "react";

/**
 * <img src="..."> can't carry custom headers, but our backend is behind
 * ngrok's free tier, which shows an HTML "you're about to visit..."
 * warning page instead of the real image unless the request includes
 * ngrok-skip-browser-warning. Our normal fetch() calls already send that
 * header (see api-client.tsx), but a plain <img> tag can't - so this
 * hook fetches the image manually with the header, then hands the
 * browser a local blob URL to actually display.
 *
 * Usage: const displayUrl = useImageWithHeaders(resolvePhotoUrl(photoUrl));
 *        <img src={displayUrl} ... />
 */
export function useImageWithHeaders(url: string | undefined): string | undefined {
  const [blobUrl, setBlobUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!url) {
      setBlobUrl(undefined);
      return;
    }

    let currentBlobUrl: string | undefined;
    let cancelled = false;

    fetch(url, { headers: { "ngrok-skip-browser-warning": "true" } })
      .then((res) => {
        if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        currentBlobUrl = URL.createObjectURL(blob);
        setBlobUrl(currentBlobUrl);
      })
      .catch(() => {
        if (!cancelled) setBlobUrl(undefined);
      });

    return () => {
      cancelled = true;
      if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
    };
  }, [url]);

  return blobUrl;
}
