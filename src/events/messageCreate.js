import { EmbedBuilder } from 'discord.js';
import { isAdmin } from '../utils/permissions.js';
import { getActiveTracker } from '../utils/tracker-db.js';
import { stopTracker } from '../services/tracker-service.js';
import {
  getTicketByChannel,
  getTicketSettings,
  updateTicket,
} from '../utils/ticket-db.js';
import { TICKET_TYPES } from '../utils/ticket-types.js';
import { isValidImageAttachment, unlockTicketForCreator } from '../services/ticket-service.js';

const STOP_COMMAND = 'q. track stop';

export const name = 'messageCreate';

export async function execute(message) {
  if (message.author.bot || !message.guild) return;

  // -----------------------------------------------------------------------
  // Ticket message handlers (run before the prefix command check)
  // -----------------------------------------------------------------------

  const ticket = await getTicketByChannel(message.guild.id, message.channel.id);

  if (ticket) {
    // -- Giveaway: detect image proof from ticket creator --
    if (
      ticket.ticketType === TICKET_TYPES.GIVEAWAY &&
      ticket.status === 'open' &&
      message.author.id === ticket.creatorId &&
      ticket.giveawayProofStatus !== 'verified'
    ) {
      const imageAttachment = message.attachments.find((att) => isValidImageAttachment(att));

      if (imageAttachment) {
        const success = await unlockTicketForCreator(
          message.guild,
          message.channel,
          ticket.creatorId,
          (await getTicketSettings(message.guild.id))?.ticketStaffRoleId
        );

        if (success) {
          await updateTicket(message.guild.id, message.channel.id, {
            giveawayProofStatus: 'verified',
            giveawayProofUrl: imageAttachment.url,
            updatedAt: Date.now(),
          });

          const embed = new EmbedBuilder()
            .setTitle('✅ Proof Verified')
            .setDescription('Thank you! Your proof has been received. You can now chat in this ticket.')
            .setColor(0x2f3136);

          await message.channel.send({ embeds: [embed] }).catch(() => {});
        }
      } else {
        await message.delete().catch(() => {});
        await message.channel.send({
          content: `<@${message.author.id}>, please send a valid image attachment as proof.`,
        }).catch(() => {});
      }
      return;
    }

    // -- Followers: staff sends "done" to request Roblox profile screenshot --
    if (
      ticket.ticketType === TICKET_TYPES.FOLLOWERS &&
      ticket.status === 'open' &&
      message.author.id !== ticket.creatorId
    ) {
      const settings = await getTicketSettings(message.guild.id);
      const staffRoleId = settings?.ticketStaffRoleId;
      const isStaff = staffRoleId && message.member.roles.cache.has(staffRoleId);
      const isStaffAdmin = isAdmin(message.member);

      if ((isStaff || isStaffAdmin) && message.content.trim().toLowerCase() === 'done') {
        // Only send the request if it hasn't been sent yet
        if (!ticket.robloxProfileRequested) {
          await updateTicket(message.guild.id, message.channel.id, {
            robloxProfileRequested: true,
            updatedAt: Date.now(),
          });

          const embed = new EmbedBuilder()
            .setTitle('Roblox Profile Required')
            .setDescription(
              'Please send a screenshot/photo of your Roblox profile so we can verify your account.'
            )
            .setColor(0x2f3136);

          await message.channel.send({
            content: `<@${ticket.creatorId}>`,
            embeds: [embed],
          }).catch(() => {});
        }
        return;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Prefix command: q. track stop
  // -----------------------------------------------------------------------

  const content = message.content.trim();
  if (!content.toLowerCase().startsWith(STOP_COMMAND)) return;

  if (!isAdmin(message.member)) {
    return message.reply({
      content: 'You do not have permission to use this command. Administrator permission is required.',
    });
  }

  const tracker = await getActiveTracker(message.guild.id);
  if (!tracker) {
    return message.reply({
      content: 'There is no active tracker to stop.',
    });
  }

  await stopTracker(message.guild.id);

  return message.reply({
    content: `Stopped tracking **${tracker.robloxName}** (target was ${tracker.milestone.toLocaleString()}).`,
  });
}
