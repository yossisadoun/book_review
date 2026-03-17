import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })

    // Verify the user's JWT
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token)
    if (userError || !user) {
      console.error('[delete-account] Auth error:', userError?.message || 'No user')
      return new Response(JSON.stringify({ error: 'Invalid or expired token', detail: userError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = user.id
    console.log(`[delete-account] Deleting user ${userId}`)

    // Only delete from tables that have user_id and won't cascade automatically.
    // Tables with ON DELETE CASCADE (book_chats, character_chats, content_hearts, feed_items)
    // will be cleaned up when auth user is deleted.
    // But proactive_message_log has NO CASCADE, so must be deleted explicitly.
    // analytics_events has no FK at all, so must be deleted explicitly.
    const tablesToDelete: Array<{ table: string; column: string }> = [
      // No CASCADE — must delete before auth user
      { table: 'proactive_message_log', column: 'user_id' },
      { table: 'analytics_events', column: 'user_id' },
      // These CASCADE but delete explicitly to be safe
      { table: 'book_chats', column: 'user_id' },
      { table: 'character_chats', column: 'user_id' },
      { table: 'content_hearts', column: 'user_id' },
      { table: 'feed_items', column: 'user_id' },
      { table: 'books', column: 'user_id' },
      { table: 'follows', column: 'follower_id' },
      { table: 'follows', column: 'following_id' },
      { table: 'users', column: 'id' },
    ]

    const warnings: string[] = []
    for (const { table, column } of tablesToDelete) {
      try {
        const { error } = await adminClient.from(table).delete().eq(column, userId)
        if (error) {
          const msg = `${table}.${column}: ${error.message}`
          console.log(`[delete-account] Warning: ${msg}`)
          warnings.push(msg)
        }
      } catch (e) {
        const msg = `${table}.${column}: ${e?.message || e}`
        console.log(`[delete-account] Warning (exception): ${msg}`)
        warnings.push(msg)
      }
    }

    // Delete the auth user (cascades to book_chats, character_chats, content_hearts, feed_items)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
    if (deleteError) {
      console.error('[delete-account] Error deleting auth user:', deleteError.message)
      return new Response(JSON.stringify({
        error: 'Failed to delete auth user',
        detail: deleteError.message,
        warnings,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[delete-account] Successfully deleted user ${userId}`)
    return new Response(JSON.stringify({ success: true, warnings }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[delete-account] Unexpected error:', err?.message || err)
    return new Response(JSON.stringify({ error: 'Internal server error', detail: err?.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
