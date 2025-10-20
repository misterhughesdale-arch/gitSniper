import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

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

interface LatencyStat {
  count: number;
  totalMs: number;
  maxMs: number;
}

export function createMetrics(options: MetricsOptions): MetricsClient {
  if (!options.enabled) {
    return createNoopClient();
  }

  const rng = options.random ?? Math.random;
  const clock = options.clock ?? Date.now;
  const reportFile = options.reportFilePath ? resolve(process.cwd(), options.reportFilePath) : undefined;

  if (reportFile) {
    const dir = dirname(reportFile);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  const counters = new Map<string, number>();
  const latencies = new Map<string, LatencyStat>();

  const recordLatency = (metric: string, valueMs: number) => {
    const stat = latencies.get(metric) ?? { count: 0, totalMs: 0, maxMs: 0 };
    stat.count += 1;
    stat.totalMs += valueMs;
    stat.maxMs = Math.max(stat.maxMs, valueMs);
    latencies.set(metric, stat);
  };

  const flush = (summary: Record<string, unknown>) => {
    const serialized = {
      timestamp: new Date(clock()).toISOString(),
      summary,
      counters: Object.fromEntries(counters),
      latencies: Object.fromEntries(
        Array.from(latencies.entries()).map(([metric, stat]) => [
          metric,
          {
            count: stat.count,
            avg_ms: Number((stat.totalMs / stat.count).toFixed(2)),
            max_ms: stat.maxMs,
          },
        ]),
      ),
    };

    const payload = JSON.stringify(serialized);
    console.log(payload);
    if (reportFile) {
      appendFileSync(reportFile, `${payload}\n`, { encoding: "utf8" });
    }

    counters.clear();
    latencies.clear();
  };

  return {
    observeLatency(metric, valueMs) {
      if (rng() > options.samplingRatio) return;
      recordLatency(metric, valueMs);
    },
    incrementCounter(metric, value = 1) {
      counters.set(metric, (counters.get(metric) ?? 0) + value);
    },
    reportLoopSummary(summary) {
      flush(summary);
    },
  };
}

function createNoopClient(): MetricsClient {
  const noop = () => {
    /* intentionally blank */
  };
  return {
    observeLatency: noop,
    incrementCounter: noop,
    reportLoopSummary: noop,
  };
}
