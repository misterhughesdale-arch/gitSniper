import { Router } from "express";
import type { FreshSniperConfig } from "@fresh-sniper/config";
import type { Logger } from "@fresh-sniper/logging";
import type { MetricsClient } from "@fresh-sniper/metrics";
import type { SolanaClients } from "@fresh-sniper/solana-client";
import { createSnipeController } from "../controllers/snipeController";

interface Dependencies {
  config: FreshSniperConfig;
  logger: Logger;
  metrics: MetricsClient;
  solanaClients: SolanaClients;
}

export function createSnipeRouter(deps: Dependencies) {
  const router = Router();
  const controller = createSnipeController(deps);

  router.post("/buy", controller.buyHandler);
  router.post("/sell", controller.sellHandler);

  return router;
}
