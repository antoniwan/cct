import { checkbox, confirm, input, select } from "@inquirer/prompts";
import chalk from "chalk";

import type { Command } from "../../../core/types.js";
import {
  getCommaListFlag,
  getFlag,
  getNumberFlag,
  hasFlag,
  loadAgentFromSession
} from "./client.js";
import {
  buildEntryFromApi,
  canUseCachedProfile,
  loadProfileCache,
  saveProfileCache
} from "./profile-cache.js";

type FollowCandidate = {
  did: string;
  handle: string;
  displayName?: string;
  followUri: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  lastPostAt: string | null;
  /** `true` if this account follows you back (set when profile is loaded). */
  theyFollowMe?: boolean;
};

type CriteriaContext = {
  myFollowersCount: number;
  inactiveDays: number;
  maxFollowers: number | null;
  maxFollowing: number | null;
  maxPosts: number | null;
  minFollowers: number | null;
  minPosts: number | null;
  lessFollowersThanMe: boolean;
  requireNoRecentPosts: boolean;
  unfollowWhoDontFollowBack: boolean;
  excludeHandleSubstrings: string[];
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

function getNonNegativeFlag(rawArgs: string[], name: string, fallback: number): number {
  const raw = getFlag(rawArgs, name);
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`--${name} must be a non-negative number.`);
  }
  return parsed;
}

function rkeyFromUri(uri: string): string {
  const parts = uri.split("/");
  return parts[parts.length - 1] || "";
}

function isHandleExcluded(
  handle: string,
  substrings: string[]
): boolean {
  if (substrings.length === 0) {
    return false;
  }
  const h = (handle || "").toLowerCase();
  return substrings.some((s) => h.includes(s.toLowerCase()));
}

function isRetriableApiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    /fetch failed|network|econnreset|etimedout|eai_again|socket|aborted|timeout|429|502|503|504|rate|too many requests/i.test(
      msg
    )
  ) {
    return true;
  }
  const anyErr = err as { status?: number; $status?: number };
  const code = anyErr?.status ?? anyErr?.$status;
  if (code === 429 || code === 502 || code === 503 || code === 504) {
    return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withApiRetry<T>(
  label: string,
  fn: () => Promise<T>,
  maxAttempts = 5
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      if (attempt < maxAttempts && isRetriableApiError(err)) {
        const waitMs = Math.min(1500 * 2 ** (attempt - 1), 30_000);
        const detail = err instanceof Error ? err.message : String(err);
        console.log(
          chalk.yellow(
            `  ⚠ ${label} failed (attempt ${attempt}/${maxAttempts}). ${detail} — retrying in ${Math.round(waitMs / 1000)}s...`
          )
        );
        await sleep(waitMs);
        continue;
      }
      const detail = err instanceof Error ? err.message : String(err);
      if (attempt >= maxAttempts && isRetriableApiError(err)) {
        throw new Error(`${label} failed after ${maxAttempts} attempt(s): ${detail}`);
      }
      throw new Error(`${label} failed: ${detail}`);
    }
  }
  throw new Error(`${label}: internal retry error`);
}

async function getLastPostAt(
  agent: Awaited<ReturnType<typeof loadAgentFromSession>>,
  actor: string
): Promise<string | null> {
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
    const interactive = hasFlag(rawArgs, "interactive");
    const me = agent.session?.did ?? agent.session?.handle;
    if (!me) {
      throw new Error("Unable to identify the logged-in account.");
    }

    let limit = getNumberFlag(rawArgs, "limit", 50);
    let allMode = hasFlag(rawArgs, "all");
    let dryRun = hasFlag(rawArgs, "dry-run");
    let inactiveDays = getNumberFlag(rawArgs, "inactive-days", 365);
    let matchMode = (getFlag(rawArgs, "match") ?? "all").toLowerCase();
    let lessFollowersThanMe = hasFlag(rawArgs, "less-followers-than-me");
    let requireNoRecentPosts = hasFlag(rawArgs, "no-posts-since");
    let examplePolicy = hasFlag(rawArgs, "example-policy");
    let maxFollowers = parseOptionalPositiveNumber(rawArgs, "max-followers");
    let maxFollowing = parseOptionalPositiveNumber(rawArgs, "max-following");
    let maxPosts = parseOptionalPositiveNumber(rawArgs, "max-posts");
    const throttleMs = getNonNegativeFlag(rawArgs, "throttle-ms", 0);
    const noCache = hasFlag(rawArgs, "no-cache");
    const cacheTtlMinutes = getNonNegativeFlag(rawArgs, "cache-ttl-minutes", 60);
    const useProfileCache = !noCache && cacheTtlMinutes > 0;
    const cacheTtlMs = cacheTtlMinutes * 60 * 1000;
    let unfollowEveryone = hasFlag(rawArgs, "unfollow-everyone");
    const confirmUnfollowEveryone = hasFlag(rawArgs, "confirm-unfollow-everyone");
    let unfollowWhoDontFollowBack = hasFlag(rawArgs, "unfollow-who-dont-follow-back");
    const minFollowers = parseOptionalPositiveNumber(rawArgs, "min-followers");
    const minPosts = parseOptionalPositiveNumber(rawArgs, "min-posts");
    const excludeHandleSubstrings = getCommaListFlag(
      rawArgs,
      "exclude-handle-contains"
    );

    if (matchMode !== "all" && matchMode !== "any") {
      throw new Error("--match must be either 'all' or 'any'.");
    }

    const hasRuleCriteria =
      examplePolicy ||
      lessFollowersThanMe ||
      requireNoRecentPosts ||
      maxFollowers !== null ||
      maxFollowing !== null ||
      maxPosts !== null ||
      unfollowWhoDontFollowBack ||
      minFollowers !== null ||
      minPosts !== null;
    const hasAnyCriteria = hasRuleCriteria || unfollowEveryone;

    if (!hasAnyCriteria || interactive) {
      console.log(chalk.cyan("🧭 Interactive unfollow setup"));
      if (interactive) {
        const wantNuke = await confirm({
          message:
            "Nuclear: unfollow everyone in the scan (still respects --exclude-style patterns if you set them in your command)?",
          default: false
        });
        if (wantNuke) {
          unfollowEveryone = true;
        }
      }

      if (unfollowEveryone) {
        matchMode = "all";
        const rawLimit = await input({
          message: "How many followed accounts should be in the scan? (ignored in all mode)",
          default: String(limit),
          required: true
        });
        const parsedLimit = Number(rawLimit);
        if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
          throw new Error("Limit must be a positive number.");
        }
        limit = parsedLimit;

        allMode = await confirm({
          message: "Scan all followed accounts (full cleanup mode)?",
          default: allMode
        });

        dryRun = await confirm({
          message: "Run in dry-run first (strongly recommended)?",
          default: true
        });
      } else {
      examplePolicy = await confirm({
        message:
          "Use preset policy? (fewer followers than you AND no posts in last year)",
        default: examplePolicy
      });

      if (!examplePolicy) {
        const selected = await checkbox({
          message: "Select unfollow criteria",
          choices: [
            {
              name: "Account has fewer followers than me",
              value: "less-followers-than-me",
              checked: lessFollowersThanMe
            },
            {
              name: "No posts in last N days",
              value: "no-posts-since",
              checked: requireNoRecentPosts
            },
            {
              name: "Followers count <= max value",
              value: "max-followers",
              checked: maxFollowers !== null
            },
            {
              name: "Following count <= max value",
              value: "max-following",
              checked: maxFollowing !== null
            },
            {
              name: "Posts count <= max value",
              value: "max-posts",
              checked: maxPosts !== null
            },
            {
              name: "They do not follow me back (one-way follows only)",
              value: "unfollow-who-dont-follow-back",
              checked: unfollowWhoDontFollowBack
            }
          ]
        });

        lessFollowersThanMe = selected.includes("less-followers-than-me");
        requireNoRecentPosts = selected.includes("no-posts-since");
        unfollowWhoDontFollowBack = selected.includes(
          "unfollow-who-dont-follow-back"
        );

        if (selected.includes("no-posts-since")) {
          const rawDays = await input({
            message: "Inactive days threshold",
            default: String(inactiveDays),
            required: true
          });
          const parsedDays = Number(rawDays);
          if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
            throw new Error("Inactive days must be a positive number.");
          }
          inactiveDays = parsedDays;
        }

        if (selected.includes("max-followers")) {
          const raw = await input({
            message: "Max followers",
            default: maxFollowers !== null ? String(maxFollowers) : "100",
            required: true
          });
          const parsed = Number(raw);
          if (!Number.isFinite(parsed) || parsed < 0) {
            throw new Error("Max followers must be a non-negative number.");
          }
          maxFollowers = parsed;
        } else {
          maxFollowers = null;
        }

        if (selected.includes("max-following")) {
          const raw = await input({
            message: "Max following",
            default: maxFollowing !== null ? String(maxFollowing) : "100",
            required: true
          });
          const parsed = Number(raw);
          if (!Number.isFinite(parsed) || parsed < 0) {
            throw new Error("Max following must be a non-negative number.");
          }
          maxFollowing = parsed;
        } else {
          maxFollowing = null;
        }

        if (selected.includes("max-posts")) {
          const raw = await input({
            message: "Max posts",
            default: maxPosts !== null ? String(maxPosts) : "50",
            required: true
          });
          const parsed = Number(raw);
          if (!Number.isFinite(parsed) || parsed < 0) {
            throw new Error("Max posts must be a non-negative number.");
          }
          maxPosts = parsed;
        } else {
          maxPosts = null;
        }

        if (selected.length > 1) {
          matchMode = await select({
            message: "How should multiple criteria be combined?",
            choices: [
              { name: "ALL (AND) - user must match every selected rule", value: "all" },
              { name: "ANY (OR) - user can match any selected rule", value: "any" }
            ],
            default: matchMode as "all" | "any"
          });
        } else {
          matchMode = "all";
        }
      } else {
        matchMode = "all";
        inactiveDays = 365;
      }

      const rawLimit = await input({
        message: "How many followed accounts should be evaluated? (ignored in all mode)",
        default: String(limit),
        required: true
      });
      const parsedLimit = Number(rawLimit);
      if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
        throw new Error("Limit must be a positive number.");
      }
      limit = parsedLimit;

      allMode = await confirm({
        message: "Scan all followed accounts (full cleanup mode)?",
        default: allMode
      });

      dryRun = await confirm({
        message: "Run in dry-run mode (recommended)?",
        default: true
      });
      }
    }

    if (unfollowEveryone) {
      if (
        examplePolicy ||
        lessFollowersThanMe ||
        requireNoRecentPosts ||
        maxFollowers !== null ||
        maxFollowing !== null ||
        maxPosts !== null ||
        unfollowWhoDontFollowBack ||
        minFollowers !== null ||
        minPosts !== null
      ) {
        throw new Error(
          "Do not combine --unfollow-everyone with rule-based filters. Allowed with nuclear: --all, --limit, --dry-run, --exclude-handle-contains, --throttle-ms, --no-cache, --cache-ttl-minutes, --confirm-unfollow-everyone."
        );
      }
    }

    if (unfollowEveryone && !dryRun && !confirmUnfollowEveryone) {
      throw new Error(
        "Nuclear: run with --dry-run first. To actually unfollow everyone in the scan, add --confirm-unfollow-everyone (excludes in --exclude-handle-contains are still applied)."
      );
    }

    // Enables the exact policy requested: lower follower count than me AND no posts in the last year.
    const finalLessFollowersThanMe = lessFollowersThanMe || examplePolicy;
    const finalRequireNoRecentPosts = requireNoRecentPosts || examplePolicy;
    const finalInactiveDays = examplePolicy ? 365 : inactiveDays;
    const finalNeedLastPost = finalRequireNoRecentPosts && !unfollowEveryone;
    const needFollowBackInfo = unfollowWhoDontFollowBack;

    const myProfile = await withApiRetry("getProfile (me)", () =>
      agent.getProfile({ actor: me })
    );
    const myFollowersCount = myProfile.data.followersCount ?? 0;

    const accountDid = agent.session?.did ?? me;
    const profileCache = await loadProfileCache(ctx, accountDid);
    let cacheHits = 0;
    let cacheMisses = 0;

    console.log(chalk.cyan("🧹 Evaluating follows for unfollow rules..."));
    console.log(
      chalk.gray(
        `Mode=${matchMode.toUpperCase()} | scope=${allMode ? "ALL_FOLLOWS" : `LIMIT_${limit}`} | dryRun=${dryRun ? "yes" : "no"} | nuclear=${unfollowEveryone ? "yes" : "no"} | throttleMs=${throttleMs} | profileCache=${
          useProfileCache && !unfollowEveryone ? `${cacheTtlMinutes}m` : unfollowEveryone ? "skipped" : "off"
        }`
      )
    );
    if (throttleMs > 0) {
      console.log(
        chalk.gray(
          "  (pauses between accounts reduce rate limits; use --throttle-ms 0 to disable)"
        )
      );
    }
    console.log(chalk.gray("Step 1/4: Fetching followed accounts..."));

    const follows: Array<
      NonNullable<(Awaited<ReturnType<typeof agent.getFollows>>)["data"]["follows"]>[number]
    > = [];
    let cursor: string | undefined;
    let page = 0;
    do {
      const pageLimit = allMode ? 100 : limit - follows.length;
      if (!allMode && pageLimit <= 0) {
        break;
      }

      const response = await withApiRetry(`getFollows (page ${page + 1})`, () =>
        agent.getFollows({
          actor: me,
          limit: pageLimit,
          cursor
        })
      );
      page += 1;
      follows.push(...response.data.follows);
      cursor = response.data.cursor;
      console.log(
        chalk.gray(
          `  - page ${page}: +${response.data.follows.length} accounts (total ${follows.length})`
        )
      );
    } while (allMode ? Boolean(cursor) : follows.length < limit);

    if (follows.length === 0) {
      console.log(chalk.yellow("⚠️ You are not following anyone in the selected scope."));
      return;
    }

    const candidates: FollowCandidate[] = [];

    if (unfollowEveryone) {
      console.log(
        chalk.magenta(
          "Step 2/4: Nuclear path — no per-account profile API calls. Only follow list + excludes."
        )
      );
      for (const followed of follows) {
        const followUri = followed.viewer?.following;
        if (!followUri) {
          continue;
        }
        if (isHandleExcluded(followed.handle, excludeHandleSubstrings)) {
          continue;
        }
        candidates.push({
          did: followed.did,
          handle: followed.handle,
          displayName: followed.displayName,
          followUri,
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
          lastPostAt: null
        });
      }
    } else {
      const step2Label = finalNeedLastPost
        ? "Loading profiles + last post time"
        : "Loading profiles only (skipping feed; no inactive-post rule)";
      console.log(
        chalk.gray(`Step 2/4: ${step2Label} for ${follows.length} account(s)...`)
      );
      let profiled = 0;
      for (const [index, followed] of follows.entries()) {
        const followUri = followed.viewer?.following;
        if (!followUri) {
          profiled += 1;
          if (profiled % 10 === 0 || profiled === follows.length) {
            console.log(
              chalk.gray(
                `  - profiled ${profiled}/${follows.length} (cache ${cacheHits} hits, ${cacheMisses} API)`
              )
            );
          }
          continue;
        }
        const handleLabel = followed.handle || followed.did;
        const needLastPost = finalNeedLastPost;
        const cached = profileCache.entries[followed.did];
        if (
          useProfileCache &&
          canUseCachedProfile(
            cached,
            cacheTtlMs,
            needLastPost,
            needFollowBackInfo
          )
        ) {
          cacheHits += 1;
          candidates.push({
            did: followed.did,
            handle: followed.handle,
            displayName: followed.displayName,
            followUri,
            followersCount: cached!.followersCount,
            followingCount: cached!.followingCount,
            postsCount: cached!.postsCount,
            lastPostAt: needLastPost ? cached!.lastPostAt : null,
            theyFollowMe: cached?.theyFollowMe
          });
          profiled = index + 1;
          if (profiled % 10 === 0 || profiled === follows.length) {
            console.log(
              chalk.gray(
                `  - profiled ${profiled}/${follows.length} (cache ${cacheHits} hits, ${cacheMisses} API)`
              )
            );
          }
          if (throttleMs > 0 && index < follows.length - 1) {
            await sleep(throttleMs);
          }
          continue;
        }

        cacheMisses += 1;
        const profile = await withApiRetry(`getProfile @${handleLabel}`, () =>
          agent.getProfile({ actor: followed.did })
        );
        const lastPostAt = needLastPost
          ? await withApiRetry(`getAuthorFeed @${handleLabel}`, () => getLastPostAt(agent, followed.did))
          : null;
        const theyFollowMe = Boolean(
          (profile.data as { viewer?: { followedBy?: string } }).viewer?.followedBy
        );
        profileCache.entries[followed.did] = buildEntryFromApi({
          handle: followed.handle,
          followersCount: profile.data.followersCount ?? 0,
          followingCount: profile.data.followsCount ?? 0,
          postsCount: profile.data.postsCount ?? 0,
          lastPostFetched: needLastPost,
          lastPostAt: needLastPost ? lastPostAt : null,
          theyFollowMe
        });
        profileCache.accountDid = accountDid;

        candidates.push({
          did: followed.did,
          handle: followed.handle,
          displayName: followed.displayName,
          followUri,
          followersCount: profile.data.followersCount ?? 0,
          followingCount: profile.data.followsCount ?? 0,
          postsCount: profile.data.postsCount ?? 0,
          lastPostAt,
          theyFollowMe
        });
        profiled = index + 1;
        if (profiled % 10 === 0 || profiled === follows.length) {
          console.log(
            chalk.gray(
              `  - profiled ${profiled}/${follows.length} (cache ${cacheHits} hits, ${cacheMisses} API)`
            )
          );
        }
        if (throttleMs > 0 && index < follows.length - 1) {
          await sleep(throttleMs);
        }
      }

      if (useProfileCache) {
        profileCache.accountDid = accountDid;
        await saveProfileCache(ctx, profileCache);
        console.log(
          chalk.gray(
            `  Step 2 done: ${cacheHits} cache hit(s), ${cacheMisses} API fetch(es). Stale entries refresh after --cache-ttl-minutes (default 60, stored in state).`
          )
        );
      }
    }

    const criteriaCtx: CriteriaContext = {
      myFollowersCount,
      inactiveDays: finalInactiveDays,
      maxFollowers,
      maxFollowing,
      maxPosts,
      minFollowers,
      minPosts,
      lessFollowersThanMe: finalLessFollowersThanMe,
      requireNoRecentPosts: finalRequireNoRecentPosts,
      unfollowWhoDontFollowBack,
      excludeHandleSubstrings
    };

    console.log(chalk.gray("Step 3/4: Applying criteria filters..."));
    const matched = candidates.filter((candidate) => {
      if (isHandleExcluded(candidate.handle, criteriaCtx.excludeHandleSubstrings)) {
        return false;
      }
      if (unfollowEveryone) {
        return true;
      }
      const checks: boolean[] = [];
      if (criteriaCtx.unfollowWhoDontFollowBack) {
        checks.push(candidate.theyFollowMe === false);
      }
      if (criteriaCtx.lessFollowersThanMe) {
        checks.push(candidate.followersCount < criteriaCtx.myFollowersCount);
      }
      if (criteriaCtx.requireNoRecentPosts) {
        checks.push(daysSince(candidate.lastPostAt) >= criteriaCtx.inactiveDays);
      }
      if (criteriaCtx.maxFollowers !== null) {
        checks.push(candidate.followersCount <= criteriaCtx.maxFollowers!);
      }
      if (criteriaCtx.maxFollowing !== null) {
        checks.push(candidate.followingCount <= criteriaCtx.maxFollowing!);
      }
      if (criteriaCtx.maxPosts !== null) {
        checks.push(candidate.postsCount <= criteriaCtx.maxPosts!);
      }
      if (criteriaCtx.minFollowers !== null) {
        checks.push(candidate.followersCount >= criteriaCtx.minFollowers!);
      }
      if (criteriaCtx.minPosts !== null) {
        checks.push(candidate.postsCount >= criteriaCtx.minPosts!);
      }
      if (checks.length === 0) {
        throw new Error(
          "No unfollow criteria provided. Add filters, --example-policy, or --unfollow-everyone."
        );
      }
      return matchMode === "all" ? checks.every(Boolean) : checks.some(Boolean);
    });

    if (matched.length === 0) {
      console.log(chalk.yellow("⚠️ No followed users matched your criteria."));
      return;
    }

    if (unfollowEveryone) {
      console.log(
        chalk.cyan(
          `Summary: nuclear mode — ${matched.length} account(s) to unfollow from this scan (after excludes). No profile stats were loaded.`
        )
      );
    } else {
      console.log(
        chalk.cyan(
          `Summary: ${matched.length} of ${candidates.length} account(s) in this run matched your rules. Step 4 unfollows only that matched set, not your whole follow list.`
        )
      );
    }
    console.log(chalk.cyan(`🎯 Matched ${matched.length} user(s):`));
    for (const user of matched) {
      const label = user.displayName
        ? `${user.displayName} (@${user.handle})`
        : `@${user.handle}`;
      if (unfollowEveryone) {
        console.log(
          `- ${chalk.blue(label)} ${chalk.gray("(nuclear: stats not loaded)")}`
        );
        continue;
      }
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

    console.log(chalk.gray(`Step 4/4: Unfollowing ${matched.length} account(s)...`));
    let unfollowed = 0;
    for (const user of matched) {
      const rkey = rkeyFromUri(user.followUri);
      if (!rkey) {
        continue;
      }
      await withApiRetry(`deleteFollow @${user.handle}`, () =>
        agent.com.atproto.repo.deleteRecord({
          repo: agent.session?.did ?? "",
          collection: "app.bsky.graph.follow",
          rkey
        })
      );
      unfollowed += 1;
      console.log(
        chalk.green(`✅ Unfollowed @${user.handle} (${unfollowed}/${matched.length})`)
      );
    }

    console.log(chalk.green(`🎉 Unfollow complete. Removed ${unfollowed} follow(s).`));
  }
};
