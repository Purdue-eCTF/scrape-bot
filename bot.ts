import {ActivityType, Client, EmbedBuilder} from 'discord.js';
import {token} from './auth';


const client = new Client({
    intents: [
        "Guilds",
        "GuildMessages",
        "GuildPresences",
        "GuildMembers",
        "GuildMessageReactions",
    ],
    presence: {activities: [{type: ActivityType.Watching, name: 'the eCTF scoreboard'}]},
    allowedMentions: {repliedUser: false}
});

type TeamData = {
    name: string,
    rank: number,
    href: string,
    achievements: number,
    points: number,
}
const scoreboard: {[name: string]: TeamData} = {};
let lastUpdated: Date;
let top5: string[] = [];


async function fetchAndUpdateScoreboard() {
    const raw = await (await fetch('https://sb.ectf.mitre.org/game/summary')).text();

    const tables = raw.matchAll(/<tbody class='.*?' id='.*?'>([^]+?)<\/tbody>/g);
    let isTop = true; // TODO: hacky?

    lastUpdated = new Date();
    top5 = [];
    for (const [, raw] of tables) {
        const teams = raw.matchAll(/<tr>\s*<td>(\d+)<\/td>\s*<td class='break-word'>\s*<a href="(.+?)">(\w+)<\/a>\s*<\/td>\s*<td>(\d+)<\/td>\s*<td>(\d+)<\/td>\s*<td>[^]+?<\/td>\s*<\/tr>/g);

        for (const [, rank, href, name, achievements, points] of teams) {
            console.log(rank, href, name, achievements, points);

            scoreboard[name] = {
                name,
                rank: Number(rank),
                href: `https://sb.ectf.mitre.org${href}`,
                achievements: Number(achievements),
                points: Number(points)
            }
            if (isTop) top5.push(name);
        }

        isTop = false;
    }
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}!`);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    switch (interaction.commandName) {
        case 'scoreboard':
            const desc = top5
                .map((name) => scoreboard[name])
                .map((data) => `${data.rank}. [${data.name}](${data.href}) — ${data.points} points (${data.achievements} achievements)`)
                .join('\n')

            const scoreboardEmbed = new EmbedBuilder()
                .setTitle('eCTF Scoreboard')
                .setDescription(desc)
                .setColor('#C61130')
                .setFooter({text: `Last scraped ${lastUpdated.toLocaleString()}`})
                .setTimestamp();
            return void interaction.reply({embeds: [scoreboardEmbed]});

        case 'refresh':
            await fetchAndUpdateScoreboard();
            const refreshEmbed = new EmbedBuilder()
                .setDescription('Refreshed eCTF scoreboard data.')
                .setColor('#C61130');
            return void interaction.reply({embeds: [refreshEmbed]});
    }
});

void fetchAndUpdateScoreboard();
setInterval(fetchAndUpdateScoreboard, 1000 * 60);

void client.login(token);
