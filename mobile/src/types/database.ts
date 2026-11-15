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
      event_members: {
        Row: {
          display_name: string
          event_id: string
          joined_at: string
          role: Database["public"]["Enums"]["member_role"]
          shots_taken: number
          user_id: string
        }
        Insert: {
          display_name: string
          event_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          shots_taken?: number
          user_id: string
        }
        Update: {
          display_name?: string
          event_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          shots_taken?: number
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
          created_at: string
          developed_at: string | null
          ends_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          host_id: string
          id: string
          invite_code: string
          look: Database["public"]["Enums"]["film_look"]
          max_members: number
          name: string
          roll_size: number | null
          status: Database["public"]["Enums"]["event_status"]
        }
        Insert: {
          created_at?: string
          developed_at?: string | null
          ends_at: string
          event_type?: Database["public"]["Enums"]["event_type"]
          host_id: string
          id?: string
          invite_code?: string
          look?: Database["public"]["Enums"]["film_look"]
          max_members: number
          name: string
          roll_size?: number | null
          status?: Database["public"]["Enums"]["event_status"]
        }
        Update: {
          created_at?: string
          developed_at?: string | null
          ends_at?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          host_id?: string
          id?: string
          invite_code?: string
          look?: Database["public"]["Enums"]["film_look"]
          max_members?: number
          name?: string
          roll_size?: number | null
          status?: Database["public"]["Enums"]["event_status"]
        }
        Relationships: []
      }
      notifications: {
        Row: {
          claimed_at: string | null
          created_at: string
          event_id: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          recipients: number | null
          sent_at: string | null
          skipped: string | null
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          recipients?: number | null
          sent_at?: string | null
          skipped?: string | null
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          recipients?: number | null
          sent_at?: string | null
          skipped?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          created_at: string
          event_id: string
          height: number | null
          id: string
          status: Database["public"]["Enums"]["photo_status"]
          storage_path: string | null
          taken_at: string
          thumb_path: string | null
          user_id: string | null
          width: number | null
        }
        Insert: {
          created_at?: string
          event_id: string
          height?: number | null
          id: string
          status?: Database["public"]["Enums"]["photo_status"]
          storage_path?: string | null
          taken_at?: string
          thumb_path?: string | null
          user_id?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string
          event_id?: string
          height?: number | null
          id?: string
          status?: Database["public"]["Enums"]["photo_status"]
          storage_path?: string | null
          taken_at?: string
          thumb_path?: string | null
          user_id?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
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
      push_tokens: {
        Row: {
          created_at: string
          notify_developed: boolean
          notify_reminder: boolean
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          notify_developed?: boolean
          notify_reminder?: boolean
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          notify_developed?: boolean
          notify_reminder?: boolean
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_notifications: {
        Args: { p_limit?: number }
        Returns: {
          event_id: string
          event_name: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
        }[]
      }
      claim_shot: {
        Args: { p_event_id: string; p_photo_id: string; p_taken_at?: string }
        Returns: {
          photo_id: string
          shots_left: number
          shots_taken: number
        }[]
      }
      complete_notification: {
        Args: {
          p_notification_id: string
          p_recipients: number
          p_skipped?: string
        }
        Returns: undefined
      }
      create_event: {
        Args: {
          p_ends_at: string
          p_event_type: Database["public"]["Enums"]["event_type"]
          p_look: Database["public"]["Enums"]["film_look"]
          p_max_members: number
          p_name: string
          p_roll_size: number
          p_transaction_id?: string
        }
        Returns: {
          created_at: string
          developed_at: string | null
          ends_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          host_id: string
          id: string
          invite_code: string
          look: Database["public"]["Enums"]["film_look"]
          max_members: number
          name: string
          roll_size: number | null
          status: Database["public"]["Enums"]["event_status"]
        }
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      develop_expired_events: { Args: never; Returns: number }
      dispatch_notifications: { Args: never; Returns: boolean }
      dispatch_purge: { Args: never; Returns: boolean }
      end_event: {
        Args: { p_event_id: string }
        Returns: {
          created_at: string
          developed_at: string | null
          ends_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          host_id: string
          id: string
          invite_code: string
          look: Database["public"]["Enums"]["film_look"]
          max_members: number
          name: string
          roll_size: number | null
          status: Database["public"]["Enums"]["event_status"]
        }
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enqueue_ending_reminders: { Args: never; Returns: number }
      event_storage_paths: {
        Args: { p_event_id: string }
        Returns: {
          path: string
        }[]
      }
      events_due_for_purge: {
        Args: { p_limit?: number }
        Returns: {
          event_id: string
        }[]
      }
      free_max_members: { Args: never; Returns: number }
      generate_invite_code: { Args: never; Returns: string }
      invoke_edge_function: { Args: { p_name: string }; Returns: boolean }
      is_event_developed: { Args: { p_event_id: string }; Returns: boolean }
      is_event_due_for_purge: { Args: { p_event_id: string }; Returns: boolean }
      is_event_member: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
      join_event: {
        Args: { p_display_name: string; p_invite_code: string }
        Returns: string
      }
      max_event_days: { Args: never; Returns: number }
      max_event_members: { Args: never; Returns: number }
      notification_recipients: {
        Args: { p_notification_id: string }
        Returns: {
          shots_left: number
          token: string
        }[]
      }
      prepare_account_deletion: {
        Args: { p_user_id: string }
        Returns: {
          hosted_event_ids: string[]
          photo_paths: string[]
        }[]
      }
      purge_event: { Args: { p_event_id: string }; Returns: boolean }
      register_push_token: {
        Args: {
          p_notify_developed?: boolean
          p_notify_reminder?: boolean
          p_platform: string
          p_token: string
        }
        Returns: undefined
      }
      reminder_lead: { Args: never; Returns: string }
      reminder_min_event_length: { Args: never; Returns: string }
      retention_period: { Args: never; Returns: string }
      start_event: {
        Args: { p_event_id: string }
        Returns: {
          created_at: string
          developed_at: string | null
          ends_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          host_id: string
          id: string
          invite_code: string
          look: Database["public"]["Enums"]["film_look"]
          max_members: number
          name: string
          roll_size: number | null
          status: Database["public"]["Enums"]["event_status"]
        }
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unlimited_roll_cap: { Args: never; Returns: number }
      unlock_max_members: { Args: { p_product_id: string }; Returns: number }
      unregister_push_token: { Args: { p_token: string }; Returns: undefined }
    }
    Enums: {
      event_status: "setup" | "live" | "developed"
      event_type:
        | "wedding"
        | "birthday"
        | "trip"
        | "party"
        | "graduation"
        | "company"
        | "other"
      film_look: "golden" | "chrome" | "faded" | "mono"
      member_role: "host" | "guest"
      notification_kind: "developed" | "ending_soon"
      photo_status: "pending" | "uploaded" | "failed"
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
      event_status: ["setup", "live", "developed"],
      event_type: [
        "wedding",
        "birthday",
        "trip",
        "party",
        "graduation",
        "company",
        "other",
      ],
      film_look: ["golden", "chrome", "faded", "mono"],
      member_role: ["host", "guest"],
      notification_kind: ["developed", "ending_soon"],
      photo_status: ["pending", "uploaded", "failed"],
    },
  },
} as const

