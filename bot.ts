import express from 'express';
import bodyParser from 'body-parser';
import {ActivityType, Client, EmbedBuilder} from 'discord.js';
import {statusToColor} from './messages';
import {failureChannelId, notifyChannelId, port, statusChannelId, statusMessageId, token} from './auth';


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
    console.log('Re-fetching eCTF scoreboard');
    const raw = await (await fetch('https://sb.ectf.mitre.org/game/summary')).text();

    const tables = raw.matchAll(/<tbody class='.*?' id='.*?'>([^]+?)<\/tbody>/g);
    let isTop = true; // TODO: hacky?

    lastUpdated = new Date();
    top5 = [];

    const totalDiffs: string[] = []
    for (const [, raw] of tables) {
        const teams = raw.matchAll(/<tr>\s*<td>(\d+)<\/td>\s*<td class='break-word'>\s*<a href="(.+?)">(\w+)<\/a>\s*<\/td>\s*<td>(\d+)<\/td>\s*<td>(\d+)<\/td>\s*<td>[^]+?<\/td>\s*<\/tr>/g);

        for (const [, rank, href, name, achievements, points] of teams) {
            const absoluteHref = `https://sb.ectf.mitre.org${href}`;

            // Construct diff string if fields change
            if (scoreboard[name]) {
                const diffs: string[] = [];

                if (scoreboard[name].points !== Number(points))
                    diffs.push(`[points: ${scoreboard[name].points} → ${Number(points)}]`)
                if (scoreboard[name].achievements !== Number(achievements))
                    diffs.push(`[achievements: ${scoreboard[name].achievements} → ${Number(achievements)}]`)

                if (diffs.length) {
                    // Push rank only if other diffs already exist so that one team jumping 15 ranks doesn't cause
                    // 14 other lines of diffs.
                    if (scoreboard[name].rank !== Number(rank))
                        diffs.push(`[rank: ${scoreboard[name].rank} → ${Number(rank)}]`);

                    totalDiffs.push(`[${name}](${absoluteHref}): ${diffs.join(' ')}`);
                }
            }

            scoreboard[name] = {
                name,
                rank: Number(rank),
                href: absoluteHref,
                achievements: Number(achievements),
                points: Number(points)
            }
            if (isTop) top5.push(name);
        }

        isTop = false;
    }

    // Broadcast diffs if they exist
    if (!totalDiffs.length) return;

    const channel = client.channels.cache.get(notifyChannelId);
    if (!channel?.isTextBased()) return;

    const diffEmbed = new EmbedBuilder()
        .setTitle('Detected eCTF scoreboard diffs')
        .setDescription(totalDiffs.join('\n'))
        .setColor('#C61130')
        .setTimestamp();

    await channel.send({embeds: [diffEmbed]});
}

type CommitInfo = {
    hash: string,
    name: string,
    author: string,
    runId: string,
}
export type BuildStatusUpdateReq = {
    current: CommitInfo,
    status: 'SUCCESS' | 'BUILDING' | 'TESTING' | 'FAILURE',
    queue: CommitInfo[]
}
async function updateBuildStatus(req: BuildStatusUpdateReq) {
    const channel = client.channels.cache.get(statusChannelId);
    if (!channel?.isTextBased())
        return console.error('Could not find build status channel!');

    const message = channel.messages.cache.get(statusMessageId)
        || await channel.messages.fetch(statusMessageId)
        || channel.lastMessage;

    const runHref = `https://github.com/Purdue-eCTF-2024/2024-ectf-secure-example/actions/runs/${req.current.runId}`;
    const queueStatus = req.queue.map((d, i) => `${i + 1}. ${formatCommitShort(d)}`).join('\n')
        || '*No commits queued.*'

    const statusEmbed = new EmbedBuilder()
        .setTitle('Secure design build status')
        .setDescription(`**Status:** ${req.status}`)
        .addFields(
            {name: 'Current commit:', value: formatCommitShort(req.current)},
            {name: 'Queued:', value: queueStatus}
        )
        .setColor(statusToColor(req.status))
        .setTimestamp()

    // Report build failures to the appropriate channel
    if (req.status === 'FAILURE') {
        const failureChannel = client.channels.cache.get(failureChannelId);

        const failureEmbed = new EmbedBuilder()
            .setTitle('Build failed for commit')
            .setColor(0xb50300)
            .setDescription(`[\`${req.current.hash}\`]: ${req.current.name} (@${req.current.author})\n[[Jump to failed workflow]](${runHref})`)
            .setTimestamp()

        if (failureChannel?.isTextBased())
            failureChannel.send({embeds: [failureEmbed]})
    }

    if (!message?.editable) return channel.send({embeds: [statusEmbed]});
    return message.edit({embeds: [statusEmbed]});
}

function formatCommitShort(c: CommitInfo) {
    const runHref = `https://github.com/Purdue-eCTF-2024/2024-ectf-secure-example/actions/runs/${c.runId}`;
    return `[\`${c.hash}\`]: ${c.name} (@${c.author}) [[link]](${runHref})`;
}

const server = express();

server.use(bodyParser.json());
server.post('/', async (req, res) => {
    try {
        await updateBuildStatus(req.body);
        res.status(200).json({ok: true});
    } catch {
        res.status(400).json({ok: false});
    }
});
server.listen(port, () => {
    console.log(`Started express server on port ${port}`);
});

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
                .setTitle('eCTF scoreboard')
                .setDescription(desc)
                .setColor('#C61130')
                .setFooter({text: `Last fetched ${lastUpdated.toLocaleString()}`})
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
