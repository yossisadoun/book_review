import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const VALID_PLATFORMS = new Set(['ios', 'android', 'web'])
const VALID_ACCOUNT_TYPES = new Set(['guest', 'apple', 'google'])
const MAX_BATCH_SIZE = 50

function deriveEnv(req: Request): string {
  const origin = req.headers.get('origin') || req.headers.get('referer') || ''
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) return 'dev'
  return 'prod'
}

interface IncomingEvent {
  user_id?: string | null
  feature?: string
  action?: string
  platform?: string
  account_type?: string
  metadata?: Record<string, any> | null
  session_id?: string | null
  created_at?: string
}

function validateEvent(e: IncomingEvent): boolean {
  if (!e.feature || typeof e.feature !== 'string') return false
  if (!e.action || typeof e.action !== 'string') return false
  if (!e.platform || !VALID_PLATFORMS.has(e.platform)) return false
  if (!e.account_type || !VALID_ACCOUNT_TYPES.has(e.account_type)) return false
  return true
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const text = await req.text()
    const body = JSON.parse(text)

    if (!Array.isArray(body) || body.length === 0) {
      return new Response(JSON.stringify({ error: 'Expected non-empty array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (body.length > MAX_BATCH_SIZE) {
      return new Response(JSON.stringify({ error: `Batch too large (max ${MAX_BATCH_SIZE})` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const env = deriveEnv(req)

    const valid = body.filter(validateEvent).map((e: IncomingEvent) => ({
      user_id: e.user_id || null,
      feature: e.feature,
      action: e.action,
      platform: e.platform,
      account_type: e.account_type,
      metadata: e.metadata ?? null,
      session_id: e.session_id || null,
      created_at: e.created_at || new Date().toISOString(),
      env,
    }))

    if (valid.length === 0) {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })

    const { error } = await supabase.from('analytics_events').insert(valid)
    if (error) {
      console.error('Insert error:', error)
    }

    return new Response(null, { status: 204, headers: corsHeaders })
  } catch (err) {
    console.error('Track error:', err)
    return new Response(null, { status: 204, headers: corsHeaders })
  }
})
