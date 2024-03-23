import express from 'express';
import bodyParser from 'body-parser';
import {ActivityType, Client, CommandInteraction, EmbedBuilder} from 'discord.js';
import {CronJob} from 'cron';

// Modules
import {BuildStatusUpdateReq, formatCommitShort, formatPiStatus, statusToColor} from './status';
import {fetchAndUpdateScoreboard, lastUpdated, scoreboard, top5} from './scoreboard';

// Config
import {failureChannelId, notifyChannelId, port, statusChannelId, statusMessageId, token} from './auth';
import {generateScript} from './flags';


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

let broadcastDiffsJob: CronJob;

async function broadcastDiffs(interaction?: CommandInteraction) {
    const totalDiffs: string[] = [];

    for (const team of Object.values(scoreboard)) {
        // Construct diff string if fields change
        const diffs: string[] = [];

        if (team.prevPoints !== team.points)
            diffs.push(`[points: ${team.prevPoints} → ${team.points}]`)
        if (team.prevAchievements !== team.achievements)
            diffs.push(`[achievements: ${team.prevAchievements} → ${team.achievements}]`)

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
        return await interaction.reply({embeds: [diffEmbed]});

    const channel = client.channels.cache.get(notifyChannelId);
    if (!channel?.isTextBased()) return;

    await channel.send({embeds: [diffEmbed]});
}

async function updateBuildStatus(req: BuildStatusUpdateReq) {
    const channel = client.channels.cache.get(statusChannelId);
    if (!channel?.isTextBased())
        return console.error('Could not find build status channel!');

    const message = channel.messages.cache.get(statusMessageId)
        || await channel.messages.fetch(statusMessageId)
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
            {name: 'Pis', value: piStatus},
            {name: 'Building:', value: buildStatus},
            {name: 'Queued:', value: queueStatus}
        )
        .setColor(color)
        .setTimestamp()

    // Report build failures to the appropriate channel
    if (
        (req.update.type === 'BUILD' || req.update.type === 'TEST')
        && req.update.state.result === 'FAILED'
    ) {
        const runHref = `https://github.com/Purdue-eCTF-2024/2024-ectf-secure-example/actions/runs/${req.update.state.commit.runId}`;

        const failureChannel = client.channels.cache.get(failureChannelId);

        const failureEmbed = new EmbedBuilder()
            .setTitle(`${req.update.type === 'BUILD' ? 'Build' : 'Tests'} failed for commit`)
            .setColor(0xb50300)
            .setDescription(`[\`${req.update.state.commit.hash.slice(0, 7)}\`]: ${req.update.state.commit.name} (@${req.update.state.commit.author})\n[[Jump to failed workflow]](${runHref})`)
            .setTimestamp()

        if (failureChannel?.isTextBased())
            failureChannel.send({embeds: [failureEmbed]})
    }

    if (!message?.editable) return channel.send({embeds: [statusEmbed]});
    return message.edit({embeds: [statusEmbed]});
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

        case 'report':
            await broadcastDiffs(interaction);
            return;

        case 'submit':
            const team = interaction.options.get('team')?.value;
            if (typeof team !== 'string') return;

            const flag = interaction.options.get('flag')?.value;
            if (typeof flag !== 'string') return;

            const chall = interaction.options.get('challenge')?.value;
            if (typeof chall !== 'number') return;

            const delay = interaction.options.get('delay')?.value;
            const script = generateScript(team, flag, chall, delay as number | undefined);

            const scriptEmbed = new EmbedBuilder()
                .setTitle('Flag submission script')
                .setDescription(`\`\`\`js\n${script}\`\`\`\nPaste the above script into the console while logged in on \`sb.ectf.mitre.org\` to begin the flag submission process. To change any values while the script is running, edit them directly i.e\`\`\`js\nTEAM = 'UIUC'\`\`\``)
                .setColor('#C61130')
                .setTimestamp();
            return void interaction.reply({embeds: [scriptEmbed]});
    }
});

void fetchAndUpdateScoreboard(true);
setInterval(fetchAndUpdateScoreboard, 1000 * 60);

void client.login(token);
