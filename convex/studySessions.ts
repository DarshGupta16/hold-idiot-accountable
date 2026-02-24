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

export const deleteTestSessions = mutation({
  args: { olderThan: v.string() },
  handler: async (ctx, args) => {
    const threshold = new Date(args.olderThan).getTime();

    // 1. Delete break logs associated with test sessions
    const breakStartLogs = await ctx.db
      .query("logs")
      .withIndex("by_type", (q) => q.eq("type", "break_start"))
      .collect();

    for (const log of breakStartLogs) {
      const subject = log.metadata?.next_session?.subject?.toLowerCase() || "";
      const isTest = subject.includes("test") && subject.includes("session");
      const isOld = log._creationTime < threshold;

      if (isTest && isOld) {
        await ctx.db.delete(log._id);
        // Find corresponding break_end logs within a reasonable window of the duration
        const durationSec = log.metadata?.duration_sec || 0;
        const breakEndLogs = await ctx.db
          .query("logs")
          .withIndex("by_type", (q) => q.eq("type", "break_end"))
          .filter((q) =>
            q.and(
              q.gte(q.field("_creationTime"), log._creationTime),
              q.lte(q.field("_creationTime"), log._creationTime + (durationSec + 120) * 1000)
            )
          )
          .collect();

        for (const endLog of breakEndLogs) {
          await ctx.db.delete(endLog._id);
        }
      }
    }

    // 2. Delete the sessions themselves
    const allSessions = await ctx.db.query("studySessions").collect();

    const toDelete = allSessions.filter((s) => {
      const subjectLower = s.subject.toLowerCase();
      const isTest = subjectLower.includes("test") && subjectLower.includes("session");
      const isOld = new Date(s.started_at).getTime() < threshold;
      return isTest && isOld;
    });

    let deletedCount = 0;
    for (const session of toDelete) {
      // 1. Delete associated logs
      const logs = await ctx.db
        .query("logs")
        .withIndex("by_session", (q) => q.eq("session", session._id))
        .collect();

      for (const log of logs) {
        await ctx.db.delete(log._id);
      }

      // 2. Delete the session
      await ctx.db.delete(session._id);
      deletedCount++;
    }

    return deletedCount;
  },
});
