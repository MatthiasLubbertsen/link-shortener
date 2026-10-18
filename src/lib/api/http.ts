import z from "zod";
import { ApiError } from "./errors";
import { getUserForApiKey } from "./keys";
import type { ApiUser } from "./service";

export function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

export async function authenticate(request: Request): Promise<ApiUser> {
  const token = bearerToken(request);
  if (!token) {
    throw new ApiError(
      401,
      "unauthorized",
      "Missing API key. Send 'Authorization: Bearer <key>'.",
    );
  }
  const user = await getUserForApiKey(token);
  if (!user) throw new ApiError(401, "unauthorized", "Invalid API key");
  return user;
}

export async function readJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON");
  }
  return parse(schema, body);
}

export function parse<T extends z.ZodType>(
  schema: T,
  value: unknown,
): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError(
      422,
      "validation_error",
      result.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; "),
      z.treeifyError(result.error),
    );
  }
  return result.data;
}

export function query<T extends z.ZodType>(request: Request, schema: T) {
  return parse(
    schema,
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
}

/** Authenticate, run the handler and turn thrown ApiErrors into JSON. */
export function api<P extends Record<string, string> = Record<string, never>>(
  handler: (ctx: {
    user: ApiUser;
    request: Request;
    params: P;
  }) => Promise<Response>,
) {
  return async ({ request, params }: { request: Request; params: P }) => {
    try {
      const user = await authenticate(request);
      return await handler({ user, request, params });
    } catch (e) {
      if (e instanceof ApiError) {
        return json(
          { error: { code: e.code, message: e.message, details: e.details } },
          e.status,
        );
      }
      console.error(e);
      return json(
        { error: { code: "internal_error", message: "Internal error" } },
        500,
      );
    }
  };
}
