import { EventEmitter } from "events";
import type { FreshSniperConfig } from "@fresh-sniper/config";
import type { Logger } from "@fresh-sniper/logging";
import type { MetricsClient } from "@fresh-sniper/metrics";
import { subscribePumpfunCreations } from "./subscriptions/pumpfunCreations";

export interface GeyserServiceDeps {
  config: FreshSniperConfig;
  logger: Logger;
  metrics: MetricsClient;
  eventBus?: EventEmitter;
}

export async function startGeyserService({ config, logger, metrics, eventBus = new EventEmitter() }: GeyserServiceDeps) {
  logger.info({}, "starting geyser service");

  const subscription = await subscribePumpfunCreations({ config, logger, metrics, eventBus });

  return {
    eventBus,
    stop: () => {
      subscription.close();
    },
  };
}
