#!/bin/bash
echo "=== RAW RESPONSE ==="
curl -s https://bundles.jito.wtf/api/v1/bundles/tip_floor

echo ""
echo ""
echo "=== PARSED WITH JQ ==="
curl -s https://bundles.jito.wtf/api/v1/bundles/tip_floor | jq '.[0]'

