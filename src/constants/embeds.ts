// constants/embeds
import { EmbedBuilder } from "discord.js";
import { DEFAULT_COLOR, SUCCESS_COLOR, ERROR_COLOR, GOAL_COLORS } from "./colors";

export const EMBED_CONFIGS = {
	botOnline: {
		title: "🤖 is online!",
		description: "⁂  Bot is currently working and is active.",
		color: SUCCESS_COLOR,
	},
	botOffline: {
		title: "🔴 is offline!",
		description: "⁖  Bot is currently offline.",
		color: ERROR_COLOR,
	},

	instructions: {
		title: "**Instructions**",
		description:
		  "## Instructions\n" +
			"This bot is meant to track your 75 progress, check if you have completed your goals, " +
			"communicate to others and hold your archive. Below are the two actions that you can take " +
			"to create an entry or review your previous entries.\n\n" +
			"**Create an entry** gets you started with a new thread to submit - you cannot create " +
			"a new thread if one is existent.\n\n" +
			'**View previous entries** sends you a DM (if permissible) with all of the days as ' +
			'"{link to channel} for day {day}."',
		color: DEFAULT_COLOR,
	},

	// Entry related embeds
	entryPrompt: {
		title: "📝 Submit your entries here!",
		description: "The bot is successfully loaded. Use any action below to log.",
	},

	// Status embeds
	accountabilityHeader: {
		title: "📊 Accountability Status",
		description: "Here's how everyone is doing today:",
		color: DEFAULT_COLOR,
	},

	// Share embeds
	shareHeader: {
		title: "🎯 Daily Goal Completion!",
		description: "Successfully completed all daily goals!",
		color: SUCCESS_COLOR,
	},

	// Previous entries embed
	previousEntriesHeader: {
		description: "All of your previous entries are detailed below. Click on a text channel when you're finished.\n\n",
		color: DEFAULT_COLOR,
	},
} as const;

// Embed templates
export class EmbedTemplates {
	static createBaseEmbed(config: Partial<typeof EMBED_CONFIGS[keyof typeof EMBED_CONFIGS]>): EmbedBuilder {
		const embed = new EmbedBuilder();

		if (config.title) embed.setTitle(config.title);
		if (config.description) embed.setDescription(config.description);
		if (config.color) embed.setColor(config.color);

		return embed.setTimestamp();
	}

	static createStatusEmbed(isOnline: boolean, reason?: string): EmbedBuilder {
		const config = isOnline ? EMBED_CONFIGS.botOnline : EMBED_CONFIGS.botOffline;
		const embed = this.createBaseEmbed(config);

		if (!isOnline && reason) {
			embed.setDescription(config.description + ` Reason: ${reason}`);
		}

		return embed;
	}

	static createInstructionEmbed(): EmbedBuilder {
		return this.createBaseEmbed(EMBED_CONFIGS.instructions);
	}

	static createEntryButtonEmbed(): EmbedBuilder {
		return this.createBaseEmbed(EMBED_CONFIGS.entryPrompt);
	}

	static createGoalEmbed(goalDef: any): EmbedBuilder {
		const embed = new EmbedBuilder()
			.setTitle(`${goalDef.emoji} ${goalDef.name}`)
			.setDescription(goalDef.description)
			.setColor(GOAL_COLORS[goalDef.role as keyof typeof GOAL_COLORS] || DEFAULT_COLOR);

		return embed;
	}

	static createWeeklyGoalEmbed(goalDef: any, dayNumber: number): EmbedBuilder {
		const embed = new EmbedBuilder()
			.setTitle(`📅 ${goalDef.emoji} ${goalDef.name} (Weekly)`)
			.setDescription(goalDef.description)
			.setColor(GOAL_COLORS[goalDef.role as keyof typeof GOAL_COLORS] || DEFAULT_COLOR)
			.addFields({
				name: "Weekly Goal",
				value: `This is a weekly goal. Complete anytime this week.`,
				inline: false,
			});

		return embed;
	}

	static createInitialEntryEmbed(
		dayNumber: number,
		userGoals: any[],
		userWeeklyGoals: any[]
	): EmbedBuilder {
		let description = `\n\n(￣✓￣) ☑ . . . . your goals\n`;

		if (userGoals.length > 0) {
			description += `${userGoals.map((goal) => `${goal.emoji} ${goal.name}`).join("\n")}\n`;
		}

		if (userWeeklyGoals.length > 0) {
			description += `\n📅 **Weekly Goals** (must complete today):\n`;
			description += `${userWeeklyGoals.map((goal) => `${goal.emoji} ${goal.name}`).join("\n")}\n`;
		}

		description += `\n**Instructions**\n`;
		description += `* Reply to each goal below with your submission - each goal has its own instructions\n`;
		description += `* You can reply to any goal at any time\n`;
		description += `* You can submit multiple times for the same goal, but one submission will count\n`;

		if (userWeeklyGoals.length > 0) {
			description += `* **Weekly goals must be completed by the end of the week (today)**\n`;
		}

		return new EmbedBuilder()
			.setTitle(`Day ${dayNumber}`)
			.setDescription(description)
			.setColor(DEFAULT_COLOR)
			.setTimestamp();
	}

	static createAccountabilityStatusEmbed(): EmbedBuilder {
		return this.createBaseEmbed(EMBED_CONFIGS.accountabilityHeader);
	}

	static createShareEmbed(displayName: string, dayNumber: number, navigationLink: string): EmbedBuilder {
		return new EmbedBuilder()
			.setTitle(`${displayName} chose to share their entry for day ${dayNumber}`)
			.setColor(DEFAULT_COLOR)
			.setTimestamp()
			.addFields({
				name: "Navigate to Thread",
				value: navigationLink,
				inline: false,
			});
	}

	static createPreviousEntriesEmbed(entryLinks: string): EmbedBuilder {
		const fullDescription = EMBED_CONFIGS.previousEntriesHeader.description + entryLinks;

		return new EmbedBuilder()
			.setDescription(fullDescription)
			.setColor(DEFAULT_COLOR)
			.setTimestamp();
	}
}
