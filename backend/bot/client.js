const { Client, GatewayIntentBits, Collection, Events } = require("discord.js");
const fs = require("fs");
const path = require("path");

let _client = null;

function getClient() { return _client; }

async function startBot() {
  if (!process.env.DISCORD_TOKEN) {
    console.warn("DISCORD_TOKEN não definido — bot Discord desativado.");
    return;
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  _client = client;

  client.commands = new Collection();
  const commandsDir = path.join(__dirname, "commands");
  for (const file of fs.readdirSync(commandsDir).filter(f => f.endsWith(".js"))) {
    const cmd = require(path.join(commandsDir, file));
    client.commands.set(cmd.data.name, cmd);
  }

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return;
    try {
      await cmd.execute(interaction);
    } catch (err) {
      console.error(err);
      const reply = { content: "❌ Erro ao executar o comando.", ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  });

  await client.login(process.env.DISCORD_TOKEN);
  console.log(`Bot Discord conectado como ${client.user.tag}`);
}

module.exports = { getClient, startBot };
