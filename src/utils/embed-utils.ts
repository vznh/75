// utils/embed-utils
import { EmbedTemplates } from "../constants/embeds";

export function createStatusEmbed(
	isOnline: boolean,
	reason?: string,
): ReturnType<typeof EmbedTemplates.createStatusEmbed> {
	return EmbedTemplates.createStatusEmbed(isOnline, reason);
}

export function createEntryButtonEmbed(): ReturnType<typeof EmbedTemplates.createEntryButtonEmbed> {
	return EmbedTemplates.createEntryButtonEmbed();
}
