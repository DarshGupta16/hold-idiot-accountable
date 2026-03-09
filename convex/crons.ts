import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "terminate inactive sessions",
  { minutes: 5 },
  internal.studySessions.terminateAfk,
);

export default crons;
