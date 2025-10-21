# Known Issues

## ❌ Transaction Simulation Failing (Error 3012)

**Issue**: Simulations fail with `{"InstructionError":[3,{"Custom":3012}]}`

**Root Cause**: Missing correct creator_vault account

**Current Code**:
```typescript
const [creatorVault] = deriveCreatorVaultPDA(buyer); // WRONG - using buyer
```

**Should Be**:
```typescript
// 1. Fetch bonding curve state
const curveData = await connection.getAccountInfo(bondingCurve);
// 2. Parse to get creator pubkey
const creator = parseBondingCurveCreator(curveData);
// 3. Derive vault from ACTUAL creator
const [creatorVault] = deriveCreatorVaultPDA(creator); // CORRECT
```

**Fix Required**:
1. Add bonding curve state parser
2. Fetch curve data before building transaction
3. Extract creator from bytes 49-81 (32-byte pubkey)

**Reference**: `examples/pumpfun-bonkfun-bot/learning-examples/manual_buy.py` lines 50-72

**ETA**: ~30 minutes

**Workaround**: Simulations will fail but we can see tokens are being detected correctly

---

## 🎯 WHAT'S WORKING

✅ Stream detection (105+ tokens)  
✅ Token extraction (full addresses)  
✅ Transaction building (structure correct)  
✅ Jito integration (ready to send)  

Only blocker: Need to fetch curve state for creator

---

## Quick Fix Steps

1. Add `parseBondingCurveState()` function to read creator
2. Make `buildBuyTransaction()` fetch curve data
3. Use real creator for creator_vault PDA
4. Re-test simulation

Once fixed: Transactions will simulate successfully and can be sent via Jito!

