// constants/plaintext
export const PLAINTEXT_MESSAGES = {
	// Instructions
	INSTRUCTIONS:
	  "## Instructions\n" +
		"This bot is meant to track your 75 progress, check if you have completed your goals, " +
		"share to others and hold your archive. Below are the two actions that you can take " +
		"to create an entry or review your previous entries. You'll know if you completed your entry if you check #statuses.\n\n" +
		"**Create an entry** gets you started with a new thread to submit - you cannot create " +
		"a new thread if one is existent.\n\n" +
		'**View previous entries** sends you a DM (if permissible) with all of the days and their respective threads."',

	// Entry related
	ENTRY_CREATION_PROMPT: "The bot is successfully loaded. Use any action below to log.",
	ENTRY_COMPLETE: "**You completed your entry for {displayName}!**\n\nThread is now archived. Click the button below to share your entry.",
	ENTRY_THREAD_ARCHIVED: "Thread is now archived. Click the button below to share your entry.",
	NO_PREVIOUS_ENTRIES: "No previous entries found. Start your challenge with the \"Create an entry\" button!\n",
	ARCHIVE_CHANNEL_NOT_FOUND: "Archive channel not found. Please contact an administrator.\n",
	ERROR_RETRIEVING_ENTRIES: "Error retrieving previous entries. Please try again later.\n",
	COULD_NOT_SEND_DM: "**{displayName}**\nCould not send DM. Check your previous entries using the buttons.",

	// Goal submission
	REPLY_TO_GOAL: "Reply to each goal below with your submission - each goal has its own instructions",
	GOAL_INSTRUCTIONS:
		"* Reply to each goal below with your submission - each goal has its own instructions\n" +
		"* You can reply to any goal at any time\n" +
		"* You can submit multiple times for the same goal, but one submission will count\n" +
		"* **Weekly goals must be completed by the end of the week (today)**\n",

	// Thread sharing
	SHARE_SUCCESS: "Successfully shared thread {threadId} for user {displayName}",
	SHARE_ATTACHMENTS_PREFIX: "**Attachments:**\n",

	// Status updates
	REFRESHING_THREAD_CACHE: "🔄 Force refreshing status and history...",
	THREAD_CACHE_REFRESHED: "✅ Thread cache refreshed",
	FORCE_REFRESH_COMPLETED: "✅ Force refresh completed",

	// Role management
	GOAL_ADDED: "Added **{goalName}** to your roles. It should appear on your next valid entry.",
	GOAL_REMOVED: "Removed **{goalName}** from your roles.",

	// Error messages (general)
	ERROR_OCCURRED: "An error occurred. Please try again later.",
	THREAD_NOT_FOUND: "Thread not found",
	CHANNEL_NOT_FOUND: "Channel not found",
	COULD_NOT_FIND_MEMBER: "Could not find member",

	// Thread naming
	THREAD_NAME_ENTRY: "{displayName}-entry-day-{dayNumber}",
	THREAD_NAME_ARCHIVE: "archive-{displayName}-entry-day-{dayNumber}",
	THREAD_NAME_RENAMED: "archive-{threadName}",

	// Completion messages
	DAILY_GOALS_HEADER: "(￣✓￣) ☑ . . . . your goals\n",
	WEEKLY_GOALS_HEADER: "\n📅 **Weekly** (must complete today):\n",
	INSTRUCTIONS_HEADER: "\n## Instructions**\n",
} as const;

// Helper functions for dynamic messages
export class PlaintextTemplates {
	static getInstructions(): string {
		return PLAINTEXT_MESSAGES.INSTRUCTIONS;
	}

	static getEntryComplete(displayName: string): string {
		return PLAINTEXT_MESSAGES.ENTRY_COMPLETE.replace('{displayName}', displayName);
	}

	static getCouldNotSendDM(displayName: string): string {
		return PLAINTEXT_MESSAGES.COULD_NOT_SEND_DM.replace('{displayName}', displayName);
	}

	static getGoalAdded(goalName: string): string {
		return PLAINTEXT_MESSAGES.GOAL_ADDED.replace('{goalName}', goalName);
	}

	static getGoalRemoved(goalName: string): string {
		return PLAINTEXT_MESSAGES.GOAL_REMOVED.replace('{goalName}', goalName);
	}

	static getShareSuccess(displayName: string, threadId: string): string {
		return PLAINTEXT_MESSAGES.SHARE_SUCCESS
			.replace('{displayName}', displayName)
			.replace('{threadId}', threadId);
	}

	static getThreadNameEntry(displayName: string, dayNumber: number): string {
		return PLAINTEXT_MESSAGES.THREAD_NAME_ENTRY
			.replace('{displayName}', displayName)
			.replace('{dayNumber}', dayNumber.toString());
	}

	static getThreadNameArchive(displayName: string, dayNumber: number): string {
		return PLAINTEXT_MESSAGES.THREAD_NAME_ARCHIVE
			.replace('{displayName}', displayName)
			.replace('{dayNumber}', dayNumber.toString());
	}

	static getThreadNameRenamed(threadName: string): string {
		return PLAINTEXT_MESSAGES.THREAD_NAME_RENAMED.replace('{threadName}', threadName);
	}

	static formatGoalList(goals: any[]): string {
		return goals.map((goal) => `${goal.emoji} ${goal.name}`).join("\n");
	}

	static formatInitialEntryDescription(
		userGoals: any[],
		userWeeklyGoals: any[],
		dayNumber: number
	): string {
		let description = PLAINTEXT_MESSAGES.DAILY_GOALS_HEADER;

		if (userGoals.length > 0) {
			description += this.formatGoalList(userGoals) + "\n";
		}

		if (userWeeklyGoals.length > 0) {
			description += PLAINTEXT_MESSAGES.WEEKLY_GOALS_HEADER;
			description += this.formatGoalList(userWeeklyGoals) + "\n";
		}

		description += PLAINTEXT_MESSAGES.INSTRUCTIONS_HEADER;
		description += PLAINTEXT_MESSAGES.GOAL_INSTRUCTIONS;

		return description;
	}
}
