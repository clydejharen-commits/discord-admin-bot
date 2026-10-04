import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { config, validateConfig } from './config.js';
import { connectDatabase } from './utils/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.commands = new Map();

async function loadCommands() {
  const commandsPath = join(__dirname, 'commands');
  const commandFiles = readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = pathToFileURL(join(commandsPath, file)).href;
    const command = await import(filePath);
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
      console.log(`Loaded command: ${command.data.name}`);
    } else {
      console.warn(`Command file ${file} is missing required "data" or "execute" export.`);
    }
  }
}

async function loadEvents() {
  const eventsPath = join(__dirname, 'events');
  const eventFiles = readdirSync(eventsPath).filter((f) => f.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = pathToFileURL(join(eventsPath, file)).href;
    const event = await import(filePath);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
    console.log(`Loaded event: ${event.name}`);
  }
}

async function main() {
  validateConfig();
  await connectDatabase();
  await loadCommands();
  await loadEvents();
  await client.login(config.token);
}

main().catch((error) => {
  console.error('Failed to start the bot:', error);
  process.exit(1);
});
