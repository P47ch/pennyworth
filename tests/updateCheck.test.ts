import { describe, expect, it, vi } from "vitest";
import {
  createUpdateCheckService,
  fetchReleases,
  selectEligibleRelease,
  type GitHubRelease
} from "../src/services/updateCheck.js";

function release(tag: string, options: Partial<GitHubRelease> = {}): GitHubRelease {
  return {
    tag_name: tag,
    html_url: `https://github.com/P47ch/pennyworth/releases/tag/${tag}`,
    draft: false,
    prerelease: tag.includes("-"),
    published_at: "2026-09-18T12:00:00.000Z",
    ...options
  };
}

describe("update release selection", () => {
  it("uses Semantic Version precedence for prereleases and full releases", () => {
    expect(selectEligibleRelease([release("v0.8.0-alpha.2"), release("v0.8.0")], "0.8.0-alpha.1", "prerelease"))
      .toMatchObject({ version: "0.8.0" });
    expect(selectEligibleRelease([release("v0.8.1")], "0.8.1+build.1", "prerelease")).toBeUndefined();
  });

  it("excludes prereleases on the stable channel and ignores malformed releases", () => {
    expect(selectEligibleRelease([release("v0.8.1-alpha.1")], "0.8.0", "stable")).toBeUndefined();
    expect(selectEligibleRelease([release("v0.9.0-alpha.1", { prerelease: false })], "0.8.0", "stable")).toBeUndefined();
    expect(selectEligibleRelease([release("not-a-version"), release("v0.8.1", { draft: true })], "0.8.0", "prerelease"))
      .toBeUndefined();
    expect(selectEligibleRelease([release("v0.8.1", { html_url: "https://example.com/release" })], "0.8.0", "prerelease"))
      .toBeUndefined();
  });
});

describe("GitHub release client", () => {
  it("sends safe fixed headers, preserves ETags, and accepts 304 responses", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 304 }));
    const result = await fetchReleases({
      installedVersion: "0.8.0-alpha.1",
      etag: '"cached"',
      signal: new AbortController().signal,
      fetch
    });

    expect(result.kind).toBe("not-modified");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/P47ch/pennyworth/releases?per_page=20",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/vnd.github+json",
          "If-None-Match": '"cached"',
          "User-Agent": "Pennyworth/0.8.0-alpha.1"
        })
      })
    );
  });

  it("rejects oversized responses before parsing", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response("[]", { headers: { "content-length": String(256 * 1024 + 1) } })
    );

    await expect(
      fetchReleases({ installedVersion: "0.8.0", signal: new AbortController().signal, fetch })
    ).rejects.toThrow("response-too-large");
  });

  it("rejects an oversized streamed response and malformed JSON payloads", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(256 * 1024 + 1));
        controller.close();
      }
    });
    const streamFetch = vi.fn().mockResolvedValue(new Response(stream));
    const invalidJsonFetch = vi.fn().mockResolvedValue(new Response("not-json"));
    const invalidPayloadFetch = vi.fn().mockResolvedValue(new Response("{}"));
    const request = { installedVersion: "0.8.0", signal: new AbortController().signal };

    await expect(fetchReleases({ ...request, fetch: streamFetch })).rejects.toThrow("response-too-large");
    await expect(fetchReleases({ ...request, fetch: invalidJsonFetch })).rejects.toThrow("invalid-json");
    await expect(fetchReleases({ ...request, fetch: invalidPayloadFetch })).rejects.toThrow("invalid-payload");
  });

  it("uses GitHub rate-limit reset timing when Retry-After is absent", async () => {
    const now = new Date("2026-09-18T12:00:00.000Z");
    const fetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 403,
        headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(now.getTime() / 1_000 + 60) }
      })
    );

    await expect(
      fetchReleases({ installedVersion: "0.8.0", signal: new AbortController().signal, fetch, now: () => now })
    ).rejects.toMatchObject({ category: "http-403", retryAfterMs: 60_000 });
  });
});

describe("update check service", () => {
  it("does nothing while disabled", async () => {
    const fetch = vi.fn();
    const setTimeout = vi.fn();
    const service = createUpdateCheckService({
      enabled: false,
      channel: "prerelease",
      installedVersion: "0.8.0-alpha.1",
      intervalHours: 24,
      fetch,
      setTimeout: setTimeout as unknown as typeof globalThis.setTimeout
    });

    service.start();
    await expect(service.refresh()).resolves.toEqual({ status: "disabled" });
    expect(fetch).not.toHaveBeenCalled();
    expect(setTimeout).not.toHaveBeenCalled();
  });

  it("coalesces concurrent refreshes and retains successful cache when a later check fails", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([release("v0.8.0-alpha.2")]), { headers: { etag: '"first"' } })
      )
      .mockRejectedValueOnce(new Error("offline"));
    const service = createUpdateCheckService({
      enabled: true,
      channel: "prerelease",
      installedVersion: "0.8.0-alpha.1",
      intervalHours: 24,
      fetch
    });

    const first = service.refresh();
    const second = service.refresh();
    expect(first).toBe(second);
    await expect(first).resolves.toMatchObject({ status: "available", release: { version: "0.8.0-alpha.2" } });
    await expect(service.refresh()).resolves.toMatchObject({
      status: "stale",
      release: { version: "0.8.0-alpha.2" }
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps the cached update fresh on a 304 response", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([release("v0.8.0-alpha.2")]), { headers: { etag: '"first"' } }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    const service = createUpdateCheckService({
      enabled: true,
      channel: "prerelease",
      installedVersion: "0.8.0-alpha.1",
      intervalHours: 24,
      fetch
    });

    await service.refresh();
    await expect(service.refresh()).resolves.toMatchObject({ status: "available", release: { version: "0.8.0-alpha.2" } });
    expect(fetch.mock.calls[1]?.[1]?.headers).toMatchObject({ "If-None-Match": '"first"' });
  });

  it("recovers a stale cached update when GitHub returns 304", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([release("v0.8.0-alpha.2")]), { headers: { etag: '"first"' } }))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    const service = createUpdateCheckService({
      enabled: true,
      channel: "prerelease",
      installedVersion: "0.8.0-alpha.1",
      intervalHours: 24,
      fetch
    });

    await service.refresh();
    await expect(service.refresh()).resolves.toMatchObject({ status: "stale", release: { version: "0.8.0-alpha.2" } });
    await expect(service.refresh()).resolves.toMatchObject({ status: "available", release: { version: "0.8.0-alpha.2" } });
  });

  it("retains the last successful result across consecutive failures and backs off scheduled retries", async () => {
    const scheduled: Array<{ callback: () => void; delay: number }> = [];
    const setTimeout = ((callback: () => void, delay: number) => {
      scheduled.push({ callback, delay });
      return { unref() {} };
    }) as unknown as typeof globalThis.setTimeout;
    const service = createUpdateCheckService({
      enabled: true,
      channel: "prerelease",
      installedVersion: "0.8.0-alpha.1",
      intervalHours: 1,
      fetch: vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify([release("v0.8.0-alpha.2")]), { headers: { etag: '"first"' } }))
        .mockRejectedValue(new Error("offline")),
      setTimeout,
      clearTimeout: vi.fn() as unknown as typeof globalThis.clearTimeout
    });

    await expect(service.refresh()).resolves.toMatchObject({ status: "available", release: { version: "0.8.0-alpha.2" } });

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await expect(service.refresh()).resolves.toMatchObject({ status: "stale", release: { version: "0.8.0-alpha.2" } });
    }

    const retryDelays = scheduled.filter(({ delay }) => delay !== 5_000).map(({ delay }) => delay);
    expect(retryDelays.slice(0, 6)).toEqual(Array(6).fill(60 * 60 * 1_000));
    expect(retryDelays[6]).toBe(64 * 60 * 1_000);
  });

  it("aborts an active request for both timeout and shutdown", async () => {
    const scheduled: Array<{ callback: () => void; delay: number }> = [];
    const setTimeout = ((callback: () => void, delay: number) => {
      scheduled.push({ callback, delay });
      return { unref() {} };
    }) as unknown as typeof globalThis.setTimeout;
    const fetch = vi.fn((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      })
    );
    const service = createUpdateCheckService({
      enabled: true,
      channel: "prerelease",
      installedVersion: "0.8.0-alpha.1",
      intervalHours: 24,
      fetch,
      setTimeout,
      clearTimeout: vi.fn() as unknown as typeof globalThis.clearTimeout
    });

    const timeoutRefresh = service.refresh();
    scheduled.find(({ delay }) => delay === 5_000)?.callback();
    await expect(timeoutRefresh).resolves.toMatchObject({ status: "unavailable" });

    const shutdownRefresh = service.refresh();
    service.stop();
    await expect(shutdownRefresh).resolves.toEqual({ status: "unavailable", lastAttemptAt: expect.any(Date) });
  });
});
