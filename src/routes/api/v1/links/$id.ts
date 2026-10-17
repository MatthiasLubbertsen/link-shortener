import { createFileRoute } from "@tanstack/react-router";
import { api, json, readJson } from "#/lib/api/http";
import {
  deleteLink,
  getLink,
  updateLink,
  updateLinkInput,
} from "#/lib/api/service";

export const Route = createFileRoute("/api/v1/links/$id")({
  server: {
    handlers: {
      GET: api<{ id: string }>(async ({ user, params }) =>
        json(await getLink(user, params.id)),
      ),
      PATCH: api<{ id: string }>(async ({ user, request, params }) =>
        json(
          await updateLink(
            user,
            params.id,
            await readJson(request, updateLinkInput),
          ),
        ),
      ),
      DELETE: api<{ id: string }>(async ({ user, params }) => {
        await deleteLink(user, params.id);
        return new Response(null, { status: 204 });
      }),
    },
  },
});
