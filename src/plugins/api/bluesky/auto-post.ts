import { input } from "@inquirer/prompts";
import chalk from "chalk";

import type { Command } from "../../../core/types.js";
import { getFlag, getNumberFlag, loadAgentFromSession } from "./client.js";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export const command: Command = {
  name: "auto-post",
  description: "Publish repeated posts at a fixed interval",
  run: async (ctx, args) => {
    const agent = await loadAgentFromSession(ctx);
    const rawArgs = (args?.rawArgs as string[]) ?? [];
    const textFromFlag = getFlag(rawArgs, "text");
    const baseText =
      textFromFlag ??
      (await input({
        message: "Post text",
        required: true
      }));
    const times = getNumberFlag(rawArgs, "times", 1);
    const intervalSeconds = getNumberFlag(rawArgs, "intervalSeconds", 60);

    if (!baseText.trim()) {
      throw new Error("Post text cannot be empty.");
    }

    for (let i = 0; i < times; i += 1) {
      const payload = times > 1 ? `${baseText.trim()} (${i + 1}/${times})` : baseText.trim();
      await agent.post({ text: payload });
      console.log(chalk.green(`Posted ${i + 1}/${times}`));
      if (i < times - 1) {
        await wait(intervalSeconds * 1000);
      }
    }
  }
};
