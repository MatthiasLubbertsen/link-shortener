// OIDC provider configuration. Defaults point at Hack Club Auth so an
// unchanged deployment keeps working. Set these env vars to use another
// OIDC provider such as Tinyauth.
export const oidcConfig = {
  clientId: process.env.OIDC_CLIENT_ID ?? process.env.HACKCLUB_CLIENT_ID,
  clientSecret:
    process.env.OIDC_CLIENT_SECRET ?? process.env.HACKCLUB_CLIENT_SECRET,
  authorizeUrl:
    process.env.OIDC_AUTHORIZE_URL ??
    "https://auth.hackclub.com/oauth/authorize",
  tokenUrl:
    process.env.OIDC_TOKEN_URL ?? "https://auth.hackclub.com/oauth/token",
  userinfoUrl:
    process.env.OIDC_USERINFO_URL ?? "https://auth.hackclub.com/oauth/userinfo",
  scope:
    process.env.OIDC_SCOPE ??
    "openid profile email slack_id verification_status",
  // On by default, since Hack Club Auth reports ID verification. Providers
  // that don't send verification_status (like Tinyauth) must set this to false.
  requireVerified: process.env.OIDC_REQUIRE_VERIFIED !== "false",
  // Public origin, e.g. https://go.example.com. Set this behind a proxy so
  // the redirect URI matches what the provider has registered.
  publicUrl: process.env.PUBLIC_URL?.replace(/\/$/, ""),
  // Comma-separated emails allowed to sign in. Empty means anyone who passes
  // the provider's checks can sign in (the previous behaviour).
  allowedEmails: (process.env.OIDC_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
};
