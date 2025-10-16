// services/entry-service
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	type Guild,
	type GuildMember,
	type Message,
	type TextChannel,
	type ThreadChannel,
} from "discord.js";
import { CHANNEL_IDS } from "../constants/channels";
import { DEFAULT_COLOR, GOAL_COLORS } from "../constants/colors";
import { MESSAGES } from "../constants/messages";
import { handleAsyncError, handleError } from "../middleware/error-handler";
import { logDebug, logError, logInfo } from "../middleware/logging";
import type { EntrySession, GoalSubmission } from "../models/entry";
import { getCurrentDayNumber, isLastDayOfWeek } from "../utils/time-utils";
import {
	getValidationRequirements,
	validateSubmission,
} from "../utils/validation-utils";
import { GoalService } from "./goal-service";

const activeSessions = new Map<string, EntrySession>();

export class EntryService {
	async nah() {}

	static async startEntry(member: GuildMember): Promise<void> {
		try {
			const discordId = member.id;
			const displayName = member.displayName || member.user.username;

			const memberRoles = member.roles.cache.map((role) =>
				role.name.toLowerCase(),
			);
			const userGoals = GoalService.getUserGoals(memberRoles);
			const userWeeklyGoals = GoalService.getUserWeeklyGoals(memberRoles);

			if (userGoals.length === 0 && userWeeklyGoals.length === 0) {
				logError(`User ${displayName} has no challenge roles`);
				return;
			}

			const dayNumber = EntryService.getCurrentDayNumber();

			const archiveChannel = member.guild.channels.cache.get(
				CHANNEL_IDS.ARCHIVE,
			) as TextChannel;

			if (!archiveChannel) {
				logError("Archive channel not found", CHANNEL_IDS.ARCHIVE);
				return;
			}

			const existingThread = await EntryService.findExistingThread(
				archiveChannel,
				displayName,
				dayNumber,
			);
			if (existingThread) {
				logInfo(`Thread already exists for ${displayName} - Day ${dayNumber}`);

				try {
					const isMember = existingThread.members.cache.has(discordId);
					if (!isMember) {
						await existingThread.members.add(discordId);
						logInfo(`Added ${displayName} to existing thread`);
					}
				} catch (error) {
					handleError(error, "adding user to existing thread");
				}
				return;
			}

			const threadName = `${displayName}-entry-day-${dayNumber}`;
			let thread;
			try {
				thread = await archiveChannel.threads.create({
					name: threadName,
					autoArchiveDuration: 1440,
					type: 12,
					reason: `Entry for ${displayName} - Day ${dayNumber}`,
					invitable: false,
				});
				logInfo(`Created thread in archive channel: ${thread.name}`);
			} catch (error) {
				handleError(error, "creating thread");
				return;
			}

			try {
				await thread.members.add(discordId);
			} catch (error) {
				handleError(error, "adding user to thread");
			}

			const session: EntrySession = {
				userId: discordId,
				channelId: thread.id,
				dayNumber: dayNumber,
				goals: userGoals.map((g) => g.role),
				weeklyGoals: userWeeklyGoals.map((g) => g.role),
				submissions: new Map(),
				weeklySubmissions: new Map(),
				goalMessages: new Map(),
				weeklyGoalMessages: new Map(),
			};

			activeSessions.set(discordId, session);

			try {
				await EntryService.sendInitialEntryEmbed(
					thread,
					displayName,
					dayNumber,
					userGoals,
					userWeeklyGoals,
				);
			} catch (error) {
				handleError(error, "sending initial embed");
			}

			for (const goalDef of userGoals) {
				try {
					const message = await EntryService.sendGoalEmbed(thread, goalDef);
					session.goalMessages.set(goalDef.role, message.id);
				} catch (error) {
					handleError(error, `sending goal embed for ${goalDef.name}`);
				}
			}

			const shouldShowWeeklyGoals =
				isLastDayOfWeek(dayNumber) ||
				EntryService.hasIncompleteWeeklyGoals(session);
			if (shouldShowWeeklyGoals && userWeeklyGoals.length > 0) {
				for (const weeklyGoalDef of userWeeklyGoals) {
					try {
						const message = await EntryService.sendWeeklyGoalEmbed(
							thread,
							weeklyGoalDef,
							dayNumber,
						);
						session.weeklyGoalMessages.set(weeklyGoalDef.role, message.id);
					} catch (error) {
						handleError(
							error,
							`sending weekly goal embed for ${weeklyGoalDef.name}`,
						);
					}
				}
			}
		} catch (error) {
			handleError(error, "startEntry");
		}
	}

	static async handleSubmission(message: Message): Promise<void> {
		if (!message.inGuild() || message.author.bot) return;

		const channel = message.channel;
		if (!channel.isThread()) return;

		const session = Array.from(activeSessions.values()).find(
			(s) => s.channelId === channel.id,
		);
		if (!session) return;

		if (message.author.id !== session.userId) return;

		await EntryService.parseAndValidateSubmission(message, session);
	}

	static async showPreviousEntries(member: GuildMember): Promise<void> {
		const discordId = member.id;

		try {
			const dayNumber = EntryService.getCurrentDayNumber();

			const archiveChannel = member.guild.channels.cache.get(
				CHANNEL_IDS.ARCHIVE,
			) as TextChannel;

			let entryLinks = "";

			if (archiveChannel) {
				try {
					const threads = archiveChannel.threads.cache.filter((thread) => {
						const threadName = thread.name;
						const displayName = member.displayName || member.user.username;
						const dayMatch = threadName.match(
							new RegExp(`${displayName}-entry-day-(\\d+)`),
						);
						return dayMatch !== null;
					});

					const sortedThreads = Array.from(threads.values()).sort((a, b) => {
						const aDay = parseInt(a.name.match(/day-(\d+)/)?.[1] || "0");
						const bDay = parseInt(b.name.match(/day-(\d+)/)?.[1] || "0");
						return bDay - aDay;
					});

					for (const thread of sortedThreads) {
						const dayMatch = thread.name.match(/day-(\d+)/);
						if (dayMatch) {
							const day = parseInt(dayMatch[1]);
							entryLinks += `https://discord.com/channels/${member.guild.id}/${thread.id} - your day ${day}\n`;
						}
					}

					if (!entryLinks) {
						entryLinks = `No previous entries found. Start your challenge with the "Create an entry" button!\n`;
					}
				} catch (error) {
					handleError(error, "searching for previous threads");
					entryLinks = `Error retrieving previous entries. Please try again later.\n`;
				}
			} else {
				entryLinks = `Archive channel not found. Please contact an administrator.\n`;
			}

			const embedDescription = `All of your previous entries are detailed below. Click on a text channel when you're finished.\n\n${entryLinks}`;

			const embed = new EmbedBuilder()
				.setDescription(embedDescription)
				.setColor(DEFAULT_COLOR)
				.setTimestamp();

			try {
				await member.send({ embeds: [embed] });
				logInfo(
					`Sent previous entries embed to user ${member.displayName || member.user.username} via DM`,
				);
			} catch (dmError) {
				logError("Could not send DM to user", dmError);

				const channel = member.guild.channels.cache.find(
					(ch) =>
						ch.isTextBased() && ch.permissionsFor(member).has("SendMessages"),
				) as TextChannel;

				if (channel) {
					await channel.send(
						`**${member.displayName || member.user.username}**\nCould not send DM. Check your previous entries using the buttons.`,
					);
				}
			}
		} catch (error) {
			handleError(error, "showPreviousEntries");
		}
	}

	static async shareThread(threadId: string, userId: string): Promise<void> {
		try {
			const client = (await import("../index")).client;
			const thread = client.channels.cache.get(threadId) as ThreadChannel;

			if (!thread) {
				logError("Thread not found for sharing", threadId);
				return;
			}

			const guild = thread.guild;
			const member = await guild.members.fetch(userId);
			const displayName = member.displayName || member.user.username;

			const dayMatch = thread.name.match(/day-(\d+)/);
			const dayNumber = dayMatch
				? parseInt(dayMatch[1])
				: EntryService.getCurrentDayNumber();

			const messages = await thread.messages.fetch({ limit: 100 });
			const sortedMessages = messages.sort(
				(a, b) => a.createdTimestamp - b.createdTimestamp,
			);

			const shareChannel = client.channels.cache.get(
				CHANNEL_IDS.SHARE,
			) as TextChannel;

			if (!shareChannel) {
				logError("Share channel not found", CHANNEL_IDS.SHARE);
				return;
			}

			const shareEmbed = new EmbedBuilder()
				.setTitle(
					`${displayName} chose to share their entry for day ${dayNumber}`,
				)
				.setColor(DEFAULT_COLOR)
				.setTimestamp()
				.addFields({
					name: "Navigate to Thread",
					value: `[${dayNumber}](https://discord.com/channels/${guild.id}/${thread.id})`,
					inline: false,
				});

			await shareChannel.send({ embeds: [shareEmbed] });

			for (const message of sortedMessages.values()) {
				if (message.author.bot) continue;

				if (message.embeds.length > 0) {
					await shareChannel.send({ embeds: message.embeds });
				}

				if (message.content) {
					await shareChannel.send({ content: message.content });
				}

				if (message.attachments.size > 0) {
					const attachmentUrls = message.attachments.map(
						(attachment) => attachment.url,
					);
					await shareChannel.send({
						content: `**Attachments:**\n${attachmentUrls.join("\n")}`,
					});
				}
			}

			logInfo(`Successfully shared thread ${threadId} for user ${displayName}`);
		} catch (error) {
			handleError(error, "shareThread");
		}
	}

	static cleanupExpiredSessions(): void {
		const expiredSessions: string[] = [];

		for (const [userId, session] of activeSessions.entries()) {
			if (Math.random() < 0.01) {
				expiredSessions.push(userId);
			}
		}

		for (const userId of expiredSessions) {
			activeSessions.delete(userId);
		}
	}

	private static async findExistingThread(
		mainChannel: TextChannel,
		displayName: string,
		dayNumber: number,
	): Promise<ThreadChannel | null> {
		try {
			const threads = mainChannel.threads.cache.filter(
				(thread) =>
					thread.name === `${displayName}-entry-day-${dayNumber}` &&
					thread.ownerId,
			);

			if (threads.size > 0) {
				return threads.first() as ThreadChannel;
			}

			return null;
		} catch (error) {
			handleError(error, "findExistingThread");
			return null;
		}
	}

	private static async sendInitialEntryEmbed(
		thread: ThreadChannel,
		displayName: string,
		dayNumber: number,
		userGoals: any[],
		userWeeklyGoals: any[],
	): Promise<void> {
		try {
			let description = `\n\n(￣✓￣) ☑ . . . . your goals\n`;

			if (userGoals.length > 0) {
				description += `${userGoals.map((goal) => `${goal.emoji} ${goal.name}`).join("\n")}\n`;
			}

			if (userWeeklyGoals.length > 0) {
				const shouldShowWeeklyGoals = isLastDayOfWeek(dayNumber);
				if (shouldShowWeeklyGoals) {
					description += `\n📅 **Weekly Goals** (must complete today):\n`;
					description += `${userWeeklyGoals.map((goal) => `${goal.emoji} ${goal.name}`).join("\n")}\n`;
				}
			}

			description += `\n**Instructions**\n`;
			description += `* Reply to each goal below with your submission - each goal has its own instructions\n`;
			description += `* You can reply to any goal at any time\n`;
			description += `* You can submit multiple times for the same goal, but one submission will count\n`;

			if (userWeeklyGoals.length > 0 && isLastDayOfWeek(dayNumber)) {
				description += `* **Weekly goals must be completed by the end of the week (today)**\n`;
			}

			const embed = new EmbedBuilder()
				.setTitle(`Day ${dayNumber}`)
				.setDescription(description)
				.setColor(DEFAULT_COLOR)
				.setTimestamp();

			await thread.send({ embeds: [embed] });
		} catch (error) {
			handleError(error, "sendInitialEntryEmbed");
			throw error;
		}
	}

	private static async sendGoalEmbed(
		thread: ThreadChannel,
		goalDef: any,
	): Promise<Message> {
		try {
			const embed = new EmbedBuilder()
				.setTitle(`${goalDef.emoji} ${goalDef.name}`)
				.setDescription(goalDef.description)
				.setColor(EntryService.getGoalColor(goalDef.role));

			const requirements = getValidationRequirements(goalDef);

			if (requirements.length > 0) {
				embed.addFields({
					name: "Required",
					value: requirements.join(" or "),
					inline: false,
				});
			}

			return await thread.send({ embeds: [embed] });
		} catch (error) {
			handleError(error, `sendGoalEmbed for ${goalDef.name}`);
			throw error;
		}
	}

	private static async sendWeeklyGoalEmbed(
		thread: ThreadChannel,
		goalDef: any,
		dayNumber: number,
	): Promise<Message> {
		try {
			const embed = new EmbedBuilder()
				.setTitle(`📅 ${goalDef.emoji} ${goalDef.name} (Weekly)`)
				.setDescription(goalDef.description)
				.setColor(EntryService.getGoalColor(goalDef.role))
				.addFields({
					name: "Weekly Goal",
					value: `This is a weekly goal. ${isLastDayOfWeek(dayNumber) ? "**Must be completed today!**" : "Complete anytime this week."}`,
					inline: false,
				});

			const requirements = getValidationRequirements(goalDef);

			if (requirements.length > 0) {
				embed.addFields({
					name: "Required",
					value: requirements.join(" or "),
					inline: false,
				});
			}

			return await thread.send({ embeds: [embed] });
		} catch (error) {
			handleError(error, `sendWeeklyGoalEmbed for ${goalDef.name}`);
			throw error;
		}
	}

	private static async parseAndValidateSubmission(
		message: Message,
		session: EntrySession,
	): Promise<void> {
		try {
			const channel = message.channel as ThreadChannel;
			const content = message.content.trim();
			const hasImage = message.attachments.size > 0;

			const pendingGoals = session.goals.filter((goalName) => {
				return !session.submissions.has(goalName);
			});

			if (pendingGoals.length === 0) {
				try {
					await channel.send(MESSAGES.ENTRY.ALL_GOALS_COMPLETE);
					await EntryService.completeEntry(session);
				} catch (error) {
					handleError(error, "sending completion message");
				}
				return;
			}

			let currentGoalName: string | null = null;
			let isWeeklyGoal = false;

			if (message.reference?.messageId) {
				for (const [goalName, messageId] of session.goalMessages.entries()) {
					if (messageId === message.reference.messageId) {
						currentGoalName = goalName;
						isWeeklyGoal = false;
						break;
					}
				}

				if (!currentGoalName) {
					for (const [
						goalName,
						messageId,
					] of session.weeklyGoalMessages.entries()) {
						if (messageId === message.reference.messageId) {
							currentGoalName = goalName;
							isWeeklyGoal = true;
							break;
						}
					}
				}
			}

			if (!currentGoalName) {
				if (pendingGoals.length > 0) {
					currentGoalName = pendingGoals[0];
					isWeeklyGoal = false;
				} else {
					const pendingWeeklyGoals = session.weeklyGoals.filter((goalName) => {
						return !session.weeklySubmissions.has(goalName);
					});
					if (pendingWeeklyGoals.length > 0) {
						currentGoalName = pendingWeeklyGoals[0];
						isWeeklyGoal = true;
					}
				}
			}

			if (!currentGoalName) {
				try {
					await channel.send(MESSAGES.SUBMISSION.INVALID_GOAL);
				} catch (error) {
					handleError(error, "sending invalid goal message");
				}
				return;
			}

			const submissionsMap = isWeeklyGoal
				? session.weeklySubmissions
				: session.submissions;
			if (submissionsMap.has(currentGoalName)) {
				try {
					await channel.send(MESSAGES.SUBMISSION.ALREADY_SUBMITTED);
				} catch (error) {
					handleError(error, "sending duplicate message");
				}
				return;
			}

			const goalDef = isWeeklyGoal
				? GoalService.getUserWeeklyGoals([currentGoalName])[0]
				: GoalService.getUserGoals([currentGoalName])[0];

			if (!goalDef) {
				try {
					await channel.send(MESSAGES.SUBMISSION.GOAL_NOT_FOUND);
				} catch (error) {
					handleError(error, "sending error message");
				}
				return;
			}

			let mediaUrl: string | undefined;
			if (message.attachments.size > 0) {
				mediaUrl = message.attachments.first()?.url;
			}

			const validation = validateSubmission(goalDef, content, hasImage);

			if (!validation.isValid) {
				const requirements = getValidationRequirements(goalDef);
				try {
					await channel.send(
						`${MESSAGES.ERROR.SUBMISSION_VALIDATION} **${goalDef.name}**. ${MESSAGES.ERROR.REQUIREMENTS} ${requirements.join(" or ")}.`,
					);
				} catch (error) {
					handleError(error, "sending validation message");
				}
				return;
			}

			const goalSubmission: GoalSubmission = {
				goalName: goalDef.role,
				content: validation.submissionContent,
				mediaUrl: validation.mediaUrl,
				isValid: true,
			};

			if (isWeeklyGoal) {
				session.weeklySubmissions.set(goalDef.role, goalSubmission);
			} else {
				session.submissions.set(goalDef.role, goalSubmission);
			}

			try {
				await channel.send(
					`✅ **${goalDef.name}** ${MESSAGES.SUBMISSION.SUBMISSION_SUCCESS}`,
				);
			} catch (error) {
				handleError(error, "sending confirmation");
			}

			const completedGoals = session.submissions.size;
			const totalGoals = session.goals.length;
			const completedWeeklyGoals = session.weeklySubmissions.size;
			const totalWeeklyGoals = session.weeklyGoals.length;

			const isLastDay = isLastDayOfWeek(session.dayNumber);
			const weeklyGoalsRequired = isLastDay && totalWeeklyGoals > 0;
			const weeklyGoalsComplete = completedWeeklyGoals >= totalWeeklyGoals;

			const allGoalsComplete =
				completedGoals >= totalGoals &&
				(!weeklyGoalsRequired || weeklyGoalsComplete);

			if (allGoalsComplete) {
				try {
					await EntryService.completeEntry(session);
				} catch (error) {
					handleError(error, "completing entry");
				}
			} else {
				const missingGoals = session.goals.filter(
					(goalName) => !session.submissions.has(goalName),
				);
				const missingGoalNames = missingGoals.map((goalName) => {
					const goalDef = GoalService.getUserGoals([goalName])[0];
					return goalDef ? goalDef.name : goalName;
				});

				let message = `${MESSAGES.SUBMISSION.MISSING_GOALS} ${totalGoals - completedGoals} goal${totalGoals - completedGoals > 1 ? "s" : ""}: ${missingGoalNames.join(", ")}`;

				if (weeklyGoalsRequired && !weeklyGoalsComplete) {
					const missingWeeklyGoals = session.weeklyGoals.filter(
						(goalName) => !session.weeklySubmissions.has(goalName),
					);
					const missingWeeklyGoalNames = missingWeeklyGoals.map((goalName) => {
						const goalDef = GoalService.getUserWeeklyGoals([goalName])[0];
						return goalDef ? goalDef.name : goalName;
					});
					message += `\n${MESSAGES.SUBMISSION.MISSING_WEEKLY_GOALS} ${totalWeeklyGoals - completedWeeklyGoals} weekly goal${totalWeeklyGoals - completedWeeklyGoals > 1 ? "s" : ""}: ${missingWeeklyGoalNames.join(", ")}`;
				}

				try {
					await channel.send(message);
				} catch (error) {
					handleError(error, "sending remaining goals message");
				}
			}
		} catch (error) {
			handleError(error, "parseAndValidateSubmission");
		}
	}

	private static async completeEntry(session: EntrySession): Promise<void> {
		try {
			const client = (await import("../index")).client;
			const thread = client.channels.cache.get(
				session.channelId,
			) as ThreadChannel;

			if (thread) {
				try {
					const guild = thread.guild;
					const member = await guild.members.fetch(session.userId);
					const displayName = member.displayName || member.user.username;

					logInfo(
						`Thread ${thread.name} is already in archive channel ${thread.parentId}`,
					);

					const newName = `archive-${thread.name}`;
					await thread.setName(newName);
					logInfo(`Renamed thread to: ${newName}`);

					const shareButton =
						new ActionRowBuilder<ButtonBuilder>().addComponents(
							new ButtonBuilder()
								.setCustomId(`share_thread_${thread.id}`)
								.setLabel("📤 Share Thread")
								.setStyle(ButtonStyle.Primary),
						);

					await thread.send({
						content: `**You complete your entry for ${displayName}!**\n\nThread is now archived. Click the button below to share your entry.`,
						components: [shareButton],
					});

					setTimeout(async () => {
						try {
							await thread.setLocked(true);
							logInfo(`Locked thread: ${newName}`);
						} catch (error) {
							handleError(error, "locking thread");
						}
					}, 5000);

					try {
						await thread.parent?.threads.fetch();
						logInfo("Refreshed thread cache");
					} catch (error) {
						handleError(error, "refreshing thread cache");
					}

					await EntryService.updateStatusWithRetry(
						thread.guild,
						displayName,
						3,
					);
					await EntryService.updateHistoryWithRetry(
						thread.guild,
						displayName,
						3,
					);
				} catch (error) {
					handleError(error, "completing thread");
				}
			} else {
				logError("Thread not found in cache", session.channelId);
			}

			activeSessions.delete(session.userId);
		} catch (error) {
			handleError(error, "completeEntry");
		}
	}

	private static hasIncompleteWeeklyGoals(session: EntrySession): boolean {
		return session.weeklyGoals.some(
			(goalName) => !session.weeklySubmissions.has(goalName),
		);
	}

	private static getGoalColor(roleName: string): number {
		return (GOAL_COLORS as any)[roleName] || DEFAULT_COLOR;
	}

	private static async updateStatusWithRetry(
		guild: Guild,
		displayName: string,
		maxRetries: number,
	): Promise<void> {
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				logInfo(
					`Attempting status update (attempt ${attempt}/${maxRetries}) for ${displayName}`,
				);

				const member = await guild.members
					.fetch({ query: displayName, limit: 1 })
					.then((members) => members.first());
				if (!member) {
					logError(`Member not found for ${displayName}`);
					continue;
				}

				const isCompleted =
					await EntryService.checkUserCompletionStatus(member);
				logInfo(`Completion status for ${displayName}: ${isCompleted}`);

				if (isCompleted) {
					const { StatusService } = await import("./status-service");
					await StatusService.updateAccountabilityStatus(guild);
					logInfo(
						`✅ Status updated successfully for ${displayName} (attempt ${attempt})`,
					);
					return;
				} else {
					logInfo(
						`❌ User ${displayName} not showing as completed yet (attempt ${attempt})`,
					);
					if (attempt < maxRetries) {
						await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
					}
				}
			} catch (error) {
				handleError(
					error,
					`updating status for ${displayName} (attempt ${attempt})`,
				);
				if (attempt < maxRetries) {
					await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
				}
			}
		}
		logError(
			`Failed to update status for ${displayName} after ${maxRetries} attempts`,
		);
	}

	private static async updateHistoryWithRetry(
		guild: Guild,
		displayName: string,
		maxRetries: number,
	): Promise<void> {
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				logInfo(
					`Attempting history update (attempt ${attempt}/${maxRetries}) for ${displayName}`,
				);

				const { StatusService } = await import("./status-service");
				await StatusService.updateHistoryEmbed(guild);
				logInfo(
					`✅ History updated successfully for ${displayName} (attempt ${attempt})`,
				);
				return;
			} catch (error) {
				handleError(
					error,
					`updating history for ${displayName} (attempt ${attempt})`,
				);
				if (attempt < maxRetries) {
					await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
				}
			}
		}
		logError(
			`Failed to update history for ${displayName} after ${maxRetries} attempts`,
		);
	}

	private static async checkUserCompletionStatus(
		member: GuildMember,
	): Promise<boolean> {
		try {
			const archiveChannel = member.guild.channels.cache.get(
				CHANNEL_IDS.ARCHIVE,
			) as TextChannel;
			const dayNumber = EntryService.getCurrentDayNumber();
			const displayName = member.displayName || member.user.username;

			if (!archiveChannel) {
				logError("Archive channel not found for completion check");
				return false;
			}

			try {
				await archiveChannel.threads.fetch();
				logInfo(
					`Refreshed thread cache for completion check of ${displayName}`,
				);
			} catch (error) {
				handleError(error, "refreshing thread cache for completion check");
			}

			const expectedThreadName = `archive-${displayName}-entry-day-${dayNumber}`;
			logInfo(`Looking for thread: ${expectedThreadName}`);

			const userThreads = archiveChannel.threads.cache.filter((thread) => {
				const matches = thread.name === expectedThreadName;
				if (matches) {
					logInfo(
						`Found matching thread: ${thread.name} (locked: ${thread.locked})`,
					);
				}
				return matches;
			});

			logInfo(
				`Thread search result for ${displayName}: ${userThreads.size} threads found`,
			);

			if (userThreads.size === 0) {
				return false;
			}

			return true;
		} catch (error) {
			handleError(error, "checking user completion status");
			return false;
		}
	}

	private static getCurrentDayNumber(): number {
		return getCurrentDayNumber();
	}
}
