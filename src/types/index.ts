export interface Profile {
  id: string
  username: string
  school: string
  avatar_color: string
  avatar_initials: string
  total_fizzups: number
  created_at: string
}

export interface Post {
  id: string
  user_id: string
  text: string
  is_anon: boolean
  school: string
  likes_count: number
  dislikes_count: number
  reposts_count: number
  comments_count: number
  is_hot: boolean
  poll: Poll | null
  images: string[]
  repost_of_id?: string | null
  repost_of?: Post | null
  my_vote?: string | null
  created_at: string
  profiles?: Profile
  has_fizzupped?: boolean
}

export interface Poll {
  question: string
  options: string[]
  votes: number[]
  voted_option: number | null
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  text: string
  created_at: string
  profiles?: Profile
}

export interface Listing {
  id: string
  user_id: string
  title: string
  price: number
  category: string
  description: string
  emoji: string
  school: string
  is_sold: boolean
  images: string[]
  created_at: string
  profiles?: Profile
}

export interface Event {
  id: string
  user_id: string
  title: string
  event_date: string
  location: string
  description: string
  school: string
  going_count: number
  created_at: string
  profiles?: Profile
  has_going?: boolean
}

export interface Message {
  id: string
  from_user_id: string
  to_user_id: string
  text: string
  is_read: boolean
  created_at: string
  from_profile?: Profile
  to_profile?: Profile
}
