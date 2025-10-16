// controllers/entry-controller
import type { ButtonInteraction, Message } from "discord.js";
import { MESSAGES } from "../constants/messages";
import { handleError } from "../middleware/error-handler";
import { logError, logInfo } from "../middleware/logging";
import { EntryService } from "../services/entry-service";

export class EntryController {
	static async handleCreateEntryButton(
		interaction: ButtonInteraction,
	): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const member = interaction.member;
		if (!member) {
			await interaction.editReply({
				content: MESSAGES.ENTRY.NO_MEMBER_INFO,
			});
			return;
		}

		try {
			await EntryService.startEntry(member as any);
			await interaction.editReply({
				content: MESSAGES.ENTRY.CREATION_STARTED,
			});
		} catch (error) {
			handleError(error, "handleCreateEntryButton");
			await interaction.editReply({
				content: MESSAGES.ENTRY.CREATION_ERROR,
			});
		}
	}

	static async handleViewEntriesButton(
		interaction: ButtonInteraction,
	): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const member = interaction.member;
		if (!member) {
			await interaction.editReply({
				content: MESSAGES.ENTRY.NO_MEMBER_INFO,
			});
			return;
		}

		try {
			await EntryService.showPreviousEntries(member as any);
			await interaction.editReply({
				content: MESSAGES.ENTRY.PREVIOUS_ENTRIES_DM,
			});
		} catch (error) {
			handleError(error, "handleViewEntriesButton");
			await interaction.editReply({
				content: MESSAGES.ENTRY.PREVIOUS_ENTRIES_ERROR,
			});
		}
	}

	static async handleShareThreadButton(
		interaction: ButtonInteraction,
	): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const threadId = interaction.customId.replace("share_thread_", "");
		const userId = interaction.user.id;

		try {
			await EntryService.shareThread(threadId, userId);
			await interaction.editReply({
				content: MESSAGES.ENTRY.THREAD_SHARED,
			});
		} catch (error) {
			handleError(error, "handleShareThreadButton");
			await interaction.editReply({
				content: MESSAGES.ENTRY.THREAD_SHARE_ERROR,
			});
		}
	}

	static async handleEntryCommand(message: Message): Promise<void> {
		const member = message.member;
		if (!member) {
			logError("Member not found for entry command");
			return;
		}

		try {
			await EntryService.startEntry(member);
		} catch (error) {
			handleError(error, "handleEntryCommand");
		}
	}

	static async handleArchiveCommand(message: Message): Promise<void> {
		const member = message.member;
		if (!member) {
			logError("Member not found for archive command");
			return;
		}

		try {
			await EntryService.showPreviousEntries(member);
		} catch (error) {
			handleError(error, "handleArchiveCommand");
		}
	}
}
