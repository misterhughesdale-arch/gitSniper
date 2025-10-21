export interface MetricsOptions {
    enabled: boolean;
    samplingRatio: number;
    reportFilePath?: string;
    clock?: () => number;
    random?: () => number;
}
export interface MetricsClient {
    observeLatency: (metric: string, valueMs: number) => void;
    incrementCounter: (metric: string, value?: number) => void;
    reportLoopSummary: (summary: Record<string, unknown>) => void;
}
export declare function createMetrics(options: MetricsOptions): MetricsClient;
