export type WidgetMode = "BEGINNER" | "ADVANCED";

export type WidgetMeta = {
  sourceUsed: string;
  updatedAt: string;
  warnings?: string[];
  warning?: string;
  requestId?: string;
  endpointUrl?: string;
  upstreamStatus?: number;
  upstreamMessage?: string;
  cacheHit?: boolean;
  cacheAgeSeconds?: number;
  dataMode?: "live" | "fixture";
};

export type WidgetCommonProps = {
  widgetId: string;
  locked: boolean;
  mode: WidgetMode;
  config: Record<string, unknown>;
  viewerMode: "guest" | "signed_in";
  authConfigured: boolean;
  dbConfigured: boolean;
  onPersist: (next: { mode?: WidgetMode; config?: Record<string, unknown>; playerId?: string }) => Promise<void>;
  onReportBug: (bundle: Record<string, unknown>) => void;
  refreshTick: number;
  dataMode: "live" | "fixture";
  onDataModeChange: (next: "live" | "fixture") => Promise<void>;
};


