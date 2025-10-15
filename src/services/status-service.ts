// services/status-service
import { EmbedBuilder, Guild, GuildMember, TextChannel } from 'discord.js';
import { CHANNEL_IDS } from '../constants/channels';
import { DEFAULT_COLOR } from '../constants/colors';
import { EntryService } from './entry-service';
import { GoalService } from './goal-service';
import { handleError } from '../middleware/error-handler';
import { logInfo, logError } from '../middleware/logging';
import { getCurrentDayNumber } from '../utils/time-utils';

export class StatusService {
  private static statusMessageId: string | null = null;
  private static historyMessageId: string | null = null;

  static async updateAccountabilityStatus(guild: Guild): Promise<void> {
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
        return userGoals.length > 0;
      });

      const memberStatuses: Array<{ member: GuildMember; completed: boolean }> = [];

      for (const member of challengeMembers.values()) {
        const completed = await this.checkUserCompletionStatus(member);
        memberStatuses.push({ member, completed });
      }

      const embed = new EmbedBuilder()
        .setTitle("Statuses")
        .setDescription('View all participants below and their statuses for today.')
        .setColor(DEFAULT_COLOR)
        .setTimestamp();

      for (const { member, completed } of memberStatuses) {
        const displayName = member.displayName || member.user.username;
        const statusEmoji = completed ? '✅' : '❌';
        const statusText = completed ? 'Completed' : 'Not completed';

        embed.addFields({
          name: `${statusEmoji} ${displayName}`,
          value: statusText,
          inline: true,
        });
      }

      if (this.statusMessageId) {
        try {
          const message = await channel.messages.fetch(this.statusMessageId);
          await message.edit({ embeds: [embed] });
          logInfo('Updated accountability status embed');
        } catch (error) {
          handleError(error, 'updating status message, will create new one');
          this.statusMessageId = null;
        }
      }

      if (!this.statusMessageId) {
        const message = await channel.send({ embeds: [embed] });
        this.statusMessageId = message.id;
        logInfo('Created new accountability status embed');
      }

    } catch (error) {
      handleError(error, 'updateAccountabilityStatus');
    }
  }

  static async updateHistoryEmbed(guild: Guild): Promise<void> {
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
        return userGoals.length > 0;
      });

      const historyData = await this.reconstructHistoryFromThreads(guild, challengeMembers);

      const embed = new EmbedBuilder()
        .setTitle("History")
        .setDescription(this.formatHistoryData(historyData))
        .setColor(DEFAULT_COLOR)
        .setTimestamp();

      if (this.historyMessageId) {
        try {
          const message = await channel.messages.fetch(this.historyMessageId);
          await message.edit({ embeds: [embed] });
          logInfo('Updated history embed');
        } catch (error) {
          handleError(error, 'updating history message, will create new one');
          this.historyMessageId = null;
        }
      }

      if (!this.historyMessageId) {
        const message = await channel.send({ embeds: [embed] });
        this.historyMessageId = message.id;
        logInfo('Created new history embed');
      }

    } catch (error) {
      handleError(error, 'updateHistoryEmbed');
    }
  }

  static async resetDailyStatus(): Promise<void> {
    logInfo('Resetting daily accountability status for new day');
    this.statusMessageId = null;
    this.historyMessageId = null;

    try {
      const client = (await import('../index')).client;
      await this.updateAccountabilityStatus(client.guilds.cache.first()!);
      await this.updateHistoryEmbed(client.guilds.cache.first()!);
    } catch (error) {
      handleError(error, 'resetDailyStatus');
    }
  }

  static async forceRefreshStatus(guild: Guild): Promise<void> {
    try {
      logInfo('🔄 Force refreshing status and history...');
      
      const archiveChannel = guild.channels.cache.get(CHANNEL_IDS.ARCHIVE) as TextChannel;
      if (archiveChannel) {
        await archiveChannel.threads.fetch();
        logInfo('✅ Thread cache refreshed');
      }
      
      await this.updateAccountabilityStatus(guild);
      await this.updateHistoryEmbed(guild);
      
      logInfo('✅ Force refresh completed');
    } catch (error) {
      handleError(error, 'force refresh');
    }
  }

  private static async reconstructHistoryFromThreads(guild: Guild, challengeMembers: any): Promise<Map<number, { completed: string[], incomplete: string[] }>> {
    const historyData = new Map<number, { completed: string[], incomplete: string[] }>();
    
    try {
      const archiveChannel = guild.channels.cache.get(CHANNEL_IDS.ARCHIVE) as TextChannel;

      if (!archiveChannel) {
        logError('Archive channel not found for history reconstruction');
        return historyData;
      }

      const currentDay = getCurrentDayNumber();

      for (let day = 1; day <= currentDay; day++) {
        const completed: string[] = [];
        const incomplete: string[] = [];

        for (const member of challengeMembers.values()) {
          const displayName = member.displayName || member.user.username;
          
          const userThreads = archiveChannel.threads.cache.filter(thread => {
            return thread.name === `archive-${displayName}-entry-day-${day}`;
          });

          if (userThreads.size > 0) {
            completed.push(displayName);
          } else {
            incomplete.push(displayName);
          }
        }

        historyData.set(day, { completed, incomplete });
      }

    } catch (error) {
      handleError(error, 'reconstructHistoryFromThreads');
    }

    return historyData;
  }

  private static formatHistoryData(historyData: Map<number, { completed: string[], incomplete: string[] }>): string {
    let formattedHistory = '';

    const sortedDays = Array.from(historyData.keys()).sort((a, b) => a - b);

    for (const day of sortedDays) {
      const dayData = historyData.get(day);
      if (!dayData) continue;

      formattedHistory += `**Day ${day}**\n`;
      
      if (dayData.completed.length > 0) {
        formattedHistory += `C: ${dayData.completed.join(', ')}\n`;
      } else {
        formattedHistory += `C: (none)\n`;
      }
      
      if (dayData.incomplete.length > 0) {
        formattedHistory += `IC: ${dayData.incomplete.join(', ')}\n`;
      } else {
        formattedHistory += `IC: (none)\n`;
      }
      
      formattedHistory += '\n';
    }

    return `\`\`\`\n${formattedHistory.trim()}\n\`\`\``;
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