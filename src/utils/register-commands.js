import { REST, Routes } from 'discord.js';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function getCommandData() {
  const commands = [];
  const commandsPath = join(__dirname, '..', 'commands');
  const commandFiles = readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = pathToFileURL(join(commandsPath, file)).href;
    const command = await import(filePath);
    if (command.data) {
      commands.push(command.data.toJSON());
    }
  }

  return commands;
}

export async function registerCommands() {
  const commands = await getCommandData();

  if (commands.length === 0) {
    console.warn('No slash commands found to register.');
    return [];
  }

  console.log(`Registering ${commands.length} slash command(s): ${commands.map((c) => c.name).join(', ')}`);

  const rest = new REST({ version: '10' }).setToken(config.token);

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

  return data;
}
