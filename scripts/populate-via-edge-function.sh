#!/bin/bash
# Alternative: Populate curated episodes by calling the Supabase Edge Function
# This is simpler but requires the Edge Function to be set up correctly

echo "🚀 Calling Supabase Edge Function to populate curated episodes..."
echo ""

# Load environment variables from .env.local
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "❌ Missing Supabase credentials in .env.local"
  echo "   Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
  exit 1
fi

EDGE_FUNCTION_URL="${SUPABASE_URL}/functions/v1/smart-responder"

echo "📡 Calling: $EDGE_FUNCTION_URL"
echo ""

response=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  "$EDGE_FUNCTION_URL")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
  echo "✅ Successfully triggered episode population!"
  echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
  echo "❌ Failed to populate episodes (HTTP $http_code)"
  echo "$body"
  exit 1
fi
