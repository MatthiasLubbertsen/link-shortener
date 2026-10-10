import { createServerFn } from "@tanstack/react-start";
import dayjs from "dayjs";
import { inArray } from "drizzle-orm";
import db from "#/db";
import { linkClicks } from "#/db/schema";
import { requireAuth } from "../auth/middleware";

const DAYS = 30;

export const getAnalytics = createServerFn()
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const links = await db.query.links.findMany({
      columns: { id: true, domain: true, key: true, url: true },
      where: {
        userId: context.user.isAdmin ? undefined : context.user.id,
      },
    });

    const since = dayjs().startOf("day").subtract(DAYS - 1, "day");
    const linkIds = links.map((l) => l.id);

    const clicks =
      linkIds.length === 0
        ? []
        : await db
            .select({
              linkId: linkClicks.linkId,
              createdAt: linkClicks.createdAt,
            })
            .from(linkClicks)
            .where(inArray(linkClicks.linkId, linkIds));

    // Bucket every click by link (all time) and by day (last 30 days).
    const perLink = new Map<string, number>();
    const perDay = new Map<string, number>();
    for (let i = 0; i < DAYS; i++) {
      perDay.set(since.add(i, "day").format("YYYY-MM-DD"), 0);
    }

    let total = 0;
    for (const click of clicks) {
      total++;
      perLink.set(click.linkId, (perLink.get(click.linkId) ?? 0) + 1);

      const day = dayjs(click.createdAt);
      if (!day.isBefore(since)) {
        const key = day.format("YYYY-MM-DD");
        if (perDay.has(key)) perDay.set(key, (perDay.get(key) ?? 0) + 1);
      }
    }

    const topLinks = links
      .map((link) => ({
        id: link.id,
        label: `${link.domain}/${link.key}`,
        url: link.url,
        clicks: perLink.get(link.id) ?? 0,
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);

    return {
      totalClicks: total,
      totalLinks: links.length,
      clicksLast30Days: [...perDay.values()].reduce((a, b) => a + b, 0),
      daily: [...perDay.entries()].map(([date, clicks]) => ({ date, clicks })),
      topLinks,
    };
  });
