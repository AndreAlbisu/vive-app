import { applyPaidBookingEffects } from './booking-effects.ts'

// deno-lint-ignore no-explicit-any
type Admin = any

/** A short database lease prevents concurrent webhooks and the repair cron from
 * applying effects together. An expired lease is deliberately retryable. */
export async function processPaidBookingEffects(admin: Admin, bookingId: string): Promise<boolean> {
  const { data: claim, error: claimError } = await admin.rpc('claim_paid_booking_effects', {
    p_booking: bookingId,
  })
  if (claimError) throw new Error(`No se pudo reclamar la confirmación: ${claimError.message}`)
  if (!claim) return false

  await applyPaidBookingEffects(admin, bookingId)

  const { data: completed, error: finishError } = await admin.rpc('finish_paid_booking_effects', {
    p_booking: bookingId,
    p_claim: claim,
  })
  if (finishError || !completed) {
    throw new Error(`No se pudo cerrar la confirmación: ${finishError?.message ?? 'lease vencido'}`)
  }
  return true
}
