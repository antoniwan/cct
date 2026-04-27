import chalk from "chalk";

import type { Command } from "../../../core/types.js";
import { getFlag, getNumberFlag, hasFlag, loadAgentFromSession } from "./client.js";

type FollowCandidate = {
  did: string;
  handle: string;
  displayName?: string;
  followUri: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  lastPostAt: string | null;
};

type CriteriaContext = {
  myFollowersCount: number;
  inactiveDays: number;
  maxFollowers: number | null;
  maxFollowing: number | null;
  maxPosts: number | null;
  lessFollowersThanMe: boolean;
  requireNoRecentPosts: boolean;
};

function daysSince(isoDate: string | null): number {
  if (!isoDate) {
    return Number.POSITIVE_INFINITY;
  }
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return Number.POSITIVE_INFINITY;
  }
  const diffMs = Date.now() - date.getTime();
  return diffMs / (1000 * 60 * 60 * 24);
}

function parseOptionalPositiveNumber(raw: string[], flag: string): number | null {
  const value = getFlag(raw, flag);
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`--${flag} must be a non-negative number.`);
  }
  return parsed;
}

function rkeyFromUri(uri: string): string {
  const parts = uri.split("/");
  return parts[parts.length - 1] || "";
}

async function getLastPostAt(agent: Awaited<ReturnType<typeof loadAgentFromSession>>, actor: string): Promise<string | null> {
  const feed = await agent.getAuthorFeed({ actor, limit: 1 });
  const item = feed.data.feed[0];
  if (!item) {
    return null;
  }
  return item.post.indexedAt ?? null;
}

export const command: Command = {
  name: "unfollow",
  description: "Unfollow users based on configurable criteria",
  run: async (ctx, args) => {
    const agent = await loadAgentFromSession(ctx);
    const rawArgs = (args?.rawArgs as string[]) ?? [];
    const me = agent.session?.did ?? agent.session?.handle;
    if (!me) {
      throw new Error("Unable to identify the logged-in account.");
    }

    const limit = getNumberFlag(rawArgs, "limit", 50);
    const dryRun = hasFlag(rawArgs, "dry-run");
    const inactiveDays = getNumberFlag(rawArgs, "inactive-days", 365);
    const matchMode = (getFlag(rawArgs, "match") ?? "all").toLowerCase();
    const lessFollowersThanMe = hasFlag(rawArgs, "less-followers-than-me");
    const requireNoRecentPosts = hasFlag(rawArgs, "no-posts-since");
    const examplePolicy = hasFlag(rawArgs, "example-policy");
    const maxFollowers = parseOptionalPositiveNumber(rawArgs, "max-followers");
    const maxFollowing = parseOptionalPositiveNumber(rawArgs, "max-following");
    const maxPosts = parseOptionalPositiveNumber(rawArgs, "max-posts");

    if (matchMode !== "all" && matchMode !== "any") {
      throw new Error("--match must be either 'all' or 'any'.");
    }

    // Enables the exact policy requested: lower follower count than me AND no posts in the last year.
    const finalLessFollowersThanMe = lessFollowersThanMe || examplePolicy;
    const finalRequireNoRecentPosts = requireNoRecentPosts || examplePolicy;
    const finalInactiveDays = examplePolicy ? 365 : inactiveDays;

    const myProfile = await agent.getProfile({ actor: me });
    const myFollowersCount = myProfile.data.followersCount ?? 0;

    console.log(chalk.cyan("🧹 Evaluating follows for unfollow rules..."));
    console.log(
      chalk.gray(
        `Mode=${matchMode.toUpperCase()} | limit=${limit} | dryRun=${dryRun ? "yes" : "no"}`
      )
    );

    const followsResponse = await agent.getFollows({ actor: me, limit });
    const follows = followsResponse.data.follows;
    if (follows.length === 0) {
      console.log(chalk.yellow("⚠️ You are not following anyone in the selected scope."));
      return;
    }

    const candidates: FollowCandidate[] = [];
    for (const followed of follows) {
      const followUri = followed.viewer?.following;
      if (!followUri) {
        continue;
      }
      const profile = await agent.getProfile({ actor: followed.did });
      const lastPostAt = await getLastPostAt(agent, followed.did);
      candidates.push({
        did: followed.did,
        handle: followed.handle,
        displayName: followed.displayName,
        followUri,
        followersCount: profile.data.followersCount ?? 0,
        followingCount: profile.data.followsCount ?? 0,
        postsCount: profile.data.postsCount ?? 0,
        lastPostAt
      });
    }

    const criteriaCtx: CriteriaContext = {
      myFollowersCount,
      inactiveDays: finalInactiveDays,
      maxFollowers,
      maxFollowing,
      maxPosts,
      lessFollowersThanMe: finalLessFollowersThanMe,
      requireNoRecentPosts: finalRequireNoRecentPosts
    };

    const matched = candidates.filter((candidate) => {
      const checks: boolean[] = [];
      if (criteriaCtx.lessFollowersThanMe) {
        checks.push(candidate.followersCount < criteriaCtx.myFollowersCount);
      }
      if (criteriaCtx.requireNoRecentPosts) {
        checks.push(daysSince(candidate.lastPostAt) >= criteriaCtx.inactiveDays);
      }
      if (criteriaCtx.maxFollowers !== null) {
        checks.push(candidate.followersCount <= criteriaCtx.maxFollowers);
      }
      if (criteriaCtx.maxFollowing !== null) {
        checks.push(candidate.followingCount <= criteriaCtx.maxFollowing);
      }
      if (criteriaCtx.maxPosts !== null) {
        checks.push(candidate.postsCount <= criteriaCtx.maxPosts);
      }
      if (checks.length === 0) {
        throw new Error(
          "No unfollow criteria provided. Add at least one filter, or use --example-policy."
        );
      }
      return matchMode === "all" ? checks.every(Boolean) : checks.some(Boolean);
    });

    if (matched.length === 0) {
      console.log(chalk.yellow("⚠️ No followed users matched your criteria."));
      return;
    }

    console.log(chalk.cyan(`🎯 Matched ${matched.length} user(s):`));
    for (const user of matched) {
      const label = user.displayName
        ? `${user.displayName} (@${user.handle})`
        : `@${user.handle}`;
      const inactiveFor = Math.floor(daysSince(user.lastPostAt));
      const inactiveText =
        Number.isFinite(inactiveFor) ? `${inactiveFor}d` : "no-posts";
      console.log(
        `- ${chalk.blue(label)} | followers=${user.followersCount} posts=${user.postsCount} inactive=${inactiveText}`
      );
    }

    if (dryRun) {
      console.log(chalk.green("✅ Dry-run complete. No unfollows were executed."));
      return;
    }

    let unfollowed = 0;
    for (const user of matched) {
      const rkey = rkeyFromUri(user.followUri);
      if (!rkey) {
        continue;
      }
      await agent.com.atproto.repo.deleteRecord({
        repo: agent.session?.did ?? "",
        collection: "app.bsky.graph.follow",
        rkey
      });
      unfollowed += 1;
      console.log(chalk.green(`✅ Unfollowed @${user.handle}`));
    }

    console.log(chalk.green(`🎉 Unfollow complete. Removed ${unfollowed} follow(s).`));
  }
};
