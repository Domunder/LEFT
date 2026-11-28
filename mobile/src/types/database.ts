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
      event_missions: {
        Row: {
          body: string
          created_at: string
          event_id: string
          id: string
          person_id: string | null
          seq: number
        }
        Insert: {
          body: string
          created_at?: string
          event_id: string
          id?: string
          person_id?: string | null
          seq?: never
        }
        Update: {
          body?: string
          created_at?: string
          event_id?: string
          id?: string
          person_id?: string | null
          seq?: never
        }
        Relationships: [
          {
            foreignKeyName: "event_missions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_missions_event_id_person_id_fkey"
            columns: ["event_id", "person_id"]
            isOneToOne: false
            referencedRelation: "mission_people"
            referencedColumns: ["event_id", "id"]
          },
        ]
      }
      events: {
        Row: {
          cover: string | null
          created_at: string
          demo: string | null
          developed_at: string | null
          ends_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          host_id: string
          id: string
          invite_code: string
          look: Database["public"]["Enums"]["film_look"]
          max_members: number
          missions_per_guest: number | null
          name: string
          reveal_delay_hours: number | null
          reveal_mode: string
          roll_size: number | null
          status: Database["public"]["Enums"]["event_status"]
        }
        Insert: {
          cover?: string | null
          created_at?: string
          demo?: string | null
          developed_at?: string | null
          ends_at: string
          event_type?: Database["public"]["Enums"]["event_type"]
          host_id: string
          id?: string
          invite_code?: string
          look?: Database["public"]["Enums"]["film_look"]
          max_members: number
          missions_per_guest?: number | null
          name: string
          reveal_delay_hours?: number | null
          reveal_mode?: string
          roll_size?: number | null
          status?: Database["public"]["Enums"]["event_status"]
        }
        Update: {
          cover?: string | null
          created_at?: string
          demo?: string | null
          developed_at?: string | null
          ends_at?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          host_id?: string
          id?: string
          invite_code?: string
          look?: Database["public"]["Enums"]["film_look"]
          max_members?: number
          missions_per_guest?: number | null
          name?: string
          reveal_delay_hours?: number | null
          reveal_mode?: string
          roll_size?: number | null
          status?: Database["public"]["Enums"]["event_status"]
        }
        Relationships: []
      }
      member_missions: {
        Row: {
          dealt_at: string
          event_id: string
          mission_id: string
          photo_id: string | null
          user_id: string
        }
        Insert: {
          dealt_at?: string
          event_id: string
          mission_id: string
          photo_id?: string | null
          user_id: string
        }
        Update: {
          dealt_at?: string
          event_id?: string
          mission_id?: string
          photo_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_missions_event_id_user_id_fkey"
            columns: ["event_id", "user_id"]
            isOneToOne: false
            referencedRelation: "event_members"
            referencedColumns: ["event_id", "user_id"]
          },
          {
            foreignKeyName: "member_missions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "event_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_missions_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_people: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          event_id: string
          id: string
          name: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          event_id: string
          id?: string
          name: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          event_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_people_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
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
      photo_reports: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          photo_id: string | null
          photo_owner_id: string | null
          reason: string
          reporter_id: string | null
          resolution: string | null
          resolved_at: string | null
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          photo_id?: string | null
          photo_owner_id?: string | null
          reason?: string
          reporter_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          photo_id?: string | null
          photo_owner_id?: string | null
          reason?: string
          reporter_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photo_reports_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_reports_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          blurhash: string | null
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
          blurhash?: string | null
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
          blurhash?: string | null
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
      assign_mission_person: {
        Args: { p_person_id: string; p_user_id?: string }
        Returns: undefined
      }
      auto_assign_missions: { Args: { p_event_id: string }; Returns: number }
      can_edit_missions: { Args: { p_event_id: string }; Returns: boolean }
      claim_mission_person: {
        Args: { p_event_id: string; p_person_id: string }
        Returns: undefined
      }
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
          p_missions_per_guest?: number
          p_name: string
          p_roll_size: number
          p_transaction_id?: string
        }
        Returns: {
          cover: string | null
          created_at: string
          demo: string | null
          developed_at: string | null
          ends_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          host_id: string
          id: string
          invite_code: string
          look: Database["public"]["Enums"]["film_look"]
          max_members: number
          missions_per_guest: number | null
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
      deal_missions: { Args: { p_event_id: string }; Returns: undefined }
      deal_one_mission: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
      demo_daily_limit: { Args: never; Returns: number }
      demo_length: { Args: never; Returns: string }
      demo_retention: { Args: never; Returns: string }
      demo_template_id: { Args: never; Returns: string }
      develop_expired_events: { Args: never; Returns: number }
      dispatch_notifications: { Args: never; Returns: boolean }
      dispatch_purge: { Args: never; Returns: boolean }
      end_event: {
        Args: { p_event_id: string }
        Returns: {
          cover: string | null
          created_at: string
          demo: string | null
          developed_at: string | null
          ends_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          host_id: string
          id: string
          invite_code: string
          look: Database["public"]["Enums"]["film_look"]
          max_members: number
          missions_per_guest: number | null
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
      event_gallery: {
        Args: { p_event_id: string }
        Returns: {
          blurhash: string
          height: number
          id: string
          status: Database["public"]["Enums"]["photo_status"]
          taken_at: string
          user_id: string
          width: number
        }[]
      }
      event_storage_paths: {
        Args: { p_event_id: string }
        Returns: {
          path: string
        }[]
      }
      event_type_missions: {
        Args: { p_event_type: Database["public"]["Enums"]["event_type"] }
        Returns: string[]
      }
      events_due_for_purge: {
        Args: { p_limit?: number }
        Returns: {
          event_id: string
        }[]
      }
      free_max_members: { Args: never; Returns: number }
      general_missions: { Args: never; Returns: string[] }
      generate_invite_code: { Args: never; Returns: string }
      generate_missions: { Args: { p_event_id: string }; Returns: number }
      invoke_edge_function: { Args: { p_name: string }; Returns: boolean }
      is_event_developed: { Args: { p_event_id: string }; Returns: boolean }
      is_event_due_for_purge: { Args: { p_event_id: string }; Returns: boolean }
      is_event_host: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
      is_event_member: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
      join_event: {
        Args: { p_display_name: string; p_invite_code: string }
        Returns: string
      }
      invite_preview: {
        Args: { p_invite_code: string }
        Returns: {
          cover: string
          ends_at: string
          event_id: string
          host_name: string
          look: string
          name: string
          reveal_delay_hours: number
          reveal_mode: string
          roll_size: number
          status: string
        }[]
      }
      mark_photo_uploaded: {
        Args: {
          p_blurhash?: string
          p_height: number
          p_photo_id: string
          p_width: number
        }
        Returns: undefined
      }
      max_event_days: { Args: never; Returns: number }
      max_event_members: { Args: never; Returns: number }
      max_event_missions: { Args: never; Returns: number }
      max_mission_people: { Args: never; Returns: number }
      mission_people_for_invite: {
        Args: { p_invite_code: string }
        Returns: {
          mine: boolean
          name: string
          person_id: string
        }[]
      }
      my_missions: {
        Args: { p_event_id: string }
        Returns: {
          body: string
          mission_id: string
          personal: boolean
          photo_id: string
        }[]
      }
      notification_recipients: {
        Args: { p_notification_id: string }
        Returns: {
          shots_left: number
          token: string
        }[]
      }
      orphaned_storage_paths: {
        Args: { p_limit?: number }
        Returns: {
          path: string
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
      report_photo: {
        Args: { p_photo_id: string; p_reason?: string }
        Returns: undefined
      }
      retention_period: { Args: never; Returns: string }
      set_event_reveal: {
        Args: { p_delay_hours?: number; p_event_id: string; p_mode: string }
        Returns: Database["public"]["Tables"]["events"]["Row"]
      }
      seed_missions: {
        Args: { p_event_id: string; p_per_guest: number }
        Returns: undefined
      }
      set_missions: {
        Args: { p_event_id: string; p_per_guest: number }
        Returns: {
          cover: string | null
          created_at: string
          demo: string | null
          developed_at: string | null
          ends_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          host_id: string
          id: string
          invite_code: string
          look: Database["public"]["Enums"]["film_look"]
          max_members: number
          missions_per_guest: number | null
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
      set_photo_mission: {
        Args: { p_mission_id?: string; p_photo_id: string }
        Returns: undefined
      }
      start_demo: {
        Args: { p_display_name?: string }
        Returns: {
          cover: string | null
          created_at: string
          demo: string | null
          developed_at: string | null
          ends_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          host_id: string
          id: string
          invite_code: string
          look: Database["public"]["Enums"]["film_look"]
          max_members: number
          missions_per_guest: number | null
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
      start_event: {
        Args: { p_event_id: string }
        Returns: {
          cover: string | null
          created_at: string
          demo: string | null
          developed_at: string | null
          ends_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          host_id: string
          id: string
          invite_code: string
          look: Database["public"]["Enums"]["film_look"]
          max_members: number
          missions_per_guest: number | null
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

