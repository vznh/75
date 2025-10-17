// services/role-service
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type Guild,
	type TextChannel,
	type User,
} from "discord.js";
import { DEFAULT_COLOR, EMBED_COLOR, GOAL_COLORS } from "../constants/colors";
import { MESSAGES } from "../constants/messages";
import { client } from "../index";
import { handleError } from "../middleware/error-handler";
import { logError, logInfo } from "../middleware/logging";
import type { ServiceResponse } from "../models/responses";
import { GoalService } from "./goal-service";

export class RoleService {
	async createRoleCreationMessage(channelId: string): Promise<ServiceResponse> {
		try {
			const channel = client.channels.cache.get(channelId) as TextChannel;

			if (!channel || !channel.isTextBased()) {
				// logger("Had an error creating roleCreationMessage because the channel isn't found/not text-based.");
				return {
					success: false,
					error: {
						message:
							"Had an error creating roleCreationMessage because channel isn't found/not text-based.",
					},
				};
			}

			const messages = await channel.messages.fetch({ limit: 5 }); // We can assume there's only this message existent.
			const existing = messages.find((msg) => {
				return msg.embeds.length > 0 && msg.embeds[0].title === "🪡";
			});

			if (existing) {
				await existing.delete();
				// logger("Deleted existing message.");
			}

			// const title = "🪡";
			const description =
				"Create any goal for yourself here.\n\nAfter interaction, the bot should send a DM to you involving all instructions - follow them closely to create your own goal.";
			// const color = "0x251111";

			const instructions = new EmbedBuilder()
				.setTitle("🪡")
				.setDescription(description)
				.setColor(EMBED_COLOR);

			await channel.send({ embeds: [instructions] });

			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: {
					message: `* Encountered an unknown error, specific logs:\n${error}`,
				},
			};
		}
	}

	static async createRoleSelectionMessage(channelId: string): Promise<void> {
		try {
			const client = (await import("../index")).client;
			const channel = client.channels.cache.get(channelId) as TextChannel;

			if (!channel || !channel.isTextBased()) {
				logError("Channel not found or not text-based", channelId);
				return;
			}

			try {
				const messages = await channel.messages.fetch({ limit: 20 });
				const existingMessage = messages.find((msg) => {
					return msg.content && msg.content.includes("📋 Create a goal");
				});

				if (existingMessage) {
					logInfo("Found existing role selection message, deleting it");
					await existingMessage.delete();
					logInfo("Old role selection message deleted successfully");
				}
			} catch (error) {
				handleError(error, "checking/deleting existing role selection message");
			}

			const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId("create_goal")
					.setLabel("📋 Create a goal")
					.setStyle(ButtonStyle.Primary)
			);

			await channel.send({
				content: "### 🪡\nYou can create your own goal here, customizable with the name, description, input and color.\nAll roles here will be displayed in #marketplace.\n",
				components: [button]
			});

			logInfo("Role selection message created with Create Goal button");
		} catch (error) {
			handleError(error, "createRoleSelectionMessage");
		}
	}


	private static async createCustomRole(guild: Guild, goalData: any): Promise<ServiceResponse & { roleId?: string }> {
		try {
			const roleName = goalData.shorthand;

			const existingRole = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
			if (existingRole) {
				return {
					success: false,
					error: { message: 'A role with this name already exists' }
				};
			}

			const role = await guild.roles.create({
				name: roleName,
				color: goalData.color,
				reason: `Custom goal created by user`,
				mentionable: true
			});

			if (!global.customGoals) {
				global.customGoals = new Map();
			}
			global.customGoals.set(roleName, {
				description: goalData.description,
				inputType: goalData.inputType,
				roleId: role.id
			});

			logInfo(`Created custom role: ${roleName} (${role.id})`);

			return { success: true, roleId: role.id };
		} catch (error) {
			handleError(error, 'createCustomRole');
			return {
				success: false,
				error: { message: `Failed to create role: ${error}` }
			};
		}
	}

	static async handleMessageReactionAdd(
		messageReaction: any,
		user: any,
	): Promise<void> {
		try {
			if (user.bot) return;

			const message = messageReaction.message;
			const emoji = messageReaction.emoji.name;

			if (
				message.embeds.length === 0 ||
				!message.embeds[0].title?.includes("🎯")
			) {
				return;
			}

			const allGoals = GoalService.getAllGoalDefinitions();
			const allWeeklyGoals = GoalService.getAllWeeklyGoalDefinitions();
			let goalDef = allGoals.find((goal) => goal.emoji === emoji);

			if (!goalDef) {
				goalDef = allWeeklyGoals.find((goal) => goal.emoji === emoji);
			}

			if (!goalDef) {
				logError(`No goal found for emoji`, emoji);
				return;
			}

			const guild = message.guild;
			if (!guild) return;

			const member = await guild.members.fetch(user.id);
			if (!member) return;

			const currentRoles = member.roles.cache.map((role: any) =>
				role.name.toLowerCase(),
			);
			const hasRole = currentRoles.some(
				(roleName: string) =>
					roleName.includes(goalDef.role.toLowerCase()) ||
					goalDef.role.toLowerCase().includes(roleName),
			);

			if (hasRole) {
				try {
					const role = guild.roles.cache.find(
						(r: any) =>
							r.name.toLowerCase().includes(goalDef.role.toLowerCase()) ||
							goalDef.role.toLowerCase().includes(r.name.toLowerCase()),
					);
					if (role) {
						await member.roles.remove(role);
						try {
							await user.send(`${MESSAGES.REACTIONS.ROLE_REMOVED}`);
						} catch (error) {
							logError(MESSAGES.REACTIONS.DM_ERROR, error);
						}
					} else {
						logError(
							`Could not find role for goal: ${goalDef.name} (searched for: ${goalDef.role})`,
						);
						logInfo(
							"Available roles:",
							guild.roles.cache.map((r: any) => r.name).join(", "),
						);
					}
				} catch (error) {
					handleError(error, `removing role for ${goalDef.name}`);
				}
			} else {
				try {
					const role = guild.roles.cache.find(
						(r: any) =>
							r.name.toLowerCase().includes(goalDef.role.toLowerCase()) ||
							goalDef.role.toLowerCase().includes(r.name.toLowerCase()),
					);
					if (role) {
						await member.roles.add(role);
						try {
							await user.send(`${MESSAGES.REACTIONS.ROLE_ADDED}`);
						} catch (error) {
							logError(MESSAGES.REACTIONS.DM_ERROR, error);
						}
					} else {
						logError(
							`Could not find role for goal: ${goalDef.name} (searched for: ${goalDef.role})`,
						);
						logInfo(
							"Available roles:",
							guild.roles.cache.map((r: any) => r.name).join(", "),
						);
					}
				} catch (error) {
					handleError(error, `adding role for ${goalDef.name}`);
				}
			}

			try {
				await messageReaction.users.remove(user.id);
			} catch (error) {
				handleError(error, "removing reaction");
			}
		} catch (error) {
			handleError(error, "handleMessageReactionAdd");
		}
	}

	static async ensureRolesExist(guild: Guild): Promise<void> {
		try {
			logInfo("Checking and creating missing challenge roles...");

			const allGoals = GoalService.getAllGoalDefinitions();
			const allWeeklyGoals = GoalService.getAllWeeklyGoalDefinitions();

			for (const goalDef of allGoals) {
				await RoleService.createOrUpdateRole(guild, goalDef);
			}

			for (const goalDef of allWeeklyGoals) {
				await RoleService.createOrUpdateRole(guild, goalDef);
			}

			logInfo("✅ Role check and creation completed");
		} catch (error) {
			handleError(error, "ensureRolesExist");
		}
	}

	private static async createOrUpdateRole(
		guild: Guild,
		goalDef: any,
	): Promise<void> {
		const roleName = goalDef.role;
		const emoji = goalDef.emoji;

		try {
			let role = guild.roles.cache.find(
				(r) => r.name.toLowerCase() === roleName.toLowerCase(),
			);

			if (!role) {
				logInfo(`Creating role: ${roleName} with emoji: ${emoji}`);

				role = await guild.roles.create({
					name: roleName,
					color: RoleService.getGoalColor(roleName),
					reason: `Auto-created role for ${goalDef.name} challenge goal`,
					mentionable: true,
				});

				logInfo(`✅ Created role: ${roleName}`);
			} else {
				logInfo(`✅ Role already exists: ${roleName}`);
			}

			if (role.color !== RoleService.getGoalColor(roleName)) {
				await role.edit({
					color: RoleService.getGoalColor(roleName),
					reason: "Updating role color to match goal definition",
				});
				logInfo(`🎨 Updated color for role: ${roleName}`);
			}
		} catch (error) {
			handleError(error, `handling role ${roleName}`);
		}
	}

	private static getGoalColor(roleName: string): number {
		return (GOAL_COLORS as any)[roleName] || DEFAULT_COLOR;
	}

	static validateGoalData(goalData: any): any {
		if (!goalData.shorthand || goalData.shorthand.trim().length === 0) {
			return { error: 'Shorthand is required' };
		}

		const description = goalData.description?.trim();
		if (!description || description.length === 0) {
			return { error: 'Description is required' };
		}

		if (!description.startsWith('Submission of')) {
			return { error: 'Description must start with "Submission of"' };
		}

		const inputType = goalData.inputType?.toLowerCase().trim();
		if (!inputType || !['text', 'image', 'both'].includes(inputType)) {
			return { error: 'Input type must be: text, image, or both' };
		}

		const colorStr = goalData.color?.trim();
		if (!colorStr) {
			return { error: 'Color is required' };
		}

		if (!colorStr.startsWith('0x')) {
			return { error: 'Color must start with 0x (e.g., 0x251111)' };
		}

		const color = parseInt(colorStr, 16);
		if (isNaN(color) || color < 0 || color > 0xFFFFFF) {
			return { error: 'Invalid color. Must be a valid hexadecimal color' };
		}

		return { success: true };
	}
}
