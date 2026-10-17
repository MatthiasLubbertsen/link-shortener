import { createFileRoute } from "@tanstack/react-router";
import { api, json, query } from "#/lib/api/http";
import { getLinkStats, statsInput } from "#/lib/api/service";

export const Route = createFileRoute("/api/v1/links/$id/stats")({
  server: {
    handlers: {
      GET: api<{ id: string }>(async ({ user, request, params }) =>
        json(await getLinkStats(user, params.id, query(request, statsInput))),
      ),
    },
  },
});
