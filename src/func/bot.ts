// func/bot
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type TextChannel,
} from "discord.js";
import { client } from "..";
import { EmbedTemplates } from "../constants/embeds";
import { PlaintextTemplates } from "../constants/plaintext";

export async function main(channelId: string) {
	const embed = EmbedTemplates.createEntryButtonEmbed();

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

	const channel = await client.channels.fetch(channelId);
	if (channel && channel.isTextBased()) {
		await (channel as TextChannel).send({
			embeds: [embed],
			components: [actions],
		});
	}
}

export async function sendInstructionsAndButtons() {
	// Send instructional message as plaintext first
	const instructions = PlaintextTemplates.getInstructions();

	// Create the action buttons
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

	// Send to the specific channel
	const targetChannelId = "1424567137976188960";
	const channel = await client.channels.fetch(targetChannelId);

	if (channel && channel.isTextBased()) {
		await (channel as TextChannel).send({
			content: instructions,
		});

		await (channel as TextChannel).send({
			embeds: [],
			components: [actions],
		});

		console.log(
			`Sent instructions and entry buttons to channel ${targetChannelId}`,
		);
	} else {
		console.error(`Could not find or send to channel ${targetChannelId}`);
	}
}
