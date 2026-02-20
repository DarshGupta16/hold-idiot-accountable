import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  studySessions: defineTable({
    started_at: v.string(),
    ended_at: v.optional(v.string()),
    planned_duration_sec: v.number(),
    subject: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("aborted")
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
  })
    .index("by_status", ["status"])
    .index("by_creation", ["_creationTime"]),

  logs: defineTable({
    type: v.union(
      v.literal("session_start"),
      v.literal("session_end"),
      v.literal("blocklist_change"),
      v.literal("warn"),
      v.literal("breach"),
      v.literal("missed_heartbeat")
    ),
    message: v.string(),
    metadata: v.optional(v.any()),
    session: v.optional(v.id("studySessions")),
  })
    .index("by_session", ["session"])
    .index("by_type", ["type"])
    .index("by_creation", ["_creationTime"]),

  variables: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("by_key", ["key"]),
});
