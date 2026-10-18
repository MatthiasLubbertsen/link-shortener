import { createFileRoute } from "@tanstack/react-router";
import { ApiError } from "#/lib/api/errors";
import { authenticate } from "#/lib/api/http";
import { handleRpc } from "#/lib/api/mcp";

// MCP server over Streamable HTTP. Stateless: every POST is answered with a
// plain JSON response, and there is no server-initiated SSE stream.
export const Route = createFileRoute("/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let user: Awaited<ReturnType<typeof authenticate>>;
        try {
          user = await authenticate(request);
        } catch (e) {
          if (e instanceof ApiError) {
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                id: null,
                error: { code: -32001, message: e.message },
              }),
              {
                status: 401,
                headers: {
                  "Content-Type": "application/json",
                  "WWW-Authenticate": 'Bearer realm="link-shortener"',
                },
              },
            );
          }
          throw e;
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            {
              jsonrpc: "2.0",
              id: null,
              error: { code: -32700, message: "Parse error" },
            },
            { status: 400 },
          );
        }

        const messages = Array.isArray(body) ? body : [body];
        const responses = (
          await Promise.all(
            messages.map((m) =>
              handleRpc(user, m).catch((e) => {
                console.error(e);
                return {
                  jsonrpc: "2.0",
                  id: m?.id ?? null,
                  error: { code: -32603, message: "Internal error" },
                };
              }),
            ),
          )
        ).filter((r) => r !== null);

        if (responses.length === 0) return new Response(null, { status: 202 });
        return Response.json(Array.isArray(body) ? responses : responses[0]);
      },
      GET: () =>
        new Response("This MCP server doesn't offer an SSE stream", {
          status: 405,
          headers: { Allow: "POST" },
        }),
      DELETE: () =>
        new Response(null, { status: 405, headers: { Allow: "POST" } }),
    },
  },
});
