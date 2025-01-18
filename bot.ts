import { ActivityType, Client, CommandInteraction, EmbedBuilder } from 'discord.js';
import { CronJob } from 'cron';
import express from 'express';
import bodyParser from 'body-parser';

// Modules
import { BuildStatusUpdateReq, formatCommitShort, formatPiStatus, statusToColor } from './modules/status';
import { fetchAndUpdateScoreboard, lastUpdated, scoreboard, top5 } from './modules/scoreboard';
import { app, initGitRepo } from './modules/slack';

// Config
import {
    FAILURE_CHANNEL_ID,
    SCOREBOARD_NOTIFY_CHANNEL_ID,
    EXPRESS_PORT,
    STATUS_CHANNEL_ID,
    STATUS_MESSAGE_ID,
    DISCORD_TOKEN,
    BOLT_PORT,
    ATTACK_NOTIFY_CHANNEL_ID
} from './auth';


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

let broadcastDiffsJob: CronJob;

async function broadcastDiffs(interaction?: CommandInteraction) {
    const totalDiffs: string[] = [];

    for (const team of Object.values(scoreboard)) {
        // Construct diff string if fields change
        const diffs: string[] = [];

        if (team.prevPoints !== team.points)
            diffs.push(`[points: ${team.prevPoints} → ${team.points}]`)

        if (diffs.length) {
            // Push rank only if other diffs already exist so that one team jumping 15 ranks doesn't cause
            // 14 other lines of diffs.
            if (team.prevRank !== team.rank)
                diffs.push(`[rank: ${team.prevRank} → ${team.rank}]`);

            totalDiffs.push(`[${team.name}](${team.href}): ${diffs.join(' ')}`);
        }
    }

    const diffEmbed = new EmbedBuilder()
        .setTitle(`eCTF scoreboard report for ${new Date().toLocaleDateString()}`)
        .setDescription(totalDiffs.length ? totalDiffs.join('\n') : '*No scoreboard changes detected.*')
        .setColor('#C61130')
        .setTimestamp();

    if (interaction)
        return await interaction.reply({ embeds: [diffEmbed] });

    const channel = client.channels.cache.get(SCOREBOARD_NOTIFY_CHANNEL_ID);
    if (!channel?.isTextBased()) return;

    await channel.send({ embeds: [diffEmbed] });
}

export async function notifyTargetPush(messages: string[]) {
    const pushEmbed = new EmbedBuilder()
        .setTitle('New target pushed to targets repository')
        .setDescription(messages.join('\n'))
        .setColor('#C61130')
        .setTimestamp();

    const channel = client.channels.cache.get(ATTACK_NOTIFY_CHANNEL_ID);
    if (!channel?.isTextBased()) return;

    await channel.send({ embeds: [pushEmbed] });
}

async function updateBuildStatus(req: BuildStatusUpdateReq) {
    const channel = client.channels.cache.get(STATUS_CHANNEL_ID);
    if (!channel?.isTextBased())
        return console.error('[BUILD] Could not find build status channel!');

    const message = channel.messages.cache.get(STATUS_MESSAGE_ID)
        || await channel.messages.fetch(STATUS_MESSAGE_ID)
        || channel.lastMessage;

    const queueStatus = req.build.queue.map((d, i) => `${i + 1}. ${formatCommitShort(d)}`).join('\n')
        || '*No commits queued.*'
    const piStatus = req.test.activeTests.map((s, i) => `${i + 1}. ${formatPiStatus(s)}`).join('\n');
    const buildStatus = req.build.active
        ? formatCommitShort(req.build.active)
        : '*No commits loaded.*'

    const color = req.build.active
        ? statusToColor(req.build.active.result)
        : '#27272a'

    const statusEmbed = new EmbedBuilder()
        .setTitle('Secure design build status')
        .setDescription(`**Status:** ${req.build.active?.result || 'N/A'}`)
        .addFields(
            { name: 'Pis', value: piStatus },
            { name: 'Building:', value: buildStatus },
            { name: 'Queued:', value: queueStatus }
        )
        .setColor(color)
        .setTimestamp()

    // Report build failures to the appropriate channel
    if (
        (req.update.type === 'BUILD' || req.update.type === 'TEST')
        && req.update.state.result === 'FAILED'
    ) {
        const runHref = `https://github.com/Purdue-eCTF-2024/2024-ectf-secure-example/actions/runs/${req.update.state.commit.runId}`;

        const failureChannel = client.channels.cache.get(FAILURE_CHANNEL_ID);

        const failureEmbed = new EmbedBuilder()
            .setTitle(`${req.update.type === 'BUILD' ? 'Build' : 'Tests'} failed for commit`)
            .setColor(0xb50300)
            .setDescription(`[\`${req.update.state.commit.hash.slice(0, 7)}\`]: ${req.update.state.commit.name} (@${req.update.state.commit.author})\n[[Jump to failed workflow]](${runHref})`)
            .setTimestamp()

        if (failureChannel?.isTextBased())
            failureChannel.send({ embeds: [failureEmbed] })
    }

    if (!message?.editable) return channel.send({ embeds: [statusEmbed] });
    return message.edit({ embeds: [statusEmbed] });
}

const server = express();

server.use(bodyParser.json());
server.post('/', async (req, res) => {
    try {
        await updateBuildStatus(req.body);
        res.status(200).json({ ok: true });
    } catch {
        res.status(400).json({ ok: false });
    }
});
server.listen(EXPRESS_PORT, () => {
    console.log(`[BUILD] Started express server on port ${EXPRESS_PORT}`);
});

client.once('ready', async () => {
    console.log(`[DISC] Logged in as ${client.user?.tag}!`);

    // Broadcast diffs daily
    broadcastDiffsJob = CronJob.from({
        cronTime: '0 0 0 * * *',
        onTick: async () => {
            await broadcastDiffs();
            await fetchAndUpdateScoreboard(true); // Reset diffs after each day
        },
        start: true,
        timeZone: 'America/Indiana/Indianapolis',
        runOnInit: false
    });
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    switch (interaction.commandName) {
        case 'scoreboard':
            const desc = top5
                .map((name) => scoreboard[name])
                .map((data) => `${data.rank}. [${data.name}](${data.href}) — ${data.points} points`)
                .join('\n')

            const scoreboardEmbed = new EmbedBuilder()
                .setTitle('eCTF scoreboard')
                .setDescription(desc)
                .setColor('#C61130')
                .setFooter({ text: `Last fetched ${lastUpdated.toLocaleString()}` })
                .setTimestamp();
            return void interaction.reply({ embeds: [scoreboardEmbed] });

        case 'refresh':
            await fetchAndUpdateScoreboard();
            const refreshEmbed = new EmbedBuilder()
                .setDescription('Refreshed eCTF scoreboard data.')
                .setColor('#C61130');
            return void interaction.reply({ embeds: [refreshEmbed] });

        case 'report':
            await broadcastDiffs(interaction);
            return;
    }
});

void initGitRepo();

void fetchAndUpdateScoreboard(true);
setInterval(fetchAndUpdateScoreboard, 1000 * 60);

void client.login(DISCORD_TOKEN);
void app.start(BOLT_PORT);
