import { REST, Routes } from 'discord.js';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { config, validateConfig } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function getCommands() {
  const commands = [];
  const commandsPath = join(__dirname, 'commands');
  const commandFiles = readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = pathToFileURL(join(commandsPath, file)).href;
    const command = await import(filePath);
    if (command.data) {
      commands.push(command.data.toJSON());
      console.log(`Registered command: ${command.data.name}`);
    }
  }

  return commands;
}

async function main() {
  validateConfig();

  const commands = await getCommands();

  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    console.log(`Started refreshing ${commands.length} application slash command(s).`);

    let data;
    if (config.guildId) {
      data = await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commands }
      );
      console.log(`Successfully registered ${data.length} guild command(s) for guild ${config.guildId}.`);
    } else {
      data = await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands }
      );
      console.log(`Successfully registered ${data.length} global command(s).`);
    }
  } catch (error) {
    console.error('Failed to register slash commands:', error);
    process.exit(1);
  }
}

main();
