import express from "express";
import { createSnipeRouter } from "./routes/snipeRoute";
import { loadConfig } from "@fresh-sniper/config";
import { createRootLogger } from "@fresh-sniper/logging";
import { createMetrics } from "@fresh-sniper/metrics";
import { createSolanaClients } from "@fresh-sniper/solana-client";

export async function startServer() {
  // Load configuration
  const config = loadConfig();
  const logger = createRootLogger({ level: config.logging.level, destination: config.logging.file });
  const metrics = createMetrics({
    enabled: config.metrics.enabled,
    samplingRatio: config.metrics.sampling_ratio,
    reportFilePath: config.metrics.report_file,
  });

  // Initialize Solana clients
  logger.info({}, "initializing solana clients");
  const solanaClients = await createSolanaClients(config);
  logger.info(
    {
      rpcEndpoint: config.rpc.primary_url,
      traderPubkey: solanaClients.traderPublicKey.toBase58(),
      jitoEnabled: config.jito.bundle_enabled,
    },
    "solana clients initialized",
  );

  // Create Express app
  const app = express();
  app.use(express.json({ limit: "10kb" }));

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  // Mount snipe routes
  app.use("/v1/snipe", createSnipeRouter({ config, logger, metrics, solanaClients }));

  // Start server
  const server = app.listen(config.express.port, config.express.host, () => {
    logger.info({ host: config.express.host, port: config.express.port }, "hot-route server started");
  });

  return { app, server, solanaClients };
}

if (require.main === module) {
  startServer().catch((error) => {
    // Defensive log to ensure boot errors bubble up with context
    console.error("Failed to start hot-route server", error);
    process.exitCode = 1;
  });
}
