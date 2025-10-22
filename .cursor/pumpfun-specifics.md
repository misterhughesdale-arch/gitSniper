# PumpFun Protocol Specifics

## Program Information

- **Program ID**: `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`
- **Global State**: `4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf`
- **Event Authority**: `Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1`
- **Fee Recipient**: `CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM`
- **Fee Program**: `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ`

## Account Structure

### Buy Transaction (16 Accounts)

Order is CRITICAL - must match exactly:

0. **global** - Global state account (read-only)
1. **fee_recipient** - Protocol fee recipient (writable)
2. **mint** - Token mint (read-only)
3. **bonding_curve** - Bonding curve state (writable)
4. **associated_bonding_curve** - Bonding curve's token account (writable)
5. **buyer_token_account** - Buyer's token account (writable)
6. **buyer** - Buyer's wallet (signer, writable)
7. **system_program** - System program (read-only)
8. **token_program** - Token program (read-only)
9. **creator_vault** - Creator's vault for fees (writable)
10. **event_authority** - Event authority PDA (read-only)
11. **program** - PumpFun program itself (read-only)
12. **global_volume_accumulator** - Global volume tracking (writable)
13. **user_volume_accumulator** - User volume tracking (writable)
14. **fee_config** - Fee configuration (read-only)
15. **fee_program** - Fee program (read-only)

### Sell Transaction (14 Accounts)

Order matters - note differences from buy:

0. **global**
1. **fee_recipient**
2. **mint**
3. **bonding_curve**
4. **associated_bonding_curve**
5. **seller_token_account**
6. **seller** (signer, writable)
7. **system_program**
8. **creator_vault** ⚠️ BEFORE token_program (different from buy!)
9. **token_program** ⚠️ AFTER creator_vault
10. **event_authority**
11. **program**
12. **fee_config**
13. **fee_program**

Note: Sell does NOT include volume accumulators (12 & 13 from buy are omitted).

## Instruction Format

### Buy Instruction

Discriminator: `[102, 6, 61, 18, 1, 218, 235, 234]` (8 bytes)

```
[discriminator (8)] [token_amount (8)] [max_sol_cost (8)] [track_volume (1)]
Total: 25 bytes
```

- **token_amount**: u64 - Amount of tokens to receive (raw units, 6 decimals)
- **max_sol_cost**: u64 - Maximum SOL to spend (lamports) - slippage protection
- **track_volume**: Option<bool> - Usually None (0x00)

Example:

```typescript
const data = Buffer.alloc(25);
BUY_DISCRIMINATOR.copy(data, 0);
data.writeBigUInt64LE(BigInt(tokenAmount), 8);  // Tokens to receive
data.writeBigUInt64LE(BigInt(maxSolCost), 16);  // Max SOL (with slippage)
data.writeUInt8(0, 24);                         // track_volume = None
```

### Sell Instruction

Discriminator: `[51, 230, 133, 164, 1, 127, 131, 173]` (8 bytes)

```
[discriminator (8)] [token_amount (8)] [min_sol_output (8)] [track_volume (1)]
Total: 25 bytes
```

- **token_amount**: u64 - Amount of tokens to sell (raw units, 6 decimals)
- **min_sol_output**: u64 - Minimum SOL to receive (lamports) - slippage protection
- **track_volume**: Option<bool> - Usually None (0x00)

## PDA Derivations

### Bonding Curve

```typescript
[bondingCurve, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from("bonding-curve"), mint.toBuffer()],
  PUMP_PROGRAM_ID
);
```

### Associated Bonding Curve (ATA)

```typescript
// This is the bonding curve's token account for the mint
associatedBondingCurve = getAssociatedTokenAddressSync(
  mint,                // mint
  bondingCurve,        // owner
  true,                // allowOwnerOffCurve
  TOKEN_PROGRAM_ID
);
```

### Creator Vault

```typescript
// CRITICAL: Use creator from bonding curve state, NOT transaction sender!
const curveState = await fetchBondingCurveState(connection, bondingCurve);
const creator = curveState.creator;

[creatorVault, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from("creator-vault"), creator.toBuffer()],
  PUMP_PROGRAM_ID
);
```

### Volume Accumulators (Buy Only)

```typescript
// Global volume (all trades)
[globalVolumeAccumulator, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from("global-volume-accumulator")],
  PUMP_PROGRAM_ID
);

// User volume (specific user)
[userVolumeAccumulator, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from("user-volume-accumulator"), userPubkey.toBuffer()],
  PUMP_PROGRAM_ID
);
```

### Fee Config

```typescript
[feeConfig, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from("fee-config")],
  PUMP_PROGRAM_ID
);
```

## Bonding Curve State

The bonding curve account contains critical information:

```typescript
interface BondingCurveState {
  discriminator: Buffer;     // 8 bytes
  virtualTokenReserves: BN;  // 8 bytes
  virtualSolReserves: BN;    // 8 bytes
  realTokenReserves: BN;     // 8 bytes
  realSolReserves: BN;       // 8 bytes
  tokenTotalSupply: BN;      // 8 bytes
  complete: boolean;         // 1 byte
  creator: PublicKey;        // 32 bytes ⚠️ CRITICAL for creator_vault
}
```

You MUST fetch this to get the correct creator address:

```typescript
async function fetchBondingCurveState(
  connection: Connection,
  bondingCurve: PublicKey
): Promise<BondingCurveState> {
  const accountInfo = await connection.getAccountInfo(bondingCurve);
  if (!accountInfo) throw new Error("Bonding curve not found");
  
  const data = accountInfo.data;
  
  return {
    discriminator: data.slice(0, 8),
    virtualTokenReserves: new BN(data.slice(8, 16), "le"),
    virtualSolReserves: new BN(data.slice(16, 24), "le"),
    realTokenReserves: new BN(data.slice(24, 32), "le"),
    realSolReserves: new BN(data.slice(32, 40), "le"),
    tokenTotalSupply: new BN(data.slice(40, 48), "le"),
    complete: data[48] !== 0,
    creator: new PublicKey(data.slice(49, 81)),
  };
}
```

## Token Properties

- **Decimals**: Always 6
- **Supply**: Varies per token, check bonding curve state
- **Mint Authority**: Bonding curve (until graduation to Raydium)

## Common Mistakes

### ❌ Wrong Creator Vault Derivation

```typescript
// WRONG - using transaction sender
const [creatorVault] = PublicKey.findProgramAddressSync(
  [Buffer.from("creator-vault"), buyer.toBuffer()], // ❌
  PUMP_PROGRAM_ID
);

// CORRECT - using bonding curve creator
const curveState = await fetchBondingCurveState(connection, bondingCurve);
const [creatorVault] = PublicKey.findProgramAddressSync(
  [Buffer.from("creator-vault"), curveState.creator.toBuffer()], // ✅
  PUMP_PROGRAM_ID
);
```

### ❌ Wrong Account Order in Sell

```typescript
// WRONG - token_program before creator_vault
keys: [
  // ...
  { pubkey: seller, isSigner: true, isWritable: true },
  { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
  { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // ❌
  { pubkey: creatorVault, isSigner: false, isWritable: true },
  // ...
]

// CORRECT - creator_vault before token_program
keys: [
  // ...
  { pubkey: seller, isSigner: true, isWritable: true },
  { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
  { pubkey: creatorVault, isSigner: false, isWritable: true }, // ✅
  { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // ✅
  // ...
]
```

### ❌ Including Volume Accumulators in Sell

```typescript
// WRONG - sell has 16 accounts like buy
const sellInstruction = new TransactionInstruction({
  keys: [
    // ... 12 accounts ...
    { pubkey: globalVolumeAccumulator, ... }, // ❌ Not in sell!
    { pubkey: userVolumeAccumulator, ... },   // ❌ Not in sell!
    { pubkey: feeConfig, ... },
    { pubkey: FEE_PROGRAM, ... },
  ],
  // ...
});

// CORRECT - sell has 14 accounts (no volume tracking)
const sellInstruction = new TransactionInstruction({
  keys: [
    // ... 12 accounts ...
    { pubkey: feeConfig, ... },    // ✅ 13th account
    { pubkey: FEE_PROGRAM, ... },  // ✅ 14th account
  ],
  // ...
});
```

### ❌ Hardcoding Token Amount in Buy

```typescript
// WRONG - hardcoded token amount
const tokenAmount = BigInt(1_000_000_000); // ❌ Fixed amount

// CORRECT - request high amount, limited by max SOL
const tokenAmount = BigInt(100_000_000_000); // ✅ High amount
const maxSolCost = BigInt(amountSol * (1 + slippage) * LAMPORTS_PER_SOL);
// Program will give you as many tokens as possible within maxSolCost
```

## Testing Checklist

Before mainnet deployment:

- [ ] Verified all 16 accounts for buy (in correct order)
- [ ] Verified all 14 accounts for sell (in correct order)
- [ ] Confirmed creator_vault uses bonding curve creator
- [ ] Tested buy with various amounts
- [ ] Tested sell after buy
- [ ] Verified slippage protection works
- [ ] Checked priority fees are competitive
- [ ] Monitored for failed transactions
- [ ] Verified token balance after buy
- [ ] Verified SOL received after sell

## Monitoring

Key metrics to track:

- Buy success rate (target: >80%)
- Sell success rate (target: >90%)
- Average latency (buy: <500ms, sell: <1s)
- Priority fee efficiency (landed vs paid)
- Slippage (actual vs max)
- Failed transaction reasons

## Resources

- Check latest program code for changes
- Monitor PumpFun Discord for updates
- Test on devnet first with throwaway tokens
- Use Solana Explorer to inspect successful transactions
