// entrypoint
import { config } from "dotenv";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel
} from "discord.js";
import * as b from "./func/bot";
config();

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once("ready", async () => {
  console.log(`Logged in as ${client.user?.tag}!`);
  const mainChannel = process.env.MAIN_CHANNEL_ID!;
  await b.main(mainChannel);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "submit") {
    await interaction.reply({ content: "* Thread created!", ephemeral: true });

    const channel = interaction.channel;
    if (!channel || !channel.isTextBased()) {
      await interaction.reply({ content: "** Couldn't find the channel.", ephemeral: true });
    }

    const thread = await (channel as TextChannel).threads.create({
      name: `(${new Date().toLocaleDateString('en-US', { day: '2-digit', month: '2-digit' })}) - ${interaction.user.username}`,
      autoArchiveDuration: 60,
      type: 12,
      reason: "Your submission for today.",
      invitable: false,
    });

    await thread.members.add(interaction.user.id);

    const objectives = [
      {
        prompt: "> Outside workout (sports, running, cycling, ...): takes string/img",
        requireText: false,
        requireImage: false,
      },
      {
        prompt: "> Inside workout (gym, calisthenics, ...): takes string/img",
        requireText: false,
        requireImage: false,
      },
      {
        prompt: "> Diet adherence (did you meet your calorie goal today? (dev. ~200 allowed)): takes string/image",
        requireText: false,
        requireImage: false,
      },
      {
        prompt: "> Water intake tracking (1gal): takes image",
        requireText: false,
        requireImage: true,
      },
      {
        prompt: "> Progress picture (w/ current weight): takes image + string (req)",
        requireText: true,
        requireImage: true,
      },
    ];

    let today = 0;
    const responses: { text?: string; image?: string }[] = [];

    await thread.send("**NOTE**: Your photos, texts, will be displayed publicly after this thread is closed.");
    await thread.send(`${objectives[0].prompt}`);

    const collector = thread.createMessageCollector({
      filter: (m) => m.author.id === interaction.user.id,
      time: 1000 * 60 * 15,
    });

    collector.on("collect", async (msg) => {
      const obj = objectives[today];
      const containsText = !!msg.content && msg.content.trim().length > 0;
      const containsImage = msg.attachments.size > 0;

      if (
        (obj.requireText && !containsText) ||
        (obj.requireImage && !containsImage)
      ) {
        await thread.send(
          `!! Please provide${obj.requireText ? " text" : ""}${obj.requireText && obj.requireImage ? " and" : ""}${obj.requireImage ? " an image" : ""} for this goal.`
        );
        return;
      }

      responses.push({
        text: containsText ? msg.content : undefined,
        image: containsImage ? msg.attachments.first()?.url : undefined,
      });

      today++;
      if (today < objectives.length) {
        await thread.send(`${objectives[today].prompt}`);
      } else {
        collector.stop("done");
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason !== "done") {
        await thread.send("!! Submission timed out, or was cancelled.");
        await thread.setArchived(true);
        return;
      }

      const mainEmbed = new EmbedBuilder()
        .setTitle(`(${new Date().toLocaleDateString('en-US', { day: '2-digit', month: '2-digit' })}) - ${interaction.user.username}`)
        .setColor(0x00ff00)
        .setTimestamp();

      // Collect all images for separate embeds
      const imageEmbeds: EmbedBuilder[] = [];
      let imageIndex = 0;

      for (let i = 0; i < objectives.length; i++) {
        const response = responses[i];
        let fieldValue = "";

        if (response?.text) {
          fieldValue = response.text;
        }

        mainEmbed.addFields({
          name: `> ${objectives[i].prompt}`,
          value: fieldValue || "No response",
          inline: false
        });

        // If this objective has an image, create a separate embed for it
        if (response?.image) {
          const imageEmbed = new EmbedBuilder()
            .setTitle(`📸 ${objectives[i].prompt}`)
            .setColor(0x0099ff)
            .setImage(response.image)
            .setTimestamp();
          imageEmbeds.push(imageEmbed);
        }
      }

      try {
        const mainChannel = await client.channels.fetch(process.env.LOG_CHANNEL_ID!);
        if (mainChannel && mainChannel.isTextBased()) {
          // Send main embed with text content
          await (mainChannel as TextChannel).send({
            content: `(★‿★) **${interaction.user.username}** completed their day.`,
            embeds: [mainEmbed]
          });

          if (imageEmbeds.length > 0) {
            for (const imageEmbed of imageEmbeds) {
              await (mainChannel as TextChannel).send({ embeds: [imageEmbed] });
            }
          }
        }
      } catch (error) {
        console.error("Error posting to main channel:", error);
      }

      await thread.send("* Your submission is complete!");
      await thread.setArchived(true);
    });

  } else if (interaction.customId === "request") {
    await interaction.reply({ content: "* Starting cheat day request!", ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
