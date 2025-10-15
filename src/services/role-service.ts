// services/role-service
import { Guild, GuildMember, TextChannel, EmbedBuilder } from 'discord.js';
import { CHANNEL_IDS } from '../constants/channels';
import { DEFAULT_COLOR, GOAL_COLORS } from '../constants/colors';
import { MESSAGES } from '../constants/messages';
import { GoalService } from './goal-service';
import { handleError } from '../middleware/error-handler';
import { logInfo, logError } from '../middleware/logging';

export class RoleService {
  static async createRoleSelectionMessage(channelId: string): Promise<void> {
    try {
      const client = (await import('../index')).client;
      const channel = client.channels.cache.get(channelId) as TextChannel;

      if (!channel || !channel.isTextBased()) {
        logError('Channel not found or not text-based', channelId);
        return;
      }

      try {
        const messages = await channel.messages.fetch({ limit: 20 });
        const existingMessage = messages.find(msg => {
          return msg.embeds.length > 0 && msg.embeds[0].title === '🎯';
        });

        if (existingMessage) {
          logInfo('Found existing role selection message, deleting it');
          await existingMessage.delete();
          logInfo('Old role selection message deleted successfully');
        }
      } catch (error) {
        handleError(error, 'checking/deleting existing role selection message');
      }

      const allGoals = GoalService.getAllGoalDefinitions();
      const allWeeklyGoals = GoalService.getAllWeeklyGoalDefinitions();

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
        .setColor(DEFAULT_COLOR);

      const message = await channel.send({ embeds: [embed] });

      for (const goal of allGoals) {
        try {
          await message.react(goal.emoji);
        } catch (error) {
          handleError(error, `adding reaction ${goal.emoji} for ${goal.name}`);
        }
      }

      for (const goal of allWeeklyGoals) {
        try {
          await message.react(goal.emoji);
        } catch (error) {
          handleError(error, `adding reaction ${goal.emoji} for ${goal.name}`);
        }
      }

      logInfo('Role selection message created with reactions');
    } catch (error) {
      handleError(error, 'createRoleSelectionMessage');
    }
  }

  static async handleMessageReactionAdd(messageReaction: any, user: any): Promise<void> {
    try {
      if (user.bot) return;

      const message = messageReaction.message;
      const emoji = messageReaction.emoji.name;

      if (message.embeds.length === 0 || !message.embeds[0].title?.includes('🎯')) {
        return;
      }

      const allGoals = GoalService.getAllGoalDefinitions();
      const allWeeklyGoals = GoalService.getAllWeeklyGoalDefinitions();
      let goalDef = allGoals.find(goal => goal.emoji === emoji);
      
      if (!goalDef) {
        goalDef = allWeeklyGoals.find(goal => goal.emoji === emoji);
      }

      if (!goalDef) {
        logError(`No goal found for emoji`, emoji);
        return;
      }

      const guild = message.guild;
      if (!guild) return;

      const member = await guild.members.fetch(user.id);
      if (!member) return;

      const currentRoles = member.roles.cache.map((role: any) => role.name.toLowerCase());
      const hasRole = currentRoles.some((roleName: string) =>
        roleName.includes(goalDef.role.toLowerCase()) ||
        goalDef.role.toLowerCase().includes(roleName)
      );

      if (hasRole) {
        try {
          const role = guild.roles.cache.find((r: any) =>
            r.name.toLowerCase().includes(goalDef.role.toLowerCase()) ||
            goalDef.role.toLowerCase().includes(r.name.toLowerCase())
          );
          if (role) {
            await member.roles.remove(role);
            try {
              await user.send(`${MESSAGES.REACTIONS.ROLE_REMOVED}`);
            } catch (error) {
              logError(MESSAGES.REACTIONS.DM_ERROR, error);
            }
          } else {
            logError(`Could not find role for goal: ${goalDef.name} (searched for: ${goalDef.role})`);
            logInfo('Available roles:', guild.roles.cache.map((r: any) => r.name).join(', '));
          }
        } catch (error) {
          handleError(error, `removing role for ${goalDef.name}`);
        }
      } else {
        try {
          const role = guild.roles.cache.find((r: any) =>
            r.name.toLowerCase().includes(goalDef.role.toLowerCase()) ||
            goalDef.role.toLowerCase().includes(r.name.toLowerCase())
          );
          if (role) {
            await member.roles.add(role);
            try {
              await user.send(`${MESSAGES.REACTIONS.ROLE_ADDED}`);
            } catch (error) {
              logError(MESSAGES.REACTIONS.DM_ERROR, error);
            }
          } else {
            logError(`Could not find role for goal: ${goalDef.name} (searched for: ${goalDef.role})`);
            logInfo('Available roles:', guild.roles.cache.map((r: any) => r.name).join(', '));
          }
        } catch (error) {
          handleError(error, `adding role for ${goalDef.name}`);
        }
      }

      try {
        await messageReaction.users.remove(user.id);
      } catch (error) {
        handleError(error, 'removing reaction');
      }

    } catch (error) {
      handleError(error, 'handleMessageReactionAdd');
    }
  }

  static async ensureRolesExist(guild: Guild): Promise<void> {
    try {
      logInfo('Checking and creating missing challenge roles...');

      const allGoals = GoalService.getAllGoalDefinitions();
      const allWeeklyGoals = GoalService.getAllWeeklyGoalDefinitions();

      for (const goalDef of allGoals) {
        await this.createOrUpdateRole(guild, goalDef);
      }

      for (const goalDef of allWeeklyGoals) {
        await this.createOrUpdateRole(guild, goalDef);
      }

      logInfo('✅ Role check and creation completed');

    } catch (error) {
      handleError(error, 'ensureRolesExist');
    }
  }

  private static async createOrUpdateRole(guild: Guild, goalDef: any): Promise<void> {
    const roleName = goalDef.role;
    const emoji = goalDef.emoji;

    try {
      let role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());

      if (!role) {
        logInfo(`Creating role: ${roleName} with emoji: ${emoji}`);

        role = await guild.roles.create({
          name: roleName,
          color: this.getGoalColor(roleName),
          reason: `Auto-created role for ${goalDef.name} challenge goal`,
          mentionable: true,
        });

        logInfo(`✅ Created role: ${roleName}`);
      } else {
        logInfo(`✅ Role already exists: ${roleName}`);
      }

      if (role.color !== this.getGoalColor(roleName)) {
        await role.edit({
          color: this.getGoalColor(roleName),
          reason: 'Updating role color to match goal definition'
        });
        logInfo(`🎨 Updated color for role: ${roleName}`);
      }

    } catch (error) {
      handleError(error, `handling role ${roleName}`);
    }
  }

  private static getGoalColor(roleName: string): number {
    return (GOAL_COLORS as any)[roleName] || DEFAULT_COLOR;
  }
}