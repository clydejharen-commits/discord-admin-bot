import { handleSetupInteraction, handleAppearanceModalSubmit } from '../utils/setup-interactions.js';

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
