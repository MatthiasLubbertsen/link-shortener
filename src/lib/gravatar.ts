import { createHash } from "node:crypto";

// Gravatar accepts a SHA-256 hash of the trimmed, lowercased email.
// d=identicon generates a unique pattern for emails without a Gravatar.
export function gravatarUrl(email: string, size = 64) {
  const hash = createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex");
  return `https://gravatar.com/avatar/${hash}?s=${size}&d=identicon`;
}
