import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { action, prediction_url, input } = body

    if (action === 'create') {
      // Create a prediction
      const response = await fetch(
        'https://api.replicate.com/v1/models/black-forest-labs/flux-2-klein-4b/predictions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${REPLICATE_API_KEY}`,
          },
          body: JSON.stringify({ input }),
        }
      )

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'poll' && prediction_url) {
      // Poll for prediction status
      const response = await fetch(prediction_url, {
        headers: { 'Authorization': `Bearer ${REPLICATE_API_KEY}` },
      })

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "create" or "poll".' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
