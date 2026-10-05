import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { isAdmin } from '../utils/permissions.js';
import {
  getTicketSettings,
  saveTicketSettings,
  getTicketButtons,
  deleteTicketButton,
  getTicket,
  getTicketByChannel,
  updateTicket,
  deleteTicketRecord,
  getCloseReasons,
} from '../utils/ticket-db.js';
import {
  TICKET_TYPES,
  TICKET_TYPE_EMOJIS,
} from '../utils/ticket-types.js';
import {
  createTicketChannel,
  sendTicketGreeting,
  buildTicketPanelComponents,
  updateTicketPanelMessage,
  buildOpenTicketControls,
  buildClosedTicketControls,
  lockTicketForCreator,
  unlockTicketForCreator,
} from '../services/ticket-service.js';

// ---------------------------------------------------------------------------
// Ticket Settings panel (shown inside /setup dashboard)
// ---------------------------------------------------------------------------

async function getTicketSettingsEmbed(guildId) {
  const settings = await getTicketSettings(guildId);

  const mainPanel = settings?.mainPanelMessageId
    ? `\`${settings.mainPanelMessageId}\``
    : 'Not configured';
  const category = settings?.ticketCategoryId
    ? `<#${settings.ticketCategoryId}>`
    : 'Not configured';
  const staffRole = settings?.ticketStaffRoleId
    ? `<@&${settings.ticketStaffRoleId}>`
    : 'Not configured';
  const buttonCount = settings?.ticketButtons?.length || 0;

  return new EmbedBuilder()
    .setTitle('🎫 Ticket Settings')
    .setDescription('Configure the ticket system for this server.')
    .addFields(
      { name: '📋 Main Panel Message ID', value: mainPanel, inline: true },
      { name: '📁 Ticket Category', value: category, inline: true },
      { name: '👥 Ticket Staff Role', value: staffRole, inline: true },
      { name: '🎫 Configured Ticket Options', value: `${buttonCount}`, inline: true }
    )
    .setColor(0x2f3136);
}

function getTicketSettingsComponents() {
  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('ticket_select_category')
      .setPlaceholder('Select Ticket Category')
      .setMinValues(1)
      .setMaxValues(1)
  );

  const roleRow = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('ticket_select_staff_role')
      .setPlaceholder('Select Ticket Staff role')
      .setMinValues(1)
      .setMaxValues(1)
  );

  const panelRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_set_panel_id')
      .setLabel('Set Main Panel Message ID')
      .setEmoji('📋')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('ticket_send_panel')
      .setLabel('Send Ticket Panel')
      .setEmoji('🎫')
      .setStyle(ButtonStyle.Secondary)
  );

  const backButtonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup_back')
      .setLabel('Back')
      .setStyle(ButtonStyle.Secondary)
  );

  return [channelRow, roleRow, panelRow, backButtonRow];
}

// ---------------------------------------------------------------------------
// Handle setup-level ticket interactions (inside the /setup dashboard)
// ---------------------------------------------------------------------------

export async function handleTicketSetupInteraction(interaction) {
  const guildId = interaction.guild?.id;

  // -- Ticket Settings button on main dashboard --
  if (interaction.isButton() && interaction.customId === 'setup_ticket_settings') {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        content: 'You do not have permission to interact with this setup.',
        ephemeral: true,
      });
    }
    await interaction.deferUpdate();
    const embed = await getTicketSettingsEmbed(guildId);
    const components = getTicketSettingsComponents();
    await interaction.editReply({ embeds: [embed], components });
    return;
  }

  // -- Set Main Panel Message ID (modal) --
  if (interaction.isButton() && interaction.customId === 'ticket_set_panel_id') {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        content: 'You do not have permission to interact with this setup.',
        ephemeral: true,
      });
    }
    const modal = new ModalBuilder()
      .setCustomId('ticket_modal_panel_id')
      .setTitle('📋 Set Main Panel Message ID')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('panel_message_id')
            .setLabel('Message ID (right-click → Copy Message ID)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. 1234567890123456789')
            .setRequired(true)
            .setMaxLength(30)
        )
      );
    await interaction.showModal(modal);
    return;
  }

  // -- Send Ticket Panel (to the channel where the panel message ID was set) --
  if (interaction.isButton() && interaction.customId === 'ticket_send_panel') {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        content: 'You do not have permission to interact with this setup.',
        ephemeral: true,
      });
    }
    await interaction.deferUpdate();

    const settings = await getTicketSettings(guildId);
    if (!settings?.ticketPanelChannelId) {
      const embed = await getTicketSettingsEmbed(guildId);
      return interaction.editReply({
        content: '⚠️ No panel channel is set. Please set the Main Panel Message ID from a channel first.',
        embeds: [embed],
        components: getTicketSettingsComponents(),
      });
    }

    const channel = await interaction.guild.channels.fetch(settings.ticketPanelChannelId).catch(() => null);
    if (!channel) {
      const embed = await getTicketSettingsEmbed(guildId);
      return interaction.editReply({
        content: '⚠️ The saved panel channel no longer exists.',
        embeds: [embed],
        components: getTicketSettingsComponents(),
      });
    }

    const components = await buildTicketPanelComponents(guildId);
    if (!components) {
      const embed = await getTicketSettingsEmbed(guildId);
      return interaction.editReply({
        content: '⚠️ No ticket options are configured. Use `/add button` to add ticket options first.',
        embeds: [embed],
        components: getTicketSettingsComponents(),
      });
    }

    const panelEmbed = new EmbedBuilder()
      .setTitle('🎫 Support Tickets')
      .setDescription('Select a ticket type from the dropdown below to open a ticket.')
      .setColor(0x2f3136);

    let sentMessage;
    try {
      sentMessage = await channel.send({ embeds: [panelEmbed], components: [components] });
    } catch (error) {
      console.error('Ticket: failed to send panel:', error.message);
      const embed = await getTicketSettingsEmbed(guildId);
      return interaction.editReply({
        content: '⚠️ Failed to send the ticket panel. Check bot permissions in that channel.',
        embeds: [embed],
        components: getTicketSettingsComponents(),
      });
    }

    await saveTicketSettings(guildId, {
      mainPanelMessageId: sentMessage.id,
      ticketPanelChannelId: channel.id,
    });

    const embed = await getTicketSettingsEmbed(guildId);
    await interaction.editReply({
      content: `✅ Ticket panel sent to ${channel}. Message ID: \`${sentMessage.id}\``,
      embeds: [embed],
      components: getTicketSettingsComponents(),
    });
    return;
  }

  // -- Channel select: Ticket Category --
  if (interaction.isChannelSelectMenu() && interaction.customId === 'ticket_select_category') {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        content: 'You do not have permission to interact with this setup.',
        ephemeral: true,
      });
    }
    await interaction.deferUpdate();
    const channelId = interaction.values[0];

    try {
      await saveTicketSettings(guildId, { ticketCategoryId: channelId });
    } catch (error) {
      console.error('Ticket Settings: failed to save category:', error.message);
      return interaction.editReply({
        content: 'An error occurred while saving the configuration.',
        components: getTicketSettingsComponents(),
      });
    }

    const embed = await getTicketSettingsEmbed(guildId);
    await interaction.editReply({
      content: '✅ Ticket Category updated.',
      embeds: [embed],
      components: getTicketSettingsComponents(),
    });
    return;
  }

  // -- Role select: Ticket Staff role --
  if (interaction.isRoleSelectMenu() && interaction.customId === 'ticket_select_staff_role') {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        content: 'You do not have permission to interact with this setup.',
        ephemeral: true,
      });
    }
    await interaction.deferUpdate();
    const roleId = interaction.values[0];

    try {
      await saveTicketSettings(guildId, { ticketStaffRoleId: roleId });
    } catch (error) {
      console.error('Ticket Settings: failed to save staff role:', error.message);
      return interaction.editReply({
        content: 'An error occurred while saving the configuration.',
        components: getTicketSettingsComponents(),
      });
    }

    const embed = await getTicketSettingsEmbed(guildId);
    await interaction.editReply({
      content: '✅ Ticket Staff role updated.',
      embeds: [embed],
      components: getTicketSettingsComponents(),
    });
    return;
  }
}

// ---------------------------------------------------------------------------
// Handle ticket modal submits (panel message ID, support reason, roblox username)
// ---------------------------------------------------------------------------

export async function handleTicketModalSubmit(interaction) {
  const guildId = interaction.guild?.id;

  // -- Panel message ID modal --
  if (interaction.customId === 'ticket_modal_panel_id') {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        content: 'You do not have permission to do this.',
        ephemeral: true,
      });
    }
    await interaction.deferReply({ ephemeral: true });
    const messageId = interaction.fields.getTextInputValue('panel_message_id').trim();

    if (!/^\d{16,20}$/.test(messageId)) {
      return interaction.editReply({ content: '❌ That does not look like a valid Discord message ID.' });
    }

    await saveTicketSettings(guildId, {
      mainPanelMessageId: messageId,
      ticketPanelChannelId: interaction.channel.id,
    });

    // Try to update the panel message with current buttons
    await updateTicketPanelMessage(interaction.guild, messageId);

    return interaction.editReply({
      content: `✅ Main Panel Message ID set to \`${messageId}\`. The panel has been updated with current ticket options if it was found.`,
    });
  }

  // -- Support reason modal --
  if (interaction.customId === 'ticket_modal_support') {
    await interaction.deferReply({ ephemeral: true });
    const reason = interaction.fields.getTextInputValue('support_reason').trim();
    const userId = interaction.user.id;

    const existing = await getTicket(guildId, userId, TICKET_TYPES.SUPPORT);
    if (existing) {
      if (existing.status === 'open') {
        return interaction.editReply({
          content: `You already have an open Support ticket: <#${existing.channelId}>`,
        });
      }
      return interaction.editReply({
        content: `You already have a Support ticket that is **${existing.status}**: <#${existing.channelId}>\nStaff can reopen it for you.`,
      });
    }

    const settings = await getTicketSettings(guildId);
    if (!settings?.ticketCategoryId) {
      return interaction.editReply({
        content: '❌ No ticket category is configured. Please ask an admin to set it up via `/setup` → Ticket Settings.',
      });
    }

    const result = await createTicketChannel(interaction.guild, interaction.user, TICKET_TYPES.SUPPORT, {
      supportReason: reason,
    });

    if (result.error) {
      return interaction.editReply({ content: `❌ ${result.error}` });
    }

    await sendTicketGreeting(result.channel, interaction.user, TICKET_TYPES.SUPPORT, { supportReason: reason });

    return interaction.editReply({
      content: `✅ Your Support ticket has been created: <#${result.channel.id}>`,
    });
  }

  // -- Invite Rewards modal --
  if (interaction.customId === 'ticket_modal_invite') {
    await interaction.deferReply({ ephemeral: true });
    const robloxUsername = interaction.fields.getTextInputValue('roblox_username').trim();
    const userId = interaction.user.id;

    const existing = await getTicket(guildId, userId, TICKET_TYPES.INVITE_REWARDS);
    if (existing) {
      if (existing.status === 'open') {
        return interaction.editReply({
          content: `You already have an open Invite Rewards ticket: <#${existing.channelId}>`,
        });
      }
      return interaction.editReply({
        content: `You already have an Invite Rewards ticket that is **${existing.status}**: <#${existing.channelId}>\nStaff can reopen it for you.`,
      });
    }

    const settings = await getTicketSettings(guildId);
    if (!settings?.ticketCategoryId) {
      return interaction.editReply({
        content: '❌ No ticket category is configured. Please ask an admin to set it up via `/setup` → Ticket Settings.',
      });
    }

    const result = await createTicketChannel(interaction.guild, interaction.user, TICKET_TYPES.INVITE_REWARDS, {
      robloxUsername,
    });

    if (result.error) {
      return interaction.editReply({ content: `❌ ${result.error}` });
    }

    await sendTicketGreeting(result.channel, interaction.user, TICKET_TYPES.INVITE_REWARDS, { robloxUsername });

    return interaction.editReply({
      content: `✅ Your Invite Rewards ticket has been created: <#${result.channel.id}>`,
    });
  }

  // -- Followers modal --
  if (interaction.customId === 'ticket_modal_followers') {
    await interaction.deferReply({ ephemeral: true });
    const robloxUsername = interaction.fields.getTextInputValue('roblox_username').trim();
    const userId = interaction.user.id;

    const existing = await getTicket(guildId, userId, TICKET_TYPES.FOLLOWERS);
    if (existing) {
      if (existing.status === 'open') {
        return interaction.editReply({
          content: `You already have an open Followers ticket: <#${existing.channelId}>`,
        });
      }
      return interaction.editReply({
        content: `You already have a Followers ticket that is **${existing.status}**: <#${existing.channelId}>\nStaff can reopen it for you.`,
      });
    }

    const settings = await getTicketSettings(guildId);
    if (!settings?.ticketCategoryId) {
      return interaction.editReply({
        content: '❌ No ticket category is configured. Please ask an admin to set it up via `/setup` → Ticket Settings.',
      });
    }

    const result = await createTicketChannel(interaction.guild, interaction.user, TICKET_TYPES.FOLLOWERS, {
      robloxUsername,
    });

    if (result.error) {
      return interaction.editReply({ content: `❌ ${result.error}` });
    }

    await sendTicketGreeting(result.channel, interaction.user, TICKET_TYPES.FOLLOWERS, { robloxUsername });

    return interaction.editReply({
      content: `✅ Your Followers ticket has been created: <#${result.channel.id}>`,
    });
  }
}

// ---------------------------------------------------------------------------
// Handle ticket panel dropdown selection (the actual ticket opening flow)
// ---------------------------------------------------------------------------

export async function handleTicketPanelSelect(interaction) {
  if (interaction.customId !== 'ticket_panel_select') return;

  const guildId = interaction.guild?.id;
  const value = interaction.values[0];

  // value format: ticket_open_<buttonId>
  const buttonId = value.replace('ticket_open_', '');

  const buttons = await getTicketButtons(guildId);
  const button = buttons.find((b) => b.id === buttonId);

  if (!button) {
    return interaction.reply({
      content: '❌ That ticket option no longer exists.',
      ephemeral: true,
    });
  }

  const ticketType = button.type;
  const userId = interaction.user.id;

  // Duplicate check: one ticket per user per type per guild
  const existing = await getTicket(guildId, userId, ticketType);
  if (existing) {
    if (existing.status === 'open') {
      return interaction.reply({
        content: `You already have an open ${ticketType} ticket: <#${existing.channelId}>`,
        ephemeral: true,
      });
    }
    return interaction.reply({
      content: `You already have a ${ticketType} ticket that is **${existing.status}**: <#${existing.channelId}>\nA staff member can reopen it for you.`,
      ephemeral: true,
    });
  }

  // Check category is configured
  const settings = await getTicketSettings(guildId);
  if (!settings?.ticketCategoryId) {
    return interaction.reply({
      content: '❌ No ticket category is configured. Please ask an admin to set it up via `/setup` → Ticket Settings.',
      ephemeral: true,
    });
  }

  // Support → modal
  if (ticketType === TICKET_TYPES.SUPPORT) {
    const modal = new ModalBuilder()
      .setCustomId('ticket_modal_support')
      .setTitle('🛠️ Support Ticket')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('support_reason')
            .setLabel("What's the reason for opening this ticket?")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Describe your issue...')
            .setRequired(true)
            .setMaxLength(1000)
        )
      );
    await interaction.showModal(modal);
    return;
  }

  // Invite Rewards → modal
  if (ticketType === TICKET_TYPES.INVITE_REWARDS) {
    const modal = new ModalBuilder()
      .setCustomId('ticket_modal_invite')
      .setTitle('👥 Invite Rewards Ticket')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('roblox_username')
            .setLabel('Roblox Username')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter your Roblox username...')
            .setRequired(true)
            .setMaxLength(100)
        )
      );
    await interaction.showModal(modal);
    return;
  }

  // Followers → modal
  if (ticketType === TICKET_TYPES.FOLLOWERS) {
    const modal = new ModalBuilder()
      .setCustomId('ticket_modal_followers')
      .setTitle('👤 Followers Ticket')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('roblox_username')
            .setLabel('Roblox Username')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter your Roblox username...')
            .setRequired(true)
            .setMaxLength(100)
        )
      );
    await interaction.showModal(modal);
    return;
  }

  // Giveaway → create directly (no modal)
  if (ticketType === TICKET_TYPES.GIVEAWAY) {
    await interaction.deferReply({ ephemeral: true });

    const result = await createTicketChannel(interaction.guild, interaction.user, TICKET_TYPES.GIVEAWAY, {
      giveawayProofStatus: 'pending',
    });

    if (result.error) {
      return interaction.editReply({ content: `❌ ${result.error}` });
    }

    await sendTicketGreeting(result.channel, interaction.user, TICKET_TYPES.GIVEAWAY);

    return interaction.editReply({
      content: `✅ Your Giveaway ticket has been created: <#${result.channel.id}>`,
    });
  }
}

// ---------------------------------------------------------------------------
// Permission helper: is the member Ticket Staff or Admin?
// ---------------------------------------------------------------------------

async function isTicketStaff(interaction, staffRoleId) {
  if (isAdmin(interaction.member)) return true;
  if (staffRoleId && interaction.member.roles.cache.has(staffRoleId)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// 🛄 Claim button — Ticket Staff / Admins only
// ---------------------------------------------------------------------------

export async function handleTicketClaimButton(interaction) {
  if (interaction.customId !== 'ticket_claim') return;

  const guildId = interaction.guild?.id;
  const channelId = interaction.channel.id;

  const ticket = await getTicketByChannel(guildId, channelId);
  if (!ticket) {
    return interaction.reply({
      content: '❌ This channel is not a ticket channel.',
      ephemeral: true,
    });
  }

  const settings = await getTicketSettings(guildId);
  const staffRoleId = settings?.ticketStaffRoleId;

  const staffMember = await isTicketStaff(interaction, staffRoleId);
  if (!staffMember) {
    return interaction.reply({
      content: 'Only Ticket Staff or Administrators can claim tickets.',
      ephemeral: true,
    });
  }

  // Already claimed — prevent duplicate claims
  if (ticket.claimStaffId) {
    return interaction.reply({
      content: `This ticket has already been claimed by <@${ticket.claimStaffId}>.`,
      ephemeral: true,
    });
  }

  await interaction.deferUpdate();

  await updateTicket(guildId, channelId, {
    claimStaffId: interaction.user.id,
    updatedAt: Date.now(),
  });

  // Update the greeting message controls to show claimed state
  const claimEmbed = new EmbedBuilder()
    .setTitle('🛄 Ticket Claimed')
    .setDescription(`This ticket has been claimed by <@${interaction.user.id}>.`)
    .setColor(0x2f3136);

  await interaction.channel.send({ embeds: [claimEmbed] }).catch(() => {});

  // Update the original greeting controls (disable the claim button)
  if (ticket.greetingMessageId) {
    const greetingMsg = await interaction.channel.messages
      .fetch(ticket.greetingMessageId)
      .catch(() => null);
    if (greetingMsg) {
      await greetingMsg
        .edit({ components: [buildOpenTicketControls(interaction.user.id)] })
        .catch(() => {});
    }
  }

  await interaction.editReply({ components: [buildOpenTicketControls(interaction.user.id)] });
}

// ---------------------------------------------------------------------------
// 🔒 Close & Delete button — shows close-reason dropdown (if configured) or
// a confirmation step for permanent deletion.
// ---------------------------------------------------------------------------

export async function handleCloseDeleteButton(interaction) {
  if (interaction.customId !== 'ticket_close_delete') return;

  const guildId = interaction.guild?.id;
  const channelId = interaction.channel.id;

  const ticket = await getTicketByChannel(guildId, channelId);
  if (!ticket) {
    return interaction.reply({
      content: '❌ This channel is not a ticket channel.',
      ephemeral: true,
    });
  }

  const settings = await getTicketSettings(guildId);
  const staffRoleId = settings?.ticketStaffRoleId;
  const isCreator = ticket.creatorId === interaction.user.id;
  const staffMember = await isTicketStaff(interaction, staffRoleId);

  if (!staffMember && !isCreator) {
    return interaction.reply({
      content: 'You do not have permission to close this ticket.',
      ephemeral: true,
    });
  }

  // If the ticket is already closed, show the permanent-delete confirmation
  if (ticket.status === 'closed') {
    const confirmEmbed = new EmbedBuilder()
      .setTitle('⚠️ Permanently Delete Ticket?')
      .setDescription(
        'This will **permanently delete** this ticket channel and its records.\n' +
        'This action cannot be undone.'
      )
      .setColor(0xed4245);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_delete_confirm')
        .setLabel('Delete Permanently')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('ticket_delete_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({ embeds: [confirmEmbed], components: [row], ephemeral: true });
  }

  // Ticket is open — show close-reason dropdown
  const closeReasons = await getCloseReasons(guildId);

  if (closeReasons.length === 0) {
    // No reasons configured — close without a reason
    await interaction.deferUpdate();

    await closeTicket(interaction, ticket, settings, null);

    const embed = new EmbedBuilder()
      .setTitle('Ticket Closed')
      .setDescription('Reason: No reason provided (no close reasons configured)')
      .setColor(0x2f3136);

    await interaction.followUp({ embeds: [embed], ephemeral: true }).catch(() => {});
    return;
  }

  const options = closeReasons.map((r) => ({
    label: r.label.slice(0, 100),
    value: r.id,
    description: 'Select this close reason',
    emoji: r.emoji || undefined,
  }));

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ticket_close_reason_select')
      .setPlaceholder('Select a close reason...')
      .addOptions(options)
  );

  const embed = new EmbedBuilder()
    .setTitle('🔒 Close Ticket')
    .setDescription('Select a reason for closing this ticket.')
    .setColor(0x2f3136);

  return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

// ---------------------------------------------------------------------------
// Close reason select menu — closes the ticket with the chosen reason
// ---------------------------------------------------------------------------

export async function handleCloseReasonSelect(interaction) {
  if (interaction.customId !== 'ticket_close_reason_select') return;

  const guildId = interaction.guild?.id;
  const channelId = interaction.channel.id;

  const ticket = await getTicketByChannel(guildId, channelId);
  if (!ticket) {
    return interaction.reply({
      content: '❌ This channel is not a ticket channel.',
      ephemeral: true,
    });
  }

  const settings = await getTicketSettings(guildId);
  const staffRoleId = settings?.ticketStaffRoleId;
  const isCreator = ticket.creatorId === interaction.user.id;
  const staffMember = await isTicketStaff(interaction, staffRoleId);

  if (!staffMember && !isCreator) {
    return interaction.reply({
      content: 'You do not have permission to close this ticket.',
      ephemeral: true,
    });
  }

  const reasonId = interaction.values[0];
  const closeReasons = await getCloseReasons(guildId);
  const reason = closeReasons.find((r) => r.id === reasonId);
  const reasonLabel = reason ? reason.label : 'Unknown';

  await interaction.deferUpdate();

  await closeTicket(interaction, ticket, settings, reasonLabel);

  const embed = new EmbedBuilder()
    .setTitle('Ticket Closed')
    .setDescription(`Reason: ${reasonLabel}`)
    .setColor(0x2f3136);

  await interaction.editReply({ embeds: [embed], components: [] });
}

// ---------------------------------------------------------------------------
// Shared close logic: update DB, lock creator, post closed controls
// ---------------------------------------------------------------------------

async function closeTicket(interaction, ticket, settings, reasonLabel) {
  const guildId = interaction.guild.id;
  const channelId = interaction.channel.id;
  const staffRoleId = settings?.ticketStaffRoleId;
  const now = Date.now();

  await updateTicket(guildId, channelId, {
    status: 'closed',
    closeReason: reasonLabel,
    closedAt: now,
    updatedAt: now,
  });

  // Lock the creator out of sending messages (keep view access)
  await lockTicketForCreator(interaction.guild, interaction.channel, ticket.creatorId, staffRoleId);

  // Post a closed embed in the ticket channel with Reopen + Close&Delete
  const closedEmbed = new EmbedBuilder()
    .setTitle('🔒 Ticket Closed')
    .setDescription(
      `This ticket has been closed by <@${interaction.user.id}>.\n` +
      (reasonLabel ? `**Reason:** ${reasonLabel}\n` : '') +
      'Staff can reopen it, or use Close & Delete to permanently delete it.'
    )
    .setColor(0x2f3136);

  await interaction.channel
    .send({ content: `<@${ticket.creatorId}>`, embeds: [closedEmbed], components: [buildClosedTicketControls()] })
    .catch(() => {});

  // Update the original greeting message controls
  if (ticket.greetingMessageId) {
    const greetingMsg = await interaction.channel.messages
      .fetch(ticket.greetingMessageId)
      .catch(() => null);
    if (greetingMsg) {
      await greetingMsg.edit({ components: [buildClosedTicketControls()] }).catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// 🔓 Reopen button — Ticket Staff / Admins only, on closed tickets
// ---------------------------------------------------------------------------

export async function handleTicketReopenButton(interaction) {
  if (interaction.customId !== 'ticket_reopen') return;

  const guildId = interaction.guild?.id;
  const channelId = interaction.channel.id;

  const ticket = await getTicketByChannel(guildId, channelId);
  if (!ticket) {
    return interaction.reply({
      content: '❌ This channel is not a ticket channel.',
      ephemeral: true,
    });
  }

  const settings = await getTicketSettings(guildId);
  const staffRoleId = settings?.ticketStaffRoleId;
  const staffMember = await isTicketStaff(interaction, staffRoleId);

  if (!staffMember) {
    return interaction.reply({
      content: 'Only Ticket Staff or Administrators can reopen tickets.',
      ephemeral: true,
    });
  }

  await interaction.deferUpdate();

  // Restore full chat permissions for the creator
  await unlockTicketForCreator(interaction.guild, interaction.channel, ticket.creatorId, staffRoleId);

  await updateTicket(guildId, channelId, {
    status: 'open',
    closedAt: null,
    reopenedAt: Date.now(),
    updatedAt: Date.now(),
  });

  const reopenEmbed = new EmbedBuilder()
    .setTitle('🔓 Ticket Reopened')
    .setDescription(
      `This ticket has been reopened by <@${interaction.user.id}>.\n` +
      `<@${ticket.creatorId}>, you can send messages again.`
    )
    .setColor(0x2f3136);

  await interaction.channel
    .send({ content: `<@${ticket.creatorId}>`, embeds: [reopenEmbed], components: [buildOpenTicketControls(ticket.claimStaffId)] })
    .catch(() => {});

  // Update the original greeting message controls
  if (ticket.greetingMessageId) {
    const greetingMsg = await interaction.channel.messages
      .fetch(ticket.greetingMessageId)
      .catch(() => null);
    if (greetingMsg) {
      await greetingMsg.edit({ components: [buildOpenTicketControls(ticket.claimStaffId)] }).catch(() => {});
    }
  }

  await interaction.editReply({ components: [buildOpenTicketControls(ticket.claimStaffId)] });
}

// ---------------------------------------------------------------------------
// Delete confirmation buttons (confirm / cancel)
// ---------------------------------------------------------------------------

export async function handleTicketDeleteConfirm(interaction) {
  if (
    interaction.customId !== 'ticket_delete_confirm' &&
    interaction.customId !== 'ticket_delete_cancel'
  ) {
    return;
  }

  const guildId = interaction.guild?.id;
  const channelId = interaction.channel.id;

  const ticket = await getTicketByChannel(guildId, channelId);
  if (!ticket) {
    return interaction.reply({
      content: '❌ This channel is not a ticket channel.',
      ephemeral: true,
    });
  }

  const settings = await getTicketSettings(guildId);
  const staffRoleId = settings?.ticketStaffRoleId;
  const staffMember = await isTicketStaff(interaction, staffRoleId);

  if (!staffMember) {
    return interaction.reply({
      content: 'Only Ticket Staff or Administrators can permanently delete tickets.',
      ephemeral: true,
    });
  }

  // Cancel
  if (interaction.customId === 'ticket_delete_cancel') {
    await interaction.update({ content: '❌ Deletion cancelled.', embeds: [], components: [] });
    return;
  }

  // Confirm — permanently delete
  await interaction.deferUpdate();

  await deleteTicketRecord(guildId, channelId);

  try {
    await interaction.channel.delete('Ticket permanently deleted.');
  } catch (error) {
    console.error('Ticket: failed to delete channel:', error.message);
  }
}

// ---------------------------------------------------------------------------
// /delete button — show configured ticket options in a dropdown
// ---------------------------------------------------------------------------

export async function handleDeleteButtonSelect(interaction) {
  if (interaction.customId !== 'ticket_delete_button_select') return;

  const guildId = interaction.guild?.id;
  if (!isAdmin(interaction.member)) {
    return interaction.reply({
      content: 'You do not have permission to do this.',
      ephemeral: true,
    });
  }

  await interaction.deferUpdate();

  const buttonId = interaction.values[0];
  const buttons = await getTicketButtons(guildId);
  const button = buttons.find((b) => b.id === buttonId);

  if (!button) {
    return interaction.editReply({ content: '❌ That ticket option no longer exists.' });
  }

  await deleteTicketButton(guildId, buttonId);

  // Update the panel message if one is configured
  const settings = await getTicketSettings(guildId);
  if (settings?.mainPanelMessageId) {
    await updateTicketPanelMessage(interaction.guild, settings.mainPanelMessageId);
  }

  return interaction.editReply({
    content: `✅ Deleted ticket option **${button.emoji} ${button.name}** (${button.type}). The ticket panel has been updated.`,
  });
}
