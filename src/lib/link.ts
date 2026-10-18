import { customAlphabet } from "nanoid";

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
