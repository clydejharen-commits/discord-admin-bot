import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { isAdmin } from '../utils/permissions.js';
import { getTicketByChannel, getTicketSettings, updateTicket } from '../utils/ticket-db.js';
import { lockTicketForCreator, buildClosedTicketControls } from '../services/ticket-service.js';

export const data = new SlashCommandBuilder()
  .setName('close')
  .setDescription('Close the current ticket with an optional reason')
  .addStringOption((option) =>
    option
      .setName('reason')
      .setDescription('Reason for closing the ticket')
      .setRequired(false)
      .setMaxLength(1000)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function isTicketStaff(member, staffRoleId) {
  if (isAdmin(member)) return true;
  if (staffRoleId && member.roles.cache.has(staffRoleId)) return true;
  return false;
}

export async function execute(interaction) {
  const guildId = interaction.guild.id;
  const channelId = interaction.channel.id;

  const ticket = await getTicketByChannel(guildId, channelId);
  if (!ticket) {
    return interaction.reply({
      content: '❌ This command can only be used inside a ticket channel.',
      ephemeral: true,
    });
  }

  const settings = await getTicketSettings(guildId);
  const staffRoleId = settings?.ticketStaffRoleId;

  const staffMember = await isTicketStaff(interaction.member, staffRoleId);
  if (!staffMember) {
    return interaction.reply({
      content: 'Only Ticket Staff or Administrators can close tickets.',
      ephemeral: true,
    });
  }

  if (ticket.status === 'closed') {
    return interaction.reply({
      content: 'This ticket is already closed. Use Close & Delete to permanently delete it.',
      ephemeral: true,
    });
  }

  const reason = interaction.options.getString('reason')?.trim() || 'No reason provided';

  await interaction.deferReply();

  await updateTicket(guildId, channelId, {
    status: 'closed',
    closeReason: reason,
    closedAt: Date.now(),
    updatedAt: Date.now(),
  });

  await lockTicketForCreator(interaction.guild, interaction.channel, ticket.creatorId, staffRoleId);

  const closedEmbed = new EmbedBuilder()
    .setTitle('🔒 Ticket Closed')
    .setDescription(
      `This ticket has been closed by <@${interaction.user.id}>.\n` +
      `**Reason:** ${reason}\n` +
      'Staff can reopen it, or use Close & Delete to permanently delete it.'
    )
    .setColor(0x2f3136);

  await interaction.channel
    .send({ content: `<@${ticket.creatorId}>`, embeds: [closedEmbed], components: [buildClosedTicketControls()] })
    .catch(() => {});

  if (ticket.greetingMessageId) {
    const greetingMsg = await interaction.channel.messages
      .fetch(ticket.greetingMessageId)
      .catch(() => null);
    if (greetingMsg) {
      await greetingMsg.edit({ components: [buildClosedTicketControls()] }).catch(() => {});
    }
  }

  await interaction.editReply({ content: `✅ Ticket closed. Reason: ${reason}` });
}
