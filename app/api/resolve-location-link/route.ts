import { NextRequest, NextResponse } from "next/server";

// POST /api/resolve-location-link
// Body: { url: string }
//
// Public, consumer-facing endpoint (same trust level as compare-advisor
// and ai-advisor below) -- used by LocationPicker's "Paste a shared
// location" box when a broker has a Google/Apple Maps link (often from
// WhatsApp) for a property they haven't physically visited yet, and the
// link itself doesn't carry coordinates: Google and Apple's SHORTENED
// share links (maps.app.goo.gl, goo.gl/maps, g.co, maps.apple.com/p/...)
// only reveal them after an HTTP redirect, which the browser's own fetch
// can't follow cross-origin -- a server-side fetch can.
//
// SECURITY: this is a server making a request to a URL the caller
// supplies, which is exactly the shape of an SSRF vulnerability if left
// unrestricted (fetching internal/cloud-metadata addresses, port
// scanning, etc). Mitigated by only ever fetching a hostname from a fixed
// allowlist of real map-link domains -- nothing else is accepted, with no
// way for a redirect chain to escape it either since every hop's final
// hostname is checked again below.
const ALLOWED_HOSTNAMES = new Set([
  "google.com",
  "www.google.com",
  "maps.google.com",
  "goo.gl",
  "maps.app.goo.gl",
  "g.co",
  "maps.apple.com",
]);

const FETCH_TIMEOUT_MS = 8000;
const MAX_BODY_CHARS = 500_000;

function isAllowedUrl(value: string): URL | null {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!ALLOWED_HOSTNAMES.has(url.hostname)) return null;

  return url;
}

function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

// Same shapes LocationPicker already tries client-side for a full link --
// repeated here because the URL being matched now is the one AFTER the
// redirect, which the client never sees.
function extractCoordsFromUrl(url: string): { lat: number; lng: number } | null {
  const patterns = [
    /[@,]\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/,
    /[?&]q=(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/,
    /[?&]ll=(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/,
    /[?&]daddr=(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const lat = Number(match[1]);
      const lng = Number(match[2]);
      if (isValidCoordinate(lat, lng)) return { lat, lng };
    }
  }

  return null;
}

// Fallback for a resolved page that doesn't put coordinates in its own
// URL (some place-card shares don't) -- Google's HTML typically still
// embeds them somewhere (a static-map preview image, embedded JSON, a
// meta tag). Looks for the first "lat,lng"-shaped pair and sanity-checks
// it's a real coordinate before trusting it.
function extractCoordsFromHtml(html: string): { lat: number; lng: number } | null {
  const matches = html.matchAll(/(-?\d{1,2}\.\d{4,}),(-?\d{1,3}\.\d{4,})/g);

  for (const match of matches) {
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (isValidCoordinate(lat, lng)) return { lat, lng };
  }

  return null;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";

  if (!rawUrl) {
    return NextResponse.json({ error: "No link provided." }, { status: 400 });
  }

  const url = isAllowedUrl(rawUrl);

  if (!url) {
    return NextResponse.json(
      {
        error:
          "That doesn't look like a Google Maps or Apple Maps link. Paste the link as shared, or use coordinates instead.",
      },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // A generic desktop browser UA -- some map services serve a
        // reduced/JS-only page to unrecognised clients.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });

    // The final hostname after following every redirect must ALSO be on
    // the allowlist -- otherwise a malicious redirect target could point
    // this server's fetch anywhere.
    const finalUrl = isAllowedUrl(res.url);

    if (!finalUrl) {
      return NextResponse.json(
        { error: "That link didn't resolve to a Google or Apple Maps page." },
        { status: 400 }
      );
    }

    const fromUrl = extractCoordsFromUrl(res.url);
    if (fromUrl) {
      return NextResponse.json(fromUrl);
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      const text = (await res.text()).slice(0, MAX_BODY_CHARS);
      const fromHtml = extractCoordsFromHtml(text);
      if (fromHtml) {
        return NextResponse.json(fromHtml);
      }
    }

    return NextResponse.json(
      {
        error:
          "Couldn't find exact coordinates in that link. Open it, make sure it shows a specific pin (not just an area or your current location), and try pasting the address-bar URL -- or search for the address / drop a pin manually instead.",
      },
      { status: 422 }
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json(
        { error: "That link took too long to load. Please try again." },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "Couldn't open that link. Please check it and try again." },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
