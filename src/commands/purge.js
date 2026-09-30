import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { isAdmin } from '../utils/permissions.js';

export const data = new SlashCommandBuilder()
  .setName('purge')
  .setDescription('Delete a number of recent messages in this channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addIntegerOption((option) =>
    option
      .setName('amount')
      .setDescription('Number of messages to delete (1–100)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100)
  )
  .addStringOption((option) =>
    option
      .setName('message_id')
      .setDescription('ID of a message to exclude from deletion')
      .setRequired(false)
  );

export async function execute(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({
      content: 'You do not have permission to use this command. Administrator permission is required.',
      ephemeral: true,
    });
  }

  const amount = interaction.options.getInteger('amount');
  const excludeId = interaction.options.getString('message_id');

  if (interaction.channel.type !== ChannelType.GuildText) {
    return interaction.reply({
      content: 'This command can only be used in a text channel.',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const messages = await interaction.channel.messages.fetch({ limit: amount + 1 });

    let toDelete = messages;
    if (excludeId) {
      const excludedExists = messages.has(excludeId);
      if (!excludedExists) {
        try {
          const excludedMsg = await interaction.channel.messages.fetch(excludeId);
          if (excludedMsg) {
            toDelete = messages.filter((m) => m.id !== excludeId);
          }
        } catch {
          return interaction.editReply({
            content: `Could not find a message with ID \`${excludeId}\`. Please provide a valid message ID or omit the option.`,
          });
        }
      } else {
        toDelete = messages.filter((m) => m.id !== excludeId);
      }
    }

    const now = Date.now();
    const fourteenDays = 14 * 24 * 60 * 60 * 1000;
    const bulkDeletable = toDelete.filter((m) => now - m.createdTimestamp < fourteenDays);
    const tooOld = toDelete.filter((m) => now - m.createdTimestamp >= fourteenDays);

    let deletedCount = 0;
    let failedOldCount = 0;

    if (bulkDeletable.size > 0) {
      const deleted = await interaction.channel.bulkDelete(bulkDeletable, true);
      deletedCount = deleted.size;
    }

    failedOldCount = tooOld.size;

    let response = `Successfully deleted **${deletedCount}** message${deletedCount === 1 ? '' : 's'}.`;

    if (excludeId) {
      response += `\nThe message with ID \`${excludeId}\` was excluded from deletion.`;
    }

    if (failedOldCount > 0) {
      response += `\n**${failedOldCount}** message${failedOldCount === 1 ? '' : 's'} could not be deleted because ${failedOldCount === 1 ? 'it is' : 'they are'} older than 14 days (Discord bulk-delete limitation).`;
    }

    return interaction.editReply({ content: response });
  } catch (error) {
    console.error('Purge command error:', error);
    return interaction.editReply({
      content: 'An error occurred while trying to purge messages. Please try again.',
    });
  }
}
