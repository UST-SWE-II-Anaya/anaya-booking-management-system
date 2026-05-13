import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: callerProfile, error: profileError } = await supabaseUser
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || callerProfile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { userId, role } = body
    const reason: string = body.reason || 'Banned by admin'

    if (!userId || !role) {
      return new Response(
        JSON.stringify({ error: 'userId and role are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!['customer', 'staff'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'role must be customer or staff' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Revoke all sessions immediately (best-effort — don't fail ban if this errors)
    await supabaseAdmin.auth.admin.signOut(userId, { scope: 'global' }).catch(() => null)

    // 2. Cascade effects based on role
    if (role === 'customer') {
      await supabaseAdmin
        .from('bookings')
        .update({ booking_status: 'cancelled' })
        .eq('customer_id', userId)
        .eq('booking_status', 'upcoming')
    } else {
      // staff: flag upcoming bookings as unassigned so others can claim them
      await supabaseAdmin
        .from('bookings')
        .update({ staff_id: null })
        .eq('staff_id', userId)
        .eq('booking_status', 'upcoming')

      // reject any pending leave requests
      await supabaseAdmin
        .from('leave_requests')
        .update({ status: 'rejected' })
        .eq('staff_id', userId)
        .eq('status', 'pending')
    }

    // 3. Update profile status
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        account_status: 'banned',
        deactivation_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
