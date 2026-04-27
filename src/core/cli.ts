import { select } from "@inquirer/prompts";
import chalk from "chalk";
import { Command as Commander } from "commander";

import { createAuthService } from "./auth.js";
import { BLUESKY_COMMAND_LABELS } from "./bluesky-commands.js";
import { promptBlueskyArgSuffix } from "./bluesky-menu.js";
import { commandTree, loadCommand } from "./router.js";
import { createStateService } from "./state.js";
import type { CommandPath } from "./router.js";
import type { Context } from "./types.js";

const SYS_COMMAND_LABELS: Record<string, string> = {
  update: "🔧 update - Update local tooling on this machine"
};

const API_SERVICE_LABELS: Record<string, string> = {
  bluesky: "🦋 bluesky - Social API actions from CLI"
};

/** Recreates the argv a user would type for this path, so `rawArgs` is consistent in interactive mode. */
function pathToRawArgs(path: CommandPath): string[] {
  if (path[0] === "sys") {
    return ["sys", path[2]];
  }
  return ["api", path[1], path[2]];
}

function makeContext(debug: boolean): Context {
  return {
    auth: createAuthService(),
    state: createStateService(),
    log: (msg: string) => console.log(chalk.cyan(msg)),
    debug
  };
}

function parsePath(input: string[]): CommandPath | null {
  if (input.length === 0) {
    return null;
  }

  const [namespace, groupOrCommand, maybeCommand] = input;

  if (!namespace || !groupOrCommand) {
    return null;
  }

  if (namespace === "sys") {
    return ["sys", "root", groupOrCommand];
  }

  if (namespace === "api") {
    if (!maybeCommand) {
      return null;
    }
    return ["api", groupOrCommand, maybeCommand];
  }

  return null;
}

async function interactivePath(): Promise<CommandPath> {
  console.log(
    chalk.cyanBright.bold("🚀 CLI COMMANDER TOOL") +
      chalk.gray("  —  local automation with style")
  );
  console.log(chalk.gray("Choose your adventure below.\n"));

  const namespace = await select({
    message: "✨ Choose a workspace",
    choices: [
      { name: "🛠️  sys - Local system operations", value: "sys" },
      { name: "🌐 api - Connected API services", value: "api" }
    ]
  });

  if (namespace === "sys") {
    const cmd = await select({
      message: "🧰 Pick a system command",
      choices: commandTree.sys.root.map((c) => ({
        name: SYS_COMMAND_LABELS[c] ?? c,
        value: c
      }))
    });
    return ["sys", "root", cmd];
  }

  const service = await select({
    message: "🔌 Pick an API service",
    choices: Object.keys(commandTree.api).map((serviceName) => ({
      name: API_SERVICE_LABELS[serviceName] ?? serviceName,
      value: serviceName
    }))
  });

  const commands = commandTree.api[service as keyof typeof commandTree.api];
  const cmd = await select({
    message: `🎯 Choose ${service} action`,
    choices: commands.map((c) => ({
      name:
        service === "bluesky" ? (BLUESKY_COMMAND_LABELS[c] ?? c) : c,
      value: c
    }))
  });

  return ["api", service, cmd];
}

export async function runCli(argv: string[]): Promise<void> {
  const program = new Commander();
  program
    .name("cct")
    .description("CLI Commander Tool local automation CLI")
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .option("--debug", "show full errors")
    .argument("[namespace]")
    .argument("[groupOrCommand]")
    .argument("[command]");

  program.parse(argv);

  const opts = program.opts<{ debug?: boolean }>();
  const args = program.args.filter((arg) => typeof arg === "string");
  const ctx = makeContext(Boolean(opts.debug));

  try {
    const path = args.length > 0 ? parsePath(args) : await interactivePath();
    if (!path) {
      throw new Error(
        "Invalid command. Try one of: cct sys update, cct api bluesky login, cct api bluesky post, cct api bluesky read, cct api bluesky extract, cct api bluesky followers, cct api bluesky unfollow"
      );
    }

    const command = await loadCommand(path);

    let rawArgs: string[];
    if (args.length > 0) {
      rawArgs = args;
    } else {
      const base = pathToRawArgs(path);
      if (path[0] === "api" && path[1] === "bluesky") {
        const extra = await promptBlueskyArgSuffix(path[2]);
        rawArgs = [...base, ...extra];
      } else {
        rawArgs = base;
      }
    }

    await command.run(ctx, {
      options: opts,
      rawArgs
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error";
    console.error(chalk.red(`❌ Error: ${message}`));
    if (opts.debug && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exitCode = 1;
  }
}
