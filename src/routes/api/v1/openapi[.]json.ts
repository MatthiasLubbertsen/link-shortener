import { createFileRoute } from "@tanstack/react-router";
import { openApiSpec } from "#/lib/api/openapi";

// The spec is public: it describes the API, it doesn't expose any data.
export const Route = createFileRoute("/api/v1/openapi.json")({
  server: {
    handlers: {
      GET: ({ request }) =>
        Response.json(openApiSpec(new URL(request.url).origin)),
    },
  },
});
