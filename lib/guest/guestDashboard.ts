"use client";

export type GuestWidgetInstance = {
  id: string;
  widgetType: string;
  mode: "BEGINNER" | "ADVANCED";
  x: number;
  y: number;
  w: number;
  h: number;
  config: Record<string, unknown>;
};

export type GuestDashboardState = {
  widgets: GuestWidgetInstance[];
  layoutLocked: boolean;
};

const KEY = "nashboard_guest_dashboard_v2";

const defaultState: GuestDashboardState = {
  widgets: [],
  layoutLocked: false,
};

function isClient(): boolean {
  return typeof window !== "undefined";
}

export function getGuestDashboard(): GuestDashboardState {
  if (!isClient()) {
    return defaultState;
  }

  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) {
    return defaultState;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<GuestDashboardState>;
    return {
      widgets: Array.isArray(parsed.widgets) ? parsed.widgets : [],
      layoutLocked: Boolean(parsed.layoutLocked),
    };
  } catch {
    return defaultState;
  }
}

export function saveGuestDashboard(state: GuestDashboardState): void {
  if (!isClient()) return;
  window.sessionStorage.setItem(KEY, JSON.stringify(state));
}

export function addWidget(instance: GuestWidgetInstance): GuestDashboardState {
  const current = getGuestDashboard();
  const next = { ...current, widgets: [...current.widgets, instance] };
  saveGuestDashboard(next);
  return next;
}

export function removeWidget(id: string): GuestDashboardState {
  const current = getGuestDashboard();
  const next = { ...current, widgets: current.widgets.filter((w) => w.id !== id) };
  saveGuestDashboard(next);
  return next;
}

export function updateLayout(widgets: GuestWidgetInstance[]): GuestDashboardState {
  const current = getGuestDashboard();
  const next = { ...current, widgets };
  saveGuestDashboard(next);
  return next;
}

export function setGuestLayoutLock(layoutLocked: boolean): GuestDashboardState {
  const current = getGuestDashboard();
  const next = { ...current, layoutLocked };
  saveGuestDashboard(next);
  return next;
}

export function clearGuestDashboard(): GuestDashboardState {
  saveGuestDashboard(defaultState);
  return defaultState;
}
