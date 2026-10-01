import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { isAdmin } from '../utils/permissions.js';

export const data = new SlashCommandBuilder()
  .setName('reaction')
  .setDescription('Add reactions to a message in this channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option
      .setName('messageid')
      .setDescription('ID of the message to react to')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('emojis')
      .setDescription('Emojis to add (space-separated), e.g. "👍 ❤️ <:name:123> <a:name:456>"')
      .setRequired(true)
  );

export async function execute(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({
      content: 'You do not have permission to use this command. Administrator permission is required.',
      ephemeral: true,
    });
  }

  if (interaction.channel.type !== ChannelType.GuildText) {
    return interaction.reply({
      content: 'This command can only be used in a text channel.',
      ephemeral: true,
    });
  }

  const messageId = interaction.options.getString('messageid');
  const emojisInput = interaction.options.getString('emojis');

  await interaction.deferReply({ ephemeral: true });

  let message;
  try {
    message = await interaction.channel.messages.fetch(messageId);
  } catch {
    return interaction.editReply({
      content: `Could not find a message with ID \`${messageId}\` in this channel. Please provide a valid message ID.`,
    });
  }

  const emojiTokens = emojisInput.trim().split(/\s+/).filter(Boolean);

  if (emojiTokens.length === 0) {
    return interaction.editReply({
      content: 'No emojis were provided. Please specify at least one emoji.',
    });
  }

  const succeeded = [];
  const failed = [];

  for (const token of emojiTokens) {
    try {
      await message.react(token);
      succeeded.push(token);
    } catch (error) {
      failed.push({ emoji: token, reason: error.message });
    }
  }

  let response = '';

  if (succeeded.length > 0) {
    response += `Successfully added **${succeeded.length}** reaction${succeeded.length === 1 ? '' : 's'}: ${succeeded.join(' ')}\n`;
  }

  if (failed.length > 0) {
    response += `\nFailed to add **${failed.length}** reaction${failed.length === 1 ? '' : 's'}:\n`;
    for (const f of failed) {
      response += `- ${f.emoji}: ${f.reason}\n`;
    }
  }

  if (succeeded.length === 0 && failed.length > 0) {
    response = `No reactions were added. All **${failed.length}** emoji${failed.length === 1 ? '' : 's'} failed:\n` +
      failed.map((f) => `- ${f.emoji}: ${f.reason}`).join('\n');
  }

  return interaction.editReply({ content: response.trim() });
}
