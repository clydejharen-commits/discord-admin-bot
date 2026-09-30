import { registerCommands } from '../utils/register-commands.js';

export const name = 'ready';
export const once = true;

export async function execute(client) {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Bot is online and ready in ${client.guilds.cache.size} guild(s).`);

  try {
    await registerCommands();
  } catch (error) {
    console.error('Failed to register slash commands on startup:', error);
  }
}
