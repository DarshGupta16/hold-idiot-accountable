import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const computeHash = query({
  args: {},
  handler: async (ctx) => {
    const studySessions = await ctx.db.query("studySessions").collect();
    const logs = await ctx.db.query("logs").collect();
    const variables = await ctx.db.query("variables").collect();

    const latestSession = await ctx.db
      .query("studySessions")
      .order("desc")
      .first();
    const latestLog = await ctx.db.query("logs").order("desc").first();
    const latestVar = await ctx.db.query("variables").order("desc").first();

    return [
      studySessions.length,
      latestSession?._creationTime ?? 0,
      logs.length,
      latestLog?._creationTime ?? 0,
      variables.length,
      latestVar?._creationTime ?? 0,
    ].join("|");
  },
});

export const exportAll = query({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db.query("studySessions").collect();
    const logs = await ctx.db.query("logs").collect();
    const variables = await ctx.db.query("variables").collect();

    if (sessions.length > 8000 || logs.length > 8000 || variables.length > 8000) {
      console.warn("Table size approaching Convex limit for single query.");
    }

    return { sessions, logs, variables };
  },
});

export const importAll = mutation({
  args: {
    sessions: v.array(v.any()),
    logs: v.array(v.any()),
    variables: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const sessionMap = new Map();

    // 1. Insert sessions first
    for (const session of args.sessions as Record<string, unknown>[]) {
      const data = { ...session };
      delete data._id;
      delete data._creationTime;
      // @ts-expect-error - Insert expects specific table record
      const newId = await ctx.db.insert("studySessions", data);
      sessionMap.set(session._id as string, newId);
    }

    // 2. Insert logs with mapped session IDs
    for (const log of args.logs) {
      const data = { ...log } as Record<string, unknown>;
      delete data._id;
      delete data._creationTime;
      
      if (data.session && sessionMap.has(data.session as string)) {
        data.session = sessionMap.get(data.session as string);
      } else {
        delete data.session;
      }
      // @ts-expect-error - Insert expects specific table record
      await ctx.db.insert("logs", data);
    }

    // 3. Insert variables
    for (const variable of args.variables) {
      const data = { ...variable } as Record<string, unknown>;
      delete data._id;
      delete data._creationTime;
      // @ts-expect-error - Insert expects specific table record
      await ctx.db.insert("variables", data);
    }
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db.query("studySessions").collect();
    for (const doc of sessions) {
      await ctx.db.delete(doc._id);
    }

    const logs = await ctx.db.query("logs").collect();
    for (const doc of logs) {
      await ctx.db.delete(doc._id);
    }

    const variables = await ctx.db.query("variables").collect();
    for (const doc of variables) {
      await ctx.db.delete(doc._id);
    }
  },
});
