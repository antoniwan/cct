import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import type { StateService } from "./types.js";

type StateMap = Record<string, unknown>;

const CLI_COMMANDER_DIR = join(homedir(), ".cli-commander");
const STATE_FILE = join(CLI_COMMANDER_DIR, "state.json");

async function readState(): Promise<StateMap> {
  try {
    const raw = await readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as StateMap;
    return parsed ?? {};
  } catch {
    return {};
  }
}

async function writeState(data: StateMap): Promise<void> {
  await mkdir(CLI_COMMANDER_DIR, { recursive: true });
  await writeFile(STATE_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function createStateService(): StateService {
  return {
    async get<T = unknown>(key: string): Promise<T | null> {
      const state = await readState();
      return (state[key] as T | undefined) ?? null;
    },
    async set(key: string, value: unknown): Promise<void> {
      const state = await readState();
      state[key] = value;
      await writeState(state);
    },
    async push(key: string, value: unknown): Promise<void> {
      const state = await readState();
      const current = state[key];
      if (Array.isArray(current)) {
        current.push(value);
        state[key] = current;
      } else {
        state[key] = [value];
      }
      await writeState(state);
    }
  };
}
