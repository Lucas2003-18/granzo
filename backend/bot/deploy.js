require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { REST, Routes } = require("discord.js");
const fs   = require("fs");
const path = require("path");

const commands = [];
const dir = path.join(__dirname, "commands");
for (const file of fs.readdirSync(dir).filter(f => f.endsWith(".js"))) {
  const cmd = require(path.join(dir, file));
  commands.push(cmd.data.toJSON());
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  console.log(`Registrando ${commands.length} slash command(s)...`);
  const route = process.env.DISCORD_GUILD_ID
    ? Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID)
    : Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);
  await rest.put(route, { body: commands });
  console.log("Slash commands registrados com sucesso!");
})();
