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
  ButtonBuilder,
  ButtonStyle,
  Guild,
} from 'discord.js';
import { getUserGoals, getAllGoalDefinitions, getUserWeeklyGoals, getAllWeeklyGoalDefinitions, getCurrentWeekNumber, isLastDayOfWeek } from './goals';
import { GoalDefinition } from '../types';
import { EntrySession, GoalSubmission } from '../types';

const activeSessions = new Map<string, EntrySession>();

export class EntryService {
  static getCurrentDayNumber(): number {
    // Set start date to October 6th, 2025 at midnight PDT
    const startDate = new Date('2025-10-06T00:00:00-07:00'); // PDT is UTC-7
    
    // Get current date in PDT
    const now = new Date();
    const pdtNow = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
    
    // Calculate difference in days
    const diffTime = pdtNow.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 because Oct 6th is day 1
    
    console.log(`Date calculation: Start=${startDate.toISOString()}, Now=${pdtNow.toISOString()}, DiffDays=${diffDays}`);
    
    return Math.max(1, diffDays); // Ensure minimum day 1
  }

  static async startEntry(member: GuildMember): Promise<void> {
    try {
      const discordId = member.id;
      const displayName = member.displayName || member.user.username;

      // Get user's goals from their roles
      const memberRoles = member.roles.cache.map(role => role.name.toLowerCase());
      const userGoals = getUserGoals(memberRoles);
      const userWeeklyGoals = getUserWeeklyGoals(memberRoles);

      if (userGoals.length === 0 && userWeeklyGoals.length === 0) {
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
        weeklyGoals: userWeeklyGoals.map(g => g.role),
        submissions: new Map(),
        weeklySubmissions: new Map(),
        goalMessages: new Map(),
        weeklyGoalMessages: new Map(),
      };

      activeSessions.set(discordId, session);

      // Send initial embed with placeholders
      try {
        await this.sendInitialEntryEmbed(thread, displayName, dayNumber, userGoals, userWeeklyGoals);
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

      // Send weekly goal embeds if it's the last day of the week or if weekly goals aren't completed
      const shouldShowWeeklyGoals = isLastDayOfWeek(dayNumber) || this.hasIncompleteWeeklyGoals(session);
      if (shouldShowWeeklyGoals && userWeeklyGoals.length > 0) {
        for (const weeklyGoalDef of userWeeklyGoals) {
          try {
            const message = await this.sendWeeklyGoalEmbed(thread, weeklyGoalDef, dayNumber);
            session.weeklyGoalMessages.set(weeklyGoalDef.role, message.id);
          } catch (error) {
            console.error(`Error sending weekly goal embed for ${weeklyGoalDef.name}:`, error);
          }
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

  private static async sendInitialEntryEmbed(thread: ThreadChannel, displayName: string, dayNumber: number, userGoals: GoalDefinition[], userWeeklyGoals: GoalDefinition[]): Promise<void> {
    try {
      let description = `\n\n(￣✓￣) ☑ . . . . your goals\n`;
      
      if (userGoals.length > 0) {
        description += `${userGoals.map(goal => `${goal.emoji} ${goal.name}`).join('\n')}\n`;
      }
      
      if (userWeeklyGoals.length > 0) {
        const shouldShowWeeklyGoals = isLastDayOfWeek(dayNumber);
        if (shouldShowWeeklyGoals) {
          description += `\n📅 **Weekly Goals** (must complete today):\n`;
          description += `${userWeeklyGoals.map(goal => `${goal.emoji} ${goal.name}`).join('\n')}\n`;
        }
      }
      
      description += `\n**Instructions**\n`;
      description += `* Reply to each goal below with your submission - each goal has its own instructions\n`;
      description += `* You can reply to any goal at any time\n`;
      description += `* You can submit multiple times for the same goal, but one submission will count\n`;
      
      if (userWeeklyGoals.length > 0 && isLastDayOfWeek(dayNumber)) {
        description += `* **Weekly goals must be completed by the end of the week (today)**\n`;
      }

      const embed = new EmbedBuilder()
        .setTitle(`Day ${dayNumber}`)
        .setDescription(description)
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
      
      // Special handling for DJ goal
      if (goalDef.role === 'dj') {
        requirements.push('📎 File (any type)');
      }

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
      let isWeeklyGoal = false;
      
      if (message.reference?.messageId) {
        // User replied to a specific message, find which goal it is
        for (const [goalName, messageId] of session.goalMessages.entries()) {
          if (messageId === message.reference.messageId) {
            currentGoalName = goalName;
            isWeeklyGoal = false;
            break;
          }
        }
        
        // Check weekly goals if not found in regular goals
        if (!currentGoalName) {
          for (const [goalName, messageId] of session.weeklyGoalMessages.entries()) {
            if (messageId === message.reference.messageId) {
              currentGoalName = goalName;
              isWeeklyGoal = true;
              break;
            }
          }
        }
      }

      // If no reply reference, try to match by content or use first pending goal
      if (!currentGoalName) {
        if (pendingGoals.length > 0) {
          currentGoalName = pendingGoals[0];
          isWeeklyGoal = false;
        } else {
          // Check for pending weekly goals
          const pendingWeeklyGoals = session.weeklyGoals.filter(goalName => {
            return !session.weeklySubmissions.has(goalName);
          });
          if (pendingWeeklyGoals.length > 0) {
            currentGoalName = pendingWeeklyGoals[0];
            isWeeklyGoal = true;
          }
        }
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
      const submissionsMap = isWeeklyGoal ? session.weeklySubmissions : session.submissions;
      if (submissionsMap.has(currentGoalName)) {
        try {
          await channel.send('(・_・) You already submitted this goal. First submission counts!');
        } catch (error) {
          console.error('Error sending duplicate message:', error);
        }
        return;
      }

      const goalDef = isWeeklyGoal 
        ? getUserWeeklyGoals([currentGoalName])[0]
        : getUserGoals([currentGoalName])[0];

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

      // Special handling for DJ goal - accept any file type
      if (goalDef.role === 'dj') {
        if (message.attachments.size > 0) {
          isValid = true;
          mediaUrl = message.attachments.first()?.url;
          submissionContent = content; // Include any text description if provided
        } else if (content) {
          isValid = true;
          submissionContent = content;
        }
      } else {
        // Regular validation for other goals
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
      }

      if (!isValid) {
        const requirements = [];
        if (goalDef.requiresText) requirements.push('text');
        if (goalDef.requiresImage) requirements.push('image');
        
        // Special handling for DJ goal
        if (goalDef.role === 'dj') {
          requirements.push('file');
        }

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

      if (isWeeklyGoal) {
        session.weeklySubmissions.set(goalDef.role, goalSubmission);
      } else {
        session.submissions.set(goalDef.role, goalSubmission);
      }

      // Send confirmation
      try {
        await channel.send(`✅ **${goalDef.name}** submitted successfully!`);
      } catch (error) {
        console.error('Error sending confirmation:', error);
      }

      // Check if all goals are complete
      const completedGoals = session.submissions.size;
      const totalGoals = session.goals.length;
      const completedWeeklyGoals = session.weeklySubmissions.size;
      const totalWeeklyGoals = session.weeklyGoals.length;
      
      // Check if it's the last day of the week and weekly goals are required
      const isLastDay = isLastDayOfWeek(session.dayNumber);
      const weeklyGoalsRequired = isLastDay && totalWeeklyGoals > 0;
      const weeklyGoalsComplete = completedWeeklyGoals >= totalWeeklyGoals;

      const allGoalsComplete = completedGoals >= totalGoals && (!weeklyGoalsRequired || weeklyGoalsComplete);

      if (allGoalsComplete) {
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

        let message = `📋 **${totalGoals - completedGoals} goal${totalGoals - completedGoals > 1 ? 's' : ''} remaining:** ${missingGoalNames.join(', ')}`;
        
        if (weeklyGoalsRequired && !weeklyGoalsComplete) {
          const missingWeeklyGoals = session.weeklyGoals.filter(goalName => !session.weeklySubmissions.has(goalName));
          const missingWeeklyGoalNames = missingWeeklyGoals.map(goalName => {
            const goalDef = getUserWeeklyGoals([goalName])[0];
            return goalDef ? goalDef.name : goalName;
          });
          message += `\n📅 **${totalWeeklyGoals - completedWeeklyGoals} weekly goal${totalWeeklyGoals - completedWeeklyGoals > 1 ? 's' : ''} remaining:** ${missingWeeklyGoalNames.join(', ')}`;
        }

        try {
          await channel.send(message);
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
          console.log(`Renamed thread to: ${newName}`);

          // Create share button
          const shareButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`share_thread_${thread.id}`)
              .setLabel("📤 Share Thread")
              .setStyle(ButtonStyle.Primary)
          );

          await thread.send({ 
            content: `**You complete your entry for ${displayName}!**\n\nThread is now archived. Click the button below to share your entry.`,
            components: [shareButton]
          });

          // Wait a moment before locking to allow button interaction
          setTimeout(async () => {
            try {
              // Lock the thread to prevent new messages (but keep it visible)
              await thread.setLocked(true);
              console.log(`Locked thread: ${newName}`);
            } catch (error) {
              console.error('Error locking thread:', error);
            }
          }, 5000); // Wait 5 seconds before locking

          // Refresh thread cache to ensure we have the latest data
          try {
            await thread.parent?.threads.fetch();
            console.log('Refreshed thread cache');
          } catch (error) {
            console.error('Error refreshing thread cache:', error);
          }

          // Update accountability status with retry mechanism
          await this.updateStatusWithRetry(thread.guild, displayName, 3);

          // Update history embed with retry mechanism
          await this.updateHistoryWithRetry(thread.guild, displayName, 3);
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
      const allWeeklyGoals = getAllWeeklyGoalDefinitions();

      let description = 'React with the emoji to add the goal to your entries.\n\n';

      if (allGoals.length > 0) {
        description += '**Daily Goals**\n';
        for (const goal of allGoals) {
          description += `${goal.emoji} **${goal.name}** - ${goal.description}\n`;
        }
        description += '\n';
      }

      if (allWeeklyGoals.length > 0) {
        description += '**Weekly Goals**\n';
        for (const goal of allWeeklyGoals) {
          description += `${goal.emoji} **${goal.name}** - ${goal.description}\n`;
        }
        description += '\n';
      }

      const embed = new EmbedBuilder()
        .setTitle('🎯')
        .setDescription(description)
        .setColor(0x0099FF)
      ;

      const message = await channel.send({ embeds: [embed] });

      // Add reactions for daily goals
      for (const goal of allGoals) {
        try {
          await message.react(goal.emoji);
        } catch (error) {
          console.error(`Error adding reaction ${goal.emoji} for ${goal.name}:`, error);
        }
      }

      // Add reactions for weekly goals
      for (const goal of allWeeklyGoals) {
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
      const allWeeklyGoals = getAllWeeklyGoalDefinitions();
      let goalDef = allGoals.find(goal => goal.emoji === emoji);
      
      // Check weekly goals if not found in daily goals
      if (!goalDef) {
        goalDef = allWeeklyGoals.find(goal => goal.emoji === emoji);
      }

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
  private static historyMessageId: string | null = null;
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

      // Refresh thread cache to ensure we have the latest data
      try {
        await archiveChannel.threads.fetch();
        console.log(`Refreshed thread cache for completion check of ${displayName}`);
      } catch (error) {
        console.error('Error refreshing thread cache for completion check:', error);
        // Continue with cached data if refresh fails
      }

      // Look for an archived thread for this user and current day
      // Pattern: archive-{displayName}-entry-day-{dayNumber}
      const expectedThreadName = `archive-${displayName}-entry-day-${dayNumber}`;
      console.log(`Looking for thread: ${expectedThreadName}`);
      
      const userThreads = archiveChannel.threads.cache.filter(thread => {
        const matches = thread.name === expectedThreadName;
        if (matches) {
          console.log(`Found matching thread: ${thread.name} (locked: ${thread.locked})`);
        }
        return matches;
      });

      console.log(`Thread search result for ${displayName}: ${userThreads.size} threads found`);

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
        .setTitle("Statuses")
        .setDescription('View all participants below and their statuses for today.')
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
      
      // Update history for the new day
      await this.updateHistoryEmbed(client.guilds.cache.first()!);
    } catch (error) {
      console.error('Error resetting daily status:', error);
    }
  }

  static async ensureRolesExist(guild: Guild): Promise<void> {
    try {
      console.log('Checking and creating missing challenge roles...');

      // Get all goal definitions
      const allGoals = getAllGoalDefinitions();
      const allWeeklyGoals = getAllWeeklyGoalDefinitions();

      for (const goalDef of allGoals) {
        const roleName = goalDef.role;
        const emoji = goalDef.emoji;

        try {
          // Check if role already exists
          let role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());

          if (!role) {
            // Create the role if it doesn't exist
            console.log(`Creating role: ${roleName} with emoji: ${emoji}`);

            role = await guild.roles.create({
              name: roleName,
              color: this.getGoalColor(roleName),
              reason: `Auto-created role for ${goalDef.name} challenge goal`,
              mentionable: true,
            });

            console.log(`✅ Created role: ${roleName}`);
          } else {
            console.log(`✅ Role already exists: ${roleName}`);
          }

          // Ensure the role has the correct color
          if (role.color !== this.getGoalColor(roleName)) {
            await role.edit({
              color: this.getGoalColor(roleName),
              reason: 'Updating role color to match goal definition'
            });
            console.log(`🎨 Updated color for role: ${roleName}`);
          }

        } catch (error) {
          console.error(`❌ Error handling role ${roleName}:`, error);
        }
      }

      // Create weekly goal roles
      for (const goalDef of allWeeklyGoals) {
        const roleName = goalDef.role;
        const emoji = goalDef.emoji;

        try {
          // Check if role already exists
          let role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());

          if (!role) {
            // Create the role if it doesn't exist
            console.log(`Creating weekly role: ${roleName} with emoji: ${emoji}`);

            role = await guild.roles.create({
              name: roleName,
              color: this.getGoalColor(roleName),
              reason: `Auto-created role for ${goalDef.name} weekly challenge goal`,
              mentionable: true,
            });

            console.log(`✅ Created weekly role: ${roleName}`);
          } else {
            console.log(`✅ Weekly role already exists: ${roleName}`);
          }

          // Ensure the role has the correct color
          if (role.color !== this.getGoalColor(roleName)) {
            await role.edit({
              color: this.getGoalColor(roleName),
              reason: 'Updating weekly role color to match goal definition'
            });
            console.log(`🎨 Updated color for weekly role: ${roleName}`);
          }

        } catch (error) {
          console.error(`❌ Error handling weekly role ${roleName}:`, error);
        }
      }

      console.log('✅ Role check and creation completed');

    } catch (error) {
      console.error('Error ensuring roles exist:', error);
    }
  }

  private static async sendWeeklyGoalEmbed(thread: ThreadChannel, goalDef: GoalDefinition, dayNumber: number): Promise<Message> {
    try {
      const embed = new EmbedBuilder()
        .setTitle(`📅 ${goalDef.emoji} ${goalDef.name} (Weekly)`)
        .setDescription(goalDef.description)
        .setColor(this.getGoalColor(goalDef.role))
        .addFields({
          name: 'Weekly Goal',
          value: `This is a weekly goal. ${isLastDayOfWeek(dayNumber) ? '**Must be completed today!**' : 'Complete anytime this week.'}`,
          inline: false,
        });

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
      console.error(`Error sending weekly goal embed for ${goalDef.name}:`, error);
      throw error;
    }
  }

  private static hasIncompleteWeeklyGoals(session: EntrySession): boolean {
    // Check if any weekly goals haven't been completed yet
    return session.weeklyGoals.some(goalName => !session.weeklySubmissions.has(goalName));
  }

  private static getGoalColor(roleName: string): number {
    const colors: Record<string, number> = {
      'leetcode': 0xFFA500, // Orange
      'water': 0x0099FF, // Blue
      'sleep': 0x9932CC, // Purple
      'cardio': 0x32CD32, // Green
      'food': 0xFF6347, // Tomato
      'job applications': 0xFFD700, // Gold
      'exercise': 0xDC143C, // Crimson
      'dj': 0xFF69B4, // Hot Pink
      'reading': 0x8B4513, // Saddle Brown
      'cafe': 0x8B4513, // Saddle Brown for cafe
      'late-eats': 0xFF4500, // Orange Red for late eating
      'portfolio': 0x4169E1, // Royal Blue for portfolio
      'ternship': 0x228B22, // Forest Green for internship
    };
    return colors[roleName] || 0x0099FF; // Default blue
  }

  static async updateHistoryEmbed(guild: Guild): Promise<void> {
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

      // Reconstruct history from archived threads
      const historyData = await this.reconstructHistoryFromThreads(guild, challengeMembers);

      // Create history embed
      const embed = new EmbedBuilder()
        .setTitle("History")
        .setDescription(this.formatHistoryData(historyData))
        .setColor(0x0099FF)
        .setTimestamp();

      // Update or send message
      if (this.historyMessageId) {
        try {
          const message = await channel.messages.fetch(this.historyMessageId);
          await message.edit({ embeds: [embed] });
          console.log('Updated history embed');
        } catch (error) {
          console.error('Error updating history message, will create new one:', error);
          this.historyMessageId = null;
        }
      }

      if (!this.historyMessageId) {
        const message = await channel.send({ embeds: [embed] });
        this.historyMessageId = message.id;
        console.log('Created new history embed');
      }

    } catch (error) {
      console.error('Error updating history embed:', error);
    }
  }

  private static async reconstructHistoryFromThreads(guild: Guild, challengeMembers: any): Promise<Map<number, { completed: string[], incomplete: string[] }>> {
    const historyData = new Map<number, { completed: string[], incomplete: string[] }>();
    
    try {
      const archiveChannelId = '1424342473198796961';
      const archiveChannel = guild.channels.cache.get(archiveChannelId) as TextChannel;

      if (!archiveChannel) {
        console.error('Archive channel not found for history reconstruction');
        return historyData;
      }

      // Get current day number to determine how many days to check
      const currentDay = this.getCurrentDayNumber();

      // For each day from 1 to current day
      for (let day = 1; day <= currentDay; day++) {
        const completed: string[] = [];
        const incomplete: string[] = [];

        // Check each challenge member for completion on this day
        for (const member of challengeMembers.values()) {
          const displayName = member.displayName || member.user.username;
          
          // Look for archived thread for this user and day
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
      console.error('Error reconstructing history from threads:', error);
    }

    return historyData;
  }

  private static formatHistoryData(historyData: Map<number, { completed: string[], incomplete: string[] }>): string {
    let formattedHistory = '';

    // Sort days in ascending order
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

    // Wrap in code block
    return `\`\`\`\n${formattedHistory.trim()}\n\`\`\``;
  }

  private static async updateStatusWithRetry(guild: Guild, displayName: string, maxRetries: number): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempting status update (attempt ${attempt}/${maxRetries}) for ${displayName}`);
        
        // Verify the user's completion status before updating
        const member = await guild.members.fetch({ query: displayName, limit: 1 }).then(members => members.first());
        if (!member) {
          console.error(`Member not found for ${displayName}`);
          continue;
        }

        const isCompleted = await this.checkUserCompletionStatus(member);
        console.log(`Completion status for ${displayName}: ${isCompleted}`);

        if (isCompleted) {
          await this.updateAccountabilityStatus(guild);
          console.log(`✅ Status updated successfully for ${displayName} (attempt ${attempt})`);
          return;
        } else {
          console.log(`❌ User ${displayName} not showing as completed yet (attempt ${attempt})`);
          if (attempt < maxRetries) {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      } catch (error) {
        console.error(`Error updating status for ${displayName} (attempt ${attempt}):`, error);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    console.error(`Failed to update status for ${displayName} after ${maxRetries} attempts`);
  }

  private static async updateHistoryWithRetry(guild: Guild, displayName: string, maxRetries: number): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempting history update (attempt ${attempt}/${maxRetries}) for ${displayName}`);
        
        await this.updateHistoryEmbed(guild);
        console.log(`✅ History updated successfully for ${displayName} (attempt ${attempt})`);
        return;
      } catch (error) {
        console.error(`Error updating history for ${displayName} (attempt ${attempt}):`, error);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    console.error(`Failed to update history for ${displayName} after ${maxRetries} attempts`);
  }

  // Manual refresh method for debugging
  static async forceRefreshStatus(guild: Guild): Promise<void> {
    try {
      console.log('🔄 Force refreshing status and history...');
      
      // Refresh thread cache
      const archiveChannelId = '1424342473198796961';
      const archiveChannel = guild.channels.cache.get(archiveChannelId) as TextChannel;
      if (archiveChannel) {
        await archiveChannel.threads.fetch();
        console.log('✅ Thread cache refreshed');
      }
      
      // Update both status and history
      await this.updateAccountabilityStatus(guild);
      await this.updateHistoryEmbed(guild);
      
      console.log('✅ Force refresh completed');
    } catch (error) {
      console.error('❌ Error during force refresh:', error);
    }
  }

  // Reminder system for incomplete goals
  static async sendGoalReminders(guild: Guild, isLastCall: boolean = false): Promise<void> {
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
        const userWeeklyGoals = getUserWeeklyGoals(memberRoles);
        return userGoals.length > 0 || userWeeklyGoals.length > 0; // Has challenge goals
      });

      // Find members who haven't completed their goals
      const incompleteMembers: GuildMember[] = [];

      for (const member of challengeMembers.values()) {
        const isCompleted = await this.checkUserCompletionStatus(member);
        if (!isCompleted) {
          incompleteMembers.push(member);
        }
      }

      if (incompleteMembers.length === 0) {
        console.log('All members have completed their goals for today');
        return;
      }

      // Create individual pings
      const individualPings = incompleteMembers.map(member => `<@${member.id}>`).join(' ');

      // Send reminder message
      const message = isLastCall 
        ? `${individualPings} last call to finish entries!`
        : `${individualPings} hasn't finished their goal yet!`;

      await channel.send(message);
      console.log(`✅ Sent ${isLastCall ? 'last call' : 'reminder'} message to ${incompleteMembers.length} members`);

    } catch (error) {
      console.error('Error sending goal reminders:', error);
    }
  }

  // Schedule reminders for 11:00 PM and 11:30 PM PDT
  static scheduleGoalReminders(): void {
    console.log('📅 Scheduling goal completion reminders...');

    // Schedule 11:00 PM reminder
    this.scheduleReminder(23, 0, false); // 11:00 PM

    // Schedule 11:30 PM reminder
    this.scheduleReminder(23, 30, true); // 11:30 PM (last call)
  }

  static async shareThread(threadId: string, userId: string): Promise<void> {
    try {
      const client = (await import('../index')).client;
      const thread = client.channels.cache.get(threadId) as ThreadChannel;
      
      if (!thread) {
        console.error('Thread not found for sharing:', threadId);
        return;
      }

      // Get the user who completed the entry
      const guild = thread.guild;
      const member = await guild.members.fetch(userId);
      const displayName = member.displayName || member.user.username;

      // Extract day number from thread name
      const dayMatch = thread.name.match(/day-(\d+)/);
      const dayNumber = dayMatch ? parseInt(dayMatch[1]) : this.getCurrentDayNumber();

      // Collect all messages from the thread
      const messages = await thread.messages.fetch({ limit: 100 });
      const sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

      // Find the share channel
      const shareChannelId = '1425381486395260980';
      const shareChannel = client.channels.cache.get(shareChannelId) as TextChannel;
      
      if (!shareChannel) {
        console.error('Share channel not found:', shareChannelId);
        return;
      }

      // Create the main share embed
      const shareEmbed = new EmbedBuilder()
        .setTitle(`${displayName} chose to share their entry for day ${dayNumber}`)
        .setColor(0x0099FF)
        .setTimestamp()
        .addFields({
          name: 'Navigate to Thread',
          value: `[${dayNumber}](https://discord.com/channels/${guild.id}/${thread.id})`,
          inline: false
        });

      // Send the main share embed
      await shareChannel.send({ embeds: [shareEmbed] });

      // Send all embeds and content from the thread
      for (const message of sortedMessages.values()) {
        if (message.author.bot) continue; // Skip bot messages
        
        // If message has embeds, send them
        if (message.embeds.length > 0) {
          await shareChannel.send({ embeds: message.embeds });
        }
        
        // If message has content, send it
        if (message.content) {
          await shareChannel.send({ content: message.content });
        }
        
        // If message has attachments, send them
        if (message.attachments.size > 0) {
          const attachmentUrls = message.attachments.map(attachment => attachment.url);
          await shareChannel.send({ content: `**Attachments:**\n${attachmentUrls.join('\n')}` });
        }
      }

      console.log(`Successfully shared thread ${threadId} for user ${displayName}`);
    } catch (error) {
      console.error('Error sharing thread:', error);
    }
  }

  private static scheduleReminder(hour: number, minute: number, isLastCall: boolean): void {
    const now = new Date();
    const pdtNow = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
    
    // Create target time for today
    const targetTime = new Date(pdtNow);
    targetTime.setHours(hour, minute, 0, 0);

    // If the time has already passed today, schedule for tomorrow
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
        console.error(`Error sending ${isLastCall ? 'last call' : 'reminder'} reminder:`, error);
      }

      // Schedule next day's reminder
      this.scheduleReminder(hour, minute, isLastCall);
    }, timeUntilReminder);

    const reminderType = isLastCall ? 'last call' : 'reminder';
    console.log(`⏰ Scheduled ${reminderType} for ${targetTime.toLocaleString("en-US", {timeZone: "America/Los_Angeles"})}`);
  }
}
