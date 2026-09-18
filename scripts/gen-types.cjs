/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
const fs = require('fs');

console.log('Generating types from Supabase local database...');
const output = execSync('npx supabase gen types typescript --local', { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });

const convenience = `
export type ProjectPhase = Database["public"]["Enums"]["project_phase"];
export type PriorityLevel = Database["public"]["Enums"]["priority_level"];
export type UserRole = Database["public"]["Enums"]["user_role"];
export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type TaskType = Database["public"]["Enums"]["task_type"];
export type FileType = Database["public"]["Enums"]["file_category"];
export type ClientReviewVerdict = Database["public"]["Enums"]["client_review_verdict"];
export type RevisionStatus = Database["public"]["Enums"]["revision_status"];
export type RevisionSource = Database["public"]["Enums"]["revision_source"];
export type QcVerdict = Database["public"]["Enums"]["qc_verdict"];
`;

fs.writeFileSync('src/types/database.ts', output + convenience, 'utf-8');
console.log('Successfully written to src/types/database.ts');
