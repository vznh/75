// controllers/reminder-controller
import type { Message } from "discord.js";
import { MESSAGES } from "../constants/messages";
import { handleError } from "../middleware/error-handler";
import { ReminderService } from "../services/reminder-service";

export class ReminderController {
	static async handleRemindCommand(message: Message): Promise<void> {
		try {
			await ReminderService.sendGoalReminders(message.guild!, false);
			await message.reply(MESSAGES.REMINDER.SENT);
		} catch (error) {
			handleError(error, "handleRemindCommand");
			await message.reply(MESSAGES.REMINDER.SEND_ERROR);
		}
	}
}
