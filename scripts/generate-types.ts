import { execSync } from "node:child_process";
import * as fs from "node:fs";

const types = execSync("npx supabase gen types typescript --local", {
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
});

const helpers = `
export type UserRole = Database["public"]["Enums"]["user_role"];
export type ProjectPhase = Database["public"]["Enums"]["project_phase"];
export type PriorityLevel = Database["public"]["Enums"]["priority_level"];
export type TaskType = Database["public"]["Enums"]["task_type"];
export type TaskStatus = Database["public"]["Enums"]["task_status"];
`;

fs.writeFileSync("src/types/database.ts", types + helpers, "utf8");
console.log("Successfully generated src/types/database.ts with UTF-8 encoding");
