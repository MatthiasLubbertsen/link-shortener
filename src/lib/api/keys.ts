import { createHash, randomBytes } from "node:crypto";
import db from "#/db";
import { apiKeys } from "#/db/schema";
import { eq } from "drizzle-orm";

const KEY_PREFIX = "lnk_";

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

/** Generate a new key. The plaintext is only ever shown to the user once. */
export function generateApiKey() {
  const key = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { key, prefix: key.slice(0, 12), hash: hashApiKey(key) };
}

/** Look up the user a key belongs to, or null if the key is unknown. */
export async function getUserForApiKey(key: string) {
  if (!key.startsWith(KEY_PREFIX)) return null;

  const row = await db.query.apiKeys.findFirst({
    where: { hash: hashApiKey(key) },
    with: { user: true },
  });
  if (!row?.user) return null;

  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id));
  return row.user;
}
