# Fresh Sniper — Setup Guide

This guide explains how to install, configure, and verify your Fresh Sniper environment step by step. Each major task is broken down into smaller subtasks for clarity and reliability.

---

## Table of Contents

1. [Prerequisites] (#prerequisites)
2. [Install Project Dependencies] (#install-project-dependencies)
3. [Configure Environment] (#configure-environment)
4. [Set Up Solana Wallet] (#set-up-solana-wallet)
5. [Validate Stream Setup] (#validate-stream-setup)
6. [Configure Strategy Parameters] (#configure-strategy-parameters)
7. [Run and Verify Sniper] (#run-and-verify-sniper)
8. [Troubleshooting] (#troubleshooting)
9. [Jito Tip Account Rotation] (#jito-tip-account-rotation)
10. [Performance Tuning] (#performance-tuning)
11. [Next Steps] (#next-steps)

---

## 1. Prerequisites

### 1.1. Install Required Tools

- Node.js >= 20.0.0  
- pnpm >= 9.0.0

### 1.2. Setup Accounts

- Create a Shyft API account (for Geyser stream access)
- Prepare a funded Solana wallet (**dedicated for sniping**)

---

## 2. Install Project Dependencies

### 2.1. Navigate to Project Directory

```bash
cd freshSniper
```

### 2.2. Install Dependencies

```bash
pnpm install
```

---

## 3. Configure Environment

### 3.1. Create Environment File

- Duplicate `.env.example` as `.env` (if exists) or make a new `.env`.

### 3.2. Set the Required Variables

Fill out `.env` with your relevant API keys and wallet path. For example:

```bash
# Geyser Stream (Required)
GRPC_URL=grpc.ny.shyft.to:443
X_TOKEN=your-shyft-api-key

# Solana RPC (Required)
SOLANA_RPC_PRIMARY=https://rpc.shyft.to?api_key=your-key

# Geyser Config (for config system)
GEYSER_ENDPOINT=grpc.ny.shyft.to:443
GEYSER_AUTH_TOKEN=your-shyft-api-key

# Wallet (Required)
TRADER_KEYPAIR_PATH=./keypairs/trader.json
```

---

## 4. Set Up Solana Wallet

### 4.1. Create Keypair Directory

```bash
mkdir -p keypairs
```

### 4.2. Place Wallet Keypair

- Save your Solana wallet keypair as JSON at `keypairs/trader.json`

Example (`keypairs/trader.json`):

```json
[123,45,67,...]  // Your 64-byte secret key
```

> ⚠️ **IMPORTANT:** Use a new/dedicated wallet for sniping, **never** your main wallet.

---

## 5. Validate Stream Setup

### 5.1. Run in Safe Detection-Only Mode

```bash
pnpm dev:working
```

### 5.2. Confirm Successful Stream

You should see terminal output like:

```
✅ Stream connected
🪙 TOKEN #1 DETECTED
   Mint: CdqR1y3i8bVr9YY42yDaMQyadM4V4bkZVwbqvnHWpump
```

- If tokens are being detected, your stream is working properly.

---

## 6. Configure Strategy Parameters

### 6.1. Edit Strategy Configuration

- Open `config/default.toml` and adjust for your needs. Example minimal setup:

```toml
[strategy]
buy_amount_sol = 0.001      # Start small!
max_slippage_bps = 500      # 5%

[jito]
priority_fee_lamports = 100000
```

- See documentation for advanced options.

---

## 7. Run and Verify Sniper

### 7.1. Test Full Buy/Sell Flow (**Mainnet, Uses Real SOL!**)

> ⚠️ **This will spend real SOL. Ensure your configurations are correct and your wallet holds funds you are comfortable risking.**

```bash
pnpm dev:full
```

### 7.2. Monitor Expected Output

Typical output after a successful run:

```
✅ Sim OK: 67ms
✅ Sent via Jito: 5VERv8NMvz...
🎉 CONFIRMED: ...
```

---

## 8. Troubleshooting

### 8.1. Compile or Module Errors

- **"Cannot find module 'zod'"**
    ```bash
    pnpm install -w zod
    ```

- **"ENOENT: no such file or directory, open './keypairs/trader.json'"**
  - Ensure the `keypairs` directory exists and contains your wallet JSON.

### 8.2. No Tokens Detected in Stream

- Confirm your `GRPC_URL` and `X_TOKEN` are correct and active
- Check Shyft API key quota status
- Pump.fun may have slow/lull periods—try again later

### 8.3. Simulation or Transaction Fails

- Make sure your wallet is funded with enough SOL
- Re-evaluate slippage parameters for market conditions
- Some tokens may have very low liquidity—try others

---

## 9. Jito Tip Account Rotation

### 9.1. Why Rotate?

- Rotating Jito tip accounts may improve transaction fairness and performance

### 9.2. Account List

Choose a tip account and update `config/default.toml`:

```
96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5
HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe
Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY
ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49
DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh
ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt
DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL
3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT
```

- Update the Jito tip account address in your configuration as needed, especially for high-volume sniping.

---

## 10. Performance Tuning

### 10.1. Optimizing for Speed

- Increase `priority_fee_lamports` (e.g., `200000`) for higher inclusion odds
- Use a private/dedicated RPC endpoint (reduce latency)
- Reduce `buy_amount_sol` for lower transaction size and faster handling

### 10.2. Optimizing for Cost

- Lower `priority_fee_lamports` (e.g., `50000`) to reduce fees (may slow execution)
- Test and find a balance between cost and performance that fits your needs

---

## 11. Next Steps

After verifying successful setup and basic operation:

1. [ ] **Add Filters:**  
   - Configure liquidity/market cap filters  
   - Optionally import creator/whitelist rules

2. [ ] **Enable Automated Selling:**  
   - Configure and test the auto-sell strategy  
   - Adjust sell thresholds and breakeven options

3. [ ] **Implement Position Tracking:**  
   - Validate trade logs and export reports  
   - Track outstanding positions and profits

4. [ ] **Scale Strategies:**  
   - Add multiple TOML strategy configs  
   - Test running with strategy permutations

---

For further help or advanced configuration, consult the [README](../README.md) and [DEVELOPMENT GUIDE](./DEVELOPMENT.md).

