import { registerCommands } from '../utils/register-commands.js';
import { restoreTracker } from '../services/tracker-service.js';

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

  try {
    await restoreTracker(client);
  } catch (error) {
    console.error('Failed to restore tracker on startup:', error);
  }
}
