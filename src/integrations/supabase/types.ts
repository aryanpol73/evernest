export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          family_id: string
          id: number
          source: string
          target_id: string | null
          target_name: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          family_id: string
          id?: never
          source?: string
          target_id?: string | null
          target_name?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          family_id?: string
          id?: never
          source?: string
          target_id?: string | null
          target_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          created_at: string
          dismissed_reminder: boolean
          expiry_date: string | null
          family_id: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          member_id: string | null
          name: string
          tags: string[] | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          dismissed_reminder?: boolean
          expiry_date?: string | null
          family_id: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          member_id?: string | null
          name: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          dismissed_reminder?: boolean
          expiry_date?: string | null
          family_id?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          member_id?: string | null
          name?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_member_same_family"
            columns: ["member_id", "family_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id", "family_id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      family_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          family_id: string
          id: string
          invited_by: string | null
          revoked_at: string | null
          role: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          family_id: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          family_id?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_invites_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          blood_group: string | null
          created_at: string
          date_of_birth: string | null
          family_id: string
          id: string
          name: string
          notes: string | null
          parent_member_id: string | null
          phone: string | null
          relation: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          blood_group?: string | null
          created_at?: string
          date_of_birth?: string | null
          family_id: string
          id?: string
          name: string
          notes?: string | null
          parent_member_id?: string | null
          phone?: string | null
          relation?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          blood_group?: string | null
          created_at?: string
          date_of_birth?: string | null
          family_id?: string
          id?: string
          name?: string
          notes?: string | null
          parent_member_id?: string | null
          phone?: string | null
          relation?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_parent_same_family"
            columns: ["parent_member_id", "family_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id", "family_id"]
          },
        ]
      }
      family_memberships: {
        Row: {
          created_at: string
          family_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_memberships_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          id: string
          onboarding_completed: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          onboarding_completed?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          onboarding_completed?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_family_invite: { Args: { _token: string }; Returns: string }
      can_edit_family: { Args: { _family_id: string }; Returns: boolean }
      can_read_family: { Args: { _family_id: string }; Returns: boolean }
      create_family_invite: {
        Args: { _email: string; _family_id: string; _role: string }
        Returns: string
      }
      delete_my_account: { Args: never; Returns: undefined }
      family_role: { Args: { _family_id: string }; Returns: string }
      generate_mfa_recovery_codes: { Args: never; Returns: string[] }
      list_family_access: {
        Args: { _family_id: string }
        Returns: {
          email: string
          full_name: string
          joined_at: string
          role: string
          user_id: string
        }[]
      }
      list_my_storage_paths: { Args: never; Returns: string[] }
      mfa_recovery_codes_remaining: { Args: never; Returns: number }
      mfa_satisfied: { Args: never; Returns: boolean }
      owns_family: { Args: { _family_id: string }; Returns: boolean }
      owns_storage_path: { Args: { _path: string }; Returns: boolean }
      pin_status: { Args: never; Returns: Json }
      preview_family_invite: { Args: { _token: string }; Returns: Json }
      record_document_access: {
        Args: { _action: string; _document_id: string }
        Returns: undefined
      }
      redeem_mfa_recovery_code: { Args: { _code: string }; Returns: Json }
      remove_family_access: {
        Args: { _family_id: string; _user_id: string }
        Returns: undefined
      }
      remove_pin: { Args: { _current_pin: string }; Returns: Json }
      reset_pin_after_login: { Args: never; Returns: undefined }
      revoke_family_invite: { Args: { _invite_id: string }; Returns: undefined }
      set_family_role: {
        Args: { _family_id: string; _role: string; _user_id: string }
        Returns: undefined
      }
      set_pin: {
        Args: { _current_pin?: string; _new_pin: string }
        Returns: Json
      }
      storage_path_role: { Args: { _path: string }; Returns: string }
      verify_pin: { Args: { _pin: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
