import { createFileRoute } from "@tanstack/react-router";
import { api, json, query } from "#/lib/api/http";
import { getAccountStats, statsInput } from "#/lib/api/service";

export const Route = createFileRoute("/api/v1/stats")({
  server: {
    handlers: {
      GET: api(async ({ user, request }) =>
        json(await getAccountStats(user, query(request, statsInput))),
      ),
    },
  },
});
