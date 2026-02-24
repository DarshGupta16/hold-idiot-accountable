import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getBySession = query({
  args: { sessionId: v.id("studySessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("logs")
      .withIndex("by_session", (q) => q.eq("session", args.sessionId))
      .order("desc")
      .collect();
  },
});

export const getBySessionAsc = query({
  args: { sessionId: v.id("studySessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("logs")
      .withIndex("by_session", (q) => q.eq("session", args.sessionId))
      .order("asc")
      .collect();
  },
});

export const getUnacknowledgedAlerts = query({
  args: {},
  handler: async (ctx) => {
    // Convex doesn't support inequality filters on indexed fields effectively for this case without a compound index
    // and filtering in memory is fine for a small number of logs.
    const alerts = await ctx.db
      .query("logs")
      .filter((q) =>
        q.or(
          q.eq(q.field("type"), "missed_heartbeat"),
          q.eq(q.field("type"), "breach"),
          q.eq(q.field("type"), "warn")
        )
      )
      .order("desc")
      .take(100);

    return alerts.filter((log) => !log.metadata?.acknowledged);
  },
});

export const create = mutation({
  args: {
    type: v.union(
      v.literal("session_start"),
      v.literal("session_end"),
      v.literal("break_start"),
      v.literal("break_end"),
      v.literal("break_skip"),
      v.literal("blocklist_change"),
      v.literal("warn"),
      v.literal("breach"),
      v.literal("missed_heartbeat")
    ),
    message: v.string(),
    metadata: v.optional(v.any()),
    session: v.optional(v.id("studySessions")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("logs", {
      type: args.type,
      message: args.message,
      metadata: args.metadata,
      session: args.session,
    });
  },
});

export const updateMetadata = mutation({
  args: {
    id: v.id("logs"),
    metadata: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { metadata: args.metadata });
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("logs").collect();
    return all.length;
  },
});

export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("logs")
      .order("desc")
      .take(args.limit || 20);
  },
});
