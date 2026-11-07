import { customAlphabet } from "nanoid";
import z from "zod";

export const genLinkKey = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  8,
);

export function getDynamicLinkData(key: string) {
  if (!key.includes(":")) {
    return {
      normalisedKey: key,
      pattern: null,
    };
  }

  const parts = key.split("/").filter(Boolean);
  const normalisedParts = parts.map((part) => {
    if (part.startsWith(":")) {
      // rename the parameter to a generic name
      if (part.endsWith("*")) {
        return ":param*";
      }
      return ":param";
    }
    return part;
  });

  const pattern = normalisedParts
    .map((part) => {
      if (part.startsWith(":")) {
        if (part.endsWith("*")) {
          return "(.*)";
        }
        return "([^/]+)";
      }
      return part;
    })
    .join("/");

  return {
    normalisedKey: normalisedParts.join("/"),
    pattern,
  };
}

// Top-level paths used by the app itself; a link can't start with these.
const RESERVED_PREFIXES = ["app", "api", "mcp"];

export function isReservedKey(key: string) {
  const first = key.split("/")[0];
  return key.startsWith("app") || RESERVED_PREFIXES.includes(first);
}

// ---- params in destination URLs ----

// Matches `https://` + authority + the rest (path, query, hash).
const URL_PARTS_RE = /^(https?:\/\/)([^/?#]*)([\s\S]*)$/;
// A param in a hostname must be a whole label (e.g. https://:sub.example.com),
// so a port like `host:8080` is never mistaken for one.
const HOST_PARAM_RE = /(^|\.):([A-Za-z0-9_-]+)/g;
// What a param may expand to inside a hostname: a single DNS label. Anything
// else (dots, @, #, ?, ...) could change where the redirect actually goes.
const HOST_LABEL_RE = /^[A-Za-z0-9-]+$/;

/** Names of the params used in a URL's hostname and path (without the colon). */
export function getUrlParamNames(url: string) {
  const match = url.match(URL_PARTS_RE);
  const host = match ? match[2] : "";
  const rest = match ? match[3] : url;

  const names = [...host.matchAll(HOST_PARAM_RE)].map((m) => m[2]);
  for (const part of rest.split("/")) {
    if (part.startsWith(":")) names.push(part.slice(1));
  }
  return names;
}

/**
 * Like z.httpUrl(), but allows params (`:name`) as whole labels of the
 * hostname, e.g. https://:subd.example.com/path.
 */
export function dynamicHttpUrl(message = "Invalid URL") {
  return z
    .string()
    .refine(
      (url) =>
        z
          .httpUrl()
          .safeParse(
            url.replace(
              URL_PARTS_RE,
              (_, scheme, host, rest) =>
                `${scheme}${host.replace(HOST_PARAM_RE, "$1param")}${rest}`,
            ),
          ).success,
      message,
    );
}

/**
 * Fills params into a destination URL, in both the hostname and the path.
 * Returns null if a hostname param has no (valid) value.
 *
 * https://:sub.example.com/users/:id + { sub: "a", id: "1" }
 *   -> https://a.example.com/users/1
 */
export function substituteUrlParams(
  url: string,
  params: Record<string, string>,
) {
  const match = url.match(URL_PARTS_RE);
  if (!match) return url;
  const [, scheme, host, rest] = match;

  let hostValid = true;
  const newHost = host.replace(HOST_PARAM_RE, (whole, dot, name) => {
    const value = params[name];
    if (!value || !HOST_LABEL_RE.test(value)) {
      hostValid = false;
      return whole;
    }
    return `${dot}${value}`;
  });
  if (!hostValid) return null;

  const newRest = rest
    .split("/")
    .map((part) => {
      if (part.startsWith(":")) {
        return params[part.slice(1)] || part;
      }
      return part;
    })
    .join("/");

  return `${scheme}${newHost}${newRest}`;
}
