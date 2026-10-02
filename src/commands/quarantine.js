import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { isAdmin } from '../utils/permissions.js';
import {
  getQuarantineSettings,
  createQuarantineRecord,
  getActiveQuarantine,
} from '../utils/tracker-db.js';

export const data = new SlashCommandBuilder()
  .setName('quarantine')
  .setDescription('Quarantine a member by removing their roles and assigning the quarantine role')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((option) =>
    option
      .setName('user')
      .setDescription('The member to quarantine')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('reason')
      .setDescription('Reason for quarantining')
      .setRequired(true)
      .setMaxLength(1000)
  );

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  let settings;
  try {
    settings = await getQuarantineSettings();
  } catch (error) {
    console.error('Quarantine: failed to read settings:', error.message);
    return interaction.editReply({
      content: 'An error occurred while reading the quarantine configuration. Please try again.',
    });
  }

  if (!settings?.quarantineStaffRoleId) {
    return interaction.editReply({
      content: '❌ Quarantine Staff role is not configured. An administrator must set it up via `/setup` → 🛡️ Mod Settings.',
    });
  }

  const member = interaction.member;
  const hasStaffRole = member.roles.cache.has(settings.quarantineStaffRoleId);
  if (!hasStaffRole && !isAdmin(member)) {
    return interaction.editReply({
      content: 'You do not have permission to use this command. You need the Quarantine Staff role or Administrator permission.',
    });
  }

  if (!settings?.quarantineRoleId) {
    return interaction.editReply({
      content: '❌ Quarantine Role is not configured. An administrator must set it up via `/setup` → 🛡️ Mod Settings.',
    });
  }

  const targetUser = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason');

  let targetMember;
  try {
    targetMember = await interaction.guild.members.fetch(targetUser.id);
  } catch {
    return interaction.editReply({
      content: `Could not find \`${targetUser.tag}\` in this server. The user must be a member of this guild.`,
    });
  }

  if (targetUser.id === interaction.user.id) {
    return interaction.editReply({ content: 'You cannot quarantine yourself.' });
  }

  if (targetUser.id === interaction.client.user.id) {
    return interaction.editReply({ content: 'You cannot quarantine the bot.' });
  }

  const quarantineRole = interaction.guild.roles.cache.get(settings.quarantineRoleId);
  if (!quarantineRole) {
    return interaction.editReply({
      content: '❌ The configured Quarantine Role no longer exists in this server. Please reconfigure it via `/setup` → 🛡️ Mod Settings.',
    });
  }

  const botMember = interaction.guild.members.me;
  if (quarantineRole.position >= botMember.roles.highest.position) {
    return interaction.editReply({
      content: '❌ The Quarantine Role is equal to or higher than the bot\'s highest role. The bot cannot assign it. Please move the bot\'s role above the Quarantine Role.',
    });
  }

  let existingRecord;
  try {
    existingRecord = await getActiveQuarantine(interaction.guild.id, targetUser.id);
  } catch (error) {
    console.error('Quarantine: failed to check existing record:', error.message);
    return interaction.editReply({
      content: 'An error occurred while checking for an existing quarantine record. Please try again.',
    });
  }

  if (existingRecord) {
    return interaction.editReply({
      content: `❌ \`${targetUser.tag}\` is already quarantined. Use \`/unquarantine\` to restore them first.`,
    });
  }

  const previousRoleIds = targetMember.roles.cache
    .filter((role) => role.id !== interaction.guild.id && role.id !== settings.quarantineRoleId)
    .map((role) => role.id);

  const removableRoles = targetMember.roles.cache.filter(
    (role) =>
      role.id !== interaction.guild.id &&
      role.id !== settings.quarantineRoleId &&
      role.position < botMember.roles.highest.position &&
      !role.managed
  );

  try {
    if (removableRoles.size > 0) {
      await targetMember.roles.remove(removableRoles, `Quarantined by ${interaction.user.tag}: ${reason}`);
    }
    await targetMember.roles.add(quarantineRole, `Quarantined by ${interaction.user.tag}: ${reason}`);
  } catch (error) {
    console.error('Quarantine: failed to modify roles:', error.message);
    return interaction.editReply({
      content: `❌ Failed to quarantine \`${targetUser.tag}\`. The bot may lack the **Manage Roles** permission or the target has roles above the bot. ${error.message}`,
    });
  }

  try {
    await createQuarantineRecord({
      guildId: interaction.guild.id,
      userId: targetUser.id,
      userTag: targetUser.tag,
      previousRoleIds,
      staffUserId: interaction.user.id,
      staffUserTag: interaction.user.tag,
      reason,
      quarantinedAt: Date.now(),
      active: true,
    });
  } catch (error) {
    console.error('Quarantine: failed to save record:', error.message);
    return interaction.editReply({
      content: `⚠️ \`${targetUser.tag}\` has been quarantined, but the quarantine record could not be saved to the database. You may need to manually restore their roles later. Error: ${error.message}`,
    });
  }

  if (settings.quarantineLogChannelId) {
    const logChannel = interaction.guild.channels.cache.get(settings.quarantineLogChannelId);
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle('🛡️ Member Quarantined')
        .setDescription('The member has been placed in quarantine and their previous roles have been saved.')
        .addFields(
          { name: 'Member', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: false },
          { name: 'Staff', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: false },
          { name: 'Reason', value: reason, inline: false }
        )
        .setColor(0xdaa520)
        .setTimestamp();
      try {
        await logChannel.send({ embeds: [logEmbed] });
      } catch (error) {
        console.error('Quarantine: failed to send log:', error.message);
      }
    }
  }

  return interaction.editReply({
    content: `✅ \`${targetUser.tag}\` has been quarantined. ${previousRoleIds.length} role(s) were saved and will be restored on \`/unquarantine\`.`,
  });
}
