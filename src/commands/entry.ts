// commands/entry
import type { Message } from "discord.js";
import { EntryController } from "../controllers/entry-controller";

export async function handleEntryCommand(message: Message): Promise<void> {
	if (message.author.bot || !message.guild) return;

	if (message.content.trim().toLowerCase() === "!entry") {
		await EntryController.handleEntryCommand(message);
	}
}
