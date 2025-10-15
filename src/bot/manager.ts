// bot/manager
import { Guild, TextChannel } from 'discord.js';
import { CHANNEL_IDS } from '../constants/channels';
import { EntryButtons } from '../buttons/entry-buttons';
import { RoleService } from '../services/role-service';
import { StatusService } from '../services/status-service';
import { ReminderService } from '../services/reminder-service';
import { logInfo, logError } from '../middleware/logging';

export class BotManager {
  static async initializeBotServices(guild: Guild): Promise<void> {
    try {
      await EntryButtons.sendInstructionsAndButtons();

      await RoleService.ensureRolesExist(guild);
    } catch (error) {
      logError('Error ensuring roles exist', error);
    }

    await RoleService.createRoleSelectionMessage(CHANNEL_IDS.ROLE_SELECTION);

    try {
      await StatusService.updateAccountabilityStatus(guild);
    } catch (error) {
      logError('Error initializing accountability status', error);
    }

    try {
      await StatusService.updateHistoryEmbed(guild);
    } catch (error) {
      logError('Error initializing history embed', error);
    }

    try {
      ReminderService.scheduleGoalReminders();
    } catch (error) {
      logError('Error initializing goal reminders', error);
    }

    logInfo('Bot services initialized successfully');
  }
}