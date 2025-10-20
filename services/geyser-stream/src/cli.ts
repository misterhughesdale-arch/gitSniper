import { loadConfig } from "@fresh-sniper/config";
import { createRootLogger } from "@fresh-sniper/logging";
import { createMetrics } from "@fresh-sniper/metrics";
import { startGeyserService } from "./index";

async function main() {
  const config = loadConfig();
  const logger = createRootLogger({ level: config.logging.level, destination: config.logging.file });
  const metrics = createMetrics({
    enabled: config.metrics.enabled,
    samplingRatio: config.metrics.sampling_ratio,
    reportFilePath: config.metrics.report_file,
  });

  logger.info({ endpoint: config.geyser.endpoint }, "booting geyser stream service");

  const service = await startGeyserService({ config, logger, metrics });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "shutting down geyser service");
    service.stop();
    service.eventBus.removeAllListeners();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("Failed to start geyser service", error);
  process.exitCode = 1;
});
