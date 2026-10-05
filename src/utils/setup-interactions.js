import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  UserSelectMenuBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
} from 'discord.js';
import { isAdmin } from '../utils/permissions.js';
import { getSettings, saveSettings, getQuarantineSettings, saveQuarantineSettings } from '../utils/tracker-db.js';
import { isValidUrl } from '../utils/validate.js';
import { handleTicketSetupInteraction } from '../utils/ticket-interactions.js';

// ---------------------------------------------------------------------------
// Tracker Settings
// ---------------------------------------------------------------------------

async function getTrackerSettingsEmbed(guildId) {
  const settings = await getSettings(guildId);

  const trackingChannel = settings?.trackingChannelId
    ? `<#${settings.trackingChannelId}>`
    : 'Not configured';

  let completionPing = 'Not configured';
  if (settings?.completionPingType && settings?.completionPingId) {
    if (settings.completionPingType === 'role') {
      completionPing = `<@&${settings.completionPingId}>`;
    } else if (settings.completionPingType === 'user') {
      completionPing = `<@${settings.completionPingId}>`;
    }
  }

  return new EmbedBuilder()
    .setTitle('Tracker Settings')
    .addFields(
      { name: 'Tracking Channel', value: trackingChannel, inline: true },
      { name: 'Completion Ping', value: completionPing, inline: true }
    )
    .setColor(0x2f3136);
}

function getTrackerSettingsComponents() {
  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('tracker_select_channel')
      .setPlaceholder('Select a tracking channel')
      .setMinValues(1)
      .setMaxValues(1)
  );

  const pingRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('tracker_select_ping')
      .setPlaceholder('Set completion ping (role or user)')
      .addOptions(
        { label: 'Select a Role', value: 'pick_role', emoji: '🏷️' },
        { label: 'Select a User', value: 'pick_user', emoji: '👤' },
        { label: 'Clear Completion Ping', value: 'clear_ping', emoji: '🗑️' }
      )
  );

  const backButtonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup_back')
      .setLabel('Back')
      .setStyle(ButtonStyle.Secondary)
  );

  return [channelRow, pingRow, backButtonRow];
}

// ---------------------------------------------------------------------------
// Bot Appearance panel
// ---------------------------------------------------------------------------

const APPEARANCE_EMBED_COLOR = 0x2f3136;

function getAppearanceEmbed(member) {
  const avatarStatus = member?.avatar ? '✅ Set (server-specific)' : '❌ Not set';
  const bannerStatus = member?.banner ? '✅ Set (server-specific)' : '❌ Not set';

  return new EmbedBuilder()
    .setTitle('🎨 Bot Appearance')
    .setDescription(
      'Customize the bot\'s **server-specific** appearance.\n' +
      'Changes only affect this server — the bot\'s global profile is not modified.'
    )
    .addFields(
      { name: '🖼️ Bot Profile (Avatar)', value: avatarStatus, inline: true },
      { name: '🏳️ Bot Banner', value: bannerStatus, inline: true },
      { name: '✏️ Bot Bio', value: 'Set via text input', inline: true }
    )
    .setColor(APPEARANCE_EMBED_COLOR);
}

function getAppearanceComponents() {
  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('appearance_set_avatar')
      .setLabel('Bot Profile')
      .setEmoji('🖼️')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('appearance_set_banner')
      .setLabel('Bot Banner')
      .setEmoji('🏳️')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('appearance_set_bio')
      .setLabel('Bot Bio')
      .setEmoji('✏️')
      .setStyle(ButtonStyle.Primary),
  );

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('appearance_reset_avatar')
      .setLabel('Reset Avatar')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('appearance_reset_banner')
      .setLabel('Reset Banner')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('appearance_reset_bio')
      .setLabel('Reset Bio')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary)
  );

  const backButtonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup_back')
      .setLabel('Back')
      .setStyle(ButtonStyle.Secondary)
  );

  return [buttonRow, actionRow, backButtonRow];
}

// ---------------------------------------------------------------------------
// Image helpers
// ---------------------------------------------------------------------------

const SUPPORTED_IMAGE_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

const MIME_BY_EXT = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

function guessMediaTypeFromUrl(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const ext = pathname.split('.').pop();
    return MIME_BY_EXT[ext] || null;
  } catch {
    return null;
  }
}

async function fetchImageAsDataUriWithFallback(url) {
  if (!isValidUrl(url)) return null;

  let response;
  try {
    response = await fetch(url, { redirect: 'follow' });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  let mediaType = null;
  const contentType = response.headers.get('content-type');
  if (contentType) {
    const baseType = contentType.split(';')[0].trim().toLowerCase();
    if (SUPPORTED_IMAGE_MEDIA_TYPES.includes(baseType)) {
      mediaType = baseType;
    }
  }

  if (!mediaType) {
    mediaType = guessMediaTypeFromUrl(url);
  }

  if (!mediaType || !SUPPORTED_IMAGE_MEDIA_TYPES.includes(mediaType)) return null;

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length === 0) return null;

  const base64 = buffer.toString('base64');
  return `data:${mediaType};base64,${base64}`;
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

function getSetupDashboardEmbed() {
  return new EmbedBuilder()
    .setTitle('Bot Setup')
    .setDescription('Manage and configure your bot\'s features using the options below.')
    .setColor(0x2f3136);
}

function getSetupDashboardComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup_appearance')
        .setLabel('Bot Appearance')
        .setEmoji('🎨')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('setup_tracker_settings')
        .setLabel('Tracker Settings')
        .setEmoji('⚙️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup_mod_settings')
        .setLabel('Mod Settings')
        .setEmoji('🛡️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup_ticket_settings')
        .setLabel('Ticket Settings')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

// ---------------------------------------------------------------------------
// Mod Settings panel
// ---------------------------------------------------------------------------

const MOD_SETTINGS_COLOR = 0x2f3136;

async function getModSettingsEmbed() {
  const settings = await getQuarantineSettings();

  const staffRole = settings?.quarantineStaffRoleId
    ? `<@&${settings.quarantineStaffRoleId}>`
    : '❌ Not configured';
  const logsChannel = settings?.quarantineLogChannelId
    ? `<#${settings.quarantineLogChannelId}>`
    : '❌ Not configured';
  const quarantineRole = settings?.quarantineRoleId
    ? `<@&${settings.quarantineRoleId}>`
    : '❌ Not configured';

  return new EmbedBuilder()
    .setTitle('🛡️ Mod Settings')
    .setDescription('Configure the quarantine system for this server.')
    .addFields(
      { name: 'Quarantine Staff Role', value: staffRole, inline: true },
      { name: 'Quarantine Log Channel', value: logsChannel, inline: true },
      { name: 'Quarantine Role', value: quarantineRole, inline: true }
    )
    .setColor(MOD_SETTINGS_COLOR);
}

function getModSettingsComponents() {
  const roleSelectRow = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('mod_select_staff_role')
      .setPlaceholder('Select Quarantine Staff role')
      .setMinValues(1)
      .setMaxValues(1)
  );

  const channelSelectRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('mod_select_log_channel')
      .setPlaceholder('Select Quarantine Log channel')
      .setMinValues(1)
      .setMaxValues(1)
  );

  const quarantineRoleRow = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('mod_select_quarantine_role')
      .setPlaceholder('Select Quarantine Role')
      .setMinValues(1)
      .setMaxValues(1)
  );

  const backButtonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup_back')
      .setLabel('Back')
      .setStyle(ButtonStyle.Secondary)
  );

  return [roleSelectRow, channelSelectRow, quarantineRoleRow, backButtonRow];
}

// ---------------------------------------------------------------------------
// Channel validation helper
// ---------------------------------------------------------------------------

async function validateTrackingChannel(guild, channelId) {
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    return { valid: false, error: 'That channel no longer exists or is inaccessible.' };
  }

  const botPerms = channel.permissionsFor(guild.members.me);
  if (!botPerms?.has(PermissionFlagsBits.SendMessages)) {
    return { valid: false, error: 'The bot lacks **Send Messages** permission in that channel.' };
  }
  if (!botPerms?.has(PermissionFlagsBits.EmbedLinks)) {
    return { valid: false, error: 'The bot lacks **Embed Links** permission in that channel.' };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Interaction handler
// ---------------------------------------------------------------------------

export async function handleSetupInteraction(interaction) {
  const guildId = interaction.guild?.id;

  // Delegate ticket-related setup interactions first
  const ticketCustomIds = [
    'setup_ticket_settings',
    'ticket_set_panel_id',
    'ticket_send_panel',
    'ticket_select_category',
    'ticket_select_staff_role',
  ];

  if (
    (interaction.isButton() && ticketCustomIds.includes(interaction.customId)) ||
    (interaction.isChannelSelectMenu() && interaction.customId === 'ticket_select_category') ||
    (interaction.isRoleSelectMenu() && interaction.customId === 'ticket_select_staff_role')
  ) {
    await handleTicketSetupInteraction(interaction);
    return;
  }

  // ---- Buttons ----------------------------------------------------------
  if (interaction.isButton()) {
    // -- Back to main dashboard --
    if (interaction.customId === 'setup_back') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to interact with this setup.',
          ephemeral: true,
        });
      }
      await interaction.deferUpdate();
      const embed = getSetupDashboardEmbed();
      const components = getSetupDashboardComponents();
      await interaction.editReply({ embeds: [embed], components });
      return;
    }

    // -- Mod Settings --
    if (interaction.customId === 'setup_mod_settings') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to interact with this setup.',
          ephemeral: true,
        });
      }
      await interaction.deferUpdate();
      const embed = await getModSettingsEmbed();
      const components = getModSettingsComponents();
      await interaction.editReply({ embeds: [embed], components });
      return;
    }

    // -- Tracker Settings --
    if (interaction.customId === 'setup_tracker_settings') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to interact with this setup.',
          ephemeral: true,
        });
      }
      await interaction.deferUpdate();
      const embed = await getTrackerSettingsEmbed(guildId);
      const components = getTrackerSettingsComponents();
      await interaction.editReply({ embeds: [embed], components });
      return;
    }

    // -- Bot Appearance --
    if (interaction.customId === 'setup_appearance') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to interact with this setup.',
          ephemeral: true,
        });
      }
      await interaction.deferUpdate();
      const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
      const embed = getAppearanceEmbed(botMember);
      const components = getAppearanceComponents();
      await interaction.editReply({ embeds: [embed], components });
      return;
    }

    // -- Appearance: set avatar --
    if (interaction.customId === 'appearance_set_avatar') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to interact with this setup.',
          ephemeral: true,
        });
      }
      const modal = new ModalBuilder()
        .setCustomId('appearance_modal_avatar')
        .setTitle('🖼️ Set Bot Profile (Server Avatar)')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('image_url')
              .setLabel('Image URL (PNG, JPG, GIF, or WebP)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('https://example.com/avatar.png')
              .setRequired(true)
              .setMaxLength(500)
          )
        );
      await interaction.showModal(modal);
      return;
    }

    // -- Appearance: set banner --
    if (interaction.customId === 'appearance_set_banner') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to interact with this setup.',
          ephemeral: true,
        });
      }
      const modal = new ModalBuilder()
        .setCustomId('appearance_modal_banner')
        .setTitle('🏳️ Set Bot Banner (Server Banner)')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('image_url')
              .setLabel('Image URL (PNG, JPG, GIF, or WebP)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('https://example.com/banner.png')
              .setRequired(true)
              .setMaxLength(500)
          )
        );
      await interaction.showModal(modal);
      return;
    }

    // -- Appearance: set bio --
    if (interaction.customId === 'appearance_set_bio') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to interact with this setup.',
          ephemeral: true,
        });
      }
      const modal = new ModalBuilder()
        .setCustomId('appearance_modal_bio')
        .setTitle('✏️ Set Bot Bio (Server Bio)')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('bio_text')
              .setLabel('Bio text (max 190 characters)')
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder('Tell people about this bot...')
              .setRequired(true)
              .setMaxLength(190)
          )
        );
      await interaction.showModal(modal);
      return;
    }

    // -- Appearance: reset avatar --
    if (interaction.customId === 'appearance_reset_avatar') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to interact with this setup.',
          ephemeral: true,
        });
      }
      await interaction.deferUpdate();
      try {
        await interaction.guild.members.editMe({ avatar: null });
      } catch (error) {
        console.error('Appearance: failed to reset avatar:', error.message);
        const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
        const embed = getAppearanceEmbed(botMember);
        await interaction.editReply({
          content: 'Failed to reset the server avatar. The bot may lack the **Manage Nicknames** permission or the image was rejected.',
          embeds: [embed],
          components: getAppearanceComponents(),
        });
        return;
      }
      const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
      const embed = getAppearanceEmbed(botMember);
      await interaction.editReply({
        content: '✅ Server avatar reset to the bot\'s global avatar.',
        embeds: [embed],
        components: getAppearanceComponents(),
      });
      return;
    }

    // -- Appearance: reset banner --
    if (interaction.customId === 'appearance_reset_banner') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to interact with this setup.',
          ephemeral: true,
        });
      }
      await interaction.deferUpdate();
      try {
        await interaction.guild.members.editMe({ banner: null });
      } catch (error) {
        console.error('Appearance: failed to reset banner:', error.message);
        const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
        const embed = getAppearanceEmbed(botMember);
        await interaction.editReply({
          content: 'Failed to reset the server banner. The bot may lack the **Manage Nicknames** permission or the image was rejected.',
          embeds: [embed],
          components: getAppearanceComponents(),
        });
        return;
      }
      const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
      const embed = getAppearanceEmbed(botMember);
      await interaction.editReply({
        content: '✅ Server banner reset to the bot\'s global banner.',
        embeds: [embed],
        components: getAppearanceComponents(),
      });
      return;
    }

    // -- Appearance: reset bio --
    if (interaction.customId === 'appearance_reset_bio') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to interact with this setup.',
          ephemeral: true,
        });
      }
      await interaction.deferUpdate();
      try {
        await interaction.guild.members.editMe({ bio: null });
      } catch (error) {
        console.error('Appearance: failed to reset bio:', error.message);
        const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
        const embed = getAppearanceEmbed(botMember);
        await interaction.editReply({
          content: 'Failed to reset the server bio. The bot may lack the **Manage Nicknames** permission.',
          embeds: [embed],
          components: getAppearanceComponents(),
        });
        return;
      }
      const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
      const embed = getAppearanceEmbed(botMember);
      await interaction.editReply({
        content: '✅ Server bio has been cleared.',
        embeds: [embed],
        components: getAppearanceComponents(),
      });
      return;
    }

    // -- Tracker cancel buttons --
    if (interaction.customId === 'tracker_cancel_role' || interaction.customId === 'tracker_cancel_user') {
      await interaction.deferUpdate();
      const embed = await getTrackerSettingsEmbed(guildId);
      const components = getTrackerSettingsComponents();
      await interaction.editReply({ embeds: [embed], components });
      return;
    }
  }

  // ---- String select menus ---------------------------------------------
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'tracker_select_ping') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to interact with this setup.',
          ephemeral: true,
        });
      }

      await interaction.deferUpdate();
      const choice = interaction.values[0];

      if (choice === 'clear_ping') {
        try {
          await saveSettings({
            completionPingType: null,
            completionPingId: null,
          }, guildId);
        } catch (error) {
          console.error('Tracker Settings: failed to clear ping:', error.message);
          return interaction.editReply({
            content: 'An error occurred while saving the configuration. Please try again.',
            components: getTrackerSettingsComponents(),
          });
        }
        const embed = await getTrackerSettingsEmbed(guildId);
        const components = getTrackerSettingsComponents();
        await interaction.editReply({ embeds: [embed], components });
        return;
      }

      if (choice === 'pick_role') {
        const roleSelectRow = new ActionRowBuilder().addComponents(
          new RoleSelectMenuBuilder()
            .setCustomId('tracker_select_role')
            .setPlaceholder('Select a role to ping')
            .setMinValues(1)
            .setMaxValues(1)
        );
        const cancelButtonRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('tracker_cancel_role')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        );
        const embed = await getTrackerSettingsEmbed(guildId);
        await interaction.editReply({ embeds: [embed], components: [roleSelectRow, cancelButtonRow] });
        return;
      }

      if (choice === 'pick_user') {
        const userSelectRow = new ActionRowBuilder().addComponents(
          new UserSelectMenuBuilder()
            .setCustomId('tracker_select_user')
            .setPlaceholder('Select a user to ping')
            .setMinValues(1)
            .setMaxValues(1)
        );
        const cancelButtonRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('tracker_cancel_user')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        );
        const embed = await getTrackerSettingsEmbed(guildId);
        await interaction.editReply({ embeds: [embed], components: [userSelectRow, cancelButtonRow] });
        return;
      }
    }
  }

  // ---- Role select menus -----------------------------------------------
  if (interaction.isRoleSelectMenu()) {
    if (interaction.customId === 'tracker_select_role') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to interact with this setup.',
          ephemeral: true,
        });
      }

      await interaction.deferUpdate();
      const roleId = interaction.values[0];

      try {
        await saveSettings({
          completionPingType: 'role',
          completionPingId: roleId,
        }, guildId);
      } catch (error) {
        console.error('Tracker Settings: failed to save role ping:', error.message);
        return interaction.editReply({
          content: 'An error occurred while saving the configuration. Please try again.',
          components: getTrackerSettingsComponents(),
        });
      }

      const embed = await getTrackerSettingsEmbed(guildId);
      const components = getTrackerSettingsComponents();
      await interaction.editReply({ embeds: [embed], components });
      return;
    }
  }

  // ---- User select menus -----------------------------------------------
  if (interaction.isUserSelectMenu()) {
    if (interaction.customId === 'tracker_select_user') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to interact with this setup.',
          ephemeral: true,
        });
      }

      await interaction.deferUpdate();
      const userId = interaction.values[0];

      try {
        await saveSettings({
          completionPingType: 'user',
          completionPingId: userId,
        }, guildId);
      } catch (error) {
        console.error('Tracker Settings: failed to save user ping:', error.message);
        return interaction.editReply({
          content: 'An error occurred while saving the configuration. Please try again.',
          components: getTrackerSettingsComponents(),
        });
      }

      const embed = await getTrackerSettingsEmbed(guildId);
      const components = getTrackerSettingsComponents();
      await interaction.editReply({ embeds: [embed], components });
      return;
    }
  }

  // ---- Channel select menus --------------------------------------------
  if (interaction.isChannelSelectMenu()) {
    if (interaction.customId === 'tracker_select_channel') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to interact with this setup.',
          ephemeral: true,
        });
      }

      await interaction.deferUpdate();
      const channelId = interaction.values[0];

      const validation = await validateTrackingChannel(interaction.guild, channelId);
      if (!validation.valid) {
        const embed = await getTrackerSettingsEmbed(guildId);
        return interaction.editReply({
          content: `⚠️ Could not set tracking channel: ${validation.error}`,
          embeds: [embed],
          components: getTrackerSettingsComponents(),
        });
      }

      try {
        await saveSettings({
          trackingChannelId: channelId,
        }, guildId);
      } catch (error) {
        console.error('Tracker Settings: failed to save channel:', error.message);
        return interaction.editReply({
          content: 'An error occurred while saving the configuration. Please try again.',
          components: getTrackerSettingsComponents(),
        });
      }

      const embed = await getTrackerSettingsEmbed(guildId);
      const components = getTrackerSettingsComponents();
      await interaction.editReply({
        content: '✅ Tracking channel updated. The active tracker will use this channel for future updates.',
        embeds: [embed],
        components,
      });
      return;
    }
  }

  // ---- Mod Settings: role/channel select menus --------------------------
  if (interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu()) {
    // Quarantine Staff role
    if (interaction.customId === 'mod_select_staff_role') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to interact with this setup.',
          ephemeral: true,
        });
      }
      await interaction.deferUpdate();
      const roleId = interaction.values[0];
      try {
        const existing = await getQuarantineSettings();
        await saveQuarantineSettings({
          quarantineStaffRoleId: roleId,
          quarantineLogChannelId: existing?.quarantineLogChannelId,
          quarantineRoleId: existing?.quarantineRoleId,
        });
      } catch (error) {
        console.error('Mod Settings: failed to save staff role:', error.message);
        return interaction.editReply({
          content: 'An error occurred while saving the configuration. Please try again.',
          components: getModSettingsComponents(),
        });
      }
      const embed = await getModSettingsEmbed();
      const components = getModSettingsComponents();
      await interaction.editReply({ content: '✅ Quarantine Staff role updated.', embeds: [embed], components });
      return;
    }

    // Quarantine Role
    if (interaction.customId === 'mod_select_quarantine_role') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to interact with this setup.',
          ephemeral: true,
        });
      }
      await interaction.deferUpdate();
      const roleId = interaction.values[0];
      try {
        const existing = await getQuarantineSettings();
        await saveQuarantineSettings({
          quarantineStaffRoleId: existing?.quarantineStaffRoleId,
          quarantineLogChannelId: existing?.quarantineLogChannelId,
          quarantineRoleId: roleId,
        });
      } catch (error) {
        console.error('Mod Settings: failed to save quarantine role:', error.message);
        return interaction.editReply({
          content: 'An error occurred while saving the configuration. Please try again.',
          components: getModSettingsComponents(),
        });
      }
      const embed = await getModSettingsEmbed();
      const components = getModSettingsComponents();
      await interaction.editReply({ content: '✅ Quarantine Role updated.', embeds: [embed], components });
      return;
    }

    // Quarantine Log channel
    if (interaction.customId === 'mod_select_log_channel') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to interact with this setup.',
          ephemeral: true,
        });
      }
      await interaction.deferUpdate();
      const channelId = interaction.values[0];
      try {
        const existing = await getQuarantineSettings();
        await saveQuarantineSettings({
          quarantineStaffRoleId: existing?.quarantineStaffRoleId,
          quarantineLogChannelId: channelId,
          quarantineRoleId: existing?.quarantineRoleId,
        });
      } catch (error) {
        console.error('Mod Settings: failed to save log channel:', error.message);
        return interaction.editReply({
          content: 'An error occurred while saving the configuration. Please try again.',
          components: getModSettingsComponents(),
        });
      }
      const embed = await getModSettingsEmbed();
      const components = getModSettingsComponents();
      await interaction.editReply({ content: '✅ Quarantine Log channel updated.', embeds: [embed], components });
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Modal submit handler (called from interactionCreate for appearance modals)
// ---------------------------------------------------------------------------

export async function handleAppearanceModalSubmit(interaction) {
  const customId = interaction.customId;

  if (customId === 'appearance_modal_avatar') {
    await interaction.deferReply({ ephemeral: true });
    const imageUrl = interaction.fields.getTextInputValue('image_url').trim();

    const dataUri = await fetchImageAsDataUriWithFallback(imageUrl);
    if (!dataUri) {
      return interaction.editReply({
        content: '❌ Could not fetch a valid image from that URL. Please provide a direct link to a PNG, JPG, GIF, or WebP image.',
      });
    }

    try {
      await interaction.guild.members.editMe({ avatar: dataUri });
    } catch (error) {
      console.error('Appearance: failed to set avatar:', error.message);
      return interaction.editReply({
        content: `❌ Failed to set the server avatar. ${formatApiError(error)}`,
      });
    }

    return interaction.editReply({
      content: '✅ Server avatar updated successfully! The change only affects this server.',
    });
  }

  if (customId === 'appearance_modal_banner') {
    await interaction.deferReply({ ephemeral: true });
    const imageUrl = interaction.fields.getTextInputValue('image_url').trim();

    const dataUri = await fetchImageAsDataUriWithFallback(imageUrl);
    if (!dataUri) {
      return interaction.editReply({
        content: '❌ Could not fetch a valid image from that URL. Please provide a direct link to a PNG, JPG, GIF, or WebP image.',
      });
    }

    try {
      await interaction.guild.members.editMe({ banner: dataUri });
    } catch (error) {
      console.error('Appearance: failed to set banner:', error.message);
      return interaction.editReply({
        content: `❌ Failed to set the server banner. ${formatApiError(error)}`,
      });
    }

    return interaction.editReply({
      content: '✅ Server banner updated successfully! The change only affects this server.',
    });
  }

  if (customId === 'appearance_modal_bio') {
    await interaction.deferReply({ ephemeral: true });
    const bioText = interaction.fields.getTextInputValue('bio_text').trim();

    try {
      await interaction.guild.members.editMe({ bio: bioText });
    } catch (error) {
      console.error('Appearance: failed to set bio:', error.message);
      return interaction.editReply({
        content: `❌ Failed to set the server bio. ${formatApiError(error)}`,
      });
    }

    return interaction.editReply({
      content: '✅ Server bio updated successfully! The change only affects this server.',
    });
  }
}

function formatApiError(error) {
  if (error.code === 50013) {
    return 'The bot lacks the **Manage Nicknames** permission in this server.';
  }
  if (error.status === 400) {
    return 'The image may be too large or in an unsupported format. Discord accepts PNG, JPG, GIF, and WebP up to 8 MB.';
  }
  return error.message || 'An unexpected error occurred.';
}
