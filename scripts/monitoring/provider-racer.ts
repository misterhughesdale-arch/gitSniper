#!/usr/bin/env node
/**
 * SOLANA PROVIDER RACER
 * 
 * Races multiple Solana providers to measure detection latency:
 * - WebSocket: Helius, QuickNode, Solana mainnet
 * - gRPC: Shyft Yellowstone
 * - HTTP RTT baseline: Helius, QuickNode, Solana, Shyft
 * 
 * Shows which provider detects Pump.fun transactions first and by how much.
 */

import 'dotenv/config';
import WebSocket from 'ws';
import { PublicKey } from '@solana/web3.js';
import Client, { CommitmentLevel, SubscribeRequest } from '@triton-one/yellowstone-grpc';

// ---- Config ----
const PUMP_PROGRAM = new PublicKey(process.env.PUMP_PROGRAM || '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');

// WS endpoints
const WS_PROVIDERS = [
  { name: 'helius-ws', url: process.env.HELIUS_WS },
  { name: 'quicknode-ws', url: process.env.QUICKNODE_WS },
  { name: 'solana-ws', url: process.env.SOLANA_WS },
].filter(p => !!p.url) as {name:string;url:string}[];

// HTTP endpoints (for RTT baseline)
const HTTP_PROVIDERS = [
  { name: 'helius-http', url: process.env.HELIUS_HTTP },
  { name: 'quicknode-http', url: process.env.QUICKNODE_HTTP },
  { name: 'solana-http', url: process.env.SOLANA_HTTP },
  { name: 'shyft-http', url: process.env.SHYFT_HTTP },
].filter(p => !!p.url) as {name:string;url:string}[];

// Yellowstone gRPC
const GRPC_URL = process.env.YELLOWSTONE_GRPC || process.env.GRPC_URL;
const GRPC_X = process.env.YELLOWSTONE_X_TOKEN || process.env.X_TOKEN;

const RUN_MS = Number(process.env.RUN_SECONDS || 600) * 1000;

// ---- State & Metrics ----
type FirstSeen = { ts: number; provider: string; slot?: number };
type Seen = { ts: number; slot?: number };

const firstSeenBySig = new Map<string, FirstSeen>();
const seenBySig = new Map<string, Map<string, Seen>>(); // sig -> provider -> {ts,slot}
const perProviderLead = new Map<string, { wins: number; total: number; lagMs: number }>();
const httpRtts = new Map<string, number[]>();
let latestSlot = 0;

function log(...args: any[]) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function recordSeen(sig: string, provider: string, slot?: number) {
  const now = Date.now();

  const first = firstSeenBySig.get(sig);
  if (!first) {
    firstSeenBySig.set(sig, { ts: now, provider, slot });
    // init entry
    seenBySig.set(sig, new Map([[provider, { ts: now, slot }]]));
    // provider stats
    const s = perProviderLead.get(provider) || { wins: 0, total: 0, lagMs: 0 };
    s.wins += 1; s.total += 1;
    perProviderLead.set(provider, s);
  } else {
    // record this provider's lag vs first
    const lag = now - first.ts;
    const s = perProviderLead.get(provider) || { wins: 0, total: 0, lagMs: 0 };
    s.total += 1;
    s.lagMs += lag;
    perProviderLead.set(provider, s);

    // add to seen table
    const mp = seenBySig.get(sig)!;
    mp.set(provider, { ts: now, slot });
  }
}

// ---- WS JSON-RPC logsSubscribe setup ----
function wsSubscribeLogs(provider: {name:string;url:string}) {
  try {
    const ws = new WebSocket(provider.url, { handshakeTimeout: 5000 });
    ws.on('open', () => {
      log(`WS open: ${provider.name}`);
      // logsSubscribe mentions Pump program id, processed commitment
      const sub = {
        jsonrpc: '2.0',
        id: 1,
        method: 'logsSubscribe',
        params: [
          { mentions: [PUMP_PROGRAM.toBase58()] },
          { commitment: 'processed' }
        ],
      };
      ws.send(JSON.stringify(sub));
    });
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        // subscription ack or notification
        if (msg.method === 'logsNotification') {
          const res = msg.params?.result;
          const sig: string | undefined = res?.value?.signature || res?.value?.signature?.toString?.();
          if (sig) {
            const ctxSlot = res?.context?.slot;
            recordSeen(sig, provider.name, Number(ctxSlot) || undefined);
          }
        }
      } catch {}
    });
    ws.on('error', (e) => log(`WS error [${provider.name}]`, e.message));
    ws.on('close', () => log(`WS closed: ${provider.name}`));
  } catch (e:any) {
    log(`WS init error [${provider.name}]:`, e.message);
  }
}

// ---- Yellowstone gRPC subscription ----
async function startGrpc() {
  if (!GRPC_URL || !GRPC_X) {
    log('gRPC not configured; skipping Yellowstone.');
    return;
  }
  try {
    const client = new Client(GRPC_URL, GRPC_X, {
      // lower latency channel options if supported by lib
      'grpc.keepalive_time_ms': 5000,
      'grpc.keepalive_timeout_ms': 2000,
      'grpc.keepalive_permit_without_calls': 1,
      'grpc.http2.min_time_between_pings_ms': 5000,
      'grpc.http2.max_pings_without_data': 0,
    } as any);
    const stream = await client.subscribe();

    stream.on('data', (data: any) => {
      try {
        if (data.blocksMeta?.blockmeta?.slot) {
          latestSlot = Number(data.blocksMeta.blockmeta.slot);
        }
        const txn = data.transaction;
        if (txn?.transaction?.transaction?.message) {
          const sig = txn.transaction?.transaction?.signatures?.[0];
          const accounts = txn.transaction.transaction.message.accountKeys?.map((k:any) => (typeof k === 'string' ? k : k?.toBase58?.())) || [];
          // Only record those mentioning Pump program in message
          if (accounts.includes(PUMP_PROGRAM.toBase58()) && sig) {
            const slot = Number(txn.transaction.meta?.slot || data.blockMeta?.slot || 0);
            recordSeen(sig, 'yellowstone-grpc', slot);
          }
        }
      } catch {}
    });

    const req: SubscribeRequest = {
      transactions: {
        pumpfun: {
          vote: false,
          failed: false,
          signature: undefined,
          accountInclude: [],
          accountExclude: [],
          accountRequired: [PUMP_PROGRAM.toBase58()],
        },
      },
      blocksMeta: { blockmeta: {} },
      entry: {},
      accounts: {},
      blocks: {},
      commitment: CommitmentLevel.PROCESSED,
    };

    stream.write(req);
    log('gRPC Yellowstone subscribed.');
  } catch (e:any) {
    log('gRPC init error:', e.message);
  }
}

// ---- HTTP RTT pinger ----
async function startHttpRtts() {
  for (const p of HTTP_PROVIDERS) {
    httpRtts.set(p.name, []);
    // ping every 2s
    setInterval(async () => {
      try {
        const body = {
          jsonrpc: '2.0',
          id: 1,
          method: 'getLatestBlockhash',
          params: [{ commitment: 'processed' }],
        };
        const t0 = performance.now();
        const r = await fetch(p.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (r.ok) {
          const t1 = performance.now();
          const ms = t1 - t0;
          const arr = httpRtts.get(p.name)!;
          arr.push(ms);
          if (arr.length > 200) arr.shift();
        }
      } catch (e:any) {
        // ignore
      }
    }, 2000);
  }
}

// ---- Reporter ----
function pct(arr: number[], p: number) {
  if (!arr.length) return NaN;
  const a = [...arr].sort((x,y)=>x-y);
  const idx = Math.min(a.length-1, Math.max(0, Math.floor((p/100)*a.length)-1));
  return a[idx];
}

function periodicReport() {
  // Provider wins & average lag
  log('—— Summary (last interval) ——');
  for (const [prov, s] of perProviderLead.entries()) {
    const avgLag = s.total > s.wins ? (s.lagMs / Math.max(1, s.total - s.wins)) : 0;
    log(`${prov}: wins=${s.wins}, seen=${s.total}, avgLag(ms among non-wins)=${avgLag.toFixed(1)}`);
  }
  // HTTP RTTs
  for (const [prov, arr] of httpRtts.entries()) {
    const p50 = pct(arr, 50);
    const p95 = pct(arr, 95);
    const p99 = pct(arr, 99);
    if (!isNaN(p50)) {
      log(`HTTP ${prov}: RTT p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms p99=${p99.toFixed(1)}ms`);
    }
  }
  log('— End summary —');
}

// ---- Main ----
async function main() {
  log('🏁 Starting Provider Racer...');
  log('Configured WS providers:', WS_PROVIDERS.map(p=>p.name).join(', ') || '(none)');
  log('Configured HTTP providers:', HTTP_PROVIDERS.map(p=>p.name).join(', ') || '(none)');
  if (GRPC_URL) log('Configured Yellowstone gRPC.');
  log(`Run duration: ${RUN_MS / 1000}s\n`);

  // Start WS subs
  WS_PROVIDERS.forEach(wsSubscribeLogs);
  // Start gRPC
  await startGrpc();
  // Start HTTP RTT pings
  await startHttpRtts();

  // periodic report
  const repTimer = setInterval(periodicReport, 15_000);

  // optional run time
  if (RUN_MS > 0) {
    setTimeout(() => {
      clearInterval(repTimer);
      log('\n🏁 Run finished. Final summary:');
      periodicReport();
      process.exit(0);
    }, RUN_MS);
  }
}

main().catch((e)=>{ console.error(e); process.exit(1); });

