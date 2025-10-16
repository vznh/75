// index

import {
	ButtonInteraction,
	Client,
	GatewayIntentBits,
	type Message,
	Partials,
	REST,
	Routes,
} from "discord.js";
import { config } from "dotenv";
import {
	setBotOnlineStatus,
	setupGracefulShutdown,
} from "./bot/graceful-shutdown";
import { BotManager } from "./bot/manager";
import { EntryButtons } from "./buttons/entry-buttons";
import { handleArchiveCommand } from "./commands/archive";
import { handleEntryCommand } from "./commands/entry";
import { handleRemindCommand } from "./commands/remind";
import { ReactionController } from "./controllers/reaction-controller";
import { scheduleDailyReset } from "./jobs/daily-reset";
import { startSessionCleanup } from "./jobs/session-cleanup";
import { handleError } from "./middleware/error-handler";
import { logInfo } from "./middleware/logging";
import { EntryService } from "./services/entry-service";
import { RoleButtons } from "./buttons/role-buttons";

config({ path: ".env.local" });

export const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessageReactions,
	],
	partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once("ready", async () => {
	logInfo(`Logged in as ${client.user?.tag}!`);

	const commands: any[] = [];

	const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN!);

	try {
		logInfo("Started refreshing application (/) commands.");
		await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), {
			body: commands,
		});
		logInfo("Successfully reloaded application (/) commands.");
	} catch (error) {
		handleError(error, "refreshing slash commands");
	}

	const guild = client.guilds.cache.first();
	if (guild) {
		await BotManager.initializeBotServices(guild);
	}

	await setBotOnlineStatus();

	scheduleDailyReset();
	startSessionCleanup();
});

client.on("interactionCreate", async (interaction) => {
	if (interaction.isButton()) {
		const entryHandlers = EntryButtons.getEntryButtonHandlers();
		const shareHandlers = EntryButtons.getShareButtonHandlers();

		for (const [customId, handler] of entryHandlers.entries()) {
			if (interaction.customId === customId) {
				await handler(interaction);
				return;
			}
		}

		for (const [customIdPrefix, handler] of shareHandlers.entries()) {
			if (interaction.customId.startsWith(customIdPrefix)) {
				await handler(interaction);
				return;
			}
		}

		// Handle role button interactions
		if (interaction.customId === "create_goal") {
			await RoleButtons.handleCreateGoal(interaction);
			return;
		}
	}

	if (interaction.isModalSubmit()) {
		// Handle goal creation modal
		if (interaction.customId.startsWith("create_goal_modal_")) {
			await RoleButtons.handleGoalCreationModal(interaction);
			return;
		}
	}
});

client.on("messageCreate", async (message: Message) => {
	if (message.author.bot || !message.guild) return;

	await handleEntryCommand(message);
	await handleArchiveCommand(message);
	await handleRemindCommand(message);

	try {
		await EntryService.handleSubmission(message);
	} catch (error) {
		handleError(error, "handling submission message");
	}
});

client.on("messageReactionAdd", async (messageReaction, user) => {
	try {
		await ReactionController.handleMessageReactionAdd(messageReaction, user);
	} catch (error) {
		handleError(error, "handling message reaction add");
	}
});

setupGracefulShutdown();

client.login(process.env.DISCORD_TOKEN);
