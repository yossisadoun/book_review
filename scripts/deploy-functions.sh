#!/bin/bash
# Deploy all Supabase edge functions with --no-verify-jwt
# IMPORTANT: All our functions handle auth internally via the Authorization header.
# Deploying WITHOUT --no-verify-jwt causes Supabase's gateway to reject valid JWTs,
# resulting in 401 "Invalid JWT" errors across all platforms.

set -e

FUNCTIONS_DIR="supabase/functions"

if [ -n "$1" ]; then
  # Deploy a specific function
  echo "Deploying $1 with --no-verify-jwt..."
  npx supabase functions deploy "$1" --no-verify-jwt
else
  # Deploy all functions
  for dir in "$FUNCTIONS_DIR"/*/; do
    func_name=$(basename "$dir")
    echo "Deploying $func_name with --no-verify-jwt..."
    npx supabase functions deploy "$func_name" --no-verify-jwt
  done
fi

echo "Done. All functions deployed with --no-verify-jwt."
