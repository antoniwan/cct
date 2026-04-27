import { select } from "@inquirer/prompts";
import chalk from "chalk";
import { Command as Commander } from "commander";

import { createAuthService } from "./auth.js";
import { commandTree, loadCommand } from "./router.js";
import { createStateService } from "./state.js";
import type { CommandPath } from "./router.js";
import type { Context } from "./types.js";

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
  const namespace = await select({
    message: "Select namespace",
    choices: [
      { name: "sys", value: "sys" },
      { name: "api", value: "api" }
    ]
  });

  if (namespace === "sys") {
    const cmd = await select({
      message: "Select sys command",
      choices: commandTree.sys.root.map((c) => ({ name: c, value: c }))
    });
    return ["sys", "root", cmd];
  }

  const service = await select({
    message: "Select API service",
    choices: Object.keys(commandTree.api).map((serviceName) => ({
      name: serviceName,
      value: serviceName
    }))
  });

  const commands = commandTree.api[service as keyof typeof commandTree.api];
  const cmd = await select({
    message: `Select ${service} command`,
    choices: commands.map((c) => ({ name: c, value: c }))
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
        "Invalid command. Try: cct sys update, cct api bluesky login, cct api bluesky post, cct api bluesky read, or cct api bluesky extract"
      );
    }

    const command = await loadCommand(path);
    await command.run(ctx, {
      options: opts,
      rawArgs: args
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error";
    console.error(chalk.red(`Error: ${message}`));
    if (opts.debug && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exitCode = 1;
  }
}
