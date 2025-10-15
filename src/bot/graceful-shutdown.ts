// bot/graceful-shutdown
import { EmbedBuilder, TextChannel } from 'discord.js';
import { client } from '../index';
import { CHANNEL_IDS } from '../constants/channels';
import { SUCCESS_COLOR, ERROR_COLOR } from '../constants/colors';
import { createStatusEmbed } from '../utils/embed-utils';
import { handleError } from '../middleware/error-handler';
import { logInfo } from '../middleware/logging';

let statusMessageId: string | null = null;

async function updateBotStatus(isOnline: boolean, reason?: string) {
  try {
    const channel = await client.channels.fetch(CHANNEL_IDS.STATUS);

    if (!channel || !channel.isTextBased()) {
      console.error('Status channel not found or not text-based:', CHANNEL_IDS.STATUS);
      return;
    }

    const embed = createStatusEmbed(isOnline, reason);

    if (statusMessageId) {
      try {
        const message = await (channel as TextChannel).messages.fetch(statusMessageId);
        await message.edit({ embeds: [embed] });
        logInfo(`Status updated: Bot ${isOnline ? 'online' : 'offline'}`);
        return;
      } catch (error) {
        handleError(error, 'editing status message, will create new one');
        statusMessageId = null;
      }
    }

    if (!statusMessageId) {
      try {
        const messages = await (channel as TextChannel).messages.fetch({ limit: 10 });
        const statusMessage = messages.find(msg => {
          return msg.embeds.length > 0 &&
                 (msg.embeds[0].title?.includes('Bot is online') ||
                  msg.embeds[0].title?.includes('Bot is offline'));
        });

        if (statusMessage) {
          statusMessageId = statusMessage.id;
          await statusMessage.edit({ embeds: [embed] });
          logInfo(`Found and updated existing status message: Bot ${isOnline ? 'online' : 'offline'}`);
          return;
        }
      } catch (error) {
        handleError(error, 'searching for existing status message');
      }
    }

    const message = await (channel as TextChannel).send({ embeds: [embed] });
    statusMessageId = message.id;
    logInfo(`Status message created: Bot ${isOnline ? 'online' : 'offline'}`);
  } catch (error) {
    handleError(error, 'updating bot status');
  }
}

export async function gracefulShutdown(signal: string): Promise<void> {
  logInfo(`Received ${signal}. Shutting down gracefully...`);

  const isManualShutdown = signal === 'SIGINT';
  const reason = isManualShutdown
    ? 'Bot was manually shut off'
    : `Bot shut off unexpectedly (signal: ${signal})`;

  await updateBotStatus(false, reason);

  process.exit(0);
}

export function setupGracefulShutdown(): void {
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));
  
  process.on('exit', (code) => {
    if (code !== 0) {
      logInfo(`Process exited with code ${code}`);
    }
  });

  process.on('uncaughtException', (error) => {
    handleError(error, 'Uncaught Exception');
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    handleError(reason, 'Unhandled Rejection at:');
    gracefulShutdown('unhandledRejection');
  });
}

export async function setBotOnlineStatus(): Promise<void> {
  await updateBotStatus(true, 'Bot restarted and is now online');
}