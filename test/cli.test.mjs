import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("cct api bluesky post fails with helpful message when not logged in", () => {
  const tempHome = mkdtempSync(join(tmpdir(), "cct-test-home-"));

  try {
    const cliPath = fileURLToPath(new URL("../dist/index.js", import.meta.url));
    const result = spawnSync(
      process.execPath,
      [cliPath, "api", "bluesky", "post", "--text", "hello world"],
      {
        encoding: "utf8",
        env: { ...process.env, HOME: tempHome }
      }
    );

    assert.equal(result.status, 1, "CLI should exit with non-zero status");
    assert.match(
      result.stderr,
      /Missing Bluesky token\. Run: cct api bluesky login/,
      "CLI should guide user to login first"
    );
  } finally {
    rmSync(tempHome, { recursive: true, force: true });
  }
});
