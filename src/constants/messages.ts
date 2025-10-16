// constants/messages
export const MESSAGES = {
	ENTRY: {
		CREATION_STARTED:
			"(・∀・) Entry creation started! Check the archive channel for your thread.",
		CREATION_ERROR: "(ಠ_ಠ) Error starting entry. Please try again.",
		ALREADY_EXISTS: "Thread already exists for user - Day",
		ALL_GOALS_COMPLETE:
			"✅ All goals completed! Entry will be finalized shortly.",
		THREAD_SHARED: "(・∀・) Thread shared successfully!",
		THREAD_SHARE_ERROR: "(ಠ_ಠ) Error sharing thread. Please try again.",
		PREVIOUS_ENTRIES_DM: "(・∀・) Previous entries info sent via DM.",
		PREVIOUS_ENTRIES_ERROR: "(ಠ_ಠ) Error retrieving entries. Please try again.",
		NO_MEMBER_INFO: "(ಠ_ಠ) Could not find member information.",
	},
	SUBMISSION: {
		INVALID_GOAL:
			"(ಠ_ಠ) Could not determine which goal this submission is for. Please reply to a specific goal embed.",
		ALREADY_SUBMITTED:
			"(・_・) You already submitted this goal. First submission counts!",
		GOAL_NOT_FOUND: "❌ Error: Goal definition not found.",
		SUBMISSION_SUCCESS: "✅ submitted successfully!",
		MISSING_GOALS: "📋 goal(s) remaining:",
		MISSING_WEEKLY_GOALS: "📅 weekly goal(s) remaining:",
	},
	REMINDER: {
		SENT: "✅ Reminder sent!",
		LAST_CALL_SENT: "✅ Last call reminder sent!",
		SEND_ERROR: "❌ Error sending reminder. Check console for details.",
		LAST_CALL_ERROR: "❌ Error sending last call. Check console for details.",
	},
	ADMIN: {
		REFRESH_SUCCESS: "✅ Status and history refreshed!",
		REFRESH_ERROR: "❌ Error refreshing status. Check console for details.",
		DAY_INFO: "📅 **Current Day:**",
		DAY_ERROR: "❌ Error getting day info. Check console for details.",
	},
	ERROR: {
		SUBMISSION_VALIDATION: "❌ Invalid submission for",
		REQUIREMENTS: "Please provide:",
	},
	REACTIONS: {
		ROLE_ADDED: "Added goal to your roles.",
		ROLE_REMOVED: "❌ Removed goal from your roles.",
		DM_ERROR: "Could not send DM to user:",
	},
} as const;
