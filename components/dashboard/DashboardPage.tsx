"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import WidgetLibrary from "@/components/widgets/WidgetLibrary";
import TonightsSlateWidget from "@/components/widgets/TonightsSlateWidget";
import PlayerCardWidget from "@/components/widgets/PlayerCardWidget";
import WatchlistWidget from "@/components/widgets/WatchlistWidget";
import RbVsDlineWidget from "@/components/widgets/RbVsDlineWidget";
import DataHealthWidget from "@/components/widgets/DataHealthWidget";
import MlbNext7GamesWidget from "@/components/widgets/MlbNext7GamesWidget";
import MlbPitcherArsenalWidget from "@/components/widgets/MlbPitcherArsenalWidget";
<<<<<<< HEAD
import MlbSeriesTrackerWidget from "@/components/widgets/MlbSeriesTrackerWidget";
import MlbStartingPitcherMatchupWidget from "@/components/widgets/MlbStartingPitcherMatchupWidget";
import MlbSeasonStatsWidget from "@/components/widgets/MlbSeasonStatsWidget";
import MlbPlatoonAdvantageWidget from "@/components/widgets/MlbPlatoonAdvantageWidget";
import MlbRecentFormWidget from "@/components/widgets/MlbRecentFormWidget";
import MlbBullpenFatigueWidget from "@/components/widgets/MlbBullpenFatigueWidget";
import MlbRunExpectancyWidget from "@/components/widgets/MlbRunExpectancyWidget";
=======
import MlbStartingPitcherMatchupWidget from "@/components/widgets/MlbStartingPitcherMatchupWidget";
import MlbSeriesTrackerWidget from "@/components/widgets/MlbSeriesTrackerWidget";
import NbaTonightsSlateWidget from "@/components/widgets/NbaTonightsSlateWidget";
import NbaStandingsWidget from "@/components/widgets/NbaStandingsWidget";
>>>>>>> 5518813dbf8beb460abbc3bf1376ae9c65caee03
import TopBarAuth from "@/components/TopBarAuth";
import type { WidgetCommonProps } from "@/components/widgets/types";
import {
  addWidget as addGuestWidget,
  clearGuestDashboard,
  getGuestDashboard,
  removeWidget as removeGuestWidget,
  setGuestLayoutLock,
  updateLayout,
  type GuestWidgetInstance,
} from "@/lib/guest/guestDashboard";
import { resolveDataMode, type DataMode } from "@/lib/dataMode";

type Sport = "NFL" | "NBA" | "MLB";

type Dashboard = {
  id: string;
  title: string;
  layoutLocked: boolean;
  isPrivate: boolean;
  shareToken?: string | null;
};

type DashboardWidget = GuestWidgetInstance;

type DashboardResponse = {
  dashboard: Dashboard;
  widgets?: DashboardWidget[];
  guest?: boolean;
  error?: string;
};

type AuthSessionResponse = {
  user?: {
    id?: string;
  };
};

type ReportBugPayload = {
  meta?: {
    sourceUsed?: string;
    updatedAt?: string;
    requestId?: string;
  };
  warning?: unknown;
};

type Mode = "forced_guest" | "guest" | "signed_in";

const WIDGET_COMPONENTS: Record<string, (props: WidgetCommonProps) => JSX.Element | null> = {
  tonights_slate: (props) => <TonightsSlateWidget {...props} />,
  player_card: (props) => <PlayerCardWidget {...props} />,
  watchlist: (props) => <WatchlistWidget {...props} />,
  rb_vs_dline: (props) => <RbVsDlineWidget {...props} />,
  data_health: (props) => <DataHealthWidget {...props} />,
  mlb_next_7_games: (props) => <MlbNext7GamesWidget {...props} />,
  mlb_pitcher_arsenal: (props) => <MlbPitcherArsenalWidget {...props} />,
<<<<<<< HEAD
  mlb_series_tracker: (props) => <MlbSeriesTrackerWidget {...props} />,
  mlb_starting_pitcher_matchup: (props) => <MlbStartingPitcherMatchupWidget {...props} />,
  mlb_season_stats: (props) => <MlbSeasonStatsWidget {...props} />,
  mlb_platoon_advantage: (props) => <MlbPlatoonAdvantageWidget {...props} />,
  mlb_recent_form: (props) => <MlbRecentFormWidget {...props} />,
  mlb_bullpen_fatigue: (props) => <MlbBullpenFatigueWidget {...props} />,
  mlb_run_expectancy: (props) => <MlbRunExpectancyWidget {...props} />,
=======
  "mlb-starting-pitcher-matchup": (props) => <MlbStartingPitcherMatchupWidget {...props} />,
  "mlb-series-tracker": (props) => <MlbSeriesTrackerWidget {...props} />,
  nba_tonights_slate: (props) => <NbaTonightsSlateWidget {...props} />,
  nba_standings: (props) => <NbaStandingsWidget {...props} />,
>>>>>>> 5518813dbf8beb460abbc3bf1376ae9c65caee03
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function DashboardPage({
  authConfigured,
  dbConfigured,
}: {
  authConfigured: boolean;
  dbConfigured: boolean;
}) {
  const [sport] = useState<Sport>("NFL");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [mode, setMode] = useState<Mode>(authConfigured ? "guest" : "forced_guest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [preferenceDataMode, setPreferenceDataMode] = useState<DataMode>("auto");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [bugBundle, setBugBundle] = useState<Record<string, unknown> | null>(null);
  const [refreshAt, setRefreshAt] = useState(0);
  const loadRequestRef = useRef(0);

  const isGuestMode = mode !== "signed_in";
  const modeResolution = useMemo(
    () => resolveDataMode({
      preferenceDataMode,
      fallbackDataMode: "auto",
    }),
    [preferenceDataMode],
  );
  const dataMode = modeResolution.resolvedDataMode;

  const sortedWidgets = useMemo(
    () => [...widgets].sort((a, b) => a.y - b.y || a.x - b.x),
    [widgets],
  );

  const loadGuest = useCallback(() => {
    const guest = getGuestDashboard();
    setDashboard({
      id: "guest-dashboard",
      title: "Guest Dashboard",
      layoutLocked: guest.layoutLocked,
      isPrivate: true,
      shareToken: null,
    });
    setWidgets(guest.widgets);
    setPreferenceDataMode("auto");
    setLoading(false);
  }, []);

  const loadServerDashboard = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const payload = (await response.json()) as DashboardResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load dashboard");
      }

      if (requestId !== loadRequestRef.current) {
        return;
      }

      setDashboard(payload.dashboard);
      setWidgets((payload.widgets ?? []).map((widget) => ({ ...widget, config: widget.config ?? {} })));
      const pref = await fetch("/api/preferences/data-mode", { cache: "no-store" })
        .then((res) => res.json())
        .catch(() => ({ mode: "auto" }));
      setPreferenceDataMode(pref.mode === "fixture" || pref.mode === "live" || pref.mode === "auto" ? pref.mode : "auto");
    } catch (loadError) {
      setError(String(loadError));
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!authConfigured) {
      setMode("forced_guest");
      loadGuest();
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const session = (await response.json()) as AuthSessionResponse;
        if (cancelled) return;

        if (session.user?.id) {
          setMode("signed_in");
          await loadServerDashboard();
          return;
        }

        setMode("guest");
        loadGuest();
      } catch {
        if (cancelled) return;
        setMode("guest");
        loadGuest();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authConfigured, loadGuest, loadServerDashboard]);

  const addWidget = async (widgetType: string) => {
    if (isGuestMode) {
      const next: DashboardWidget = {
        id: `guest-${Date.now()}`,
        widgetType,
        mode: "BEGINNER",
        x: widgets.length % 4,
        y: Math.floor(widgets.length / 4),
        w: 1,
        h: 1,
        config: {},
      };

      const state = addGuestWidget(next);
      setWidgets(state.widgets);
      if (dashboard) {
        setDashboard({ ...dashboard, layoutLocked: state.layoutLocked });
      }
      setLibraryOpen(false);
      return;
    }

    const response = await fetch("/api/dashboard/widgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widgetType, sport, mode: "BEGINNER", config: {} }),
    });

    const payload = (await response.json()) as { error?: string; widget?: Partial<DashboardWidget> };
    if (!response.ok || !payload.widget?.id || !payload.widget.widgetType || !payload.widget.mode) {
      setError(payload.error ?? "Failed to add widget");
      return;
    }

    const created: DashboardWidget = {
      id: payload.widget.id,
      widgetType: payload.widget.widgetType,
      mode: payload.widget.mode,
      x: payload.widget.x ?? 0,
      y: payload.widget.y ?? 0,
      w: payload.widget.w ?? 1,
      h: payload.widget.h ?? 1,
      config: payload.widget.config ?? {},
    };

    setWidgets((current) => [...current, created]);
    setLibraryOpen(false);
  };

  const removeWidget = async (widgetId: string) => {
    if (dashboard?.layoutLocked) return;

    if (isGuestMode) {
      const state = removeGuestWidget(widgetId);
      setWidgets(state.widgets);
      return;
    }

    const response = await fetch(`/api/dashboard/widgets/${widgetId}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({ error: "Failed to remove widget" }))) as {
        error?: string;
      };
      setError(payload.error ?? "Failed to remove widget");
      return;
    }

    setWidgets((current) => current.filter((widget) => widget.id !== widgetId));
  };

  const moveWidget = async (widgetId: string, delta: number) => {
    if (dashboard?.layoutLocked) return;

    const target = widgets.find((widget) => widget.id === widgetId);
    if (!target) return;

    const nextY = Math.max(0, target.y + delta);
    const nextWidgets = widgets.map((widget) =>
      widget.id === widgetId ? { ...widget, y: nextY } : widget,
    );

    if (isGuestMode) {
      const state = updateLayout(nextWidgets);
      setWidgets(state.widgets);
      return;
    }

    const response = await fetch(`/api/dashboard/widgets/${widgetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ y: nextY }),
    });

    if (!response.ok) {
      setError("Failed to move widget");
      return;
    }

    setWidgets(nextWidgets);
  };

  const persistWidget = async (
    widgetId: string,
    next: { mode?: "BEGINNER" | "ADVANCED"; config?: Record<string, unknown>; playerId?: string },
  ) => {
    const widget = widgets.find((candidate) => candidate.id === widgetId);
    if (!widget) return;

    const nextWidget = {
      ...widget,
      mode: next.mode ?? widget.mode,
      config: next.config ?? widget.config,
    };

    if (isGuestMode) {
      const state = updateLayout(
        widgets.map((item) => (item.id === widgetId ? nextWidget : item)),
      );
      setWidgets(state.widgets);
      return;
    }

    const response = await fetch(`/api/dashboard/widgets/${widgetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: next.mode, config: next.config, playerId: next.playerId }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({ error: "Failed to update widget" }))) as {
        error?: string;
      };
      setError(payload.error ?? "Failed to update widget");
      return;
    }

    setWidgets((current) => current.map((item) => (item.id === widgetId ? nextWidget : item)));
  };

  const toggleLock = async () => {
    if (!dashboard) return;
    const nextLocked = !dashboard.layoutLocked;

    if (isGuestMode) {
      const state = setGuestLayoutLock(nextLocked);
      setDashboard({ ...dashboard, layoutLocked: state.layoutLocked });
      return;
    }

    const response = await fetch("/api/dashboard", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layoutLocked: nextLocked }),
    });
    if (!response.ok) {
      setError("Failed to toggle layout lock");
      return;
    }

    setDashboard({ ...dashboard, layoutLocked: nextLocked });
  };

  const resetDashboard = async () => {
    if (isGuestMode) {
      const state = clearGuestDashboard();
      setWidgets(state.widgets);
      if (dashboard) {
        setDashboard({ ...dashboard, layoutLocked: state.layoutLocked });
      }
      return;
    }

    const response = await fetch("/api/dashboard", { method: "DELETE" });
    if (!response.ok) {
      setError("Failed to reset dashboard");
      return;
    }

    setWidgets([]);
  };

  const refreshAll = useCallback(() => {
    const now = Date.now();
    if (now - refreshAt < 5000) {
      return;
    }
    setRefreshAt(now);
    setRefreshTick((current) => current + 1);
  }, [refreshAt]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      refreshAll();
    }, 60000);

    const onVisibility = () => {
      if (!document.hidden) {
        refreshAll();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshAll]);

  const copyBugBundle = async () => {
    if (!bugBundle) return;
    const health = await fetch(
      `/api/health/data?dataMode=${dataMode}&preferenceMode=${preferenceDataMode}`,
      { cache: "no-store" },
    )
      .then((res) => res.json())
      .catch(() => null);
    const bundle = {
      ...bugBundle,
      appInfo: {
        preferenceMode: preferenceDataMode,
        mode: health?.resolvedDataMode ?? dataMode,
        modeSource: health?.resolutionSource ?? modeResolution.source,
        user: isGuestMode ? "guest" : dashboard?.id,
      },
    };
    await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
  };

  if (loading) {
    return <div className="p-6">Loading dashboard...</div>;
  }

  const statusBanner = (() => {
    if (!dbConfigured) {
      return {
        tone: "amber" as const,
        text: "DB offline: DATABASE_URL is not configured. Running in guest/session-only mode.",
      };
    }
    if (mode === "signed_in") {
      return {
        tone: "emerald" as const,
        text: "Signed in: dashboard and widgets persist to database.",
      };
    }
    return {
      tone: "amber" as const,
      text: "Guest mode: dashboard resets when browser session ends. Sign in to save.",
    };
  })();

  return (
    <div className="min-h-screen bg-[#090c11] text-white">
      <header className="border-b border-neutral-800 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">NashBoard</h1>
            <p className="text-xs text-neutral-400">{dashboard?.title ?? "Dashboard"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              className="rounded border border-neutral-700 px-3 py-1"
              onClick={() => setLibraryOpen(true)}
              type="button"
            >
              Add Widget
            </button>
            <button className="rounded border border-neutral-700 px-3 py-1" onClick={() => refreshAll()} type="button">
              Refresh All
            </button>
            <button
              className="rounded border border-neutral-700 px-3 py-1"
              onClick={() => void resetDashboard()}
              type="button"
            >
              Reset Dashboard
            </button>
            <button
              className="rounded border border-neutral-700 px-3 py-1"
              onClick={() => void toggleLock()}
              type="button"
            >
              {dashboard?.layoutLocked ? "Unlock Layout" : "Lock Layout"}
            </button>
            {!isGuestMode && dashboard?.shareToken ? (
              <span className="text-neutral-400">Share: ?shareToken={dashboard.shareToken}</span>
            ) : null}
          </div>
        </div>
        <div className="mt-2">
          <TopBarAuth />
        </div>
      </header>

      <main className="p-6">
        {error ? (
          <p className="mb-3 rounded border border-red-500 bg-red-950 p-2 text-xs text-red-200">{error}</p>
        ) : null}
        <p className={`mb-3 text-xs ${statusBanner.tone === "emerald" ? "text-emerald-300" : "text-amber-300"}`}>
          {statusBanner.text}
        </p>
        {sortedWidgets.length === 0 ? (
          <p className="rounded border border-dashed border-neutral-700 p-4 text-sm text-neutral-400">
            Dashboard is blank. Open Add Widget to start.
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sortedWidgets.map((widget) => {
            const Component = WIDGET_COMPONENTS[widget.widgetType];
            return (
              <section key={widget.id} className="rounded-xl border border-neutral-800 bg-[#111827] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wide text-neutral-400">
                    {widget.widgetType.replaceAll("_", " ")}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-xs text-neutral-300"
                      onClick={() => void moveWidget(widget.id, -1)}
                      disabled={Boolean(dashboard?.layoutLocked)}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="text-xs text-neutral-300"
                      onClick={() => void moveWidget(widget.id, 1)}
                      disabled={Boolean(dashboard?.layoutLocked)}
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-300"
                      onClick={() => void removeWidget(widget.id)}
                      disabled={Boolean(dashboard?.layoutLocked)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {Component ? (
                  <Component
                    widgetId={widget.id}
                    locked={Boolean(dashboard?.layoutLocked)}
                    mode={widget.mode}
                    config={widget.config}
                    viewerMode={isGuestMode ? "guest" : "signed_in"}
                    authConfigured={authConfigured}
                    dbConfigured={dbConfigured}
                    refreshTick={refreshTick}
                    dataMode={dataMode}
                    preferenceDataMode={preferenceDataMode}
                    dataModeSource={modeResolution.source}
                    onPersist={(next) => persistWidget(widget.id, next)}
                    onReportBug={(bundle) => {
                      const parsed = bundle as ReportBugPayload;
                      setBugBundle({
                        widgetType: widget.widgetType,
                        sourceUsed: parsed.meta?.sourceUsed,
                        updatedTimestamp: parsed.meta?.updatedAt,
                        warnings: parsed.warning,
                        requestId: parsed.meta?.requestId,
                        widget,
                        bundle,
                      });
                    }}
                  />
                ) : (
                  <p className="text-xs text-neutral-500">Widget is not wired.</p>
                )}
              </section>
            );
          })}
        </div>
      </main>

      <WidgetLibrary
        open={libraryOpen}
        sport={sport}
        onClose={() => setLibraryOpen(false)}
        onAddWidget={(type) => void addWidget(type)}
      />

      {bugBundle ? (
        <div className="fixed inset-0 z-50 bg-black/60 p-4">
          <div className="mx-auto max-w-2xl rounded border border-neutral-700 bg-neutral-900 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium">Report a bug</p>
              <button
                type="button"
                className="rounded border border-neutral-700 px-2 py-1 text-xs"
                onClick={() => setBugBundle(null)}
              >
                Close
              </button>
            </div>
            <p className="text-xs text-neutral-400">
              Includes sourceUsed, updated timestamp, warnings, requestId, mode, and user context.
            </p>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-black/40 p-2 text-[11px]">
              {JSON.stringify(bugBundle, null, 2)}
            </pre>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[10px] text-neutral-500">Updated {to12h(new Date().toISOString())}</p>
              <button
                className="rounded border border-neutral-700 px-2 py-1 text-xs"
                type="button"
                onClick={() => void copyBugBundle()}
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

