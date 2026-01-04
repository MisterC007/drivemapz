// app/lib/database.types.ts
export type Database = {
  public: {
    Tables: {
      trips: {
        Row: {
          id: string
          user_id: string
          name: string
          start_date: string | null
          end_date: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          start_date?: string | null
          end_date?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          start_date?: string | null
          end_date?: string | null
          created_at?: string | null
        }
        Relationships: []
      }

      trip_stops: {
        Row: {
          id: string
          trip_id: string
          stop_index: number
          title: string | null
          kind: string | null // 'start' | 'end' | 'stop'
          lat: number | null
          lng: number | null
          notes: string | null
          arrived_at: string | null
          departed_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          trip_id: string
          stop_index: number
          title?: string | null
          kind?: string | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          arrived_at?: string | null
          departed_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          trip_id?: string
          stop_index?: number
          title?: string | null
          kind?: string | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          arrived_at?: string | null
          departed_at?: string | null
          created_at?: string | null
        }
        Relationships: []
      }

      fuel_logs: {
        Row: {
          id: string
          user_id: string
          trip_id: string
          filled_at: string
          stop_id: string | null
          country_code: string | null
          odometer_km: number | null
          liters: number | null
          total_paid: number | null
          price_per_l: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          trip_id: string
          filled_at?: string
          stop_id?: string | null
          country_code?: string | null
          odometer_km?: number | null
          liters?: number | null
          total_paid?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          trip_id?: string
          filled_at?: string
          stop_id?: string | null
          country_code?: string | null
          odometer_km?: number | null
          liters?: number | null
          total_paid?: number | null
          created_at?: string | null
        }
        Relationships: []
      }

      toll_logs: {
        Row: {
          id: string
          user_id: string
          trip_id: string
          paid_at: string
          country_code: string | null
          road_name: string | null
          amount: number
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          trip_id: string
          paid_at?: string
          country_code?: string | null
          road_name?: string | null
          amount: number
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          trip_id?: string
          paid_at?: string
          country_code?: string | null
          road_name?: string | null
          amount?: number
          notes?: string | null
          created_at?: string | null
        }
        Relationships: []
      }

      trip_track_points: {
        Row: {
          id: string
          user_id: string
          trip_id: string
          lat: number
          lng: number
          accuracy_m: number | null
          speed: number | null
          heading: number | null
          captured_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          trip_id: string
          lat: number
          lng: number
          accuracy_m?: number | null
          speed?: number | null
          heading?: number | null
          captured_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          trip_id?: string
          lat?: number
          lng?: number
          accuracy_m?: number | null
          speed?: number | null
          heading?: number | null
          captured_at?: string | null
          created_at?: string | null
        }
        Relationships: []
      }

user_profiles: {
  Row: {
    user_id: string
    nickname: string
    first_name: string
    last_name: string
    email: string
    street: string | null
    house_number: string | null
    box: string | null
    postal_code: string | null
    city: string | null
    country: string | null
    created_at: string | null
    updated_at: string | null
  }
  Insert: {
    user_id: string
    nickname: string
    first_name: string
    last_name: string
    email: string
    street?: string | null
    house_number?: string | null
    box?: string | null
    postal_code?: string | null
    city?: string | null
    country?: string | null
    created_at?: string | null
    updated_at?: string | null
  }
  Update: {
    user_id?: string
    nickname?: string
    first_name?: string
    last_name?: string
    email?: string
    street?: string | null
    house_number?: string | null
    box?: string | null
    postal_code?: string | null
    city?: string | null
    country?: string | null
    created_at?: string | null
    updated_at?: string | null
  }
  Relationships: []
}

user_vehicles: {
  Row: {
    id: string
    user_id: string
    mode: string
    label: string
    make: string | null
    model: string | null
    avg_consumption: number | null
    tank_capacity: number | null
    fuel: string | null
    created_at: string | null
    updated_at: string | null
  }
  Insert: {
    id?: string
    user_id: string
    mode: string
    label: string
    make?: string | null
    model?: string | null
    avg_consumption?: number | null
    tank_capacity?: number | null
    fuel?: string | null
    created_at?: string | null
    updated_at?: string | null
  }
  Update: {
    id?: string
    user_id?: string
    mode?: string
    label?: string
    make?: string | null
    model?: string | null
    avg_consumption?: number | null
    tank_capacity?: number | null
    fuel?: string | null
    created_at?: string | null
    updated_at?: string | null
  }
  Relationships: []
}

      camper_profiles: {
        Row: {
          id: string
          user_id: string
          vehicle_name: string | null
          fuel_type: string | null
          consumption_l_per_100km: number | null
          tank_capacity_l: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          vehicle_name?: string | null
          fuel_type?: string | null
          consumption_l_per_100km?: number | null
          tank_capacity_l?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          vehicle_name?: string | null
          fuel_type?: string | null
          consumption_l_per_100km?: number | null
          tank_capacity_l?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }

    Views: {}

    // ✅ Voeg je RPC functies toe zodat supabase.rpc(...) niet "never" wordt
    Functions: {
      insert_stop_at: {
        Args: { p_trip_id: string; p_index: number; p_payload: any }
        Returns: unknown
      }
      move_stop: {
        Args: { p_trip_id: string; p_from: number; p_to: number }
        Returns: unknown
      }
      delete_stop_and_reindex: {
        Args: { p_stop_id: string }
        Returns: unknown
      }
    }

    Enums: {}
    CompositeTypes: {}
  }
}
