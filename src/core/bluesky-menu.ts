import { confirm, input, select } from "@inquirer/prompts";
import chalk from "chalk";

import { commandTree } from "./router.js";
import type { BlueskyCommandName } from "./bluesky-commands.js";

const BLUESKY_CMDS = commandTree.api.bluesky;

function isBlueskyCommand(s: string): s is BlueskyCommandName {
  return (BLUESKY_CMDS as readonly string[]).includes(s);
}

/**
 * After picking api → bluesky → <command>, user chooses which flags to pass.
 * Returns argv suffix only (e.g. `["--all", "--dry-run"]`).
 */
export async function promptBlueskyArgSuffix(command: string): Promise<string[]> {
  if (!isBlueskyCommand(command)) {
    return [];
  }

  console.log(
    chalk.gray(
      `\nOptions for \`cct api bluesky ${command}\` (or defaults / in-command prompts)\n`
    )
  );

  switch (command) {
    case "login": {
      console.log(
        chalk.gray("No command-line options — starting login (browser on localhost).\n")
      );
      return [];
    }

    case "post": {
      const mode = await select<"prompt" | "text">({
        message: "Post",
        choices: [
          { name: "Type post when prompted (default)", value: "prompt" },
          { name: "Pass --text now", value: "text" }
        ],
        default: "prompt"
      });
      if (mode === "text") {
        return ["--text", await input({ message: "Post text", required: true })];
      }
      return [];
    }

    case "read": {
      const mode = await select<"home" | "author" | "limit">({
        message: "Read",
        choices: [
          { name: "Home timeline (default limit 10)", value: "home" },
          { name: "Someone else's feed (set --actor)", value: "author" },
          { name: "Set --limit only (home)", value: "limit" }
        ],
        default: "home"
      });
      const out: string[] = [];
      if (mode === "author") {
        out.push("--actor", await input({ message: "Handle or DID", required: true }));
        if (
          await confirm({
            message: "Set a custom --limit?",
            default: false
          })
        ) {
          out.push(
            "--limit",
            await input({ message: "Limit", default: "20", required: true })
          );
        }
      } else if (mode === "limit") {
        out.push(
          "--limit",
          await input({ message: "Limit", default: "10", required: true })
        );
      } else if (
        await confirm({
          message: "Override default home timeline limit (10)?",
          default: false
        })
      ) {
        out.push(
          "--limit",
          await input({ message: "Limit", default: "10", required: true })
        );
      }
      return out;
    }

    case "extract": {
      const mode = await select<"defaults" | "out" | "full">({
        message: "Extract",
        choices: [
          {
            name: "Default file & limit (./bluesky-posts.json, limit 50)",
            value: "defaults"
          },
          { name: "Set --out only", value: "out" },
          { name: "Set --actor, --out, and --limit", value: "full" }
        ],
        default: "defaults"
      });
      if (mode === "defaults") {
        return [];
      }
      if (mode === "out") {
        return [
          "--out",
          await input({ message: "Output JSON path", default: "./bluesky-posts.json" })
        ];
      }
      const actor = await input({ message: "--actor (handle or DID)", required: true });
      const outPath = await input({
        message: "--out",
        default: "./bluesky-posts.json"
      });
      const limit = await input({ message: "--limit", default: "50" });
      return ["--actor", actor, "--out", outPath, "--limit", limit];
    }

    case "followers": {
      const mode = await select<"me" | "actor">({
        message: "Followers",
        choices: [
          { name: "List followers for me (default)", value: "me" },
          { name: "List for another account (set --actor and --limit)", value: "actor" }
        ],
        default: "me"
      });
      if (mode === "me") {
        if (await confirm({ message: "Set custom --limit?", default: false })) {
          return [
            "--limit",
            await input({ message: "Limit", default: "20", required: true })
          ];
        }
        return [];
      }
      return [
        "--actor",
        await input({ message: "Handle or DID", required: true }),
        "--limit",
        await input({ message: "Limit", default: "20", required: true })
      ];
    }

    case "unfollow": {
      const preset = await select<
        | "wizard"
        | "interactive"
        | "exampleDry"
        | "allExampleDry"
        | "nuclearDry"
        | "oneWayDry"
        | "throttleDry"
      >({
        message: "Unfollow (see README for the full flag list)",
        choices: [
          { name: "Full guided wizard (default — set criteria in prompts)", value: "wizard" },
          { name: "Force wizard (pass --interactive)", value: "interactive" },
          { name: "Example policy, dry-run", value: "exampleDry" },
          { name: "All follows: example policy, dry-run", value: "allExampleDry" },
          { name: "Nuclear: unfollow everyone, dry-run", value: "nuclearDry" },
          { name: "One-way: who do not follow back, dry-run", value: "oneWayDry" },
          { name: "Throttled + example policy, dry-run", value: "throttleDry" }
        ],
        default: "wizard"
      });
      const map: Record<typeof preset, string[]> = {
        wizard: [],
        interactive: ["--interactive"],
        exampleDry: ["--example-policy", "--dry-run"],
        allExampleDry: ["--all", "--example-policy", "--dry-run"],
        nuclearDry: ["--all", "--unfollow-everyone", "--dry-run"],
        oneWayDry: ["--all", "--unfollow-who-dont-follow-back", "--dry-run"],
        throttleDry: [
          "--all",
          "--example-policy",
          "--dry-run",
          "--throttle-ms",
          "50"
        ]
      };
      return map[preset];
    }

    case "auto-post": {
      const mode = await select<"prompt" | "flags">({
        message: "Auto-post",
        choices: [
          { name: "Type text, times, and interval when asked (default)", value: "prompt" },
          { name: "Set --text, --times, and --intervalSeconds", value: "flags" }
        ],
        default: "prompt"
      });
      if (mode === "flags") {
        return [
          "--text",
          await input({ message: "Text", required: true }),
          "--times",
          await input({ message: "How many times", default: "1", required: true }),
          "--intervalSeconds",
          await input({ message: "Seconds between posts", default: "60", required: true })
        ];
      }
      return [];
    }

    case "auto-follow": {
      const mode = await select<"dry" | "real">({
        message: "Auto-follow (requires --actor)",
        choices: [
          { name: "Real run: set --actor and --limit (no --dry-run)", value: "real" },
          { name: "Dry-run: set --actor, --limit, and --dry-run (recommended first)", value: "dry" }
        ],
        default: "dry"
      });
      const actor = await input({ message: "Handle or DID (--actor)", required: true });
      const limit = await input({ message: "Limit", default: "20" });
      if (mode === "dry") {
        return ["--actor", actor, "--limit", limit, "--dry-run"];
      }
      return ["--actor", actor, "--limit", limit];
    }

    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
}
