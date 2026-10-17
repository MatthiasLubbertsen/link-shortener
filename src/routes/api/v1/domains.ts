import { createFileRoute } from "@tanstack/react-router";
import { api, json } from "#/lib/api/http";
import { listDomains } from "#/lib/api/service";

export const Route = createFileRoute("/api/v1/domains")({
  server: {
    handlers: {
      GET: api(async ({ user }) => json(await listDomains(user))),
    },
  },
});
