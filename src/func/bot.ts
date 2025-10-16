// func/bot
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	type TextChannel,
} from "discord.js";
import { client } from "..";

export async function main(channelId: string) {
	const embed = new EmbedBuilder()
		.setTitle("📝 Submit your entries here!")
		.setDescription(
			"The bot is successfully loaded. Use any action below to log.",
		);

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
	// Send instructional embed first
	const instructionEmbed = new EmbedBuilder()
		.setTitle("**Instructions**")
		.setDescription(
			"This bot is meant to track your 75 progress, check if you have completed your goals, communicate to others and hold your archive. Below are the two actions that you can take to create an entry or review your previous entries.\n\n" +
				"**Create an entry** gets you started with a new thread to submit - you cannot create a new thread if one is existent.\n\n" +
				'**View previous entries** sends you a DM (if permissible) with all of the days as "{link to channel} for day {day}."',
		)
		.setColor(0x0099ff);

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
			embeds: [instructionEmbed],
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
