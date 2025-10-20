import type { Request, Response } from "express";
import type { FreshSniperConfig } from "@fresh-sniper/config";
import type { Logger } from "@fresh-sniper/logging";
import type { MetricsClient } from "@fresh-sniper/metrics";
import type { SolanaClients } from "@fresh-sniper/solana-client";
import { buildBuyWorkflow, buildSellWorkflow } from "@fresh-sniper/transactions";
import { z } from "zod";

interface Dependencies {
  config: FreshSniperConfig;
  logger: Logger;
  metrics: MetricsClient;
  solanaClients: SolanaClients;
}

const BuyPayloadSchema = z.object({
  mint: z.string().length(44, "Invalid mint address"),
  amountSol: z.number().positive().optional(),
  slippageBps: z.number().int().min(0).max(10000).optional(),
});

const SellPayloadSchema = z.object({
  mint: z.string().length(44, "Invalid mint address"),
  tokenAmount: z.number().positive(),
  slippageBps: z.number().int().min(0).max(10000).optional(),
});

export function createSnipeController({ config, logger, metrics, solanaClients }: Dependencies) {
  const buyWorkflow = buildBuyWorkflow({
    config,
    logger,
    metrics,
    connection: solanaClients.rpcConnection,
    trader: solanaClients.traderKeypair,
  });

  const sellWorkflow = buildSellWorkflow({
    config,
    logger,
    metrics,
    connection: solanaClients.rpcConnection,
    trader: solanaClients.traderKeypair,
  });

  return {
    buyHandler: async (req: Request, res: Response) => {
      const startedAt = Date.now();
      try {
        // Validate payload
        const validation = BuyPayloadSchema.safeParse(req.body);
        if (!validation.success) {
          metrics.incrementCounter("buy_route_validation_errors");
          res.status(400).json({
            success: false,
            error: "Invalid payload",
            details: validation.error.errors,
          });
          return;
        }

        const payload = validation.data;
        const result = await buyWorkflow.execute(payload);
        const elapsedMs = Date.now() - startedAt;

        metrics.observeLatency("buy_route_total_ms", elapsedMs);
        metrics.reportLoopSummary({
          loop: "buy_route",
          mint: payload.mint,
          success: result.success,
          elapsedMs,
          ...result.metrics,
        });

        if (result.success) {
          res.status(200).json({ success: true, signature: result.signature, metrics: result.metrics });
        } else {
          res.status(500).json({ success: false, error: result.error, metrics: result.metrics });
        }
      } catch (error) {
        logger.error({ err: serializeError(error) }, "buy handler failed");
        metrics.incrementCounter("buy_route_errors");
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    },

    sellHandler: async (req: Request, res: Response) => {
      const startedAt = Date.now();
      try {
        // Validate payload
        const validation = SellPayloadSchema.safeParse(req.body);
        if (!validation.success) {
          metrics.incrementCounter("sell_route_validation_errors");
          res.status(400).json({
            success: false,
            error: "Invalid payload",
            details: validation.error.errors,
          });
          return;
        }

        const payload = validation.data;
        const result = await sellWorkflow.execute(payload);
        const elapsedMs = Date.now() - startedAt;

        metrics.observeLatency("sell_route_total_ms", elapsedMs);
        metrics.reportLoopSummary({
          loop: "sell_route",
          mint: payload.mint,
          success: result.success,
          elapsedMs,
          ...result.metrics,
        });

        if (result.success) {
          res.status(200).json({ success: true, signature: result.signature, metrics: result.metrics });
        } else {
          res.status(500).json({ success: false, error: result.error, metrics: result.metrics });
        }
      } catch (error) {
        logger.error({ err: serializeError(error) }, "sell handler failed");
        metrics.incrementCounter("sell_route_errors");
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    },
  };
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}
