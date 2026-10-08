import { randomUUID } from "node:crypto";
import { compare, prerelease, rcompare, valid } from "semver";

export type UpdateChannel = "stable" | "prerelease";

export type AvailableRelease = {
  version: string;
  url: string;
  prerelease: boolean;
  publishedAt?: Date;
};

export type UpdateCheckState =
  | { status: "disabled" }
  | { status: "pending" }
  | { status: "current"; checkedAt: Date }
  | { status: "available"; checkedAt: Date; release: AvailableRelease }
  | { status: "unavailable"; lastAttemptAt: Date }
  | { status: "stale"; checkedAt: Date; lastAttemptAt: Date; release?: AvailableRelease };

export type GitHubRelease = {
  tag_name?: unknown;
  html_url?: unknown;
  draft?: unknown;
  prerelease?: unknown;
  published_at?: unknown;
};

type ValidRelease = AvailableRelease;

type FetchResult =
  | { kind: "not-modified"; retryAfterMs?: number }
  | { kind: "releases"; releases: GitHubRelease[]; etag?: string; retryAfterMs?: number };

export type UpdateCheckLogger = {
  warn: (details: { category: string; requestId: string }, message: string) => void;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type UpdateCheckServiceOptions = {
  enabled: boolean;
  channel: UpdateChannel;
  installedVersion: string;
  intervalHours: number;
  fetch?: FetchLike;
  now?: () => Date;
  setTimeout?: typeof setTimeout;
  clearTimeout?: typeof clearTimeout;
  logger?: UpdateCheckLogger;
};

const releasesEndpoint = "https://api.github.com/repos/P47ch/pennyworth/releases?per_page=20";
const githubApiVersion = "2022-11-28";
const maxResponseBytes = 256 * 1024;
const requestTimeoutMs = 5_000;

class UpdateCheckError extends Error {
  constructor(
    readonly category: string,
    readonly retryAfterMs?: number
  ) {
    super(category);
  }
}

function normalizeVersion(tag: string): string | null {
  const candidate = tag.startsWith("v") ? tag.slice(1) : tag;
  return valid(candidate);
}

function releaseUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "github.com" || !url.pathname.startsWith("/P47ch/pennyworth/releases/")) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function validateRelease(release: GitHubRelease): ValidRelease | null {
  if (release.draft === true || typeof release.tag_name !== "string" || typeof release.prerelease !== "boolean") {
    return null;
  }

  const version = normalizeVersion(release.tag_name);
  const url = releaseUrl(release.html_url);

  if (!version || !url) {
    return null;
  }

  const publishedAt =
    typeof release.published_at === "string" && !Number.isNaN(Date.parse(release.published_at))
      ? new Date(release.published_at)
      : undefined;

  return { version, url, prerelease: prerelease(version) !== null, publishedAt };
}

export function selectEligibleRelease(
  releases: GitHubRelease[],
  installedVersion: string,
  channel: UpdateChannel
): AvailableRelease | undefined {
  const installed = normalizeVersion(installedVersion);
  if (!installed) {
    throw new Error("Installed application version must be valid Semantic Versioning.");
  }

  const eligible = releases
    .map(validateRelease)
    .filter((release): release is ValidRelease => release !== null)
    .filter((release) => channel === "prerelease" || !release.prerelease)
    .sort((left, right) => rcompare(left.version, right.version));
  const selected = eligible[0];

  return selected && compare(selected.version, installed) > 0 ? selected : undefined;
}

function retryAfterMilliseconds(value: string | null, now: Date): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1_000);
  }

  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now.getTime());
}

function rateLimitWaitMilliseconds(headers: Headers, now: Date): number | undefined {
  const retryAfter = retryAfterMilliseconds(headers.get("retry-after"), now);
  if (retryAfter !== undefined) {
    return retryAfter;
  }

  if (headers.get("x-ratelimit-remaining") !== "0") {
    return undefined;
  }

  const resetAt = Number(headers.get("x-ratelimit-reset"));
  return Number.isFinite(resetAt) ? Math.max(0, resetAt * 1_000 - now.getTime()) : undefined;
}

async function boundedJson(response: Response): Promise<unknown> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxResponseBytes)) {
    throw new UpdateCheckError("response-too-large");
  }

  if (!response.body) {
    throw new UpdateCheckError("empty-response");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > maxResponseBytes) {
        await reader.cancel();
        throw new UpdateCheckError("response-too-large");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof UpdateCheckError) {
      throw error;
    }
    throw new UpdateCheckError("response-read-failed");
  }

  const text = new TextDecoder().decode(Buffer.concat(chunks));
  try {
    return JSON.parse(text);
  } catch {
    throw new UpdateCheckError("invalid-json");
  }
}

export async function fetchReleases(options: {
  installedVersion: string;
  etag?: string;
  signal: AbortSignal;
  fetch?: FetchLike;
  now?: () => Date;
}): Promise<FetchResult> {
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  const response = await fetchImplementation(releasesEndpoint, {
    signal: options.signal,
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": `Pennyworth/${options.installedVersion}`,
      "X-GitHub-Api-Version": githubApiVersion,
      ...(options.etag ? { "If-None-Match": options.etag } : {})
    }
  });
  const retryAfterMs = rateLimitWaitMilliseconds(response.headers, (options.now ?? (() => new Date()))());

  if (response.status === 304) {
    return { kind: "not-modified", retryAfterMs };
  }

  if (!response.ok) {
    throw new UpdateCheckError(`http-${response.status}`, retryAfterMs);
  }

  const payload = await boundedJson(response);
  if (!Array.isArray(payload)) {
    throw new UpdateCheckError("invalid-payload");
  }

  return {
    kind: "releases",
    releases: payload.filter((item): item is GitHubRelease => typeof item === "object" && item !== null),
    etag: response.headers.get("etag") ?? undefined,
    retryAfterMs
  };
}

export type UpdateCheckService = {
  getState: () => UpdateCheckState;
  refresh: () => Promise<UpdateCheckState>;
  start: () => void;
  stop: () => void;
};

export function createUpdateCheckService(options: UpdateCheckServiceOptions): UpdateCheckService {
  if (!Number.isInteger(options.intervalHours) || options.intervalHours < 1 || options.intervalHours > 168) {
    throw new Error("Update check interval must be between 1 and 168 hours.");
  }
  if (!normalizeVersion(options.installedVersion)) {
    throw new Error("Installed application version must be valid Semantic Versioning.");
  }

  const now = options.now ?? (() => new Date());
  const scheduleTimeout = options.setTimeout ?? setTimeout;
  const cancelTimeout = options.clearTimeout ?? clearTimeout;
  const intervalMs = options.intervalHours * 60 * 60 * 1_000;
  let state: UpdateCheckState = options.enabled ? { status: "pending" } : { status: "disabled" };
  let lastSuccessful: { checkedAt: Date; release?: AvailableRelease } | undefined;
  let etag: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let activeRefresh: Promise<UpdateCheckState> | undefined;
  let activeController: AbortController | undefined;
  let failures = 0;
  let stopped = false;

  function schedule(delayMs: number) {
    if (!options.enabled || stopped) {
      return;
    }
    if (timer) {
      cancelTimeout(timer);
    }
    timer = scheduleTimeout(() => {
      timer = undefined;
      void refresh();
    }, delayMs);
    timer.unref?.();
  }

  function successfulState(checkedAt: Date, release: AvailableRelease | undefined): UpdateCheckState {
    return release ? { status: "available", checkedAt, release } : { status: "current", checkedAt };
  }

  async function runRefresh(): Promise<UpdateCheckState> {
    const lastAttemptAt = now();
    activeController = new AbortController();
    const timeout = scheduleTimeout(() => activeController?.abort(), requestTimeoutMs);
    timeout.unref?.();

    try {
      const result = await fetchReleases({
        installedVersion: options.installedVersion,
        etag,
        signal: activeController.signal,
        fetch: options.fetch,
        now
      });
      const checkedAt = now();

      if (result.kind === "not-modified") {
        if (lastSuccessful) {
          lastSuccessful = { ...lastSuccessful, checkedAt };
          state = successfulState(checkedAt, lastSuccessful.release);
        } else {
          throw new UpdateCheckError("unexpected-not-modified", result.retryAfterMs);
        }
      } else {
        etag = result.etag;
        lastSuccessful = {
          checkedAt,
          release: selectEligibleRelease(result.releases, options.installedVersion, options.channel)
        };
        state = successfulState(lastSuccessful.checkedAt, lastSuccessful.release);
      }

      failures = 0;
      schedule(intervalMs);
      return state;
    } catch (error) {
      if (stopped) {
        return state;
      }
      failures += 1;
      const updateError = error instanceof UpdateCheckError ? error : new UpdateCheckError("request-failed");
      state = lastSuccessful
        ? {
            status: "stale",
            checkedAt: lastSuccessful.checkedAt,
            lastAttemptAt,
            ...(lastSuccessful.release ? { release: lastSuccessful.release } : {})
          }
        : { status: "unavailable", lastAttemptAt };
      options.logger?.warn({ category: updateError.category, requestId: randomUUID() }, "Update check failed");
      const backoffMs = Math.min(intervalMs * 8, 60_000 * 2 ** Math.min(failures, 8));
      schedule(Math.max(intervalMs, backoffMs, updateError.retryAfterMs ?? 0));
      return state;
    } finally {
      cancelTimeout(timeout);
      activeController = undefined;
    }
  }

  function refresh(): Promise<UpdateCheckState> {
    if (!options.enabled) {
      return Promise.resolve(state);
    }
    if (activeRefresh) {
      return activeRefresh;
    }
    activeRefresh = runRefresh().finally(() => {
      activeRefresh = undefined;
    });
    return activeRefresh;
  }

  return {
    getState: () => state,
    refresh,
    start: () => schedule(0),
    stop: () => {
      stopped = true;
      if (timer) {
        cancelTimeout(timer);
        timer = undefined;
      }
      activeController?.abort();
    }
  };
}
