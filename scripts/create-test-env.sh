#!/bin/bash
# Quick script to create a minimal test environment

echo "🔧 Setting up test environment for Fresh Sniper"

# Create .env if it doesn't exist
if [ ! -f .env ]; then
  echo "Creating .env from template..."
  cp .env.template .env
  echo "✅ Created .env - YOU MUST EDIT IT WITH YOUR CREDENTIALS"
else
  echo "⚠️  .env already exists, skipping..."
fi

# Create keypairs directory
if [ ! -d keypairs ]; then
  echo "Creating keypairs directory..."
  mkdir -p keypairs
  echo "✅ Created keypairs/"
  echo "⚠️  YOU MUST ADD YOUR trader.json KEYPAIR"
else
  echo "✅ keypairs/ directory exists"
fi

# Create logs directory
if [ ! -d logs ]; then
  echo "Creating logs directory..."
  mkdir -p logs
  echo "✅ Created logs/"
else
  echo "✅ logs/ directory exists"
fi

echo ""
echo "📋 TODO before running:"
echo "1. Edit .env with your RPC/Geyser credentials"
echo "2. Place your wallet keypair JSON at keypairs/trader.json"
echo "3. Run: pnpm install"
echo "4. Run: pnpm build"
echo "5. Run: npx tsx scripts/sanity-check.ts"

