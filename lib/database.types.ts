export type UserRole = 'user' | 'coach'

export type Profile = {
  id: string
  email: string
  name: string
  role: UserRole
  avatar_url?: string
  created_at: string
}

export type Coach = {
  id: string
  profile_id: string
  specialty: string
  bio: string
  price_per_session: number
  nationality: string
  verified: boolean
  created_at: string
}

export type Booking = {
  id: string
  user_id: string
  coach_id: string
  date: string
  time: string
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled'
  created_at: string
}

export type Message = {
  id: string
  sala_id: string
  sender_id: string
  content: string
  created_at: string
}

export type Sala = {
  id: string
  user_id: string
  coach_id: string
  created_at: string
}
