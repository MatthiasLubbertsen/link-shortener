import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import z from "zod";
import db from "#/db";
import { apiKeys } from "#/db/schema";
import { generateApiKey } from "#/lib/api/keys";
import { requireAuth } from "../auth/middleware";

export const getApiKeys = createServerFn()
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    return db.query.apiKeys.findMany({
      columns: {
        id: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        createdAt: true,
      },
      where: { userId: context.user.id },
      orderBy: { createdAt: "desc" },
    });
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    z.object({ name: z.string().trim().min(1, "Required").max(64) }),
  )
  .handler(async ({ context, data }) => {
    const { key, prefix, hash } = generateApiKey();
    await db
      .insert(apiKeys)
      .values({ userId: context.user.id, name: data.name, prefix, hash });
    // The only time the full key is ever returned.
    return { key };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, data.id), eq(apiKeys.userId, context.user.id)));
  });
