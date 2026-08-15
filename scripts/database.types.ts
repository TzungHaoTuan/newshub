// ponytail: hand-written from the confirmed schema instead of `supabase gen types`,
// which needs a personal access token this dashboard doesn't expose without one.
// Re-generate properly via CLI if the schema starts changing often.
export type Database = {
  public: {
    Tables: {
      articles: {
        Row: {
          id: string;
          source: string;
          category: string | null;
          tags: string[];
          title: string;
          summary: string | null;
          link: string;
          published_at: string;
          fetched_at: string;
        };
        Insert: {
          id?: string;
          source: string;
          category?: string | null;
          tags?: string[];
          title: string;
          summary?: string | null;
          link: string;
          published_at: string;
          fetched_at?: string;
        };
        Update: {
          id?: string;
          source?: string;
          category?: string | null;
          tags?: string[];
          title?: string;
          summary?: string | null;
          link?: string;
          published_at?: string;
          fetched_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
