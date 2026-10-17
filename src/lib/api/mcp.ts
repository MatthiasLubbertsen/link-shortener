// Minimal stateless MCP server (Streamable HTTP transport, JSON responses
// only) exposing the same operations as the REST API. It's hand-rolled
// because it only needs initialize, ping, tools/list and tools/call.
import z from "zod";
import { ApiError } from "./errors";
import {
  type ApiUser,
  createLink,
  createLinkInput,
  deleteLink,
  getAccountStats,
  getLink,
  getLinkStats,
  listDomains,
  listLinks,
  listLinksInput,
  statsInput,
  updateLink,
  updateLinkInput,
} from "./service";

const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const idInput = z.object({
  id: z.string().describe("Link id (the `id` field, not the key)"),
});

type Tool = {
  name: string;
  description: string;
  schema: z.ZodType;
  run: (user: ApiUser, args: never) => Promise<unknown>;
};

function tool<S extends z.ZodType>(t: {
  name: string;
  description: string;
  schema: S;
  run: (user: ApiUser, args: z.infer<S>) => Promise<unknown>;
}): Tool {
  return t as unknown as Tool;
}

const tools: Tool[] = [
  tool({
    name: "list_domains",
    description: "List the domains you can create short links on.",
    schema: z.object({}),
    run: (user) => listDomains(user),
  }),
  tool({
    name: "list_links",
    description:
      "List short links (newest first) with click counts. Supports search, domain filter and pagination.",
    schema: listLinksInput,
    run: (user, args) => listLinks(user, args),
  }),
  tool({
    name: "get_link",
    description: "Get one short link by id.",
    schema: idInput,
    run: (user, args) => getLink(user, args.id),
  }),
  tool({
    name: "create_link",
    description:
      "Create a short link. Only `url` is required; `key` is random if omitted and `domain` defaults to your only domain. Keys can have parameters like `users/:id` (use :id in the url too).",
    schema: createLinkInput,
    run: (user, args) => createLink(user, args),
  }),
  tool({
    name: "update_link",
    description:
      "Update a short link. Only the fields you pass change; pass null to clear expirationDate, expirationUrl or password.",
    schema: idInput.extend(updateLinkInput.shape),
    run: (user, { id, ...patch }) => updateLink(user, id, patch),
  }),
  tool({
    name: "delete_link",
    description: "Permanently delete a short link and its click history.",
    schema: idInput,
    run: async (user, args) => {
      await deleteLink(user, args.id);
      return { deleted: true };
    },
  }),
  tool({
    name: "get_link_stats",
    description:
      "Click stats for one link: all-time total plus clicks per day (UTC) for the last `days` days.",
    schema: idInput.extend({ days: statsInput.shape.days }),
    run: (user, { id, ...rest }) =>
      getLinkStats(user, id, statsInput.parse(rest)),
  }),
  tool({
    name: "get_stats",
    description:
      "Account-wide stats: totals, clicks per day for the last `days` days and the top links.",
    schema: statsInput,
    run: (user, args) => getAccountStats(user, args),
  }),
];

type RpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

const rpcError = (id: RpcRequest["id"], code: number, message: string) => ({
  jsonrpc: "2.0" as const,
  id: id ?? null,
  error: { code, message },
});

async function callTool(user: ApiUser, params: Record<string, unknown> = {}) {
  const found = tools.find((t) => t.name === params.name);
  if (!found) {
    throw new ApiError(400, "unknown_tool", `Unknown tool: ${params.name}`);
  }

  try {
    const args = found.schema.parse(params.arguments ?? {});
    const result = await found.run(user, args as never);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (e) {
    // Tool failures are reported to the model, not as protocol errors.
    let message = "Internal error";
    if (e instanceof ApiError) message = `${e.code}: ${e.message}`;
    else if (e instanceof z.ZodError) {
      message = `validation_error: ${e.issues.map((i) => `${i.path.join(".") || "arguments"}: ${i.message}`).join("; ")}`;
    } else console.error(e);
    return { isError: true, content: [{ type: "text", text: message }] };
  }
}

/** Handle one JSON-RPC message. Returns null for notifications. */
export async function handleRpc(user: ApiUser, msg: RpcRequest) {
  if (msg?.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return rpcError(msg?.id, -32600, "Invalid request");
  }
  // Notifications have no id and get no response.
  if (msg.id === undefined) return null;

  switch (msg.method) {
    case "initialize": {
      const requested = msg.params?.protocolVersion;
      return {
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          protocolVersion: SUPPORTED_VERSIONS.includes(requested as string)
            ? requested
            : SUPPORTED_VERSIONS[0],
          capabilities: { tools: {} },
          serverInfo: { name: "link-shortener", version: "1.0.0" },
        },
      };
    }
    case "ping":
      return { jsonrpc: "2.0", id: msg.id, result: {} };
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: z.toJSONSchema(t.schema, { io: "input" }),
          })),
        },
      };
    case "tools/call":
      try {
        return {
          jsonrpc: "2.0",
          id: msg.id,
          result: await callTool(user, msg.params),
        };
      } catch (e) {
        if (e instanceof ApiError) return rpcError(msg.id, -32602, e.message);
        throw e;
      }
    default:
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}
