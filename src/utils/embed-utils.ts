// utils/embed-utils
import { EmbedBuilder } from 'discord.js';

export function createStatusEmbed(isOnline: boolean, reason?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(isOnline ? "🤖 Bot is online!" : "🔴 Bot is offline!")
    .setDescription(isOnline
      ? "Bot is currently working and is active."
      : `Bot is currently offline.${reason ? ` Reason: ${reason}` : ''}`
    )
    .setColor(isOnline ? 0x00FF00 : 0xFF0000)
    .setTimestamp();
}

export function createInstructionEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("**Instructions**")
    .setDescription(
      "This bot is meant to track your 75 progress, check if you have completed your goals, communicate to others and hold your archive. Below are the two actions that you can take to create an entry or review your previous entries.\n\n" +
      "**Create an entry** gets you started with a new thread to submit - you cannot create a new thread if one is existent.\n\n" +
      "**View previous entries** sends you a DM (if permissible) with all of the days as \"{link to channel} for day {day}.\""
    )
    .setColor(0x0099FF);
}

export function createEntryButtonEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("📝 Submit your entries here!")
    .setDescription("The bot is successfully loaded. Use any action below to log.");
}