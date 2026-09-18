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
      activity_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          project_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          project_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          project_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          client_id: string
          code: string
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          client_id: string
          code: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          code?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brands_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      briefs: {
        Row: {
          created_at: string
          created_by: string
          deliverables_summary: string
          id: string
          key_message: string
          objective: string
          project_id: string
          reference_links: string | null
          target_audience: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deliverables_summary: string
          id?: string
          key_message: string
          objective: string
          project_id: string
          reference_links?: string | null
          target_audience: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deliverables_summary?: string
          id?: string
          key_message?: string
          objective?: string
          project_id?: string
          reference_links?: string | null
          target_audience?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      client_review_items: {
        Row: {
          client_review_id: string
          created_at: string
          feedback_notes: string | null
          file_id: string
          id: string
          task_id: string
          verdict: Database["public"]["Enums"]["qc_verdict"]
        }
        Insert: {
          client_review_id: string
          created_at?: string
          feedback_notes?: string | null
          file_id: string
          id?: string
          task_id: string
          verdict: Database["public"]["Enums"]["qc_verdict"]
        }
        Update: {
          client_review_id?: string
          created_at?: string
          feedback_notes?: string | null
          file_id?: string
          id?: string
          task_id?: string
          verdict?: Database["public"]["Enums"]["qc_verdict"]
        }
        Relationships: [
          {
            foreignKeyName: "client_review_items_client_review_id_fkey"
            columns: ["client_review_id"]
            isOneToOne: false
            referencedRelation: "client_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_review_items_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "project_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_review_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      client_reviews: {
        Row: {
          created_at: string
          general_feedback: string | null
          id: string
          overall_verdict: Database["public"]["Enums"]["client_review_verdict"]
          project_id: string
          reviewed_at: string | null
          round_number: number
          submitted_by: string
        }
        Insert: {
          created_at?: string
          general_feedback?: string | null
          id?: string
          overall_verdict?: Database["public"]["Enums"]["client_review_verdict"]
          project_id: string
          reviewed_at?: string | null
          round_number?: number
          submitted_by: string
        }
        Update: {
          created_at?: string
          general_feedback?: string | null
          id?: string
          overall_verdict?: Database["public"]["Enums"]["client_review_verdict"]
          project_id?: string
          reviewed_at?: string | null
          round_number?: number
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_reviews_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_plans: {
        Row: {
          channel: string
          copy_draft: string | null
          created_at: string
          created_by: string
          id: string
          pillar: string | null
          planned_post_date: string
          project_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          channel: string
          copy_draft?: string | null
          created_at?: string
          created_by: string
          id?: string
          pillar?: string | null
          planned_post_date: string
          project_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          channel?: string
          copy_draft?: string | null
          created_at?: string
          created_by?: string
          id?: string
          pillar?: string | null
          planned_post_date?: string
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link_url: string
          message: string
          source_event_id: string | null
          source_event_type: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link_url: string
          message: string
          source_event_id?: string | null
          source_event_type?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link_url?: string
          message?: string
          source_event_id?: string | null
          source_event_type?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      project_files: {
        Row: {
          asset_group_id: string
          created_at: string
          deleted_at: string | null
          file_name: string
          file_size_bytes: number
          file_type: Database["public"]["Enums"]["file_category"]
          id: string
          mime_type: string
          project_id: string
          storage_bucket: string
          storage_path: string
          task_id: string | null
          uploaded_by: string
          version: number
        }
        Insert: {
          asset_group_id?: string
          created_at?: string
          deleted_at?: string | null
          file_name: string
          file_size_bytes: number
          file_type: Database["public"]["Enums"]["file_category"]
          id?: string
          mime_type: string
          project_id: string
          storage_bucket: string
          storage_path: string
          task_id?: string | null
          uploaded_by: string
          version?: number
        }
        Update: {
          asset_group_id?: string
          created_at?: string
          deleted_at?: string | null
          file_name?: string
          file_size_bytes?: number
          file_type?: Database["public"]["Enums"]["file_category"]
          id?: string
          mime_type?: string
          project_id?: string
          storage_bucket?: string
          storage_path?: string
          task_id?: string | null
          uploaded_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["project_phase"]
          id: string
          project_id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["project_phase"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status: Database["public"]["Enums"]["project_phase"]
          id?: string
          project_id: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["project_phase"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["project_phase"]
          id?: string
          project_id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["project_phase"]
        }
        Relationships: [
          {
            foreignKeyName: "project_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_status_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          brand_id: string
          created_at: string
          created_by: string
          deadline: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          priority: Database["public"]["Enums"]["priority_level"]
          project_code: string
          publication_url: string | null
          publish_note: string | null
          published_at: string | null
          published_by: string | null
          script_not_required: boolean
          sms_owner_id: string
          start_date: string
          status: Database["public"]["Enums"]["project_phase"]
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          created_by: string
          deadline: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          priority?: Database["public"]["Enums"]["priority_level"]
          project_code: string
          publication_url?: string | null
          publish_note?: string | null
          published_at?: string | null
          published_by?: string | null
          script_not_required?: boolean
          sms_owner_id: string
          start_date?: string
          status?: Database["public"]["Enums"]["project_phase"]
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          created_by?: string
          deadline?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          project_code?: string
          publication_url?: string | null
          publish_note?: string | null
          published_at?: string | null
          published_by?: string | null
          script_not_required?: boolean
          sms_owner_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["project_phase"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_sms_owner_id_fkey"
            columns: ["sms_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qc_reviews: {
        Row: {
          created_at: string
          file_id: string
          id: string
          notes: string
          project_id: string
          result: Database["public"]["Enums"]["qc_verdict"]
          reviewed_at: string
          reviewer_id: string
          round_number: number
          task_id: string
        }
        Insert: {
          created_at?: string
          file_id: string
          id?: string
          notes: string
          project_id: string
          result: Database["public"]["Enums"]["qc_verdict"]
          reviewed_at?: string
          reviewer_id: string
          round_number?: number
          task_id: string
        }
        Update: {
          created_at?: string
          file_id?: string
          id?: string
          notes?: string
          project_id?: string
          result?: Database["public"]["Enums"]["qc_verdict"]
          reviewed_at?: string
          reviewer_id?: string
          round_number?: number
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qc_reviews_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "project_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_reviews_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      revision_requests: {
        Row: {
          assigned_to: string
          created_at: string
          id: string
          notes: string
          project_id: string
          qc_review_id: string | null
          requested_at: string
          requested_by: string
          resolved_at: string | null
          round_number: number
          source: Database["public"]["Enums"]["revision_source"]
          status: Database["public"]["Enums"]["revision_status"]
          task_id: string
        }
        Insert: {
          assigned_to: string
          created_at?: string
          id?: string
          notes: string
          project_id: string
          qc_review_id?: string | null
          requested_at?: string
          requested_by: string
          resolved_at?: string | null
          round_number?: number
          source: Database["public"]["Enums"]["revision_source"]
          status?: Database["public"]["Enums"]["revision_status"]
          task_id: string
        }
        Update: {
          assigned_to?: string
          created_at?: string
          id?: string
          notes?: string
          project_id?: string
          qc_review_id?: string | null
          requested_at?: string
          requested_by?: string
          resolved_at?: string | null
          round_number?: number
          source?: Database["public"]["Enums"]["revision_source"]
          status?: Database["public"]["Enums"]["revision_status"]
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revision_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_requests_qc_review_id_fkey"
            columns: ["qc_review_id"]
            isOneToOne: false
            referencedRelation: "qc_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_requests_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          body: string
          call_to_action: string
          content_plan_id: string | null
          created_at: string
          created_by: string
          hook: string
          id: string
          project_id: string
          status: string
          title: string
          updated_at: string
          visual_cues: string
        }
        Insert: {
          body: string
          call_to_action: string
          content_plan_id?: string | null
          created_at?: string
          created_by: string
          hook: string
          id?: string
          project_id: string
          status?: string
          title: string
          updated_at?: string
          visual_cues: string
        }
        Update: {
          body?: string
          call_to_action?: string
          content_plan_id?: string | null
          created_at?: string
          created_by?: string
          hook?: string
          id?: string
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
          visual_cues?: string
        }
        Relationships: [
          {
            foreignKeyName: "scripts_content_plan_id_fkey"
            columns: ["content_plan_id"]
            isOneToOne: false
            referencedRelation: "content_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scripts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scripts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          assignee_id: string
          ended_at: string | null
          id: string
          task_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          assignee_id: string
          ended_at?: string | null
          id?: string
          task_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          assignee_id?: string
          ended_at?: string | null
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          content_plan_id: string | null
          created_at: string
          current_assignee_id: string | null
          deadline: string
          deleted_at: string | null
          id: string
          notes: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          project_id: string
          requires_qc: boolean
          script_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          task_type: Database["public"]["Enums"]["task_type"]
          title: string
          updated_at: string
        }
        Insert: {
          content_plan_id?: string | null
          created_at?: string
          current_assignee_id?: string | null
          deadline: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id: string
          requires_qc?: boolean
          script_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type: Database["public"]["Enums"]["task_type"]
          title: string
          updated_at?: string
        }
        Update: {
          content_plan_id?: string | null
          created_at?: string
          current_assignee_id?: string | null
          deadline?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string
          requires_qc?: boolean
          script_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: Database["public"]["Enums"]["task_type"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_content_plan_id_fkey"
            columns: ["content_plan_id"]
            isOneToOne: false
            referencedRelation: "content_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_current_assignee_id_fkey"
            columns: ["current_assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allocate_deliverable_upload: {
        Args: {
          p_file_name: string
          p_file_size_bytes: number
          p_file_type: Database["public"]["Enums"]["file_category"]
          p_mime_type: string
          p_task_id: string
        }
        Returns: Json
      }
      archive_task: { Args: { p_task_id: string }; Returns: undefined }
      auth_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      commit_deliverable_file: {
        Args: {
          p_asset_group_id: string
          p_file_id: string
          p_file_name: string
          p_file_size_bytes: number
          p_file_type: Database["public"]["Enums"]["file_category"]
          p_mime_type: string
          p_storage_path: string
          p_task_id: string
          p_version: number
        }
        Returns: string
      }
      create_notification: {
        Args: {
          p_link_url: string
          p_message: string
          p_recipient_user_id: string
          p_title: string
        }
        Returns: string
      }
      create_production_task: {
        Args: {
          p_assignee_id?: string
          p_content_plan_id?: string
          p_deadline: string
          p_notes?: string
          p_priority: Database["public"]["Enums"]["priority_level"]
          p_project_id: string
          p_script_id?: string
          p_task_type: Database["public"]["Enums"]["task_type"]
          p_title: string
        }
        Returns: Json
      }
      create_project: {
        Args: {
          p_brand_id: string
          p_deadline: string
          p_description: string
          p_name: string
          p_priority: Database["public"]["Enums"]["priority_level"]
          p_sms_owner_id?: string
          p_start_date: string
        }
        Returns: Json
      }
      dispatch_domain_notification: {
        Args: {
          p_link_url: string
          p_message: string
          p_recipient_id: string
          p_source_event_id?: string
          p_source_event_type?: string
          p_title: string
        }
        Returns: string
      }
      evaluate_project_qc_readiness: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      exceptional_content_update: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_patch: Json
          p_reason: string
        }
        Returns: undefined
      }
      finalize_client_approval: {
        Args: { p_project_id: string }
        Returns: Json
      }
      generate_project_code: { Args: { p_brand_id: string }; Returns: string }
      is_active_committed_deliverable: {
        Args: { p_storage_path: string }
        Returns: boolean
      }
      is_active_user: { Args: never; Returns: boolean }
      is_client_presented_deliverable: {
        Args: { p_file_id: string }
        Returns: boolean
      }
      is_committed_deliverable: {
        Args: { p_storage_path: string }
        Returns: boolean
      }
      is_project_member: { Args: { p_project_id: string }; Returns: boolean }
      log_project_activity: {
        Args: { p_event_type: string; p_metadata?: Json; p_project_id: string }
        Returns: string
      }
      mark_all_notifications_read: { Args: never; Returns: undefined }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      publish_project: {
        Args: {
          p_project_id: string
          p_publication_url: string
          p_publish_note?: string
        }
        Returns: Json
      }
      reassign_task: {
        Args: { p_new_assignee_id: string; p_task_id: string }
        Returns: undefined
      }
      record_client_item_verdict: {
        Args: {
          p_feedback?: string
          p_review_id: string
          p_task_id: string
          p_verdict: Database["public"]["Enums"]["qc_verdict"]
        }
        Returns: Json
      }
      resolve_revision_request: {
        Args: { p_revision_id: string }
        Returns: undefined
      }
      set_project_script_not_required: {
        Args: { p_not_required: boolean; p_project_id: string }
        Returns: undefined
      }
      soft_delete_project_file: {
        Args: { p_file_id: string }
        Returns: undefined
      }
      start_client_re_presentation: {
        Args: { p_project_id: string }
        Returns: Json
      }
      start_client_review: { Args: { p_project_id: string }; Returns: Json }
      start_production: { Args: { p_project_id: string }; Returns: Json }
      submit_qc_verdict: {
        Args: {
          p_notes?: string
          p_task_id: string
          p_verdict: Database["public"]["Enums"]["qc_verdict"]
        }
        Returns: Json
      }
      transition_project_phase: {
        Args: {
          p_project_id: string
          p_target_phase: Database["public"]["Enums"]["project_phase"]
        }
        Returns: Json
      }
      transition_task_status: {
        Args: {
          p_new_status: Database["public"]["Enums"]["task_status"]
          p_task_id: string
        }
        Returns: undefined
      }
      update_task_metadata: {
        Args: {
          p_content_plan_id?: string
          p_deadline: string
          p_notes?: string
          p_priority: Database["public"]["Enums"]["priority_level"]
          p_script_id?: string
          p_task_id: string
          p_task_type?: Database["public"]["Enums"]["task_type"]
          p_title: string
        }
        Returns: undefined
      }
    }
    Enums: {
      client_review_verdict: "PENDING" | "APPROVED" | "REVISION_REQUESTED"
      file_category:
        | "BRIEF"
        | "REFERENCE"
        | "RAW_FOOTAGE"
        | "AUDIO"
        | "DESIGN"
        | "VIDEO"
        | "DOCUMENT"
      priority_level: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
      project_phase:
        | "BRIEF_RECEIVED"
        | "CONTENT_PLANNING"
        | "SCRIPT_READY"
        | "PRODUCTION"
        | "INTERNAL_QC"
        | "CLIENT_REVIEW"
        | "APPROVED"
        | "PUBLISHED"
        | "DONE"
        | "CANCELLED"
      qc_verdict: "APPROVED" | "REVISION_REQUESTED"
      revision_source: "INTERNAL_QC" | "CLIENT"
      revision_status: "OPEN" | "IN_PROGRESS" | "RESOLVED"
      task_status:
        | "TODO"
        | "IN_PROGRESS"
        | "IN_REVIEW"
        | "REVISION_REQUESTED"
        | "APPROVED"
        | "COMPLETED"
      task_type:
        | "CONTENT_PLAN"
        | "SCRIPT"
        | "GRAPHIC_DESIGN"
        | "VIDEO_EDITING"
        | "PUBLISHING"
        | "OTHER"
      user_role:
        | "ADMIN"
        | "CREATIVE_DIRECTOR"
        | "ACCOUNT_EXECUTIVE"
        | "SOCIAL_MEDIA_SPECIALIST"
        | "GRAPHIC_DESIGNER"
        | "VIDEO_EDITOR"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      client_review_verdict: ["PENDING", "APPROVED", "REVISION_REQUESTED"],
      file_category: [
        "BRIEF",
        "REFERENCE",
        "RAW_FOOTAGE",
        "AUDIO",
        "DESIGN",
        "VIDEO",
        "DOCUMENT",
      ],
      priority_level: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      project_phase: [
        "BRIEF_RECEIVED",
        "CONTENT_PLANNING",
        "SCRIPT_READY",
        "PRODUCTION",
        "INTERNAL_QC",
        "CLIENT_REVIEW",
        "APPROVED",
        "PUBLISHED",
        "DONE",
        "CANCELLED",
      ],
      qc_verdict: ["APPROVED", "REVISION_REQUESTED"],
      revision_source: ["INTERNAL_QC", "CLIENT"],
      revision_status: ["OPEN", "IN_PROGRESS", "RESOLVED"],
      task_status: [
        "TODO",
        "IN_PROGRESS",
        "IN_REVIEW",
        "REVISION_REQUESTED",
        "APPROVED",
        "COMPLETED",
      ],
      task_type: [
        "CONTENT_PLAN",
        "SCRIPT",
        "GRAPHIC_DESIGN",
        "VIDEO_EDITING",
        "PUBLISHING",
        "OTHER",
      ],
      user_role: [
        "ADMIN",
        "CREATIVE_DIRECTOR",
        "ACCOUNT_EXECUTIVE",
        "SOCIAL_MEDIA_SPECIALIST",
        "GRAPHIC_DESIGNER",
        "VIDEO_EDITOR",
      ],
    },
  },
} as const

// Domain Enum and Model Type Aliases
export type UserRole = Database["public"]["Enums"]["user_role"]
export type ProjectPhase = Database["public"]["Enums"]["project_phase"]
export type PriorityLevel = Database["public"]["Enums"]["priority_level"]
export type TaskStatus = Database["public"]["Enums"]["task_status"]
export type TaskType = Database["public"]["Enums"]["task_type"]
export type FileCategory = Database["public"]["Enums"]["file_category"]
export type QcVerdict = Database["public"]["Enums"]["qc_verdict"]
export type RevisionSource = Database["public"]["Enums"]["revision_source"]
export type RevisionStatus = Database["public"]["Enums"]["revision_status"]
export type ClientReviewVerdict = Database["public"]["Enums"]["client_review_verdict"]

