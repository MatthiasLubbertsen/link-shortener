// Link operations shared by the REST API (/api/v1) and the MCP server (/mcp).
// Permissions mirror the dashboard: users manage their own links, admins
// manage everyone's.
import { and, count, eq, gte, like, or, sql } from "drizzle-orm";
import z from "zod";
import { editLinkSchema } from "#/actions/edit/schema";
import db from "#/db";
import { linkClicks, links } from "#/db/schema";
import { genLinkKey, getDynamicLinkData } from "#/lib/link";
import { oidcConfig } from "#/lib/oidc";
import { ApiError } from "./errors";

export type ApiUser = { id: string; isAdmin: boolean };
type LinkRow = typeof links.$inferSelect;

// ---- input schemas ----

const nullableUrl = z.httpUrl("Invalid URL").nullable();

export const createLinkInput = z.strictObject({
  url: z.httpUrl("Invalid URL"),
  domain: z.string().min(1).optional(),
  key: z.string().optional(),
  expirationDate: z.iso.datetime({ offset: true }).nullable().optional(),
  expirationUrl: nullableUrl.optional(),
  password: z.string().nullable().optional(),
  isCloaked: z.boolean().optional(),
});

export const updateLinkInput = createLinkInput.partial();

export const listLinksInput = z.object({
  domain: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const statsInput = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// ---- helpers ----

function shortUrl(domain: string, key: string) {
  // Reuse PUBLIC_URL's origin for the app's own host so ports and http are kept.
  const origin =
    oidcConfig.publicUrl && new URL(oidcConfig.publicUrl).hostname === domain
      ? new URL(oidcConfig.publicUrl).origin
      : `https://${domain}`;
  return `${origin}/${key}`;
}

export function serializeLink(link: LinkRow, clicks?: number) {
  return {
    id: link.id,
    domain: link.domain,
    key: link.key,
    shortUrl: shortUrl(link.domain, link.key),
    url: link.url,
    isDynamic: link.pattern !== null,
    expirationDate: link.expirationDate?.toISOString() ?? null,
    expirationUrl: link.expirationUrl,
    hasPassword: Boolean(link.password),
    isCloaked: link.isCloaked,
    archived: link.archived,
    ...(clicks === undefined ? {} : { clicks }),
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt?.toISOString() ?? null,
  };
}

function ownedBy(user: ApiUser) {
  return user.isAdmin ? undefined : eq(links.userId, user.id);
}

async function accessibleDomains(user: ApiUser) {
  return db.query.domains.findMany({
    columns: { domain: true, public: true, createdAt: true },
    where: {
      OR: user.isAdmin ? undefined : [{ userId: user.id }, { public: true }],
    },
  });
}

async function resolveDomain(user: ApiUser, requested: string | undefined) {
  const available = await accessibleDomains(user);
  if (requested) {
    if (!available.some((d) => d.domain === requested)) {
      throw new ApiError(
        400,
        "invalid_domain",
        `Domain ${requested} is not available to you`,
      );
    }
    return requested;
  }
  if (available.length === 1) return available[0].domain;
  throw new ApiError(
    400,
    "domain_required",
    available.length === 0
      ? "You have no domains. Sign in to the dashboard once to create the default domain."
      : `"domain" is required because you have multiple domains: ${available.map((d) => d.domain).join(", ")}`,
  );
}

/** Run a link through the same validation as the dashboard form. */
function validateLink(input: {
  domain: string;
  key: string;
  url: string;
  expirationDate: Date | null;
  expirationUrl: string | null;
  password: string | null;
  isCloaked: boolean;
}) {
  const parsed = editLinkSchema.safeParse({
    domain: input.domain,
    key: input.key,
    url: input.url,
    expiration: {
      date: input.expirationDate?.toISOString() ?? "",
      url: input.expirationUrl ?? "",
    },
    password: input.password ?? "",
    isCloaked: input.isCloaked,
  });
  if (!parsed.success) {
    throw new ApiError(
      422,
      "validation_error",
      parsed.error.issues[0]?.message ?? "Invalid link",
      z.treeifyError(parsed.error),
    );
  }

  const { data } = parsed;
  const { normalisedKey, pattern } = getDynamicLinkData(data.key);
  return {
    domain: data.domain,
    key: data.key,
    url: data.url,
    normalisedKey,
    pattern,
    expirationDate: data.expiration.date || null,
    expirationUrl: data.expiration.date ? data.expiration.url || null : null,
    password: data.password || null,
    isCloaked: data.isCloaked,
  };
}

async function findLink(user: ApiUser, id: string) {
  const link = await db.query.links.findFirst({
    where: { id, userId: user.isAdmin ? undefined : user.id },
  });
  if (!link) throw new ApiError(404, "not_found", "Link not found");
  return link;
}

function isUniqueError(e: unknown) {
  return String((e as Error)?.cause ?? e).includes("UNIQUE");
}

function utcDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Zero-filled daily buckets for the last `days` days (UTC), oldest first. */
function dailySeries(days: number, clickDates: Date[]) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    buckets.set(utcDay(new Date(today.getTime() - i * 86_400_000)), 0);
  }
  for (const date of clickDates) {
    const day = utcDay(date);
    if (buckets.has(day)) buckets.set(day, (buckets.get(day) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([date, clicks]) => ({ date, clicks }));
}

function since(days: number) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return new Date(start.getTime() - (days - 1) * 86_400_000);
}

// ---- operations ----

export async function listDomains(user: ApiUser) {
  const rows = await accessibleDomains(user);
  return {
    data: rows.map((d) => ({
      domain: d.domain,
      public: d.public,
      createdAt: d.createdAt.toISOString(),
    })),
  };
}

export async function listLinks(
  user: ApiUser,
  input: z.infer<typeof listLinksInput>,
) {
  const where = and(
    ownedBy(user),
    input.domain ? eq(links.domain, input.domain) : undefined,
    input.search
      ? or(
          like(links.key, `%${input.search.toLowerCase()}%`),
          like(links.url, `%${input.search}%`),
        )
      : undefined,
  );

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        link: links,
        clicks: db.$count(linkClicks, eq(linkClicks.linkId, links.id)),
      })
      .from(links)
      .where(where)
      .orderBy(sql`${links.createdAt} desc`, links.id)
      .limit(input.limit)
      .offset(input.offset),
    db.select({ total: count() }).from(links).where(where),
  ]);

  return {
    data: rows.map((r) => serializeLink(r.link, r.clicks)),
    total,
    limit: input.limit,
    offset: input.offset,
  };
}

export async function getLink(user: ApiUser, id: string) {
  const link = await findLink(user, id);
  const clicks = await db.$count(linkClicks, eq(linkClicks.linkId, id));
  return serializeLink(link, clicks);
}

export async function createLink(
  user: ApiUser,
  input: z.infer<typeof createLinkInput>,
) {
  const domain = await resolveDomain(user, input.domain);
  const valid = validateLink({
    domain,
    key: input.key || genLinkKey(),
    url: input.url,
    expirationDate: input.expirationDate
      ? new Date(input.expirationDate)
      : null,
    expirationUrl: input.expirationUrl ?? null,
    password: input.password ?? null,
    isCloaked: input.isCloaked ?? false,
  });

  try {
    const [row] = await db
      .insert(links)
      .values({ ...valid, userId: user.id })
      .returning();
    return serializeLink(row, 0);
  } catch (e) {
    if (isUniqueError(e)) {
      throw new ApiError(
        409,
        "key_taken",
        `${valid.domain}/${valid.key} already exists`,
      );
    }
    throw e;
  }
}

export async function updateLink(
  user: ApiUser,
  id: string,
  input: z.infer<typeof updateLinkInput>,
) {
  const current = await findLink(user, id);
  const domain = input.domain
    ? await resolveDomain(user, input.domain)
    : current.domain;

  const valid = validateLink({
    domain,
    key: input.key ?? current.key,
    url: input.url ?? current.url,
    expirationDate:
      input.expirationDate === undefined
        ? current.expirationDate
        : input.expirationDate
          ? new Date(input.expirationDate)
          : null,
    expirationUrl:
      input.expirationUrl === undefined
        ? current.expirationUrl
        : input.expirationUrl,
    password: input.password === undefined ? current.password : input.password,
    isCloaked: input.isCloaked ?? current.isCloaked,
  });

  try {
    const [row] = await db
      .update(links)
      .set(valid)
      .where(eq(links.id, id))
      .returning();
    const clicks = await db.$count(linkClicks, eq(linkClicks.linkId, id));
    return serializeLink(row, clicks);
  } catch (e) {
    if (isUniqueError(e)) {
      throw new ApiError(
        409,
        "key_taken",
        `${valid.domain}/${valid.key} already exists`,
      );
    }
    throw e;
  }
}

export async function deleteLink(user: ApiUser, id: string) {
  await findLink(user, id);
  await db.delete(links).where(eq(links.id, id));
}

export async function getLinkStats(
  user: ApiUser,
  id: string,
  input: z.infer<typeof statsInput>,
) {
  const link = await findLink(user, id);
  const [totalClicks, recent] = await Promise.all([
    db.$count(linkClicks, eq(linkClicks.linkId, id)),
    db
      .select({ createdAt: linkClicks.createdAt })
      .from(linkClicks)
      .where(
        and(
          eq(linkClicks.linkId, id),
          gte(linkClicks.createdAt, since(input.days)),
        ),
      ),
  ]);

  const daily = dailySeries(
    input.days,
    recent.map((c) => c.createdAt),
  );
  return {
    link: serializeLink(link, totalClicks),
    totalClicks,
    days: input.days,
    clicksInPeriod: recent.length,
    daily,
  };
}

export async function getAccountStats(
  user: ApiUser,
  input: z.infer<typeof statsInput>,
) {
  const owned = ownedBy(user);
  const [totalLinks, totalClicks, recent, perLink] = await Promise.all([
    db.$count(links, owned),
    db
      .select({ total: count() })
      .from(linkClicks)
      .innerJoin(links, eq(links.id, linkClicks.linkId))
      .where(owned)
      .then((r) => r[0].total),
    db
      .select({ createdAt: linkClicks.createdAt })
      .from(linkClicks)
      .innerJoin(links, eq(links.id, linkClicks.linkId))
      .where(and(owned, gte(linkClicks.createdAt, since(input.days)))),
    db
      .select({ link: links, clicks: count(linkClicks.id) })
      .from(links)
      .leftJoin(linkClicks, eq(linkClicks.linkId, links.id))
      .where(owned)
      .groupBy(links.id)
      .orderBy(sql`count(${linkClicks.id}) desc`, links.id)
      .limit(input.limit),
  ]);

  return {
    totalLinks,
    totalClicks,
    days: input.days,
    clicksInPeriod: recent.length,
    daily: dailySeries(
      input.days,
      recent.map((c) => c.createdAt),
    ),
    topLinks: perLink.map((r) => serializeLink(r.link, r.clicks)),
  };
}
