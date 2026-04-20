export type PredictionPayload = {
  pointEstimate: number;
  rangeLow: number;
  rangeHigh: number;
  confidenceLabel: "low" | "medium" | "high";
  explanation: string;
  keyFactors: string[];
  inputs: Record<string, unknown>;
  sources: string[];
  generatedAt: string;
  isFallback: boolean;
  fallbackReason?: string;
};

export type BeginnerPredictionView = Pick<
  PredictionPayload,
  "pointEstimate" | "rangeLow" | "rangeHigh" | "confidenceLabel" | "explanation" | "isFallback"
>;

export type AdvancedPredictionView = PredictionPayload;
