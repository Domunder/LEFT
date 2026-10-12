export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      budget_reservations: {
        Row: {
          actual_seconds: number | null
          charged_seconds: number | null
          clip_id: string | null
          committed_at: string | null
          created_at: string
          event_id: string
          expires_at: string
          id: string
          resolved_at: string | null
          seconds: number
          settled_at: string | null
          user_id: string
        }
        Insert: {
          actual_seconds?: number | null
          charged_seconds?: number | null
          clip_id?: string | null
          committed_at?: string | null
          created_at?: string
          event_id: string
          expires_at: string
          id?: string
          resolved_at?: string | null
          seconds: number
          settled_at?: string | null
          user_id: string
        }
        Update: {
          actual_seconds?: number | null
          charged_seconds?: number | null
          clip_id?: string | null
          committed_at?: string | null
          created_at?: string
          event_id?: string
          expires_at?: string
          id?: string
          resolved_at?: string | null
          seconds?: number
          settled_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_reservations_clip_id_fkey"
            columns: ["clip_id"]
            isOneToOne: false
            referencedRelation: "clips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_reservations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      clips: {
        Row: {
          created_at: string
          duration_seconds: number
          event_id: string
          id: string
          recorded_at: string
          status: Database["public"]["Enums"]["clip_status"]
          storage_path: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds: number
          event_id: string
          id?: string
          recorded_at?: string
          status?: Database["public"]["Enums"]["clip_status"]
          storage_path?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          event_id?: string
          id?: string
          recorded_at?: string
          status?: Database["public"]["Enums"]["clip_status"]
          storage_path?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clips_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_members: {
        Row: {
          display_name: string
          event_id: string
          joined_at: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          display_name: string
          event_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          display_name?: string
          event_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_members_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          budget_seconds: number
          created_at: string
          ends_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          format: Database["public"]["Enums"]["film_format"]
          host_id: string
          id: string
          invite_code: string
          max_members: number
          name: string
          status: Database["public"]["Enums"]["event_status"]
          used_seconds: number
        }
        Insert: {
          budget_seconds: number
          created_at?: string
          ends_at: string
          event_type?: Database["public"]["Enums"]["event_type"]
          format?: Database["public"]["Enums"]["film_format"]
          host_id: string
          id?: string
          invite_code?: string
          max_members: number
          name: string
          status?: Database["public"]["Enums"]["event_status"]
          used_seconds?: number
        }
        Update: {
          budget_seconds?: number
          created_at?: string
          ends_at?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          format?: Database["public"]["Enums"]["film_format"]
          host_id?: string
          id?: string
          invite_code?: string
          max_members?: number
          name?: string
          status?: Database["public"]["Enums"]["event_status"]
          used_seconds?: number
        }
        Relationships: []
      }
      purchases: {
        Row: {
          consumed_at: string | null
          consumed_by_event_id: string | null
          created_at: string
          currency: string | null
          environment: string
          id: string
          max_members: number
          price_cents: number | null
          product_id: string
          purchased_at: string
          store: string | null
          store_transaction_id: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          consumed_by_event_id?: string | null
          created_at?: string
          currency?: string | null
          environment: string
          id?: string
          max_members: number
          price_cents?: number | null
          product_id: string
          purchased_at: string
          store?: string | null
          store_transaction_id: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          consumed_by_event_id?: string | null
          created_at?: string
          currency?: string | null
          environment?: string
          id?: string
          max_members?: number
          price_cents?: number | null
          product_id?: string
          purchased_at?: string
          store?: string | null
          store_transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_consumed_by_event_id_fkey"
            columns: ["consumed_by_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      available_seconds: { Args: { p_event_id: string }; Returns: number }
      budget_plan: { Args: { p_max_members: number }; Returns: number }
      close_expired_events: { Args: never; Returns: number }
      commit_reservation: {
        Args: { p_actual_seconds: number; p_reservation_id: string }
        Returns: {
          budget_seconds: number
          charged_seconds: number
          clip_id: string
          status: string
          used_after: number
        }[]
      }
      compile_film: {
        Args: { p_event_id: string }
        Returns: {
          budget_seconds: number
          created_at: string
          ends_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          format: Database["public"]["Enums"]["film_format"]
          host_id: string
          id: string
          invite_code: string
          max_members: number
          name: string
          status: Database["public"]["Enums"]["event_status"]
          used_seconds: number
        }
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_event: {
        Args: {
          p_budget_seconds?: number
          p_ends_at: string
          p_event_type: Database["public"]["Enums"]["event_type"]
          p_format: Database["public"]["Enums"]["film_format"]
          p_max_members: number
          p_name: string
          p_transaction_id?: string
        }
        Returns: {
          budget_seconds: number
          created_at: string
          ends_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          format: Database["public"]["Enums"]["film_format"]
          host_id: string
          id: string
          invite_code: string
          max_members: number
          name: string
          status: Database["public"]["Enums"]["event_status"]
          used_seconds: number
        }
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finish_event: {
        Args: { p_event_id: string }
        Returns: {
          budget_seconds: number
          created_at: string
          ends_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          format: Database["public"]["Enums"]["film_format"]
          host_id: string
          id: string
          invite_code: string
          max_members: number
          name: string
          status: Database["public"]["Enums"]["event_status"]
          used_seconds: number
        }
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_invite_code: { Args: never; Returns: string }
      is_event_member: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
      join_event: {
        Args: { p_display_name: string; p_invite_code: string }
        Returns: string
      }
      max_take_seconds: { Args: never; Returns: number }
      prepare_account_deletion: {
        Args: { p_user_id: string }
        Returns: {
          clip_paths: string[]
          hosted_event_ids: string[]
        }[]
      }
      release_reservation: {
        Args: { p_reservation_id: string }
        Returns: number
      }
      remaining_seconds: { Args: { p_event_id: string }; Returns: number }
      reserve_budget: {
        Args: { p_event_id: string; p_seconds: number }
        Returns: {
          granted_seconds: number
          remaining_after: number
          reservation_id: string
        }[]
      }
      resolve_takes: { Args: { p_event_id: string }; Returns: undefined }
      start_event: {
        Args: { p_event_id: string }
        Returns: {
          budget_seconds: number
          created_at: string
          ends_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          format: Database["public"]["Enums"]["film_format"]
          host_id: string
          id: string
          invite_code: string
          max_members: number
          name: string
          status: Database["public"]["Enums"]["event_status"]
          used_seconds: number
        }
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unlock_max_members: { Args: { p_product_id: string }; Returns: number }
    }
    Enums: {
      clip_status: "pending" | "uploaded" | "failed"
      event_status: "setup" | "live" | "processing" | "ready"
      event_type:
        | "wedding"
        | "birthday"
        | "trip"
        | "party"
        | "graduation"
        | "company"
        | "other"
      film_format: "vertical" | "horizontal"
      member_role: "host" | "guest"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      clip_status: ["pending", "uploaded", "failed"],
      event_status: ["setup", "live", "processing", "ready"],
      event_type: [
        "wedding",
        "birthday",
        "trip",
        "party",
        "graduation",
        "company",
        "other",
      ],
      film_format: ["vertical", "horizontal"],
      member_role: ["host", "guest"],
    },
  },
} as const

