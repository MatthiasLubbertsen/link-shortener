import { createFileRoute, redirect } from "@tanstack/react-router";
import { setCookie } from "@tanstack/react-start/server";
import { nanoid } from "nanoid";
import { joinURL, withQuery } from "ufo";
import { oidcConfig } from "#/lib/oidc";
import { getSession } from "#/lib/session";

export const Route = createFileRoute("/app/_app/auth/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { session } = await getSession();
        if (session) {
          throw redirect({
            to: "/app",
          });
        }

        const state = nanoid();
        setCookie("hackclub_state", state, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
        });

        const baseUrl = oidcConfig.publicUrl ?? new URL(request.url).origin;

        const redirectUrl = withQuery(oidcConfig.authorizeUrl, {
          client_id: oidcConfig.clientId,
          redirect_uri: joinURL(baseUrl, "/app/auth/callback"),
          response_type: "code",
          scope: oidcConfig.scope,
          state,
        });

        throw redirect({
          href: redirectUrl,
        });
      },
    },
  },
});
