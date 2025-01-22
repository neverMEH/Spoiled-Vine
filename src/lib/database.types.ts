export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          bio: string | null
          location: string | null
          last_login: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          location?: string | null
          last_login?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          location?: string | null
          last_login?: string | null
          created_at?: string
          updated_at?: string
        }
        review_violations: {
          Row: {
            id: string
            review_id: string
            product_id: string
            violations: Json[]
            scanned_at: string
            overridden: boolean
            overridden_by: string | null
            overridden_at: string | null
            created_at: string
          }
          Insert: {
            id?: string
            review_id: string
            product_id: string
            violations: Json[]
            scanned_at?: string
            overridden?: boolean
            overridden_by?: string | null
            overridden_at?: string | null
            created_at?: string
          }
          Update: {
            id?: string
            review_id?: string
            product_id?: string
            violations?: Json[]
            scanned_at?: string
            overridden?: boolean
            overridden_by?: string | null
            overridden_at?: string | null
            created_at?: string
          }
        }
      }
    }
  }
}