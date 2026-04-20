export type AIAnalysisPayload = {
  summary: string;
  keyPoints: string[];
  caveats: string[];
  sources: string[];
  generatedAt: string;
  isFallback: boolean;
  fallbackReason?: string;
};
