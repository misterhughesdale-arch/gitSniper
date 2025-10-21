"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMetrics = createMetrics;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
function createMetrics(options) {
    if (!options.enabled) {
        return createNoopClient();
    }
    const rng = options.random ?? Math.random;
    const clock = options.clock ?? Date.now;
    const reportFile = options.reportFilePath ? (0, node_path_1.resolve)(process.cwd(), options.reportFilePath) : undefined;
    if (reportFile) {
        const dir = (0, node_path_1.dirname)(reportFile);
        if (!(0, node_fs_1.existsSync)(dir)) {
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        }
    }
    const counters = new Map();
    const latencies = new Map();
    const recordLatency = (metric, valueMs) => {
        const stat = latencies.get(metric) ?? { count: 0, totalMs: 0, maxMs: 0 };
        stat.count += 1;
        stat.totalMs += valueMs;
        stat.maxMs = Math.max(stat.maxMs, valueMs);
        latencies.set(metric, stat);
    };
    const flush = (summary) => {
        const serialized = {
            timestamp: new Date(clock()).toISOString(),
            summary,
            counters: Object.fromEntries(counters),
            latencies: Object.fromEntries(Array.from(latencies.entries()).map(([metric, stat]) => [
                metric,
                {
                    count: stat.count,
                    avg_ms: Number((stat.totalMs / stat.count).toFixed(2)),
                    max_ms: stat.maxMs,
                },
            ])),
        };
        const payload = JSON.stringify(serialized);
        console.log(payload);
        if (reportFile) {
            (0, node_fs_1.appendFileSync)(reportFile, `${payload}\n`, { encoding: "utf8" });
        }
        counters.clear();
        latencies.clear();
    };
    return {
        observeLatency(metric, valueMs) {
            if (rng() > options.samplingRatio)
                return;
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
function createNoopClient() {
    const noop = () => {
        /* intentionally blank */
    };
    return {
        observeLatency: noop,
        incrementCounter: noop,
        reportLoopSummary: noop,
    };
}
