import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
} from 'discord.js';
import { isAdmin } from '../utils/permissions.js';
import { getTicketButtons } from '../utils/ticket-db.js';

export const data = new SlashCommandBuilder()
  .setName('deletebutton')
  .setDescription('Delete a ticket option from the ticket panel')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({
      content: 'You do not have permission to use this command. Administrator permission is required.',
      ephemeral: true,
    });
  }

  const guildId = interaction.guild.id;
  const buttons = await getTicketButtons(guildId);

  if (buttons.length === 0) {
    return interaction.reply({
      content: 'There are no ticket options configured. Use `/add button` to add one.',
      ephemeral: true,
    });
  }

  const options = buttons.map((btn) => ({
    label: `${btn.emoji} ${btn.name}`.slice(0, 100),
    value: btn.id,
    description: btn.type.slice(0, 100),
  }));

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ticket_delete_button_select')
      .setPlaceholder('Select a ticket option to delete...')
      .addOptions(options)
  );

  const embed = new EmbedBuilder()
    .setTitle('🎫 Delete Ticket Option')
    .setDescription('Select the ticket option you want to remove from the dropdown below.')
    .setColor(0x2f3136);

  return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}
