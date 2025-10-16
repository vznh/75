// commands/archive
import type { Message } from "discord.js";
import { EntryController } from "../controllers/entry-controller";

export async function handleArchiveCommand(message: Message): Promise<void> {
	if (message.author.bot || !message.guild) return;

	if (message.content.trim().toLowerCase() === "!archive") {
		await EntryController.handleArchiveCommand(message);
	}
}
