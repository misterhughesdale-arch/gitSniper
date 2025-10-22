#!/bin/bash
# Quick test to see raw Jito API response

echo "Raw API response:"
curl -s https://bundles.jito.wtf/api/v1/bundles/tip_floor | jq '.'

