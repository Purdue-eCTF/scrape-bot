import { ActivityType, ChannelType, Client, CommandInteraction, EmbedBuilder } from 'discord.js';
import { CronJob } from 'cron';
import express from 'express';
import bodyParser from 'body-parser';

// Modules
import { BuildStatusUpdateReq, formatCommitShort, formatPiStatus, statusToColor } from './modules/status';
import { fetchAndUpdateScoreboard, lastUpdated, scoreboard, top5 } from './modules/scoreboard';
import { challenges, ctfdClient, fetchAndUpdateChallenges } from './modules/challenges';
import { initTargetsRepo, slack } from './modules/slack';

// Config
import { DISCORD_TOKEN } from './auth';
import {
    ATTACK_FORUM_CHANNEL_ID,
    ATTACK_NOTIFY_CHANNEL_ID,
    BOLT_PORT,
    DESIGN_REPO_URL,
    EXPRESS_PORT,
    FAILURE_CHANNEL_ID,
    SCOREBOARD_NOTIFY_CHANNEL_ID,
    STATUS_CHANNEL_ID,
    STATUS_MESSAGE_ID
} from './config';


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

export async function notifyTargetPush(name: string, ip: string, portLow: string, portHigh: string) {
    const attackThreadsChannel = client.channels.cache.get(ATTACK_FORUM_CHANNEL_ID);
    if (attackThreadsChannel?.type !== ChannelType.GuildForum) return;

    const targetEmbed = new EmbedBuilder()
        .setTitle(name)
        .setDescription(`- IP: ${ip}\n- Ports: ${portLow}-${portHigh}`)
        .setColor('#C61130')
        .setTimestamp();

    const attackThread = await attackThreadsChannel.threads.create({
        name,
        message: { embeds: [targetEmbed] }
    })

    const pushEmbed = new EmbedBuilder()
        .setTitle('New target pushed to targets repository')
        .setDescription(`**${name}** (\`${name}_package.zip\`):\n- IP: ${ip}\n- Ports: ${portLow}-${portHigh}\nDiscussion: ${attackThread}`)
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

    const color = req.status
        ? statusToColor(req.status)
        : '#27272a'

    const statusEmbed = new EmbedBuilder()
        .setTitle('Secure design build status')
        .setDescription(`**Status:** ${req.status || 'N/A'}`)
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
        const runHref = `${DESIGN_REPO_URL}/actions/runs/${req.update.state.commit.runId}`;

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
    console.log(`[BUILD] Received webhook push:\n${JSON.stringify(req.body)}`);
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
            const scoreboardDesc = top5
                .map((name) => scoreboard[name])
                .map((data) => `${data.rank}. [${data.name}](${data.href}) — ${data.points} points`)
                .join('\n')

            const scoreboardEmbed = new EmbedBuilder()
                .setTitle('eCTF scoreboard')
                .setDescription(scoreboardDesc)
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

        case 'challenges':
            const challengesDesc = challenges
                .filter((c) => !c.solved_by_me && !c.name.endsWith(' - Late'))
                .toSorted((a, b) => (b.solves - a.solves) || (b.value - a.value))
                .slice(0, 10)
                .map((c, i) => `${i + 1}. **${c.name}** (${c.value} pts): solved by ${c.solves}`)
                .join('\n');

            const challengesEmbed = new EmbedBuilder()
                .setTitle('eCTF challenges')
                .setDescription(`Top 10 remaining challenges by solves and points:\n${challengesDesc}`)
                .setColor('#C61130')
                .setTimestamp();
            return void interaction.reply({ embeds: [challengesEmbed] });

        case 'submit':
            const id = interaction.options.getInteger('challenge', true);
            const flag = interaction.options.getString('flag', true);

            const res = await ctfdClient.submitFlag(id, flag);
            const challName = challenges.find((c) => c.id === id)!.name;

            const submitEmbed = new EmbedBuilder()
                .setTitle(`Flag submission for \`${challName}\``)
                .setDescription(`**Flag:** \`${flag}\`\n**Status:** ${res.status}\n**Message:** ${res.message}`)
                .setColor('#C61130')
                .setTimestamp();
            return void interaction.reply({ embeds: [submitEmbed] });
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isAutocomplete()) return;

    const input = interaction.options.getFocused();
    const res = challenges
        .filter(((c) => !c.solved_by_me && c.name.toLowerCase().startsWith(input.toLowerCase())))
        .map((c) => ({ name: c.name, value: c.id }))
        .slice(0, 25)

    await interaction.respond(res);
});

void initTargetsRepo();

void fetchAndUpdateScoreboard(true);
setInterval(fetchAndUpdateScoreboard, 1000 * 60);

void fetchAndUpdateChallenges();
setInterval(fetchAndUpdateChallenges, 1000 * 60);

void client.login(DISCORD_TOKEN);
void slack.start(BOLT_PORT);
