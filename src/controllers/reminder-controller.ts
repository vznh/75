// controllers/reminder-controller
import { Message } from 'discord.js';
import { MESSAGES } from '../constants/messages';
import { ReminderService } from '../services/reminder-service';
import { handleError } from '../middleware/error-handler';

export class ReminderController {
  static async handleRemindCommand(message: Message): Promise<void> {
    try {
      await ReminderService.sendGoalReminders(message.guild!, false);
      await message.reply(MESSAGES.REMINDER.SENT);
    } catch (error) {
      handleError(error, 'handleRemindCommand');
      await message.reply(MESSAGES.REMINDER.SEND_ERROR);
    }
  }
}