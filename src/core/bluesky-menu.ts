import { confirm, input, select } from "@inquirer/prompts";
import chalk from "chalk";

import { commandTree } from "./router.js";
import type { BlueskyCommandName } from "./bluesky-commands.js";

const BLUESKY_CMDS = commandTree.api.bluesky;

function isBlueskyCommand(s: string): s is BlueskyCommandName {
  return (BLUESKY_CMDS as readonly string[]).includes(s);
}

type ExecutionMode = "dry" | "live";

/**
 * @returns "dry" = pass `--dry-run` (or stay in preview). "live" = no `--dry-run`.
 */
async function chooseBlueskyExecutionMode(opts: {
  label: string;
  /** Pre-selected list item (e.g. prefer live for auto-follow). */
  defaultMode: ExecutionMode;
  liveConfirmMessage?: string;
}): Promise<ExecutionMode> {
  const mode = await select<ExecutionMode>({
    message: `${opts.label} — how should this run?`,
    choices: [
      { name: "Dry-run — preview / no real changes to follows", value: "dry" },
      { name: "Live — apply for real (unfollows / follows as implemented)", value: "live" }
    ],
    default: opts.defaultMode
  });
  if (mode === "dry") {
    return "dry";
  }
  const message =
    opts.liveConfirmMessage ??
    "This performs real follow/unfollow actions (not a preview). Continue?";
  const ok = await confirm({ message, default: false });
  if (!ok) {
    console.log(
      chalk.yellow("Using dry-run instead. Re-run the menu and choose live when you are ready.")
    );
    return "dry";
  }
  return "live";
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
      const scenario = await select<
        | "wizard"
        | "interactive"
        | "example"
        | "allExample"
        | "nuclear"
        | "oneWay"
        | "throttle"
      >({
        message: "Unfollow (see README for the full flag list)",
        choices: [
          { name: "Full guided wizard (default — set criteria in prompts)", value: "wizard" },
          { name: "Force wizard (pass --interactive)", value: "interactive" },
          { name: "Example policy (rule-based, non-wizard)", value: "example" },
          { name: "All follows: example policy (scan all follows)", value: "allExample" },
          { name: "Nuclear: unfollow everyone in scan (dangerous)", value: "nuclear" },
          { name: "One-way: who do not follow you back", value: "oneWay" },
          { name: "Throttled + example policy (rate-limit friendly)", value: "throttle" }
        ],
        default: "wizard"
      });
      if (scenario === "wizard") {
        return [];
      }
      if (scenario === "interactive") {
        return ["--interactive"];
      }

      const execution = await chooseBlueskyExecutionMode({
        label: "Unfollow",
        defaultMode: "dry",
        liveConfirmMessage:
          scenario === "nuclear"
            ? "Nuclear: this will attempt to unfollow every account in the scan (after excludes). This is hard to undo. Continue?"
            : "This will unfollow accounts for real according to the flags you chose. Continue?"
      });

      let flags: string[];
      switch (scenario) {
        case "example":
          flags = ["--example-policy"];
          break;
        case "allExample":
          flags = ["--all", "--example-policy"];
          break;
        case "nuclear":
          flags = ["--all", "--unfollow-everyone"];
          break;
        case "oneWay":
          flags = ["--all", "--unfollow-who-dont-follow-back"];
          break;
        case "throttle":
          flags = ["--all", "--example-policy", "--throttle-ms", "50"];
          break;
        default: {
          const _ex: never = scenario;
          return _ex;
        }
      }
      if (execution === "dry") {
        return [...flags, "--dry-run"];
      }
      if (scenario === "nuclear") {
        return [...flags, "--confirm-unfollow-everyone"];
      }
      return flags;
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
      const actor = await input({ message: "Handle or DID (--actor)", required: true });
      const limit = await input({ message: "Limit", default: "20" });
      const execution = await chooseBlueskyExecutionMode({
        label: "Auto-follow",
        defaultMode: "live",
        liveConfirmMessage: "This will follow accounts for real (subject to the command’s rules). Continue?"
      });
      if (execution === "dry") {
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
