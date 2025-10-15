// commands/remind
import { Message } from 'discord.js';
import { ReminderController } from '../controllers/reminder-controller';

export async function handleRemindCommand(message: Message): Promise<void> {
  if (message.author.bot || !message.guild) return;
  
  if (message.content.trim().toLowerCase() === "!remind") {
    await ReminderController.handleRemindCommand(message);
  }
}