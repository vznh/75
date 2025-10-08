// entrypoint
import { config } from "dotenv";
import {
  Client,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
  REST,
  Routes,
} from "discord.js";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
} from "discord.js";
import * as b from "./func/bot";
import { EntryService } from "./lib/entry";
import { Message } from "discord.js";

// Status message management
let statusMessageId: string | null = null;
const STATUS_CHANNEL_ID = '1424172599197565109';

async function updateBotStatus(isOnline: boolean, reason?: string) {
  try {
    const channel = await client.channels.fetch(STATUS_CHANNEL_ID);

    if (!channel || !channel.isTextBased()) {
      console.error('Status channel not found or not text-based:', STATUS_CHANNEL_ID);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(isOnline ? "🤖 Bot is online!" : "🔴 Bot is offline!")
      .setDescription(isOnline
        ? "Bot is currently working and is active."
        : `Bot is currently offline.${reason ? ` Reason: ${reason}` : ''}`
      )
      .setColor(isOnline ? 0x00FF00 : 0xFF0000) // Green for online, red for offline
      .setTimestamp();

    if (statusMessageId) {
      // Try to edit existing message
      try {
        const message = await (channel as TextChannel).messages.fetch(statusMessageId);
        await message.edit({ embeds: [embed] });
        console.log(`Status updated: Bot ${isOnline ? 'online' : 'offline'}`);
        return;
      } catch (error) {
        console.error('Error editing status message, will create new one:', error);
        statusMessageId = null;
      }
    }

    // Look for existing status message in the channel
    if (!statusMessageId) {
      try {
        const messages = await (channel as TextChannel).messages.fetch({ limit: 10 });
        const statusMessage = messages.find(msg => {
          // Look for messages that contain our status embed pattern
          return msg.embeds.length > 0 &&
                 (msg.embeds[0].title?.includes('Bot is online') ||
                  msg.embeds[0].title?.includes('Bot is offline'));
        });

        if (statusMessage) {
          statusMessageId = statusMessage.id;
          // Try to edit the found message
          await statusMessage.edit({ embeds: [embed] });
          console.log(`Found and updated existing status message: Bot ${isOnline ? 'online' : 'offline'}`);
          return;
        }
      } catch (error) {
        console.error('Error searching for existing status message:', error);
      }
    }

    // Create new message if no existing one found
    const message = await (channel as TextChannel).send({ embeds: [embed] });
    statusMessageId = message.id;
    console.log(`Status message created: Bot ${isOnline ? 'online' : 'offline'}`);
  } catch (error) {
    console.error('Error updating bot status:', error);
  }
}

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down gracefully...`);

  // Determine if this was manual or unexpected shutdown
  const isManualShutdown = signal === 'SIGINT';
  const reason = isManualShutdown
    ? 'Bot was manually shut off'
    : `Bot shut off unexpectedly (signal: ${signal})`;

  // Update status to offline before shutting down
  await updateBotStatus(false, reason);

  // Exit the process
  process.exit(0);
}

// Set up signal handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon restarts
process.on('exit', (code) => {
  if (code !== 0) {
    console.log(`Process exited with code ${code}`);
  }
});

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});
config({ path: '.env.local' });

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
  console.log(`Logged in as ${client.user?.tag}!`);

  const commands = [
    new SlashCommandBuilder()
      .setName("signup")
      .setDescription("Enroll yourself as a participant for the challenge.")
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN!);

  try {
    console.log("Started refreshing application (/) commands.");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), {
      body: commands,
    });
    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }

  // Send instructions and entry buttons to the designated channel
  await b.sendInstructionsAndButtons();

  // Ensure all challenge roles exist in the server
  try {
    const guild = client.guilds.cache.first();
    if (guild) {
      await EntryService.ensureRolesExist(guild);
    }
  } catch (error) {
    console.error('Error ensuring roles exist:', error);
  }

  // Initialize role selection message in channel 1424177763895607380
  await EntryService.createRoleSelectionMessage('1424177763895607380');

  // Initialize accountability status
  try {
    await EntryService.updateAccountabilityStatus(client.guilds.cache.first()!);
  } catch (error) {
    console.error('Error initializing accountability status:', error);
  }

  // Initialize history embed
  try {
    await EntryService.updateHistoryEmbed(client.guilds.cache.first()!);
  } catch (error) {
    console.error('Error initializing history embed:', error);
  }

  // Initialize goal reminder scheduler
  try {
    EntryService.scheduleGoalReminders();
  } catch (error) {
    console.error('Error initializing goal reminders:', error);
  }

  // Set bot status to online
  await updateBotStatus(true, 'Bot restarted and is now online');
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "signup") {

      try {
        // TODO: Add to Supabase database
        // For now, just acknowledge the signup
        await interaction.reply({
          content: `✅ **${interaction.user.username}** has enrolled in the challenge.`,
          ephemeral: true,
        });

        const mainChannel = await client.channels.fetch(
          process.env.MAIN_CHANNEL_ID!,
        );
        if (mainChannel && mainChannel.isTextBased()) {
          await (mainChannel as TextChannel).send({
            content: `🎉 **${interaction.user.username}** has joined the challenge!`,
          });
        }
      } catch (error) {
        console.error("Error during signup:", error);
        await interaction.reply({
          content: "❌ There was an error during signup. Please try again.",
          ephemeral: true,
        });
      }
      return;
    }
  }

  // Handle button interactions
  if (!interaction.isButton()) return;

  if (interaction.customId === "create_entry") {
    // Defer reply immediately to prevent interaction timeout
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member;
    if (!member) {
      await interaction.editReply({
        content: "(ಠ_ಠ) Could not find member information.",
      });
      return;
    }

    try {
      await EntryService.startEntry(member as any);
      await interaction.editReply({
        content: "(・∀・) Entry creation started! Check the archive channel for your thread.",
      });
    } catch (error) {
      console.error('Error starting entry:', error);
      await interaction.editReply({
        content: "(ಠ_ಠ) Error starting entry. Please try again.",
      });
    }
  } else if (interaction.customId === "view_entries") {
    // Defer reply immediately to prevent interaction timeout
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member;
    if (!member) {
      await interaction.editReply({
        content: "(ಠ_ಠ) Could not find member information.",
      });
      return;
    }

    try {
      await EntryService.showPreviousEntries(member as any);
      await interaction.editReply({
        content: "(・∀・) Previous entries info sent via DM.",
      });
    } catch (error) {
      console.error('Error showing previous entries:', error);
      await interaction.editReply({
        content: "(ಠ_ಠ) Error retrieving entries. Please try again.",
      });
    }
  }

  // Role selection is now handled via reactions in handleMessageReactionAdd
});

// Handle message commands (!entry and !prev)
client.on("messageCreate", async (message: Message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim().toLowerCase();

  if (content === "!entry") {
    const member = message.member;
    if (!member) {
      console.error('Member not found for entry command');
      return;
    }

    try {
      await EntryService.startEntry(member);
    } catch (error) {
      console.error('Error handling !entry command:', error);
    }
    return;
  }

  if (content === "!prev") {
    const member = message.member;
    if (!member) {
      console.error('Member not found for prev command');
      return;
    }

    try {
      await EntryService.showPreviousEntries(member);
    } catch (error) {
      console.error('Error handling !prev command:', error);
    }
    return;
  }

  if (content === "!refresh") {
    try {
      await EntryService.forceRefreshStatus(message.guild!);
      await message.reply('✅ Status and history refreshed!');
    } catch (error) {
      console.error('Error handling !refresh command:', error);
      await message.reply('❌ Error refreshing status. Check console for details.');
    }
    return;
  }

  if (content === "!day") {
    try {
      const dayNumber = EntryService.getCurrentDayNumber();
      const now = new Date();
      const pdtNow = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
      
      await message.reply(`📅 **Current Day:** ${dayNumber}\n🕐 **PDT Time:** ${pdtNow.toLocaleString()}\n📆 **Date:** ${pdtNow.toDateString()}`);
    } catch (error) {
      console.error('Error handling !day command:', error);
      await message.reply('❌ Error getting day info. Check console for details.');
    }
    return;
  }

  if (content === "!remind") {
    try {
      await EntryService.sendGoalReminders(message.guild!, false);
      await message.reply('✅ Reminder sent!');
    } catch (error) {
      console.error('Error handling !remind command:', error);
      await message.reply('❌ Error sending reminder. Check console for details.');
    }
    return;
  }

  if (content === "!lastcall") {
    try {
      await EntryService.sendGoalReminders(message.guild!, true);
      await message.reply('✅ Last call reminder sent!');
    } catch (error) {
      console.error('Error handling !lastcall command:', error);
      await message.reply('❌ Error sending last call. Check console for details.');
    }
    return;
  }

  // Handle submissions in entry threads
  try {
    await EntryService.handleSubmission(message);
  } catch (error) {
    console.error('Error handling submission message:', error);
  }
});

// Handle reaction events for role assignment
client.on("messageReactionAdd", async (messageReaction, user) => {
  try {
    await EntryService.handleMessageReactionAdd(messageReaction, user);
  } catch (error) {
    console.error('Error handling message reaction add:', error);
  }
});

// Cleanup expired sessions periodically
setInterval(() => {
  EntryService.cleanupExpiredSessions();
}, 5 * 60 * 1000); // Every 5 minutes

// Daily reset at midnight for accountability status
function scheduleDailyReset() {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0); // Next midnight

  const timeUntilMidnight = midnight.getTime() - now.getTime();

  setTimeout(async () => {
    try {
      await EntryService.resetDailyStatus();
      console.log('Daily accountability status reset completed');
    } catch (error) {
      console.error('Error during daily reset:', error);
    }

    // Schedule next reset for tomorrow
    scheduleDailyReset();
  }, timeUntilMidnight);
}

// Start the daily reset scheduler
scheduleDailyReset();

client.login(process.env.DISCORD_TOKEN);
