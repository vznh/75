// models/entry
export interface Entry {
  id: string;
  user_id: string;
  day_number: number;
  channel_id: string;
  status: 'in_progress' | 'completed';
  created_at: string;
  completed_at?: string;
}

export interface EntrySession {
  userId: string;
  channelId: string;
  dayNumber: number;
  goals: string[];
  weeklyGoals: string[];
  submissions: Map<string, GoalSubmission>;
  weeklySubmissions: Map<string, GoalSubmission>;
  goalMessages: Map<string, string>;
  weeklyGoalMessages: Map<string, string>;
}

import { Submission } from './submission';

export type GoalSubmission = {
  goalName: string;
  content?: string;
  mediaUrl?: string;
  isValid: boolean;
};