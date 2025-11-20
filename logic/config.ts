import { z } from "npm:zod@3.21.4";

const LocalConfig = z.object({
  backend: z.literal("local"),
  local: z.object({
    filename: z.string().default("todo.txt"),
  }).default({}),
});

const WebDavConfig = z.object({
  backend: z.literal("webdav"),
  webdav: z.object({
    url: z.string(),
    username: z.string().optional(),
    password: z.string().optional(),
  }),
});

export const ConfigSchema = z.discriminatedUnion("backend", [
  LocalConfig,
  WebDavConfig,
]);

export type TodoTuiConfig = z.infer<typeof ConfigSchema>;

export async function loadConfig(): Promise<TodoTuiConfig> {
  try {
    const text = await Deno.readTextFile("todotui-config.json");
    const json = JSON.parse(text);
    return ConfigSchema.parse(json);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.log("Config file not found, defaulting to local 'todo.txt'");
      return {
        backend: "local",
        local: { filename: "todo.txt" },
      };
    }
    throw error;
  }
}
