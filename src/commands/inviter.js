import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getInvitedMember, getInviteSettings } from '../utils/invite-db.js';

export const data = new SlashCommandBuilder()
  .setName('inviter')
  .setDescription('Check who invited a member and their invite details')
  .addUserOption((option) =>
    option
      .setName('user')
      .setDescription('The member to check (mention or select)')
      .setRequired(false)
  )
  .addStringOption((option) =>
    option
      .setName('user_id')
      .setDescription('The member\'s user ID')
      .setRequired(false)
  )
  .addStringOption((option) =>
    option
      .setName('username')
      .setDescription('The member\'s username')
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guild.id;

  let targetUser = interaction.options.getUser('user');
  const userIdInput = interaction.options.getString('user_id');
  const usernameInput = interaction.options.getString('username');

  if (!targetUser && userIdInput) {
    targetUser = await interaction.client.users.fetch(userIdInput).catch(() => null);
  }

  if (!targetUser && usernameInput) {
    const member = await findMemberByUsername(interaction.guild, usernameInput);
    if (member) {
      targetUser = member.user;
    }
  }

  if (!targetUser) {
    return interaction.editReply({
      content: 'Could not find that user. Please provide a valid mention, user ID, or username.',
    });
  }

  const record = await getInvitedMember(guildId, targetUser.id);
  const settings = await getInviteSettings(guildId);

  const embed = new EmbedBuilder()
    .setTitle('🔗 Invite Information')
    .setColor(0x2f3136);

  if (!record) {
    embed.addFields(
      { name: 'Member', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: false },
      { name: 'Invited By', value: 'Unknown', inline: true },
      { name: 'Invite', value: 'Unknown', inline: true },
      { name: 'Status', value: 'Unknown', inline: true },
      { name: 'Verified', value: 'Unknown', inline: true },
      { name: 'Fake', value: 'Unknown', inline: true }
    );
    return interaction.editReply({ embeds: [embed] });
  }

  let targetMember = null;
  try {
    targetMember = await interaction.guild.members.fetch(targetUser.id);
  } catch {
    // member may have left
  }

  const isFake = record.status === 'fake';

  let statusText = 'Unknown';
  if (record.status === 'active') {
    statusText = '🟢 Active';
  } else if (record.status === 'left') {
    statusText = '🔴 Left';
  } else if (record.status === 'rejoined') {
    statusText = '🔄 Rejoined';
  } else if (isFake) {
    statusText = '❌ Fake Invite';
  }

  let verifiedText = '❌ No';
  if (settings?.verifiedRoleId && targetMember) {
    verifiedText = targetMember.roles.cache.has(settings.verifiedRoleId) ? '✅ Yes' : '❌ No';
  } else if (!settings?.verifiedRoleId) {
    verifiedText = 'Not configured';
  }

  embed.addFields(
    { name: 'Member', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: false },
    { name: 'Invited By', value: record.inviterId ? `<@${record.inviterId}>` : 'Unknown', inline: true },
    { name: 'Invite', value: record.code ? `\`${record.code}\`` : 'Unknown', inline: true },
    { name: 'Status', value: statusText, inline: true },
    { name: 'Verified', value: verifiedText, inline: true },
    { name: 'Fake', value: isFake ? '✅ Yes' : '❌ No', inline: true }
  );

  return interaction.editReply({ embeds: [embed] });
}

async function findMemberByUsername(guild, username) {
  const query = username.toLowerCase();
  const members = await guild.members.fetch({ limit: 100, force: false }).catch(() => null);
  if (!members) return null;

  return members.find((m) => {
    return (
      m.user.username.toLowerCase() === query ||
      m.user.tag.toLowerCase() === query ||
      m.displayName?.toLowerCase() === query ||
      m.nickname?.toLowerCase() === query
    );
  });
}
