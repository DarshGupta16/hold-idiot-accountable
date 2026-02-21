/**
 * Manually created API reference using anyApi.
 * This avoids needing `npx convex codegen` during Docker builds.
 * anyApi is a Proxy that dynamically creates function references
 * like api.logs.create, api.studySessions.getActive, etc.
 */
import { anyApi } from "convex/server";

export const api = anyApi;
