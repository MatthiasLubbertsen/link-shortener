import z from "zod";
import { isReservedKey } from "#/lib/link";

export const createLinkSchema = z.object({
  domain: z.string().min(1, "Required"),
  key: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9-_/]*$/,
      "Only the characters A-Z, a-z, 0-9, -, _, and / are allowed",
    )
    .toLowerCase()
    .transform((key) => key.split("/").filter(Boolean).join("/"))
    .refine((key) => !isReservedKey(key), "Cannot start with /app, /api or /mcp"),
  url: z.httpUrl("Invalid URL"),
});
