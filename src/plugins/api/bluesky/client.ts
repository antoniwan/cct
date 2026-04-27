import { BskyAgent } from "@atproto/api";
import type { AtpSessionData } from "@atproto/api";

import type { Context } from "../../../core/types.js";

const DEFAULT_SERVICE = "https://bsky.social";
const SESSION_KEY = "bluesky_session";

interface StoredSession {
  service: string;
  session: AtpSessionData;
}

export function getFlag(rawArgs: string[], name: string): string | undefined {
  const flag = `--${name}`;
  const index = rawArgs.indexOf(flag);
  return index >= 0 ? rawArgs[index + 1] : undefined;
}

export function getNumberFlag(
  rawArgs: string[],
  name: string,
  fallback: number
): number {
  const raw = getFlag(rawArgs, name);
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive number.`);
  }
  return parsed;
}

export function hasFlag(rawArgs: string[], name: string): boolean {
  return rawArgs.includes(`--${name}`);
}

export async function loadAgentFromSession(ctx: Context): Promise<BskyAgent> {
  const rawSession = await ctx.auth.get(SESSION_KEY);
  if (!rawSession) {
    throw new Error("Missing Bluesky session. Run: cct api bluesky login");
  }

  let parsed: StoredSession;
  try {
    parsed = JSON.parse(rawSession) as StoredSession;
  } catch {
    throw new Error(
      "Bluesky session is invalid. Re-authenticate: cct api bluesky login"
    );
  }

  const service = parsed.service || DEFAULT_SERVICE;
  const agent = new BskyAgent({ service });
  try {
    await agent.resumeSession(parsed.session);
  } catch {
    throw new Error("Bluesky session expired. Re-authenticate: cct api bluesky login");
  }

  return agent;
}

export async function saveAgentSession(ctx: Context, agent: BskyAgent): Promise<void> {
  if (!agent.session) {
    throw new Error("Unable to store Bluesky session.");
  }

  const payload: StoredSession = {
    service: agent.service.toString(),
    session: agent.session
  };

  await ctx.auth.set(SESSION_KEY, JSON.stringify(payload));
}

export async function createAgent(service?: string): Promise<BskyAgent> {
  return new BskyAgent({ service: service || DEFAULT_SERVICE });
}
