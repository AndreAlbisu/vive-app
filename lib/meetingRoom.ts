import { supabase } from './supabase'

export async function createOrGetMeetingUrl(bookingId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('create-meeting-room', {
      body: { booking_id: bookingId },
    })
    if (error) {
      console.error('[meetingRoom] Edge function error:', error)
      return null
    }
    return (data as { url?: string })?.url ?? null
  } catch (e) {
    console.error('[meetingRoom] unexpected error:', e)
    return null
  }
}
