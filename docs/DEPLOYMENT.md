# Deployment Guide

---

## 1. Pre-Deployment Checklist

### 1.1. Stream Verification
- [ ] Test detection stream
  - Run stream-only mode: `pnpm dev:working`
  - Confirm tokens are being detected in real-time

### 1.2. Transaction Verification
- [ ] Build and simulate transactions
  - Use simulation mode for dry-run
  - Ensure no simulation errors or unexpected reverts

### 1.3. Test Small-Scale Trade
- [ ] Run test trade with minimal amount
  - Set `buy_amount_sol` to 0.001 in config
  - Observe buy/sell flow and check logs

### 1.4. Configuration Audit
- [ ] Review all TOML and environment variable settings
  - Inspect `config/` and `.env` files
  - Validate:
    - Correct RPC endpoints
    - Correct geyser endpoint and token
    - Strategy parameters

### 1.5. Wallet Readiness
- [ ] Ensure wallet is funded and accessible
  - Confirm at least 0.1 SOL for transaction fees
  - Validate correct keypair path

### 1.6. Monitoring & Alerting
- [ ] Set up monitoring
  - Check logging paths
  - Configure automated alerts (failure/balance/latency)

### 1.7. Fault Tolerance
- [ ] Configure backup RPC endpoints
  - Document fallback and failover settings
  - Test switching to fallback under RPC outage

---

## 2. Production Configuration

### 2.1. Production Config File (`config/production.toml`)
- [ ] Create or edit the config file:
  - `[environment]`
    - `name = "production"`
  - `[strategy]`
    - `buy_amount_sol = 0.01`  # Adjust for production budget
    - `max_slippage_bps = 300` # 3% max slippage
  - `[jito]`
    - `priority_fee_lamports = 150000` # Optimize for landing reliability

```toml
[environment]
name = "production"

[strategy]
buy_amount_sol = 0.01
max_slippage_bps = 300

[jito]
priority_fee_lamports = 150000
```

### 2.2. Required Environment Variables

- [ ] Set the following in your environment:

```bash
FRESH_SNIPER_ENV=production                   # Sets production mode
SOLANA_RPC_PRIMARY=your-premium-rpc-endpoint  # Premium RPC endpoint
GEYSER_ENDPOINT=grpc.ny.shyft.to:443          # Geyser endpoint for stream
GEYSER_AUTH_TOKEN=production-token            # Geyser authentication token
TRADER_KEYPAIR_PATH=/secure/path/to/keypair.json # Secure trader keypair
```

---

## 3. Running in Production

### 3.1. Using PM2 Process Manager

- [ ] Install and configure PM2:

```bash
# Install PM2 globally if not already installed
npm install -g pm2


# Start sniper process
pm2 start "pnpm dev:full" --name fresh-sniper

# Monitor logs
pm2 logs fresh-sniper

# Stop the sniper
pm2 stop fresh-sniper
```

### 3.2. Using systemd Service

- [ ] Create systemd service unit at `/etc/systemd/system/fresh-sniper.service`
  - Replace user/path/environment as appropriate

```ini
[Unit]
Description=Fresh Sniper
After=network.target

[Service]
Type=simple
User=sniper
WorkingDirectory=/home/sniper/freshSniper
Environment="PATH=/home/sniper/.nvm/versions/node/v20.0.0/bin:/usr/bin"
ExecStart=/usr/bin/pnpm dev:full
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

- [ ] Enable, start, and monitor the service:

```bash
sudo systemctl enable fresh-sniper
sudo systemctl start fresh-sniper
sudo journalctl -u fresh-sniper -f
```

---

## 4. Monitoring & Metrics

### 4.1. Log Inspection

- [ ] Monitor real-time logs for metric output:
  - Command: `tail -f logs/mvp-metrics.log | jq '.summary'`
  - Verify periodic appearance of summary objects

### 4.2. Metrics Breakdown

- tokensDetected:
  - Should be >0 if Pump.fun is active
- simSuccess / simFailed:
  - Simulation success rate target >80%
- txConfirmed / txFailed:
  - Aim for high transaction confirmation rates
- detection latency:
  - Must be below 10ms for best execution

### 4.3. Alerting System

- [ ] Set up dashboards / notifications for:
  - No tokens detected for >60s (stream down)
  - Simulation success rate <50% (RPC health)
  - Transaction failure rate >20% (possible fee or infra issue)

---

## 5. Security best practices

### 5.1. Key and API Management

- [ ] Never commit to version control:
  - Keypairs (`.json`)
  - `.env` files or secrets
- [ ] Use a dedicated wallet for sniping
- [ ] Periodically rotate API keys and geyser tokens

### 5.2. Wallet & Balance Safety

- [ ] Set up low-balance automated alerts
- [ ] Consider hardware wallet or HSM for high balances

---

## 6. Scaling & High Availability

### 6.1. Multi-Instance Strategies

- [ ] Run separate processes for different configurations:
  - Example:
    - Small buys, high frequency:
      - `FRESH_SNIPER_ENV=production-small pnpm dev:full`
    - Larger buys, filtered selection:
      - `FRESH_SNIPER_ENV=production-large pnpm dev:full`

### 6.2. Load Distribution

- [ ] List and set multiple RPC endpoints in `rpc.fallback_urls`
- [ ] Rotate Jito tip accounts periodically
- [ ] Deploy across multiple servers for redundancy if needed

---

## 7. Troubleshooting Guide

### 7.1. High Failure Rate on Transactions

- [ ] Troubleshooting steps:
  1. Increase `priority_fee_lamports`
  2. Check premium RPC provider latency
  3. Ensure Jito tip meets minimum (at least 1000 lamports)

### 7.2. Stream Disconnects

- [ ] Troubleshooting steps:
  - Check current Shyft API quota
  - Test network connectivity and firewall rules
  - Tune stream reconnection backoff parameters

### 7.3. Running Low on SOL

- [ ] Troubleshooting steps:
  - Monitor wallet live balance in dashboard/logs
  - Set up triggers for low-balance alerting
  - Auto-pause bot when low balance detected

---

## 8. Backup and Recovery

### 8.1. Config & Keypair Backups

- [ ] Take regular encrypted backups:
  - Backup configs, env, and keypairs:

```bash
tar -czf backup-$(date +%Y%m%d).tar.gz config/ .env keypairs/
```

### 8.2. Trade & Metrics History

- [ ] Archive log data before purging:

```bash
cp -r logs/ logs-backup-$(date +%Y%m%d)/
```

---

## 9. Maintenance and Updates

### 9.1. Ongoing Maintenance Tasks

- [ ] Daily:
  - Check success/failure rates in metrics log
  - Adjust `priority_fee_lamports` if needed
- [ ] Weekly:
  - Review overall trade results, especially PnL
  - Tune config and strategy parameters as needed
- [ ] Monthly:
  - Rotate API keys and geyser tokens
  - Update all dependencies

### 9.2. Update & Redeploy

- [ ] To update and redeploy:

```bash
pnpm update              # Update dependencies to latest
pnpm clean               # Clean previous builds
pnpm build               # Build the project for production
pnpm dev:working         # Test thoroughly before full deployment
```

---

