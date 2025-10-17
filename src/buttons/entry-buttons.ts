// buttons/entry-buttons
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type TextChannel,
} from "discord.js";
import { CHANNEL_IDS } from "../constants/channels";
import { EntryController } from "../controllers/entry-controller";
import { logError, logInfo } from "../middleware/logging";
import { createEntryButtonEmbed } from "../utils/embed-utils";
import { PlaintextTemplates } from "../constants/plaintext";

export class EntryButtons {
	static async sendInstructionsAndButtons(): Promise<void> {
		const { client } = await import("../index");

		const instructions = PlaintextTemplates.getInstructions();

		const actions = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId("create_entry")
				.setLabel("🔨 Create an entry")
				.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
				.setCustomId("view_entries")
				.setLabel("🔄 View previous entries")
				.setStyle(ButtonStyle.Secondary),
		);

		const targetChannelId = CHANNEL_IDS.MAIN;
		const channel = client.channels.cache.get(targetChannelId);

		if (channel && channel.isTextBased()) {
			await (channel as TextChannel).send({
				content: instructions,
			});

			await (channel as TextChannel).send({
				embeds: [],
				components: [actions],
			});

			logInfo(
				`Sent instructions and entry buttons to channel ${targetChannelId}`,
			);
		} else {
			logError(`Could not find or send to channel ${targetChannelId}`);
		}
	}

	static getEntryButtonHandlers(): Map<
		string,
		(interaction: any) => Promise<void>
	> {
		const handlers = new Map();

		handlers.set("create_entry", EntryController.handleCreateEntryButton);
		handlers.set("view_entries", EntryController.handleViewEntriesButton);

		return handlers;
	}

	static getShareButtonHandlers(): Map<
		string,
		(interaction: any) => Promise<void>
	> {
		const handlers = new Map();

		handlers.set("share_thread_", EntryController.handleShareThreadButton);

		return handlers;
	}
}
