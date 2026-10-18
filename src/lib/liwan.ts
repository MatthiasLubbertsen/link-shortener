// Optional Liwan (https://liwan.dev) analytics. When LIWAN_URL and
// LIWAN_ENTITY_ID are set, every redirect is also reported to Liwan as a
// "pageview" event for the short URL. The built-in click counts keep working
// either way.
const liwanConfig = {
  url: process.env.LIWAN_URL?.replace(/\/$/, ""),
  entityId: process.env.LIWAN_ENTITY_ID,
};

// Same parameters Liwan's own tracker keeps; everything else is dropped.
const KEPT_PARAMS = [
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term",
  "ref",
  "referrer",
  "source",
];

export const liwanEnabled = Boolean(liwanConfig.url && liwanConfig.entityId);

/**
 * Report a redirect to Liwan. Never throws and is not awaited by the caller,
 * so a slow or unreachable Liwan can't delay or break a redirect.
 */
export function trackRedirect(
  request: Request,
  link: { domain: string; key: string; url: string },
) {
  if (!liwanConfig.url || !liwanConfig.entityId) return;

  try {
    const requestUrl = new URL(request.url);
    const trackedUrl = new URL(requestUrl.pathname, requestUrl.origin);
    for (const [key, value] of requestUrl.searchParams) {
      if (KEPT_PARAMS.includes(key)) trackedUrl.searchParams.append(key, value);
    }

    // Liwan reads the visitor's IP and user agent from the request headers,
    // so pass the ones we received along.
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const userAgent = request.headers.get("user-agent");
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (userAgent) headers["User-Agent"] = userAgent;
    if (forwardedFor) headers["X-Forwarded-For"] = forwardedFor;

    let destination = "";
    try {
      destination = new URL(link.url).hostname;
    } catch {}

    fetch(`${liwanConfig.url}/api/event`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        name: "pageview",
        entity_id: liwanConfig.entityId,
        url: trackedUrl.toString(),
        referrer: request.headers.get("referer") || undefined,
        properties: { key: link.key.slice(0, 255), destination },
      }),
    })
      .then((res) => {
        if (!res.ok) console.error("Liwan event rejected:", res.status);
      })
      .catch((e) => console.error("Liwan event failed:", e));
  } catch (e) {
    console.error("Liwan event failed:", e);
  }
}
