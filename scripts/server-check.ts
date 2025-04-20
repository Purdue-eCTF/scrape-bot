import { ActivityType, Client } from 'discord.js';
import { DISCORD_TOKEN } from '../auth';


const client = new Client({
    intents: [
        "Guilds",
        "GuildMessages",
        "GuildPresences",
        "GuildMembers",
        "GuildMessageReactions",
    ],
    presence: { activities: [{ type: ActivityType.Watching, name: 'the eCTF scoreboard' }] },
    allowedMentions: { repliedUser: false }
});

client.once('ready', async () => {
    for (const g of client.guilds.cache.values()) {
        console.log(g.id, g.name);
    }
});

void client.login(DISCORD_TOKEN)
