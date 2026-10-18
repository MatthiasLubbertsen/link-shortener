# link-shortener

a minimal link shortener. looks nice, mostly works, ticks boxes.

demo available at https://wack.club and https://hackthis.club for teens in Hack Club.

<img width="1920" height="1279" alt="screenshot of the link shortener homepage" src="https://github.com/user-attachments/assets/103dfa75-932b-4245-9c41-f68b53783b57" />

## features
- shorten links _(who knew?)_
- edit existing links
- **🌟 dynamic links** - add custom parameters (like /users/:id) and use them to redirect
- search and sort links
- track link clicks
- add expiration dates and urls, password protection, and link cloaking (à la [Dub](https://dub.co/help/article/link-cloaking))
- **REST API + MCP server** - create, edit and read stats for links with API keys ([docs](#api))
- optional [Liwan](https://liwan.dev) analytics for every redirect ([docs](#liwan-analytics))

## getting started

first, go to [Hack Club Auth](https://auth.hackclub.com/developer/apps) and create a new app with all scopes (openid, name, email, profile, verification_status, slack_id). add `http://localhost:3000/app/auth/callback` as a redirect url.

> if you can't see the Developer section, go to My Info and check the 'developer mode' box.

create `.env.local` and add the following variables:

```env
DATABASE_URL="file:./dev.db"

SESSION_SECRET="<randomly generated password>"

HACKCLUB_CLIENT_ID="<your client id>"
HACKCLUB_CLIENT_SECRET="<your client secret>"
```

then, to start the application, run:

```bash
pnpm install
pnpm db:push
pnpm dev
```

the first time someone signs in, the app creates a domain for the host of `PUBLIC_URL` (or the host you're visiting, if that's unset), owned by that user. for local development that's `localhost`. no manual database step is needed.

> if you want links on more than one domain, add rows to the `domains` table (e.g. with `pnpm db:studio`, [local.drizzle.studio](https://local.drizzle.studio)). there's no UI for it.

## running with docker

```bash
cp .env.example .env   # then fill it in
docker compose --profile tools run --rm migrate   # creates/updates the database tables
docker compose up -d
```

run the `migrate` step again after updating, since new versions can add tables (the API keys table was added with the API).

## API

open the **api** page in the app to create API keys and see the docs with examples that use your own domain. keys act as the user who created them (admins can manage everyone's links). each key is shown once and only a hash is stored.

authenticate with `Authorization: Bearer lnk_...`. all requests and responses are JSON. a machine-readable [OpenAPI 3.1 spec](#openapi) is served at `/api/v1/openapi.json`.

| method | path | what it does |
| --- | --- | --- |
| `GET` | `/api/v1/links` | list links. `?domain`, `?search`, `?limit` (1-200, default 50), `?offset` |
| `POST` | `/api/v1/links` | create a link |
| `GET` | `/api/v1/links/:id` | get a link |
| `PATCH` | `/api/v1/links/:id` | update a link. only the fields you send change |
| `DELETE` | `/api/v1/links/:id` | delete a link and its clicks (`204`) |
| `GET` | `/api/v1/links/:id/stats` | clicks for one link. `?days` (1-365, default 30) |
| `GET` | `/api/v1/stats` | account-wide totals, daily clicks and top links. `?days`, `?limit` (top links, default 10) |
| `GET` | `/api/v1/domains` | domains you can create links on |

`:id` is the link's `id`, not its key.

### link fields

| field | type | notes |
| --- | --- | --- |
| `url` | string | destination, `http`/`https`. **required** when creating |
| `key` | string | path after the domain, e.g. `docs`. random 8 characters if omitted. allowed: `A-Z a-z 0-9 - _ /`, plus `:param` and `:param*` for [dynamic links](#features). lowercased. can't start with `app`, `api` or `mcp` |
| `domain` | string | only needed if you have more than one domain |
| `expirationDate` | string or null | ISO 8601, e.g. `2030-01-01T00:00:00Z` |
| `expirationUrl` | string or null | where to redirect after expiry. needs `expirationDate` |
| `password` | string or null | visitors must enter it. never returned, see `hasPassword` |
| `isCloaked` | boolean | link cloaking |

responses contain `id`, `domain`, `key`, `shortUrl`, `url`, `isDynamic`, `expirationDate`, `expirationUrl`, `hasPassword`, `isCloaked`, `archived`, `clicks`, `createdAt` and `updatedAt`. on `PATCH`, send `null` to clear `expirationDate`, `expirationUrl` or `password`.

### examples

```bash
# create
curl -X POST https://go.example.com/api/v1/links \
  -H "Authorization: Bearer lnk_..." -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/some/long/page", "key": "docs"}'

# edit
curl -X PATCH https://go.example.com/api/v1/links/LINK_ID \
  -H "Authorization: Bearer lnk_..." -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/new-destination"}'

# stats for the last 7 days
curl "https://go.example.com/api/v1/links/LINK_ID/stats?days=7" \
  -H "Authorization: Bearer lnk_..."
```

stats look like this. days are in UTC, oldest first, and days without clicks are included with `0`:

```json
{
  "link": { "id": "...", "key": "docs", "clicks": 42 },
  "totalClicks": 42,
  "days": 7,
  "clicksInPeriod": 9,
  "daily": [{ "date": "2026-01-01", "clicks": 3 }]
}
```

### errors

errors have the shape `{"error": {"code": "...", "message": "...", "details": ...}}`:

| status | code | when |
| --- | --- | --- |
| `400` | `invalid_json`, `invalid_domain`, `domain_required` | bad body, or a domain you can't use |
| `401` | `unauthorized` | missing or invalid API key |
| `404` | `not_found` | link doesn't exist, or isn't yours |
| `409` | `key_taken` | a link with that key already exists on the domain |
| `422` | `validation_error` | invalid fields. `details` lists them per field |

### openapi

`/api/v1/openapi.json` is public (it describes the API, it doesn't expose data). if you change an endpoint, update `src/lib/api/openapi.ts` and the docs on the api page (`src/routes/app/_app/api/index.tsx`).

## MCP server

the app is also an [MCP](https://modelcontextprotocol.io) server at `/mcp`, so AI tools can manage your links. it uses the stateless streamable HTTP transport and the same API keys.

```bash
claude mcp add --transport http links https://go.example.com/mcp \
  --header "Authorization: Bearer lnk_..."
```

or in `.mcp.json`:

```json
{
  "mcpServers": {
    "links": {
      "type": "http",
      "url": "https://go.example.com/mcp",
      "headers": { "Authorization": "Bearer lnk_..." }
    }
  }
}
```

tools: `list_domains`, `list_links`, `get_link`, `create_link`, `update_link`, `delete_link`, `get_link_stats`, `get_stats`. they take the same fields as the REST API and return the same JSON.

## Liwan analytics

the app can report every redirect to [Liwan](https://liwan.dev), a small privacy-friendly analytics tool. the built-in click counts keep working either way.

**already running Liwan?** skip to step 3. create the entity, set `LIWAN_ENTITY_ID`, and set `LIWAN_URL` to an address the app container can reach (see below).

**new to Liwan?** the compose file has an optional bundled instance:

1. `docker compose --profile liwan up -d` also starts a `liwan` container. set `LIWAN_BASE_URL` in `.env` to the public URL where you'll reach it.
2. run `docker compose logs liwan` and open the one-time setup link to create your account.
3. in Liwan, create an entity. its **domain** should be your shortener's domain (e.g. `go.example.com`).
4. put the entity's id in `LIWAN_ENTITY_ID` in `.env` and run `docker compose up -d` again (with `--profile liwan` if you use the bundled one).

each redirect sends a `pageview` event to Liwan with the short URL path, the visitor's user agent and IP (from `X-Forwarded-For`, so keep your reverse proxy setting it), the referrer, and a `key` and `destination` (host only) property. only UTM-style query parameters are kept. the event is sent in the background, so a slow or down Liwan never delays a redirect.

by default `LIWAN_URL` is `http://liwan:9042` (the bundled service). leaving `LIWAN_ENTITY_ID` empty turns this off.

**using a Liwan from another compose project:** the app has to be able to reach it. the simplest way is to put both containers on a shared docker network (e.g. the `proxy` network) and set `LIWAN_URL=http://<liwan container name>:9042`. Liwan only trusts `X-Forwarded-For` from the proxies in `trusted_proxies` (default: loopback), so also add the shared network's subnet (`docker network inspect <network>`) to `trusted_proxies` in your Liwan config. otherwise visitor IPs (and so unique visitors and geo data) won't be recorded.

## serving short links on your main domain (Traefik)

say your portfolio is a single page on `example.com` and the shortener is on `go.example.com`. `docker-compose.traefik.yml` makes `example.com/slug` redirect to `go.example.com/slug` with Traefik labels on the shortener, without changing the portfolio:

```bash
docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d
```

set `SHORTENER_DOMAIN` and `PORTFOLIO_DOMAIN` in `.env` (see `.env.example`). the file assumes Traefik v3 and that Traefik is on an external docker network called `proxy` (change with `TRAEFIK_NETWORK`). it doesn't set entrypoints or TLS, so the routers listen on all entrypoints and expect TLS to be handled before Traefik. add `tls` / `certresolver` labels if you terminate TLS in Traefik.

the redirect router matches every path on your main domain **except**:

- `/` (your portfolio)
- anything with a dot in it, like `/favicon.ico` or `/main.css`. link keys can't contain dots, so these can never be short links
- top-level folders in `PORTFOLIO_ASSET_DIRS`, default `assets|static|_next|_astro`. add the folder your portfolio serves its files from if it's something else, or those files will redirect

**using your own compose file** (e.g. one that runs the prebuilt image)? copy the labels and the `proxy` network from `docker-compose.traefik.yml` into your `app` service. replace the `${...}` variables with your values, and write `$$` as a single `$` if you're not using compose interpolation.

this only works if requests for your main domain actually reach Traefik. if something in front of Traefik (a reverse proxy, a host-level proxy) sends your main domain straight to the portfolio container, point it at Traefik instead, or add the redirect there.

things to know:

- a slug that doesn't exist on the shortener shows the shortener's "Link not found" page, not your portfolio's 404
- the redirect is a `302`, so slugs can be changed later
- the shortener's domain must exist and links must be created on it (e.g. `go.example.com/gh`). the redirect only moves the visitor there
- paths on the portfolio that aren't `/` and aren't assets (like a `/blog` page) would be redirected too. it's a single page site so there are none, but if you add one, add its name to `PORTFOLIO_ASSET_DIRS`

# build for production

to build this application for production:

```bash
pnpm build
```

you can then test locally with `pnpm preview` or deploy somewhere like Vercel! when deploying, you'll need to add domains manually.

> [!TIP]
> for a cloud sqlite database, I recommend [Turso](https://turso.tech/) since it's really easy (and free!) to get started.
> 
> you can also rewrite the database schema into Postgres or MySQL if you wish. check `src/db/schema.ts` and the Drizzle ORM docs for help.

## made with
- TanStack Start
- React + Tailwind CSS
- Drizzle ORM

some code for the link cloaking feature, like fetching meta tags, was adapted from [Dub](https://github.com/dubinc/dub) (license AGPLv3). if you need a free link shortener, don't have your own custom domain, or want more features, Dub is pretty good for most people!
