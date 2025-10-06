// lib/entry.ts
import {
  GuildMember,
  TextChannel,
  EmbedBuilder,
  Message,
  ThreadChannel,
  OverwriteResolvable,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  Guild,
} from 'discord.js';
import { getUserGoals, getAllGoalDefinitions } from './goals';
import { GoalDefinition } from '../types';
import { EntrySession, GoalSubmission } from '../types';

const activeSessions = new Map<string, EntrySession>();

export class EntryService {
  static getCurrentDayNumber(): number {
    const startDate = new Date('2025-10-05');
    const today = new Date();
    const diffTime = today.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 because Oct 5th is day 1
    return Math.max(1, diffDays); // Ensure minimum day 1
  }

  static async startEntry(member: GuildMember): Promise<void> {
    try {
      const discordId = member.id;
      const displayName = member.displayName || member.user.username;

      // Get user's goals from their roles
      const memberRoles = member.roles.cache.map(role => role.name.toLowerCase());
      const userGoals = getUserGoals(memberRoles);

      if (userGoals.length === 0) {
        console.error(`User ${displayName} has no challenge roles`);
        return;
      }

      // Calculate day number (no database needed)
      const dayNumber = this.getCurrentDayNumber();

      // Find the archive channel to create thread in
      const archiveChannelId = '1424342473198796961';
      const archiveChannel = member.guild.channels.cache.get(archiveChannelId) as TextChannel;

      if (!archiveChannel) {
        console.error('Archive channel not found:', archiveChannelId);
        return;
      }

      // Check if thread already exists for this user and day
      const existingThread = await this.findExistingThread(archiveChannel, displayName, dayNumber);
      if (existingThread) {
        console.log(`Thread already exists for ${displayName} - Day ${dayNumber}`);
        // Add user to existing thread if they're not already a member
        try {
          const isMember = existingThread.members.cache.has(discordId);
          if (!isMember) {
            await existingThread.members.add(discordId);
            console.log(`Added ${displayName} to existing thread`);
          }
        } catch (error) {
          console.error('Error adding user to existing thread:', error);
        }
        return;
      }

      // Create private thread in archive channel
      const threadName = `${displayName}-entry-day-${dayNumber}`;
      let thread;
      try {
        thread = await archiveChannel.threads.create({
          name: threadName,
          autoArchiveDuration: 1440, // 24 hours
          type: 12, // private thread
          reason: `Entry for ${displayName} - Day ${dayNumber}`,
          invitable: false,
        });
        console.log(`Created thread in archive channel: ${thread.name}`);
      } catch (error) {
        console.error('Error creating thread:', error);
        return;
      }

      // Add user to thread
      try {
        await thread.members.add(discordId);
      } catch (error) {
        console.error('Error adding user to thread:', error);
      }

      // Initialize session (no database)
      const session: EntrySession = {
        userId: discordId,
        channelId: thread.id,
        dayNumber: dayNumber,
        goals: userGoals.map(g => g.role),
        submissions: new Map(),
        goalMessages: new Map(),
      };

      activeSessions.set(discordId, session);

      // Send initial embed with placeholders
      try {
        await this.sendInitialEntryEmbed(thread, displayName, dayNumber, userGoals);
      } catch (error) {
        console.error('Error sending initial embed:', error);
      }

      // Send individual goal embeds as separate messages
      for (const goalDef of userGoals) {
        try {
          const message = await this.sendGoalEmbed(thread, goalDef);
          session.goalMessages.set(goalDef.role, message.id);
        } catch (error) {
          console.error(`Error sending goal embed for ${goalDef.name}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in startEntry:', error);
    }
  }

  private static async findExistingThread(mainChannel: TextChannel, displayName: string, dayNumber: number): Promise<ThreadChannel | null> {
    try {
      // Fetch recent threads from the main channel
      const threads = mainChannel.threads.cache.filter(thread =>
        thread.name === `${displayName}-entry-day-${dayNumber}` &&
        thread.ownerId // Make sure it's a user-created thread
      );

      if (threads.size > 0) {
        return threads.first() as ThreadChannel;
      }

      return null;
    } catch (error) {
      console.error('Error finding existing thread:', error);
      return null;
    }
  }

  private static async sendInitialEntryEmbed(thread: ThreadChannel, displayName: string, dayNumber: number, userGoals: GoalDefinition[]): Promise<void> {
    try {
      const embed = new EmbedBuilder()
        .setTitle(`Day ${dayNumber}`)
        .setDescription(
          `\n\n` +
          `(￣✓￣) ☑ . . . . your goals\n` +
          `${userGoals.map(goal => `${goal.emoji} ${goal.name}`).join('\n')}\n\n` +
          `**Instructions**\n` +
          `* Reply to each goal below with your submission - each goal has its own instructions\n` +
          `* You can reply to any goal at any time\n` +
          `* You can submit multiple times for the same goal, but one submission will count`
        )
        .setColor(0x0099FF)
        .setTimestamp();

      await thread.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error sending initial entry embed:', error);
      throw error;
    }
  }

  private static async sendGoalEmbed(thread: ThreadChannel, goalDef: GoalDefinition): Promise<Message> {
    try {
      const embed = new EmbedBuilder()
        .setTitle(`${goalDef.emoji} ${goalDef.name}`)
        .setDescription(goalDef.description)
        .setColor(this.getGoalColor(goalDef.role));

      // Add requirements
      const requirements = [];
      if (goalDef.requiresImage) requirements.push('📷 Image');
      if (goalDef.requiresText) requirements.push('📝 Text');

      if (requirements.length > 0) {
        embed.addFields({
          name: 'Required',
          value: requirements.join(' or '),
          inline: false,
        });
      }

      return await thread.send({ embeds: [embed] });
    } catch (error) {
      console.error(`Error sending goal embed for ${goalDef.name}:`, error);
      throw error;
    }
  }

  private static getGoalColor(roleName: string): number {
    const colors: Record<string, number> = {
      'leetcode': 0xFFA500, // Orange
      'water': 0x0099FF, // Blue
      'sleep': 0x9932CC, // Purple
      'work': 0x32CD32, // Green
      'food': 0xFF6347, // Tomato
      'job applications': 0xFFD700, // Gold
      'gym': 0xDC143C, // Crimson
    };
    return colors[roleName] || 0x0099FF; // Default blue
  }

  static async handleSubmission(message: Message): Promise<void> {
    if (!message.inGuild() || message.author.bot) return;

    const channel = message.channel;
    if (!channel.isThread()) return;

    // Find active session for this user
    const session = Array.from(activeSessions.values()).find(s => s.channelId === channel.id);
    if (!session) return;

    // Only accept messages from the user who started the entry
    if (message.author.id !== session.userId) return;

    // Parse the message for goal submissions
    await this.parseAndValidateSubmission(message, session);
  }

  private static async parseAndValidateSubmission(message: Message, session: EntrySession): Promise<void> {
    try {
      const channel = message.channel as ThreadChannel;
      const content = message.content.trim();
      const hasImage = message.attachments.size > 0;

      // Check if all goals are already completed
      const pendingGoals = session.goals.filter(goalName => {
        return !session.submissions.has(goalName);
      });

      if (pendingGoals.length === 0) {
        try {
          await channel.send('✅ All goals completed! Entry will be finalized shortly.');
          await this.completeEntry(session);
        } catch (error) {
          console.error('Error sending completion message:', error);
        }
        return;
      }

      // Detect which goal the user is replying to based on message reference
      let currentGoalName: string | null = null;
      
      if (message.reference?.messageId) {
        // User replied to a specific message, find which goal it is
        for (const [goalName, messageId] of session.goalMessages.entries()) {
          if (messageId === message.reference.messageId) {
            currentGoalName = goalName;
            break;
          }
        }
      }

      // If no reply reference, try to match by content or use first pending goal
      if (!currentGoalName && pendingGoals.length > 0) {
        currentGoalName = pendingGoals[0];
      }

      if (!currentGoalName) {
        try {
          await channel.send('(ಠ_ಠ) Could not determine which goal this submission is for. Please reply to a specific goal embed.');
        } catch (error) {
          console.error('Error sending error message:', error);
        }
        return;
      }

      // Check if this goal was already submitted
      if (session.submissions.has(currentGoalName)) {
        try {
          await channel.send('(・_・) You already submitted this goal. First submission counts!');
        } catch (error) {
          console.error('Error sending duplicate message:', error);
        }
        return;
      }

      const goalDef = getUserGoals([currentGoalName])[0];

      if (!goalDef) {
        try {
          await channel.send('❌ Error: Goal definition not found.');
        } catch (error) {
          console.error('Error sending error message:', error);
        }
        return;
      }

      // Validate submission
      let isValid = false;
      let submissionContent: string | undefined;
      let mediaUrl: string | undefined;

      if (goalDef.requiresText && content) {
        submissionContent = content;
        if (goalDef.validation) {
          isValid = goalDef.validation(content, hasImage);
        } else {
          isValid = content.length > 0;
        }
      }

      if (goalDef.requiresImage && hasImage) {
        mediaUrl = message.attachments.first()?.url;
        isValid = true;
      }

      // For goals that accept either text or image
      if (!goalDef.requiresText && !goalDef.requiresImage) {
        if (content || hasImage) {
          isValid = true;
          submissionContent = content;
          if (hasImage) mediaUrl = message.attachments.first()?.url;
        }
      }

      if (!isValid) {
        const requirements = [];
        if (goalDef.requiresText) requirements.push('text');
        if (goalDef.requiresImage) requirements.push('image');

        try {
          await channel.send(
            `❌ Invalid submission for **${goalDef.name}**. Please provide: ${requirements.join(' or ')}.`
          );
        } catch (error) {
          console.error('Error sending validation message:', error);
        }
        return;
      }

      // Store submission in session (no database)
      const goalSubmission: GoalSubmission = {
        goalName: goalDef.role,
        content: submissionContent,
        mediaUrl: mediaUrl,
        isValid: true,
      };

      session.submissions.set(goalDef.role, goalSubmission);

      // Send confirmation
      try {
        await channel.send(`✅ **${goalDef.name}** submitted successfully!`);
      } catch (error) {
        console.error('Error sending confirmation:', error);
      }

      // Check if all goals are complete
      const completedGoals = session.submissions.size;
      const totalGoals = session.goals.length;

      if (completedGoals >= totalGoals) {
        try {
          await this.completeEntry(session);
        } catch (error) {
          console.error('Error completing entry:', error);
        }
      } else {
        // Show missing goals
        const missingGoals = session.goals.filter(goalName => !session.submissions.has(goalName));
        const missingGoalNames = missingGoals.map(goalName => {
          const goalDef = getUserGoals([goalName])[0];
          return goalDef ? goalDef.name : goalName;
        });

        try {
          await channel.send(`📋 **${totalGoals - completedGoals} goal${totalGoals - completedGoals > 1 ? 's' : ''} remaining:** ${missingGoalNames.join(', ')}`);
        } catch (error) {
          console.error('Error sending remaining goals message:', error);
        }
      }
    } catch (error) {
      console.error('Error in parseAndValidateSubmission:', error);
    }
  }

  private static async completeEntry(session: EntrySession): Promise<void> {
    try {
      // Get the thread channel
      const client = (await import('../index')).client;
      const thread = client.channels.cache.get(session.channelId) as ThreadChannel;

      if (thread) {
        try {
          // Get the guild to find the member and their display name
          const guild = thread.guild;
          const member = await guild.members.fetch(session.userId);
          const displayName = member.displayName || member.user.username;

          // Thread is already in archive channel, just confirm it's in the right place
          console.log(`Thread ${thread.name} is already in archive channel ${thread.parentId}`);

          // Rename thread to prepend with archive-
          const newName = `archive-${thread.name}`;
          await thread.setName(newName);

          await thread.send(`**You complete your entry for ${displayName}!**\n\nThread is now read-only and archived.`);

          // Lock the thread to prevent new messages (but keep it visible)
          await thread.setLocked(true);

          // Update accountability status immediately when thread is locked
          try {
            await this.updateAccountabilityStatus(thread.guild);
            console.log('Accountability status updated for completed entry');
          } catch (error) {
            console.error('Error updating accountability status after thread lock:', error);
          }
        } catch (error) {
          console.error('Error completing thread:', error);
        }
      } else {
        console.error('Thread not found in cache:', session.channelId);
      }

      // Clean up session (no database)
      activeSessions.delete(session.userId);

    } catch (error) {
      console.error('Error in completeEntry:', error);
    }
  }

  static async showPreviousEntries(member: GuildMember): Promise<void> {
    const discordId = member.id;

    try {
      // For now, we'll just show a simple message since we're not using database
      // In a full implementation, we'd search through channels to find user's threads
      const dayNumber = this.getCurrentDayNumber();

      // Find actual previous entry threads for this user
      const archiveChannelId = '1424342473198796961';
      const guildId = member.guild.id;
      const archiveChannel = member.guild.channels.cache.get(archiveChannelId) as TextChannel;

      let entryLinks = '';

      if (archiveChannel) {
        try {
          // Fetch recent threads from the archive channel
          const threads = archiveChannel.threads.cache.filter(thread => {
            // Look for threads that match the user's name and day pattern
            const threadName = thread.name;
            const displayName = member.displayName || member.user.username;
            const dayMatch = threadName.match(new RegExp(`${displayName}-entry-day-(\\d+)`));
            return dayMatch !== null;
          });

          // Sort threads by day number (newest first, but we'll reverse for chronological order)
          const sortedThreads = Array.from(threads.values()).sort((a, b) => {
            const aDay = parseInt(a.name.match(/day-(\d+)/)?.[1] || '0');
            const bDay = parseInt(b.name.match(/day-(\d+)/)?.[1] || '0');
            return bDay - aDay; // Reverse order so day 1 comes first
          });

          // Generate links for each thread found
          for (const thread of sortedThreads) {
            const dayMatch = thread.name.match(/day-(\d+)/);
            if (dayMatch) {
              const day = parseInt(dayMatch[1]);
              entryLinks += `https://discord.com/channels/${guildId}/${thread.id} - your day ${day}\n`;
            }
          }

          // If no threads found, provide a helpful message
          if (!entryLinks) {
            entryLinks = `No previous entries found. Start your challenge with the "Create an entry" button!\n`;
          }
        } catch (error) {
          console.error('Error searching for previous threads:', error);
          entryLinks = `Error retrieving previous entries. Please try again later.\n`;
        }
      } else {
        entryLinks = `Archive channel not found. Please contact an administrator.\n`;
      }

      const embedDescription = `All of your previous entries are detailed below. Click on a text channel when you're finished.\n\n${entryLinks}`;

      // Create embed with no title and timestamp
      const embed = new EmbedBuilder()
        .setDescription(embedDescription)
        .setColor(0x0099FF)
        .setTimestamp();

      // Send via DM to the user
      try {
        await member.send({ embeds: [embed] });
        console.log(`Sent previous entries embed to user ${member.displayName || member.user.username} via DM`);
      } catch (dmError) {
        console.error('Could not send DM to user:', dmError);
        // Fallback: try to send to a channel if DM fails
        const channel = member.guild.channels.cache.find(ch =>
          ch.isTextBased() && ch.permissionsFor(member).has('SendMessages')
        ) as TextChannel;

        if (channel) {
          await channel.send(`**${member.displayName || member.user.username}**\nCould not send DM. Check your previous entries using the buttons.`);
        }
      }

    } catch (error) {
      console.error('Error showing previous entries:', error);
    }
  }

  static async createRoleSelectionMessage(channelId: string): Promise<void> {
    try {
      const client = (await import('../index')).client;
      const channel = client.channels.cache.get(channelId) as TextChannel;

      if (!channel || !channel.isTextBased()) {
        console.error('Channel not found or not text-based:', channelId);
        return;
      }

      // Check if role selection message already exists and delete it
      try {
        const messages = await channel.messages.fetch({ limit: 20 });
        const existingMessage = messages.find(msg => {
          return msg.embeds.length > 0 && msg.embeds[0].title === '🎯';
        });

        if (existingMessage) {
          console.log('Found existing role selection message, deleting it');
          await existingMessage.delete();
          console.log('Old role selection message deleted successfully');
        }
      } catch (error) {
        console.error('Error checking/deleting existing role selection message:', error);
        // Continue with creation if we can't check for existing message
      }

      const allGoals = getAllGoalDefinitions();

      let description = 'React with the emoji to add the goal to your entries.\n\n';

      for (const goal of allGoals) {
        description += `${goal.emoji} **${goal.name}** - ${goal.description}\n`;
      }

      const embed = new EmbedBuilder()
        .setTitle('🎯')
        .setDescription(description)
        .setColor(0x0099FF)
      ;

      const message = await channel.send({ embeds: [embed] });

      for (const goal of allGoals) {
        try {
          await message.react(goal.emoji);
        } catch (error) {
          console.error(`Error adding reaction ${goal.emoji} for ${goal.name}:`, error);
        }
      }

      console.log('Role selection message created with reactions');
    } catch (error) {
      console.error('Error creating role selection message:', error);
    }
  }

  static async handleMessageReactionAdd(messageReaction: any, user: any): Promise<void> {
    try {
      // Ignore bot reactions
      if (user.bot) return;

      const message = messageReaction.message;
      const emoji = messageReaction.emoji.name;

      // Check if this is our role selection message
      if (message.embeds.length === 0 || !message.embeds[0].title?.includes('🎯')) {
        return;
      }

      // Find the goal that matches this emoji
      const allGoals = getAllGoalDefinitions();
      const goalDef = allGoals.find(goal => goal.emoji === emoji);

      if (!goalDef) {
        console.error(`No goal found for emoji: ${emoji}`);
        return;
      }

      // Get the member who reacted
      const guild = message.guild;
      if (!guild) return;

      const member = await guild.members.fetch(user.id);
      if (!member) return;

      // Check if user already has this role (flexible matching)
      const currentRoles = member.roles.cache.map((role: any) => role.name.toLowerCase());
      const hasRole = currentRoles.some((roleName: string) =>
        roleName.includes(goalDef.role.toLowerCase()) ||
        goalDef.role.toLowerCase().includes(roleName)
      );

      if (hasRole) {
        // User already has the role, remove it
        try {
          const role = guild.roles.cache.find((r: any) =>
            r.name.toLowerCase().includes(goalDef.role.toLowerCase()) ||
            goalDef.role.toLowerCase().includes(r.name.toLowerCase())
          );
          if (role) {
            await member.roles.remove(role);
            // Send ephemeral message to user
            try {
              await user.send(`❌ Removed **${goalDef.name}** goal from your roles.`);
            } catch (error) {
              console.error('Could not send DM to user:', error);
            }
          } else {
            console.error(`Could not find role for goal: ${goalDef.name} (searched for: ${goalDef.role})`);
            console.log('Available roles:', guild.roles.cache.map((r: any) => r.name).join(', '));
          }
        } catch (error) {
          console.error(`Error removing role for ${goalDef.name}:`, error);
        }
      } else {
        // User doesn't have the role, add it
        try {
          const role = guild.roles.cache.find((r: any) =>
            r.name.toLowerCase().includes(goalDef.role.toLowerCase()) ||
            goalDef.role.toLowerCase().includes(r.name.toLowerCase())
          );
          if (role) {
            await member.roles.add(role);
            // Send ephemeral message to user
            try {
              await user.send(`Added **${goalDef.name}** goal to your roles.`);
            } catch (error) {
              console.error('Could not send DM to user:', error);
            }
          } else {
            console.error(`Could not find role for goal: ${goalDef.name} (searched for: ${goalDef.role})`);
            console.log('Available roles:', guild.roles.cache.map((r: any) => r.name).join(', '));
          }
        } catch (error) {
          console.error(`Error adding role for ${goalDef.name}:`, error);
        }
      }

      // Remove the reaction after processing
      try {
        await messageReaction.users.remove(user.id);
      } catch (error) {
        console.error('Error removing reaction:', error);
      }

    } catch (error) {
      console.error('Error handling message reaction:', error);
    }
  }

  static cleanupExpiredSessions(): void {
    const expiredSessions: string[] = [];

    for (const [userId, session] of activeSessions.entries()) {
      // Consider sessions expired after 2 hours of inactivity
      // In a real implementation, you'd track last activity time
      if (Math.random() < 0.01) { // Simple cleanup for demo
        expiredSessions.push(userId);
      }
    }

    for (const userId of expiredSessions) {
      activeSessions.delete(userId);
    }
  }

  // Accountability system variables
  private static statusMessageId: string | null = null;
  private static readonly STATUS_CHANNEL_ID = '1424172599197565109';

  static async checkUserCompletionStatus(member: GuildMember): Promise<boolean> {
    try {
      const archiveChannelId = '1424342473198796961';
      const archiveChannel = member.guild.channels.cache.get(archiveChannelId) as TextChannel;
      const dayNumber = this.getCurrentDayNumber();
      const displayName = member.displayName || member.user.username;

      if (!archiveChannel) {
        console.error('Archive channel not found for completion check');
        return false;
      }

      // Look for an archived thread for this user and current day
      // Pattern: archive-{displayName}-entry-day-{dayNumber}
      const userThreads = archiveChannel.threads.cache.filter(thread => {
        return thread.name === `archive-${displayName}-entry-day-${dayNumber}`;
      });

      if (userThreads.size === 0) {
        return false; // No archived thread found for today
      }

      // If thread exists with archive- prefix, user has completed their entry
      return true;

    } catch (error) {
      console.error('Error checking user completion status:', error);
      return false;
    }
  }

  static async updateAccountabilityStatus(guild: Guild): Promise<void> {
    try {
      const channel = await guild.channels.fetch(this.STATUS_CHANNEL_ID) as TextChannel;

      if (!channel || !channel.isTextBased()) {
        console.error('Status channel not found or not text-based:', this.STATUS_CHANNEL_ID);
        return;
      }

      // Get all members who have challenge roles
      const allMembers = await guild.members.fetch();
      const challengeMembers = allMembers.filter(member => {
        if (member.user.bot) return false;
        const memberRoles = member.roles.cache.map(role => role.name.toLowerCase());
        const userGoals = getUserGoals(memberRoles);
        return userGoals.length > 0; // Has challenge goals
      });

      // Check completion status for each member
      const memberStatuses: Array<{ member: GuildMember; completed: boolean }> = [];

      for (const member of challengeMembers.values()) {
        const completed = await this.checkUserCompletionStatus(member);
        memberStatuses.push({ member, completed });
      }

      // Create status embed
      const embed = new EmbedBuilder()
        .setTitle(`Statuses - Day ${this.getCurrentDayNumber()}`)
        .setDescription('View all participants below and their statuses.')
        .setColor(0x0099FF)
        .setTimestamp();

      // Add fields for each member
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

      // Update or send message
      if (this.statusMessageId) {
        try {
          const message = await channel.messages.fetch(this.statusMessageId);
          await message.edit({ embeds: [embed] });
          console.log('Updated accountability status embed');
        } catch (error) {
          console.error('Error updating status message, will create new one:', error);
          this.statusMessageId = null;
        }
      }

      if (!this.statusMessageId) {
        const message = await channel.send({ embeds: [embed] });
        this.statusMessageId = message.id;
        console.log('Created new accountability status embed');
      }

    } catch (error) {
      console.error('Error updating accountability status:', error);
    }
  }

  static async resetDailyStatus(): Promise<void> {
    console.log('Resetting daily accountability status for new day');
    this.statusMessageId = null;

    try {
      // Update status for the new day
      const client = (await import('../index')).client;
      await this.updateAccountabilityStatus(client.guilds.cache.first()!);
    } catch (error) {
      console.error('Error resetting daily status:', error);
    }
  }
}
