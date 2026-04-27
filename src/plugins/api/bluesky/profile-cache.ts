import type { Context } from "../../../core/types.js";

const STATE_KEY = "bluesky_unfollow_profile_cache";

export type ProfileCacheEntry = {
  handle: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  /** When false, `lastPostAt` was not loaded; do not use for inactivity rules. */
  lastPostFetched: boolean;
  lastPostAt: string | null;
  cachedAt: string;
};

type ProfileCacheStore = {
  version: 1;
  accountDid: string;
  entries: Record<string, ProfileCacheEntry>;
};

function emptyStore(accountDid: string): ProfileCacheStore {
  return { version: 1, accountDid, entries: {} };
}

function isValidStore(raw: unknown): raw is ProfileCacheStore {
  if (!raw || typeof raw !== "object") {
    return false;
  }
  const s = raw as ProfileCacheStore;
  return s.version === 1 && typeof s.accountDid === "string" && typeof s.entries === "object";
}

export async function loadProfileCache(ctx: Context, accountDid: string): Promise<ProfileCacheStore> {
  const raw = await ctx.state.get<unknown>(STATE_KEY);
  if (!isValidStore(raw) || raw.accountDid !== accountDid) {
    return emptyStore(accountDid);
  }
  return raw;
}

export async function saveProfileCache(ctx: Context, store: ProfileCacheStore): Promise<void> {
  await ctx.state.set(STATE_KEY, store);
}

export function isCacheEntryFresh(
  entry: ProfileCacheEntry | undefined,
  ttlMs: number
): boolean {
  if (!entry) {
    return false;
  }
  if (ttlMs <= 0) {
    return false;
  }
  const t = new Date(entry.cachedAt).getTime();
  if (Number.isNaN(t)) {
    return false;
  }
  return Date.now() - t < ttlMs;
}

export function buildEntryFromApi(args: {
  handle: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  lastPostFetched: boolean;
  lastPostAt: string | null;
}): ProfileCacheEntry {
  return {
    handle: args.handle,
    followersCount: args.followersCount,
    followingCount: args.followingCount,
    postsCount: args.postsCount,
    lastPostFetched: args.lastPostFetched,
    lastPostAt: args.lastPostAt,
    cachedAt: new Date().toISOString()
  };
}

function hasSafeLastPostData(entry: ProfileCacheEntry): boolean {
  return entry.lastPostFetched === true;
}

/** When `needLastPost` is true, cache must include a real feed snapshot (inactivity rules). */
export function canUseCachedProfile(
  entry: ProfileCacheEntry | undefined,
  ttlMs: number,
  needLastPost: boolean
): boolean {
  if (!entry) {
    return false;
  }
  if (ttlMs <= 0) {
    return false;
  }
  if (!isCacheEntryFresh(entry, ttlMs)) {
    return false;
  }
  if (needLastPost && !hasSafeLastPostData(entry)) {
    return false;
  }
  if (!needLastPost) {
    return true;
  }
  return hasSafeLastPostData(entry);
}
