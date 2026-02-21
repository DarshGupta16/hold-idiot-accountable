import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

export const getActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("studySessions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .first();
  },
});

export const getById = query({
  args: { id: v.id("studySessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("studySessions")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const create = mutation({
  args: {
    started_at: v.string(),
    planned_duration_sec: v.number(),
    subject: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("aborted")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("studySessions", {
      started_at: args.started_at,
      planned_duration_sec: args.planned_duration_sec,
      subject: args.subject,
      status: args.status,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("studySessions"),
    updates: v.object({
      ended_at: v.optional(v.string()),
      status: v.optional(
        v.union(
          v.literal("active"),
          v.literal("completed"),
          v.literal("aborted")
        )
      ),
      end_note: v.optional(v.string()),
      timeline: v.optional(
        v.array(
          v.object({
            id: v.string(),
            time: v.string(),
            type: v.union(
              v.literal("START"),
              v.literal("END"),
              v.literal("BREACH"),
              v.literal("WARNING"),
              v.literal("INFO")
            ),
            description: v.string(),
          })
        )
      ),
      summary: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, args.updates);
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("studySessions").collect();
    return all.length;
  },
});
