// Video-embeds voor evenementen zonder eigen opslag: we bewaren alleen de
// publieke link (YouTube/Vimeo) en zetten die om naar een privacy-vriendelijke
// embed-URL voor een <iframe>. Onbekende/ongeldige links → null (geen embed).

export interface EventVideo {
  embedUrl: string;
  provider: "youtube" | "vimeo";
}

/** Haal de 11-teken YouTube-video-id uit de gangbare URL-vormen. */
function youTubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return /^[\w-]{11}$/.test(id) ? id : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v") ?? "";
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    const m = url.pathname.match(/^\/(?:embed|shorts|v|live)\/([\w-]{11})/);
    if (m) return m[1];
  }
  return null;
}

/** Haal de numerieke Vimeo-video-id uit een vimeo.com-link. */
function vimeoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
  const m = url.pathname.match(/\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

/** Zet een ruwe video-link om naar een embed-URL, of null als niet ondersteund. */
export function parseEventVideo(raw: string | null | undefined): EventVideo | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const yt = youTubeId(url);
  if (yt) {
    return { provider: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${yt}` };
  }
  const vimeo = vimeoId(url);
  if (vimeo) {
    return { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${vimeo}` };
  }
  return null;
}

/** Lichte client-side check voor de wizard: is dit een herkenbare video-link? */
export function isSupportedVideoUrl(raw: string): boolean {
  return parseEventVideo(raw) !== null;
}
