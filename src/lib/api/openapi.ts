// OpenAPI 3.1 description of /api/v1, served at /api/v1/openapi.json.
// Keep in sync with src/lib/api/service.ts and the docs on /app/api.
export function openApiSpec(origin: string) {
  const idParam = {
    name: "id",
    in: "path",
    required: true,
    schema: { type: "string" },
    description: "Link id (the `id` field of a link, not its key).",
  };
  const daysParam = {
    name: "days",
    in: "query",
    schema: { type: "integer", minimum: 1, maximum: 365, default: 30 },
    description: "Length of the daily series, ending today (UTC).",
  };
  const errorResponses = {
    "401": { $ref: "#/components/responses/Error" },
    "422": { $ref: "#/components/responses/Error" },
  };
  const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
  const jsonBody = (schema: unknown) => ({
    required: true,
    content: { "application/json": { schema } },
  });
  const jsonResponse = (description: string, schema: unknown) => ({
    description,
    content: { "application/json": { schema } },
  });

  return {
    openapi: "3.1.0",
    info: {
      title: "Link shortener API",
      version: "1.0.0",
      description:
        "Create, edit and inspect short links. Authenticate with an API key created on the /app/api page: `Authorization: Bearer lnk_...`. Keys act as the user who created them.",
    },
    servers: [{ url: origin }],
    security: [{ bearerAuth: [] }],
    paths: {
      "/api/v1/links": {
        get: {
          summary: "List links",
          operationId: "listLinks",
          parameters: [
            { name: "domain", in: "query", schema: { type: "string" } },
            {
              name: "search",
              in: "query",
              schema: { type: "string" },
              description: "Matches part of the key or destination URL.",
            },
            {
              name: "limit",
              in: "query",
              schema: {
                type: "integer",
                minimum: 1,
                maximum: 200,
                default: 50,
              },
            },
            {
              name: "offset",
              in: "query",
              schema: { type: "integer", minimum: 0, default: 0 },
            },
          ],
          responses: {
            "200": jsonResponse("A page of links, newest first", {
              type: "object",
              properties: {
                data: { type: "array", items: ref("Link") },
                total: { type: "integer" },
                limit: { type: "integer" },
                offset: { type: "integer" },
              },
            }),
            ...errorResponses,
          },
        },
        post: {
          summary: "Create a link",
          operationId: "createLink",
          requestBody: jsonBody(ref("LinkInput")),
          responses: {
            "201": jsonResponse("The created link", ref("Link")),
            "400": { $ref: "#/components/responses/Error" },
            "409": { $ref: "#/components/responses/Error" },
            ...errorResponses,
          },
        },
      },
      "/api/v1/links/{id}": {
        parameters: [idParam],
        get: {
          summary: "Get a link",
          operationId: "getLink",
          responses: {
            "200": jsonResponse("The link", ref("Link")),
            "404": { $ref: "#/components/responses/Error" },
            "401": { $ref: "#/components/responses/Error" },
          },
        },
        patch: {
          summary: "Update a link",
          description:
            "Only the fields you send are changed. Send `null` to clear `expirationDate`, `expirationUrl` or `password`.",
          operationId: "updateLink",
          requestBody: jsonBody(ref("LinkInput")),
          responses: {
            "200": jsonResponse("The updated link", ref("Link")),
            "404": { $ref: "#/components/responses/Error" },
            "409": { $ref: "#/components/responses/Error" },
            ...errorResponses,
          },
        },
        delete: {
          summary: "Delete a link and its click history",
          operationId: "deleteLink",
          responses: {
            "204": { description: "Deleted" },
            "404": { $ref: "#/components/responses/Error" },
            "401": { $ref: "#/components/responses/Error" },
          },
        },
      },
      "/api/v1/links/{id}/stats": {
        get: {
          summary: "Click stats for a link",
          operationId: "getLinkStats",
          parameters: [idParam, daysParam],
          responses: {
            "200": jsonResponse("Stats", ref("LinkStats")),
            "404": { $ref: "#/components/responses/Error" },
            "401": { $ref: "#/components/responses/Error" },
          },
        },
      },
      "/api/v1/stats": {
        get: {
          summary: "Account-wide stats",
          operationId: "getStats",
          parameters: [
            daysParam,
            {
              name: "limit",
              in: "query",
              schema: {
                type: "integer",
                minimum: 1,
                maximum: 100,
                default: 10,
              },
              description: "How many top links to return.",
            },
          ],
          responses: {
            "200": jsonResponse("Stats", ref("AccountStats")),
            ...errorResponses,
          },
        },
      },
      "/api/v1/domains": {
        get: {
          summary: "List domains you can create links on",
          operationId: "listDomains",
          responses: {
            "200": jsonResponse("Domains", {
              type: "object",
              properties: {
                data: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      domain: { type: "string" },
                      public: { type: "boolean" },
                      createdAt: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            }),
            "401": { $ref: "#/components/responses/Error" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
      },
      responses: {
        Error: {
          description: "Error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: {
                    type: "object",
                    properties: {
                      code: { type: "string" },
                      message: { type: "string" },
                      details: {},
                    },
                    required: ["code", "message"],
                  },
                },
              },
            },
          },
        },
      },
      schemas: {
        LinkInput: {
          type: "object",
          additionalProperties: false,
          required: [],
          properties: {
            url: {
              type: "string",
              format: "uri",
              description: "Destination (http/https). Required on create.",
            },
            domain: {
              type: "string",
              description:
                "Required only if you have more than one domain; otherwise your only domain is used.",
            },
            key: {
              type: "string",
              description:
                "The path after the domain, e.g. `docs`. Random if omitted on create. Supports parameters like `users/:id` (see README).",
            },
            expirationDate: {
              type: ["string", "null"],
              format: "date-time",
            },
            expirationUrl: {
              type: ["string", "null"],
              format: "uri",
              description:
                "Where to redirect after expiry. Needs expirationDate.",
            },
            password: { type: ["string", "null"] },
            isCloaked: { type: "boolean" },
          },
        },
        Link: {
          type: "object",
          properties: {
            id: { type: "string" },
            domain: { type: "string" },
            key: { type: "string" },
            shortUrl: { type: "string", format: "uri" },
            url: { type: "string", format: "uri" },
            isDynamic: { type: "boolean" },
            expirationDate: { type: ["string", "null"], format: "date-time" },
            expirationUrl: { type: ["string", "null"] },
            hasPassword: { type: "boolean" },
            isCloaked: { type: "boolean" },
            archived: { type: "boolean" },
            clicks: { type: "integer" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: ["string", "null"], format: "date-time" },
          },
        },
        DailyClicks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string", format: "date" },
              clicks: { type: "integer" },
            },
          },
        },
        LinkStats: {
          type: "object",
          properties: {
            link: ref("Link"),
            totalClicks: { type: "integer" },
            days: { type: "integer" },
            clicksInPeriod: { type: "integer" },
            daily: ref("DailyClicks"),
          },
        },
        AccountStats: {
          type: "object",
          properties: {
            totalLinks: { type: "integer" },
            totalClicks: { type: "integer" },
            days: { type: "integer" },
            clicksInPeriod: { type: "integer" },
            daily: ref("DailyClicks"),
            topLinks: { type: "array", items: ref("Link") },
          },
        },
      },
    },
  };
}
