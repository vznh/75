// func/bot
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel
} from "discord.js";
import { client } from "..";

export async function main(channelId: string) {
  const embed = new EmbedBuilder()
    .setTitle("(ง •̀‿•́)ง")
    .setDescription("Tracker for keeping us all in check.");

  const actions = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("submit")
      .setLabel("✧【📜】submit ✧ﾟ")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("request")
      .setLabel("(╯︵╰,) request cheat day【📜】")
      .setStyle(ButtonStyle.Secondary),
  );

  const channel = await client.channels.fetch(channelId);
  if (channel && channel.isTextBased()) {
    await (channel as TextChannel).send({
      embeds: [embed],
      components: [actions],
    });
  }
}
