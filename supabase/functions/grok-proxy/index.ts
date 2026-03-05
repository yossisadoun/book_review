import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GROK_API_KEY = Deno.env.get('GROK_API_KEY') || ''
const GROK_CHAT_URL = 'https://api.x.ai/v1/chat/completions'
const GROK_RESPONSES_URL = 'https://api.x.ai/v1/responses'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { endpoint } = body

    // Route to responses API if requested
    if (endpoint === 'responses') {
      const { input, model, tools, temperature } = body

      if (!input) {
        return new Response(
          JSON.stringify({ error: 'input is required for responses endpoint' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const response = await fetch(GROK_RESPONSES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROK_API_KEY}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          input,
          model: model || 'grok-4-1-fast-non-reasoning',
          tools: tools || [],
          ...(temperature != null ? { temperature } : {}),
        }),
      })

      const data = await response.json()

      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Default: chat completions
    const { messages, model, temperature, stream } = body

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const response = await fetch(GROK_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_API_KEY}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        messages,
        model: model || 'grok-4-1-fast-non-reasoning',
        stream: stream ?? false,
        temperature: temperature ?? 0.7,
      }),
    })

    const data = await response.json()

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
