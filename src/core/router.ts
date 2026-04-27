import type { Command } from "./types.js";

export type CommandKey = `${string}:${string}:${string}`;
export type CommandPath = [string, string, string];

const commandLoaders: Record<CommandKey, () => Promise<Command>> = {
  "sys:root:update": async () =>
    (await import("../plugins/sys/update.js")).command,
  "api:bluesky:login": async () =>
    (await import("../plugins/api/bluesky/login.js")).command,
  "api:bluesky:post": async () =>
    (await import("../plugins/api/bluesky/post.js")).command,
  "api:bluesky:read": async () =>
    (await import("../plugins/api/bluesky/read.js")).command,
  "api:bluesky:extract": async () =>
    (await import("../plugins/api/bluesky/extract.js")).command,
  "api:bluesky:followers": async () =>
    (await import("../plugins/api/bluesky/followers.js")).command,
  "api:bluesky:auto-post": async () =>
    (await import("../plugins/api/bluesky/auto-post.js")).command,
  "api:bluesky:auto-follow": async () =>
    (await import("../plugins/api/bluesky/auto-follow.js")).command
};

export const commandTree = {
  sys: {
    root: ["update"]
  },
  api: {
    bluesky: [
      "login",
      "post",
      "read",
      "extract",
      "followers",
      "auto-post",
      "auto-follow"
    ]
  }
} as const;

export async function loadCommand(path: CommandPath): Promise<Command> {
  const [namespace, group, command] = path;
  const key = `${namespace}:${group}:${command}` as CommandKey;
  const loader = commandLoaders[key];
  if (!loader) {
    throw new Error(`Unknown command path: ${namespace} ${group} ${command}`);
  }
  return loader();
}
