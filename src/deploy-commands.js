import { config, validateConfig } from './config.js';
import { registerCommands } from './utils/register-commands.js';

async function main() {
  validateConfig();

  try {
    await registerCommands();
    console.log('Slash command registration complete.');
  } catch (error) {
    console.error('Failed to register slash commands:', error);
    process.exit(1);
  }
}

main();
