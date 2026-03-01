import { describe, expect, it } from "vitest";
import { shouldUseServerWatchlist } from "@/components/widgets/WatchlistWidget";

describe("watchlist mode selection", () => {
  it("does not use server routes when auth/db are missing", () => {
    expect(
      shouldUseServerWatchlist({
        viewerMode: "guest",
        authConfigured: false,
        dbConfigured: false,
      }),
    ).toBe(false);

    expect(
      shouldUseServerWatchlist({
        viewerMode: "signed_in",
        authConfigured: true,
        dbConfigured: false,
      }),
    ).toBe(false);
  });

  it("uses server routes only for signed-in with auth+db configured", () => {
    expect(
      shouldUseServerWatchlist({
        viewerMode: "signed_in",
        authConfigured: true,
        dbConfigured: true,
      }),
    ).toBe(true);
  });
});
