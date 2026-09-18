import { z } from "zod";

/**
 * Standard PostgreSQL UUID format validator (8-4-4-4-12 hex string).
 * Supports standard RFC 4122 UUIDs as well as deterministic seed UUIDs
 * (e.g. 20000000-0000-0000-0000-000000000001, 00000000-0000-0000-0000-000000000004).
 */
export const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function uuidSchema(errorMessage = "ID tidak valid.") {
  return z.string().regex(UUID_REGEX, { message: errorMessage });
}
