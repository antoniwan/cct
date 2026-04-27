import { writeFile } from "node:fs/promises";
import chalk from "chalk";

import type { Command } from "../../../core/types.js";
import { getFlag, getNumberFlag, loadAgentFromSession } from "./client.js";

type ExtractedPost = {
  uri: string;
  cid: string;
  author: string;
  indexedAt: string;
  text: string;
};

export const command: Command = {
  name: "extract",
  description: "Extract Bluesky posts to a local JSON file",
  run: async (ctx, args) => {
    const agent = await loadAgentFromSession(ctx);
    const rawArgs = (args?.rawArgs as string[]) ?? [];
    const actor = getFlag(rawArgs, "actor");
    const out = getFlag(rawArgs, "out") ?? "./bluesky-posts.json";
    const limit = getNumberFlag(rawArgs, "limit", 50);

    const feed = actor
      ? (await agent.getAuthorFeed({ actor, limit })).data.feed
      : (await agent.getTimeline({ limit })).data.feed;

    const posts: ExtractedPost[] = feed.map((item) => {
      const record = item.post.record;
      return {
        uri: item.post.uri,
        cid: item.post.cid,
        author: item.post.author.handle,
        indexedAt: item.post.indexedAt,
        text: record && "text" in record ? String(record.text) : ""
      };
    });

    console.log(chalk.cyan(`📦 Extracting ${posts.length} posts...`));
    await writeFile(out, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
    console.log(chalk.green(`✅ Extracted ${posts.length} posts to ${out}`));
  }
};
