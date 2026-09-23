// Reintenta las confirmaciones cuyos pagos ya se acreditaron. No vuelve a
// consultar al procesador: solo trabaja sobre pagos verificados por su webhook.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { esServiceRole } from '../_shared/service-role.ts'
import { processPaidBookingEffects } from '../_shared/paid-effects-recovery.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (!esServiceRole(req.headers.get('Authorization') ?? '', SUPABASE_SERVICE_ROLE_KEY)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: bookings, error } = await admin.from('bookings')
    .select('id').eq('payment_status', 'aprobado')
    .in('status', ['pendiente', 'confirmada'])
    .is('paid_effects_completed_at', null)
    .order('paid_at', { ascending: true }).limit(100)
  if (error) return new Response('db error', { status: 502 })

  let completed = 0
  let failed = 0
  for (const booking of bookings ?? []) {
    try {
      if (await processPaidBookingEffects(admin, booking.id)) completed++
    } catch (cause) {
      failed++
      console.error('[reconcile-paid-effects] pendiente de reintento:', booking.id, cause)
    }
  }
  return Response.json({ examined: bookings?.length ?? 0, completed, failed }, {
    status: failed ? 503 : 200,
  })
})
