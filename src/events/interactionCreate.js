export const name = 'interactionCreate';

export async function execute(interaction) {
  if (!interaction.isChatInputCommand()) return;

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
}
