/**
 * Every authenticated request must include this header (injected by oauth2-proxy in prod;
 * MSW / local dev spoofs it). Not declared in openapi.json.
 */
export const AUTH_HEADER = "X-Auth-Request-Email"
