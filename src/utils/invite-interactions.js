import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getInvitedMembersByInviter, getInviteSettings } from './invite-db.js';

const MEMBERS_PER_PAGE = 10;

export async function buildInvitedListEmbed(guildId, inviterId, page = 0) {
  const members = await getInvitedMembersByInviter(guildId, inviterId);
  const settings = await getInviteSettings(guildId);

  const sorted = members.sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0));
  const totalPages = Math.max(1, Math.ceil(sorted.length / MEMBERS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * MEMBERS_PER_PAGE;
  const pageMembers = sorted.slice(start, start + MEMBERS_PER_PAGE);

  const lines = [];
  for (const m of pageMembers) {
    const statusEmoji = getStatusEmoji(m.status);
    let line = `<@${m.userId}> — ${statusEmoji}`;

    if (m.status === 'active' && settings?.verifiedRoleId) {
      const isVerified = m.verified === true;
      if (isVerified) {
        line += ' • ✅ Verified';
      }
    }

    lines.push(line);
  }

  const embed = new EmbedBuilder()
    .setTitle('👥 Invited Members')
    .setColor(0x2f3136)
    .setFooter({ text: `Page ${safePage + 1} / ${totalPages} • ${sorted.length} total` });

  if (lines.length === 0) {
    embed.setDescription('No invited members found.');
  } else {
    embed.setDescription(lines.join('\n'));
  }

  return { embed, totalPages: totalPages, currentPage: safePage };
}

export function getStatusEmoji(status) {
  switch (status) {
    case 'active':
      return '🟢 Active';
    case 'left':
      return '🔴 Left';
    case 'rejoined':
      return '🔄 Rejoined';
    case 'fake':
      return '❌ Fake Invite';
    default:
      return '🟢 Active';
  }
}

export function buildInvitedListComponents(currentPage, totalPages) {
  const row = new ActionRowBuilder();

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`invite_list_prev_${currentPage}`)
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 0)
  );

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`invite_list_next_${currentPage}`)
      .setLabel('Next')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages - 1)
  );

  row.addComponents(
    new ButtonBuilder()
      .setCustomId('invite_list_close')
      .setLabel('Close')
      .setStyle(ButtonStyle.Danger)
  );

  return [row];
}

export async function handleInvitedListInteraction(interaction) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferUpdate().catch(() => {});
  }

  const customId = interaction.customId;

  if (customId === 'invite_list_close') {
    await interaction.editReply({ embeds: [], components: [], content: 'Invite list closed.' }).catch(() => {});
    return;
  }

  const match = customId.match(/^invite_list_(prev|next)_(\d+)$/);
  if (!match) return;

  const direction = match[1];
  const currentParsed = parseInt(match[2], 10);

  const inviterId = getStoredInviter(interaction.message.id);
  if (!inviterId) {
    await interaction.editReply({ content: 'Could not determine the inviter for this list.' }).catch(() => {});
    return;
  }

  const { embed, totalPages, currentPage } = await buildInvitedListEmbed(
    interaction.guild.id,
    inviterId,
    currentParsed
  );

  let newPage = currentPage;
  if (direction === 'prev') {
    newPage = Math.max(0, currentPage - 1);
  } else {
    newPage = Math.min(totalPages - 1, currentPage + 1);
  }

  const { embed: finalEmbed, totalPages: finalTotal } = await buildInvitedListEmbed(
    interaction.guild.id,
    inviterId,
    newPage
  );

  const components = buildInvitedListComponents(newPage, finalTotal);
  await interaction.editReply({ embeds: [finalEmbed], components }).catch(() => {});
}

const inviterStore = new Map();

export function storeInviter(messageId, inviterId) {
  inviterStore.set(messageId, inviterId);
}

export function getStoredInviter(messageId) {
  return inviterStore.get(messageId);
}

export function clearStoredInviter(messageId) {
  inviterStore.delete(messageId);
}
