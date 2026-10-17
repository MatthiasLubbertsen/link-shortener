import { createFileRoute } from "@tanstack/react-router";
import { api, json, query, readJson } from "#/lib/api/http";
import {
  createLink,
  createLinkInput,
  listLinks,
  listLinksInput,
} from "#/lib/api/service";

export const Route = createFileRoute("/api/v1/links/")({
  server: {
    handlers: {
      GET: api(async ({ user, request }) =>
        json(await listLinks(user, query(request, listLinksInput))),
      ),
      POST: api(async ({ user, request }) =>
        json(
          await createLink(user, await readJson(request, createLinkInput)),
          201,
        ),
      ),
    },
  },
});
