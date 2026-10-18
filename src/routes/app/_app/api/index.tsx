import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useState } from "react";
import { createApiKey, revokeApiKey } from "#/actions/api-keys";
import { getApiKeysQuery } from "#/actions/api-keys/queries";
import { Button } from "#/components/ui/Button";
import Input from "#/components/ui/Input";

export const Route = createFileRoute("/app/_app/api/")({
  head: () => ({
    meta: [
      {
        title: "api - link shortener",
      },
    ],
  }),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(getApiKeysQuery());
  },
  component: App,
});

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto border border-neutral-700 bg-neutral-900 p-3 text-xs">
      {children}
    </pre>
  );
}

function Keys() {
  const queryClient = useQueryClient();
  const { data: keys } = useSuspenseQuery(getApiKeysQuery());
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getApiKeysQuery().queryKey });

  const create = useMutation({
    mutationFn: createApiKey,
    onSuccess: async ({ key }) => {
      setNewKey(key);
      setName("");
      await refresh();
    },
  });
  const revoke = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: refresh,
  });

  return (
    <section>
      <h1 className="font-bold">api keys</h1>
      <p className="mt-1 text-sm text-neutral-400">
        keys act as you: they can manage the same links you can. they work for
        both the REST API and the MCP server.
      </p>

      {newKey && (
        <div className="mt-3 space-y-2 border border-amber-300 p-3">
          <p className="text-sm">
            copy your new key now. you won't be able to see it again.
          </p>
          <Code>{newKey}</Code>
          <div className="flex gap-3">
            <Button
              size="xs"
              onClick={() => navigator.clipboard.writeText(newKey)}
            >
              [copy]
            </Button>
            <Button size="xs" color="neutral" onClick={() => setNewKey(null)}>
              [done]
            </Button>
          </div>
        </div>
      )}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate({ data: { name } });
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="key name, e.g. my script"
          maxLength={64}
        />
        <Button type="submit" disabled={create.isPending || !name.trim()}>
          [create]
        </Button>
      </form>

      <div className="mt-3 border-t border-neutral-700">
        {keys.length === 0 && (
          <p className="py-3 text-sm text-neutral-400">no keys yet</p>
        )}
        {keys.map((key) => (
          <div
            key={key.id}
            className="flex items-center gap-3 border-b border-neutral-700 py-3 text-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate">{key.name}</p>
              <p className="mt-1 text-xs text-neutral-400">
                {key.prefix}… · created {dayjs(key.createdAt).fromNow()} ·{" "}
                {key.lastUsedAt
                  ? `used ${dayjs(key.lastUsedAt).fromNow()}`
                  : "never used"}
              </p>
            </div>
            <Button
              size="xs"
              color="red"
              disabled={revoke.isPending}
              onClick={() => {
                if (confirm(`Revoke "${key.name}"? This can't be undone.`)) {
                  revoke.mutate({ data: { id: key.id } });
                }
              }}
            >
              [revoke]
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

const ENDPOINTS = [
  ["GET", "/api/v1/links", "list links (?domain, ?search, ?limit, ?offset)"],
  ["POST", "/api/v1/links", "create a link"],
  ["GET", "/api/v1/links/:id", "get a link"],
  ["PATCH", "/api/v1/links/:id", "update a link (only the fields you send)"],
  ["DELETE", "/api/v1/links/:id", "delete a link and its clicks"],
  ["GET", "/api/v1/links/:id/stats", "clicks for one link (?days)"],
  ["GET", "/api/v1/stats", "account-wide stats (?days, ?limit)"],
  ["GET", "/api/v1/domains", "domains you can use"],
  ["GET", "/api/v1/openapi.json", "OpenAPI spec (no key needed)"],
];

function Docs() {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const base = origin || "https://go.example.com";

  return (
    <>
      <section className="space-y-3">
        <h1 className="font-bold">rest api</h1>
        <p className="text-sm text-neutral-400">
          JSON over HTTPS. send your key in the <code>Authorization</code>{" "}
          header. errors look like{" "}
          <code>{'{"error":{"code":"key_taken","message":"..."}}'}</code> with a
          matching HTTP status (400, 401, 404, 409, 422). the machine readable
          spec is at{" "}
          <a href="/api/v1/openapi.json" className="underline hover:text-white">
            /api/v1/openapi.json
          </a>
          .
        </p>
        <div className="border-t border-neutral-700">
          {ENDPOINTS.map(([method, path, description]) => (
            <div
              key={`${method} ${path}`}
              className="flex gap-3 border-b border-neutral-700 py-2 text-xs"
            >
              <span className="w-14 flex-none text-amber-300">{method}</span>
              <code className="w-52 flex-none">{path}</code>
              <span className="text-neutral-400">{description}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">create a link</h2>
        <p className="text-sm text-neutral-400">
          only <code>url</code> is required. <code>key</code> is random if left
          out, and <code>domain</code> defaults to your only domain. other
          optional fields: <code>expirationDate</code> (ISO 8601),{" "}
          <code>expirationUrl</code>, <code>password</code>,{" "}
          <code>isCloaked</code>. keys can use parameters such as{" "}
          <code>users/:id</code>.
        </p>
        <Code>{`curl -X POST ${base}/api/v1/links \\
  -H "Authorization: Bearer lnk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com/some/long/page", "key": "docs"}'`}</Code>
        <Code>{`{
  "id": "k3j5h2...",
  "domain": "go.example.com",
  "key": "docs",
  "shortUrl": "https://go.example.com/docs",
  "url": "https://example.com/some/long/page",
  "isDynamic": false,
  "expirationDate": null,
  "expirationUrl": null,
  "hasPassword": false,
  "isCloaked": false,
  "archived": false,
  "clicks": 0,
  "createdAt": "2026-01-01T12:00:00.000Z",
  "updatedAt": null
}`}</Code>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">edit a link</h2>
        <p className="text-sm text-neutral-400">
          use the link's <code>id</code> from the create or list response. send{" "}
          <code>null</code> to clear <code>expirationDate</code>,{" "}
          <code>expirationUrl</code> or <code>password</code>.
        </p>
        <Code>{`curl -X PATCH ${base}/api/v1/links/LINK_ID \\
  -H "Authorization: Bearer lnk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com/new-destination"}'`}</Code>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">stats</h2>
        <p className="text-sm text-neutral-400">
          <code>days</code> (1–365, default 30) sets the length of the per-day
          series, in UTC.
        </p>
        <Code>{`curl "${base}/api/v1/links/LINK_ID/stats?days=7" \\
  -H "Authorization: Bearer lnk_..."`}</Code>
        <Code>{`{
  "link": { "id": "...", "key": "docs", "clicks": 42, ... },
  "totalClicks": 42,
  "days": 7,
  "clicksInPeriod": 9,
  "daily": [{ "date": "2026-01-01", "clicks": 3 }, ...]
}`}</Code>
      </section>

      <section className="space-y-3">
        <h1 className="font-bold">mcp server</h1>
        <p className="text-sm text-neutral-400">
          connect AI tools to your links. the server uses the streamable HTTP
          transport at <code>/mcp</code> with the same API keys, and offers
          tools to list, get, create, update and delete links and to read stats
          (<code>list_domains</code>, <code>list_links</code>,{" "}
          <code>get_link</code>, <code>create_link</code>,{" "}
          <code>update_link</code>, <code>delete_link</code>,{" "}
          <code>get_link_stats</code>, <code>get_stats</code>).
        </p>
        <Code>{`claude mcp add --transport http links ${base}/mcp \\
  --header "Authorization: Bearer lnk_..."`}</Code>
        <p className="text-sm text-neutral-400">
          or in an <code>.mcp.json</code> file:
        </p>
        <Code>{`{
  "mcpServers": {
    "links": {
      "type": "http",
      "url": "${base}/mcp",
      "headers": { "Authorization": "Bearer lnk_..." }
    }
  }
}`}</Code>
      </section>
    </>
  );
}

function App() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <Keys />
      <Docs />
    </div>
  );
}
