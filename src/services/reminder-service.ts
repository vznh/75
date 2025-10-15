// services/reminder-service
import { Guild, GuildMember, TextChannel } from 'discord.js';
import { CHANNEL_IDS } from '../constants/channels';
import { REMINDER_TIMES } from '../constants/timings';
import { MESSAGES } from '../constants/messages';
import { StatusService } from './status-service';
import { GoalService } from './goal-service';
import { handleError } from '../middleware/error-handler';
import { logInfo, logError } from '../middleware/logging';
import { getPDTTime, getCurrentDayNumber } from '../utils/time-utils';

export class ReminderService {
  static async sendGoalReminders(guild: Guild, isLastCall: boolean = false): Promise<void> {
    try {
      const channel = await guild.channels.fetch(CHANNEL_IDS.STATUS) as TextChannel;

      if (!channel || !channel.isTextBased()) {
        logError('Status channel not found or not text-based', CHANNEL_IDS.STATUS);
        return;
      }

      const allMembers = await guild.members.fetch();
      const challengeMembers = allMembers.filter(member => {
        if (member.user.bot) return false;
        const memberRoles = member.roles.cache.map(role => role.name.toLowerCase());
        const userGoals = GoalService.getUserGoals(memberRoles);
        const userWeeklyGoals = GoalService.getUserWeeklyGoals(memberRoles);
        return userGoals.length > 0 || userWeeklyGoals.length > 0;
      });

      const incompleteMembers: GuildMember[] = [];

      for (const member of challengeMembers.values()) {
        const isCompleted = await this.checkUserCompletionStatus(member);
        if (!isCompleted) {
          incompleteMembers.push(member);
        }
      }

      if (incompleteMembers.length === 0) {
        logInfo('All members have completed their goals for today');
        return;
      }

      const individualPings = incompleteMembers.map(member => `<@${member.id}>`).join(' ');

      const message = isLastCall 
        ? `${individualPings} last call to finish entries!`
        : `${individualPings} hasn't finished their goal yet!`;

      await channel.send(message);
      logInfo(`✅ Sent ${isLastCall ? 'last call' : 'reminder'} message to ${incompleteMembers.length} members`);

    } catch (error) {
      handleError(error, 'sendGoalReminders');
    }
  }

  static scheduleGoalReminders(): void {
    logInfo('📅 Scheduling goal completion reminders...');

    this.scheduleReminder(REMINDER_TIMES.REGULAR_REMINDER.hour, REMINDER_TIMES.REGULAR_REMINDER.minute, false);
    this.scheduleReminder(REMINDER_TIMES.LAST_CALL_REMINDER.hour, REMINDER_TIMES.LAST_CALL_REMINDER.minute, true);
  }

  private static scheduleReminder(hour: number, minute: number, isLastCall: boolean): void {
    
    const now = new Date();
    const pdtNow = getPDTTime();
    
    const targetTime = new Date(pdtNow);
    targetTime.setHours(hour, minute, 0, 0);

    if (targetTime <= pdtNow) {
      targetTime.setDate(targetTime.getDate() + 1);
    }

    const timeUntilReminder = targetTime.getTime() - pdtNow.getTime();

    setTimeout(async () => {
      try {
        const client = (await import('../index')).client;
        const guild = client.guilds.cache.first();
        if (guild) {
          await this.sendGoalReminders(guild, isLastCall);
        }
      } catch (error) {
        handleError(error, `sending ${isLastCall ? 'last call' : 'reminder'} reminder`);
      }

      this.scheduleReminder(hour, minute, isLastCall);
    }, timeUntilReminder);

    const reminderType = isLastCall ? 'last call' : 'reminder';
    logInfo(`⏰ Scheduled ${reminderType} for ${targetTime.toLocaleString("en-US", {timeZone: "America/Los_Angeles"})}`);
  }

  private static async checkUserCompletionStatus(member: GuildMember): Promise<boolean> {
    try {
      const archiveChannel = member.guild.channels.cache.get(CHANNEL_IDS.ARCHIVE) as TextChannel;
      const dayNumber = getCurrentDayNumber();
      const displayName = member.displayName || member.user.username;

      if (!archiveChannel) {
        logError('Archive channel not found for completion check');
        return false;
      }

      try {
        await archiveChannel.threads.fetch();
        logInfo(`Refreshed thread cache for completion check of ${displayName}`);
      } catch (error) {
        handleError(error, 'refreshing thread cache for completion check');
      }

      const expectedThreadName = `archive-${displayName}-entry-day-${dayNumber}`;
      logInfo(`Looking for thread: ${expectedThreadName}`);
      
      const userThreads = archiveChannel.threads.cache.filter(thread => {
        const matches = thread.name === expectedThreadName;
        if (matches) {
          logInfo(`Found matching thread: ${thread.name} (locked: ${thread.locked})`);
        }
        return matches;
      });

      logInfo(`Thread search result for ${displayName}: ${userThreads.size} threads found`);

      if (userThreads.size === 0) {
        return false;
      }

      return true;

    } catch (error) {
      handleError(error, 'checking user completion status');
      return false;
    }
  }
}