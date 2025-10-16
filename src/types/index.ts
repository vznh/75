// types/index.ts
export interface User {
	discord_id: string;
	username: string;
	created_at: string;
}

export interface Entry {
	id: string;
	user_id: string;
	day_number: number;
	channel_id: string;
	status: "in_progress" | "completed";
	created_at: string;
	completed_at?: string;
}

export interface Submission {
	id: string;
	entry_id: string;
	goal_name: string;
	content?: string;
	media_url?: string;
	submitted_at: string;
}

export interface GoalDefinition {
	name: string; // Display name (e.g., "LeetCode")
	role: string; // Discord role name (e.g., "leetcode")
	emoji: string; // Emoji for the goal (e.g., "💻")
	description: string; // "Submit a LeetCode solution."
	requiresImage: boolean;
	requiresText: boolean;
	validation?: (content?: string, hasImage?: boolean) => boolean;
}

export interface GoalSubmission {
	goalName: string;
	content?: string;
	mediaUrl?: string;
	isValid: boolean;
}

export interface EntrySession {
	userId: string;
	channelId: string;
	dayNumber: number;
	goals: string[]; // Array of role names
	weeklyGoals: string[]; // Array of weekly goal role names
	submissions: Map<string, GoalSubmission>; // goal name -> submission
	weeklySubmissions: Map<string, GoalSubmission>; // weekly goal name -> submission
	goalMessages: Map<string, string>; // goal name -> message ID of the goal embed
	weeklyGoalMessages: Map<string, string>; // weekly goal name -> message ID of the weekly goal embed
}
