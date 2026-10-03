import {
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import { isAdmin } from '../utils/permissions.js';
import {
  getQuarantineSettings,
  getActiveQuarantine,
  deactivateQuarantineRecord,
} from '../utils/tracker-db.js';

export const data = new SlashCommandBuilder()
  .setName('unquarantine')
  .setDescription('Restore a quarantined member by giving back their saved roles')
  .addUserOption((option) =>
    option
      .setName('user')
      .setDescription('The member to unquarantine')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('reason')
      .setDescription('Reason for unquarantining')
      .setRequired(true)
      .setMaxLength(1000)
  );

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  let settings;
  try {
    settings = await getQuarantineSettings();
  } catch (error) {
    console.error('Unquarantine: failed to read settings:', error.message);
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
      content: '❌ You don\'t have permission to use this command.',
    });
  }

  const targetUser = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason');

  let record;
  try {
    record = await getActiveQuarantine(interaction.guild.id, targetUser.id);
  } catch (error) {
    console.error('Unquarantine: failed to read record:', error.message);
    return interaction.editReply({
      content: 'An error occurred while checking the quarantine record. Please try again.',
    });
  }

  if (!record) {
    return interaction.editReply({
      content: `❌ \`${targetUser.tag}\` does not have an active quarantine record. They may not have been quarantined, or they have already been unquarantined.`,
    });
  }

  let targetMember;
  try {
    targetMember = await interaction.guild.members.fetch(targetUser.id);
  } catch {
    return interaction.editReply({
      content: `❌ \`${targetUser.tag}\` is no longer in this server. Their quarantine record has been marked as inactive. Their roles will need to be restored manually if they rejoin.`,
    });
  }

  const botMember = interaction.guild.members.me;
  const quarantineRoleId = settings.quarantineRoleId;

  if (quarantineRoleId && targetMember.roles.cache.has(quarantineRoleId)) {
    const quarantineRole = interaction.guild.roles.cache.get(quarantineRoleId);
    if (quarantineRole && quarantineRole.position < botMember.roles.highest.position && !quarantineRole.managed) {
      try {
        await targetMember.roles.remove(quarantineRole, `Unquarantined by ${interaction.user.tag}: ${reason}`);
      } catch (error) {
        console.error('Unquarantine: failed to remove quarantine role:', error.message);
      }
    }
  }

  const restoredRoles = [];
  const skippedRoles = [];

  for (const roleId of record.previousRoleIds) {
    const role = interaction.guild.roles.cache.get(roleId);
    if (!role) {
      skippedRoles.push(roleId);
      continue;
    }
    if (role.managed) {
      skippedRoles.push(roleId);
      continue;
    }
    if (role.position >= botMember.roles.highest.position) {
      skippedRoles.push(roleId);
      continue;
    }
    if (targetMember.roles.cache.has(roleId)) {
      restoredRoles.push(role);
      continue;
    }
    try {
      await targetMember.roles.add(role, `Unquarantined by ${interaction.user.tag}: ${reason}`);
      restoredRoles.push(role);
    } catch (error) {
      console.error(`Unquarantine: failed to add role ${role.name}:`, error.message);
      skippedRoles.push(roleId);
    }
  }

  try {
    await deactivateQuarantineRecord(interaction.guild.id, targetUser.id);
  } catch (error) {
    console.error('Unquarantine: failed to deactivate record:', error.message);
  }

  if (settings.quarantineLogChannelId) {
    const logChannel = interaction.guild.channels.cache.get(settings.quarantineLogChannelId);
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle('🔓 Member Unquarantined')
        .setDescription('The member\'s previous roles have been restored.')
        .addFields(
          { name: 'Member', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: false },
          { name: 'Staff', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: false },
          { name: 'Reason', value: reason, inline: false }
        )
        .setColor(0x00bfff)
        .setTimestamp();
      try {
        await logChannel.send({ embeds: [logEmbed] });
      } catch (error) {
        console.error('Unquarantine: failed to send log:', error.message);
      }
    }
  }

  let response = `✅ \`${targetUser.tag}\` has been unquarantined. ${restoredRoles.length} role(s) restored.`;
  if (skippedRoles.length > 0) {
    response += ` ${skippedRoles.length} role(s) were skipped (deleted, managed by integration, or above the bot's highest role).`;
  }

  return interaction.editReply({ content: response });
}
