import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import type { AuthService } from "./types.js";

type SecretMap = Record<string, string>;

const CLI_COMMANDER_DIR = join(homedir(), ".cli-commander");
const SECRETS_FILE = join(CLI_COMMANDER_DIR, "secrets.json");

async function readSecrets(): Promise<SecretMap> {
  try {
    const raw = await readFile(SECRETS_FILE, "utf8");
    const parsed = JSON.parse(raw) as SecretMap;
    return parsed ?? {};
  } catch {
    return {};
  }
}

async function writeSecrets(data: SecretMap): Promise<void> {
  await mkdir(CLI_COMMANDER_DIR, { recursive: true });
  await writeFile(SECRETS_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function createAuthService(): AuthService {
  return {
    async get(service: string): Promise<string | null> {
      const secrets = await readSecrets();
      return secrets[service] ?? null;
    },
    async set(service: string, value: string): Promise<void> {
      const secrets = await readSecrets();
      secrets[service] = value;
      await writeSecrets(secrets);
    }
  };
}
