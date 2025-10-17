// buttons/role-buttons
import {
  ActionRowBuilder,
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";
import { RoleService } from "../services/role-service";
import { handleError } from "../middleware/error-handler";
import { logInfo } from "../middleware/logging";

export class RoleButtons {
  static async handleCreateGoal(interaction: ButtonInteraction): Promise<void> {
    try {
      const modal = new ModalBuilder()
        .setCustomId(`create_goal_modal_${interaction.user.id}`)
        .setTitle("Creation");

      const shorthandInput = new TextInputBuilder()
        .setCustomId("shorthand")
        .setLabel("Shorthand (role display name, like 'gym')")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const descriptionInput = new TextInputBuilder()
        .setCustomId("description")
        .setLabel("Description (must start with 'Submission of')")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Submission of a picture of the gym, alongside my workout routine for the day.")
        .setRequired(true);

      const inputTypeInput = new TextInputBuilder()
        .setCustomId("inputType")
        .setLabel("Input Type (text/image/both)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("both")
        .setRequired(true);

      const colorInput = new TextInputBuilder()
        .setCustomId("color")
        .setLabel("Color (hexadecimal, e.g., 0x251111)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("0x251111")
        .setRequired(true);

      const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(shorthandInput);
      const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);
      const thirdRow = new ActionRowBuilder<TextInputBuilder>().addComponents(inputTypeInput);
      const fourthRow = new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput);

      modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);

      await interaction.showModal(modal);

      logInfo(`User ${interaction.user.tag} opened goal creation modal`, interaction.user.id);
    } catch (error) {
      handleError(error, "handleCreateGoal");
      try {
        await interaction.reply({
          content: "I couldn't open the goal creation form. Please try again.",
          ephemeral: true
        });
      } catch (replyError) {
        handleError(replyError, "replying to goal creation error");
      }
    }
  }

  static async handleGoalCreationModal(interaction: any): Promise<void> {
    try {
      await interaction.deferReply({ flags: ['Ephemeral'] });

      const loadingMsg = await interaction.editReply("(1) Creating...");

      const loadingInterval = setInterval(async () => {
        try {
          const currentContent = loadingMsg || "";
          const match = currentContent.match(/\((\d+)\)/);
          if (match) {
            const currentNum = parseInt(match[1]);
            const newContent = `(${currentNum + 1}) Creating...`;
            await interaction.editReply(newContent);
          }
        } catch (e) {
          // Ignore editing errors
        }
      }, 3000);

      const shorthand = interaction.fields.getTextInputValue("shorthand");
      const description = interaction.fields.getTextInputValue("description");
      const inputType = interaction.fields.getTextInputValue("inputType").toLowerCase();
      const colorStr = interaction.fields.getTextInputValue("color");

      const goalData = {
        shorthand,
        description,
        inputType,
        color: colorStr
      };

      const validationResult = RoleService.validateGoalData(goalData);

      if (!validationResult.error) {
        const guild = interaction.guild;

        if (guild) {
          const color = parseInt(colorStr, 16);
          const roleResult = await RoleService.createCustomRole(guild, { ...goalData, color });
          clearInterval(loadingInterval);

          if (roleResult.success) {
            const member = await guild.members.fetch(interaction.user.id);

            if (member && roleResult.roleId) {
              const role = guild.roles.cache.get(roleResult.roleId);

              if (role) {
                await member.roles.add(role);
                await interaction.editReply("Your role has been made and assigned to you.");
              } else {
                await interaction.editReply("Your role has been made, but I couldn't assign it automatically.");
              }
            } else {
              await interaction.editReply("Your role has been made.");
            }
          } else {
            await interaction.editReply(`I couldn't make your role.\n${roleResult.error?.message || 'Unknown error'}`);
          }
        } else {
          clearInterval(loadingInterval);
          await interaction.editReply("I couldn't find the server to create the role.");
        }
      } else {
        clearInterval(loadingInterval);
        await interaction.editReply("Incorrect format, check against the example.");
      }
    } catch (error) {
      handleError(error, "handling goal creation modal submit");
      await interaction.editReply({
        content: "I couldn't process your request. Please check your format and try again."
      });
    }
  }
}
