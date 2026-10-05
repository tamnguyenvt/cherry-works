import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * An MCP server's OAuth, on `127.0.0.1`, as small as the SDK's client needs:
 * the protected-resource and authorization-server metadata, dynamic
 * registration, an authorization that redirects back at once as though the
 * developer had agreed, and a token endpoint that checks PKCE and renews.
 *
 * `refusesRenewal` makes a renewal answer `invalid_grant`, as an mcp origin that
 * took the developer's access away does.
 */
export interface OAuthTestServer {
  readonly endpoint: string;
  readonly server: Server;
  refusesRenewal: boolean;
  /** How many times each token was issued, by grant. */
  readonly issued: { authorization_code: number; refresh_token: number };
}

export async function anOAuthServer(): Promise<OAuthTestServer> {
  const challenges = new Map<string, string>();
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const oauthTestServer: OAuthTestServer = { endpoint: `${base}/mcp`, server, refusesRenewal: false, issued: { authorization_code: 0, refresh_token: 0 } };

  server.on("request", async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", base);
    let body = "";
    for await (const chunk of request) body += chunk;
    const answerJson = (status: number, json: unknown) => response.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(json));

    if (requestUrl.pathname.startsWith("/.well-known/oauth-protected-resource"))
      return answerJson(200, { resource: oauthTestServer.endpoint, authorization_servers: [base] });
    if (requestUrl.pathname === "/.well-known/oauth-authorization-server")
      return answerJson(200, {
        issuer: base,
        authorization_endpoint: `${base}/authorize`,
        token_endpoint: `${base}/token`,
        registration_endpoint: `${base}/register`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"],
      });
    if (requestUrl.pathname === "/register") return answerJson(201, { ...JSON.parse(body), client_id: "client-1" });
    if (requestUrl.pathname === "/authorize") {
      const code = `code-${challenges.size + 1}`;
      challenges.set(code, requestUrl.searchParams.get("code_challenge") ?? "");
      const callbackUrl = new URL(requestUrl.searchParams.get("redirect_uri") ?? "");
      callbackUrl.searchParams.set("code", code);
      callbackUrl.searchParams.set("state", requestUrl.searchParams.get("state") ?? "");
      return response.writeHead(302, { location: callbackUrl.href }).end();
    }
    if (requestUrl.pathname === "/token") {
      const form = new URLSearchParams(body);
      if (form.get("grant_type") === "authorization_code") {
        const verifier = createHash("sha256").update(form.get("code_verifier") ?? "").digest("base64url");
        if (challenges.get(form.get("code") ?? "") !== verifier) return answerJson(400, { error: "invalid_grant" });
        oauthTestServer.issued.authorization_code += 1;
        return answerJson(200, { access_token: "access-1", token_type: "Bearer", expires_in: 3600, refresh_token: "refresh-1" });
      }
      if (oauthTestServer.refusesRenewal) return answerJson(400, { error: "invalid_grant" });
      oauthTestServer.issued.refresh_token += 1;
      return answerJson(200, { access_token: `access-renewed-${oauthTestServer.issued.refresh_token}`, token_type: "Bearer", expires_in: 3600 });
    }
    answerJson(404, {});
  });
  return oauthTestServer;
}
