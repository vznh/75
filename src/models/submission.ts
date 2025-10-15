// models/submission
export interface Submission {
  id: string;
  entry_id: string;
  goal_name: string;
  content?: string;
  media_url?: string;
  submitted_at: string;
}