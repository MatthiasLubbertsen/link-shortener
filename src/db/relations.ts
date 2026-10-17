import { defineRelations } from "drizzle-orm";
import { apiKeys, domains, linkClicks, links, sessions, users } from "./schema";

export const relations = defineRelations(
  {
    links,
    linkClicks,
    users,
    sessions,
    domains,
    apiKeys,
  },
  (r) => ({
    links: {
      linkClicks: r.many.linkClicks(),
    },
    linkClicks: {
      link: r.one.links({
        from: r.linkClicks.linkId,
        to: r.links.id,
      }),
    },

    apiKeys: {
      user: r.one.users({
        from: r.apiKeys.userId,
        to: r.users.id,
        optional: false,
      }),
    },

    sessions: {
      user: r.one.users({
        from: r.sessions.userId,
        to: r.users.id,
        optional: false,
      }),
    },
  }),
);
