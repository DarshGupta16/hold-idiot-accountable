import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("variables")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
  },
});

export const upsert = mutation({
  args: { key: v.string(), value: v.any() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("variables")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value });
    } else {
      await ctx.db.insert("variables", {
        key: args.key,
        value: args.value,
      });
    }
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("variables").collect();
    return all.length;
  },
});
