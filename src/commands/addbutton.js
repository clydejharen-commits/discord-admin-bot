import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { isAdmin } from '../utils/permissions.js';
import { addTicketButton, getTicketButtons, getTicketSettings } from '../utils/ticket-db.js';
import { VALID_TYPES, isValidType, generateButtonId } from '../utils/ticket-types.js';
import { updateTicketPanelMessage } from '../services/ticket-service.js';

export const data = new SlashCommandBuilder()
  .setName('addbutton')
  .setDescription('Add a ticket option to the ticket panel')
  .addStringOption((option) =>
    option
      .setName('emoji')
      .setDescription('Emoji for the ticket option (unicode, server, or animated Discord emoji)')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('name')
      .setDescription('Display name for the ticket option')
      .setRequired(true)
      .setMaxLength(100)
  )
  .addStringOption((option) =>
    option
      .setName('type')
      .setDescription('Ticket type')
      .setRequired(true)
      .addChoices(
        { name: '🎁 Giveaway', value: 'Giveaway' },
        { name: '🛠️ Support', value: 'Support' },
        { name: '👥 Invite Rewards', value: 'Invite Rewards' },
        { name: '👤 Followers', value: 'Followers' },
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({
      content: 'You do not have permission to use this command. Administrator permission is required.',
      ephemeral: true,
    });
  }

  const emoji = interaction.options.getString('emoji').trim();
  const name = interaction.options.getString('name').trim();
  const type = interaction.options.getString('type');

  if (!isValidType(type)) {
    return interaction.reply({
      content: `❌ Invalid ticket type. Valid types: ${VALID_TYPES.join(', ')}`,
      ephemeral: true,
    });
  }

  // Validate emoji: unicode, custom server emoji, or animated emoji
  // Custom emoji format: <a:name:id> or <:name:id>
  // Unicode emoji: any character that's an emoji
  const isCustomEmoji = /^<a?:[a-zA-Z0-9_]+:\d+>$/;
  const isUnicodeEmoji = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;

  if (!isCustomEmoji.test(emoji) && !isUnicodeEmoji.test(emoji)) {
    return interaction.reply({
      content: '❌ That does not appear to be a valid emoji. Use a unicode emoji, server emoji, or animated Discord emoji.',
      ephemeral: true,
    });
  }

  const guildId = interaction.guild.id;

  // Check for duplicate names
  const existingButtons = await getTicketButtons(guildId);
  if (existingButtons.some((b) => b.name.toLowerCase() === name.toLowerCase())) {
    return interaction.reply({
      content: `❌ A ticket option named "${name}" already exists. Use a different name.`,
      ephemeral: true,
    });
  }

  // Discord select menu max 25 options
  if (existingButtons.length >= 25) {
    return interaction.reply({
      content: '❌ You can have a maximum of 25 ticket options. Delete one before adding more.',
      ephemeral: true,
    });
  }

  const button = {
    id: generateButtonId(),
    emoji,
    name,
    type,
    createdAt: Date.now(),
  };

  await addTicketButton(guildId, button);

  // Update the panel message if one is configured
  const settings = await getTicketSettings(guildId);
  if (settings?.mainPanelMessageId) {
    await updateTicketPanelMessage(interaction.guild, settings.mainPanelMessageId);
  }

  return interaction.reply({
    content: `✅ Added ticket option **${emoji} ${name}** (Type: ${type}). The ticket panel has been updated if it was already sent.`,
    ephemeral: true,
  });
}
