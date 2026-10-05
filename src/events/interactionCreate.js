import { handleSetupInteraction, handleAppearanceModalSubmit } from '../utils/setup-interactions.js';
import {
  handleTicketPanelSelect,
  handleTicketModalSubmit,
  handleTicketClaimButton,
  handleCloseDeleteButton,
  handleCloseReasonSelect,
  handleTicketReopenButton,
  handleTicketDeleteConfirm,
  handleDeleteButtonSelect,
} from '../utils/ticket-interactions.js';

export const name = 'interactionCreate';

export async function execute(interaction) {
  if (interaction.isChatInputCommand()) {
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.warn(`Unknown command received: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing command ${interaction.commandName}:`, error);

      const payload = {
        content: 'An error occurred while executing this command.',
        ephemeral: true,
      };

      if (interaction.deferred) {
        await interaction.editReply(payload).catch(() => {});
      } else if (interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    // Appearance modals
    if (interaction.customId.startsWith('appearance_modal_')) {
      try {
        await handleAppearanceModalSubmit(interaction);
      } catch (error) {
        console.error('Error handling appearance modal submit:', error);

        const payload = {
          content: 'An error occurred while processing your input.',
          ephemeral: true,
        };

        if (interaction.deferred) {
          await interaction.editReply(payload).catch(() => {});
        } else if (interaction.replied) {
          await interaction.followUp(payload).catch(() => {});
        } else {
          await interaction.reply(payload).catch(() => {});
        }
      }
      return;
    }

    // Ticket modals
    if (interaction.customId.startsWith('ticket_modal_')) {
      try {
        await handleTicketModalSubmit(interaction);
      } catch (error) {
        console.error('Error handling ticket modal submit:', error);

        const payload = {
          content: 'An error occurred while processing your ticket.',
          ephemeral: true,
        };

        if (interaction.deferred) {
          await interaction.editReply(payload).catch(() => {});
        } else if (interaction.replied) {
          await interaction.followUp(payload).catch(() => {});
        } else {
          await interaction.reply(payload).catch(() => {});
        }
      }
      return;
    }
  }

  // Ticket panel dropdown selection
  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_panel_select') {
    try {
      await handleTicketPanelSelect(interaction);
    } catch (error) {
      console.error('Error handling ticket panel select:', error);

      const payload = {
        content: 'An error occurred while opening this ticket.',
        ephemeral: true,
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
    return;
  }

  // /delete button dropdown selection
  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_delete_button_select') {
    try {
      await handleDeleteButtonSelect(interaction);
    } catch (error) {
      console.error('Error handling delete button select:', error);

      const payload = {
        content: 'An error occurred while deleting this ticket option.',
        ephemeral: true,
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
    return;
  }

  // Close reason select menu
  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_close_reason_select') {
    try {
      await handleCloseReasonSelect(interaction);
    } catch (error) {
      console.error('Error handling close reason select:', error);

      const payload = {
        content: 'An error occurred while closing this ticket.',
        ephemeral: true,
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
    return;
  }

  // Ticket claim / close&delete / reopen / delete-confirm / delete-cancel buttons
  if (
    interaction.isButton() &&
    (interaction.customId === 'ticket_claim' ||
      interaction.customId === 'ticket_close_delete' ||
      interaction.customId === 'ticket_reopen' ||
      interaction.customId === 'ticket_delete_confirm' ||
      interaction.customId === 'ticket_delete_cancel')
  ) {
    try {
      if (interaction.customId === 'ticket_claim') {
        await handleTicketClaimButton(interaction);
      } else if (interaction.customId === 'ticket_close_delete') {
        await handleCloseDeleteButton(interaction);
      } else if (interaction.customId === 'ticket_reopen') {
        await handleTicketReopenButton(interaction);
      } else {
        await handleTicketDeleteConfirm(interaction);
      }
    } catch (error) {
      console.error('Error handling ticket button:', error);

      const payload = {
        content: 'An error occurred while handling this ticket action.',
        ephemeral: true,
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
    return;
  }

  if (interaction.isButton() || interaction.isAnySelectMenu()) {
    try {
      await handleSetupInteraction(interaction);
    } catch (error) {
      console.error('Error handling component interaction:', error);

      const payload = {
        content: 'An error occurred while handling this interaction.',
        ephemeral: true,
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
    return;
  }
}
