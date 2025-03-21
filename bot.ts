import { ActivityType, AttachmentBuilder, ChannelType, Client, CommandInteraction, EmbedBuilder } from 'discord.js';
import { CronJob } from 'cron';
import express from 'express';
import bodyParser from 'body-parser';

// Modules
import { BuildStatusUpdateReq, formatCommitShort, formatPiStatus, statusToColor } from './modules/status';
import { fetchAndUpdateScoreboard, lastUpdated, scoreboard } from './modules/scoreboard';
import { challenges, ctfdClient, fetchAndUpdateChallenges, wrapFlagForChallenge } from './modules/challenges';
import { initTargetsRepo, loadTargetFromSlackUrl, lock, slack, writePortsFile } from './modules/slack';
import {
    formatAttackOutput,
    formatCustomAttackOutput,
    runAttacksOnLocalTarget,
    runCustomAttackOnTarget
} from './modules/attack';
import { paginate, textEmbed } from './util/embeds';
import { execAsync } from './util/exec';
import { chunked } from './util/misc';

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
    if (!channel?.isSendable()) return;

    await channel.send({ embeds: [diffEmbed] });
}

export async function notifyTargetPush(name: string, ip: string, portLow: number, portHigh: number) {
    const attackThreadsChannel = client.channels.cache.get(ATTACK_FORUM_CHANNEL_ID);
    if (attackThreadsChannel?.type !== ChannelType.GuildForum) return;

    // If the channel already exists, use it; otherwise, make a new channel.
    let attackThread = attackThreadsChannel.threads.cache.find((c) => c.name === name);
    if (!attackThread) {
        const targetEmbed = new EmbedBuilder()
            .setTitle(name)
            .setDescription(`- IP: ${ip}\n- Ports: ${portLow}-${portHigh}`)
            .setColor('#C61130')
            .setTimestamp();

        attackThread = await attackThreadsChannel.threads.create({
            name,
            message: { embeds: [targetEmbed] }
        });

        // Pin ports info message
        const message = await attackThread.fetchStarterMessage();
        await message?.pin();
    }

    const pushEmbed = new EmbedBuilder()
        .setTitle('New target pushed to targets repository')
        .setDescription(`**${name}** (\`${name}_package.zip\`):\n- IP: ${ip}\n- Ports: ${portLow}-${portHigh}\nDiscussion: ${attackThread}`)
        .setColor('#C61130')
        .setTimestamp();

    const channel = client.channels.cache.get(ATTACK_NOTIFY_CHANNEL_ID);
    if (!channel?.isSendable()) return;

    await channel.send({ embeds: [pushEmbed] });

    return attackThread;
}

export async function updateInfoForTeam(name: string, ip: string, portLow: number, portHigh: number) {
    const attackThreadsChannel = client.channels.cache.get(ATTACK_FORUM_CHANNEL_ID);
    if (attackThreadsChannel?.type !== ChannelType.GuildForum) return;

    const attackThread = attackThreadsChannel.threads.cache.find((c) => c.name === name);
    if (!attackThread) return;

    const targetEmbed = new EmbedBuilder()
        .setTitle(name)
        .setDescription(`- IP: ${ip}\n- Ports: ${portLow}-${portHigh}`)
        .setColor('#C61130')
        .setTimestamp();

    const message = await attackThread.fetchStarterMessage();
    if (!message?.editable) {
        // TODO: handle this
        return;
    } else {
        await message.edit({ embeds: [targetEmbed] })
    }

    const resEmbed = new EmbedBuilder()
        .setDescription(`IP and port updated for \`${name}\`.\n[[Jump to message]](${message.url})`)
        .setColor('#C61130')

    await attackThread.send({ embeds: [resEmbed] });
}

async function updateBuildStatus(req: BuildStatusUpdateReq) {
    const channel = client.channels.cache.get(STATUS_CHANNEL_ID);
    if (!channel?.isSendable())
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

        if (failureChannel?.isSendable())
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
            const sortedScoreboard = Object.values(scoreboard)
                .toSorted((a, b) => a.rank - b.rank)

            const scoreboardPages = chunked(sortedScoreboard, 10).map((chunk) => {
                const desc = chunk
                    .map((data) => `${data.rank}. [${data.name}](${data.href}) — ${data.points} points`)
                    .join('\n')

                return new EmbedBuilder()
                    .setTitle('eCTF scoreboard')
                    .setDescription(desc)
                    .setColor('#C61130')
                    .setFooter({ text: `Last fetched ${lastUpdated.toLocaleString()}` })
                    .setTimestamp();
            });

            return paginate(interaction, scoreboardPages);

        case 'refresh':
            await fetchAndUpdateScoreboard();
            return void interaction.reply({ embeds: [textEmbed('Refreshed eCTF scoreboard data.')] });

        case 'report':
            await broadcastDiffs(interaction);
            return;

        case 'challenges':
            const sortedChalls = challenges
                .filter((c) => !c.solved_by_me && !c.name.endsWith(' - Late'))
                .toSorted((a, b) => (b.solves - a.solves) || (b.value - a.value));

            const challengesPages = chunked(sortedChalls, 10).map((chunk, i) => {
                const desc = chunk
                    .map((c, j) => `${(i * 10) + j + 1}. **${c.name}** (${c.value} pts): solved by ${c.solves}`)
                    .join('\n');

                return new EmbedBuilder()
                    .setTitle('eCTF challenges')
                    .setDescription(`Remaining challenges by solves and points:\n${desc}`)
                    .setColor('#C61130')
                    .setTimestamp();
            });

            return paginate(interaction, challengesPages);

        case 'submit':
            const id = interaction.options.getInteger('challenge', true);
            const challName = challenges.find((c) => c.id === id)!.name;

            const flag = wrapFlagForChallenge(challName, interaction.options.getString('flag', true));
            const res = await ctfdClient.submitFlag(id, flag);

            const submitEmbed = new EmbedBuilder()
                .setTitle(`Flag submission for \`${challName}\``)
                .setDescription(`**Flag:** \`${flag}\`\n**Status:** ${res.status}\n**Message:** ${res.message}`)
                .setColor('#C61130')
                .setTimestamp();
            return interaction.reply({ embeds: [submitEmbed] });

        case 'load':
            const url = interaction.options.getString('url', true);
            await interaction.deferReply();

            await loadTargetFromSlackUrl(url);
            return interaction.editReply({ embeds: [textEmbed('Loaded new target.')] });

        case 'attack':
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'target') {
                const target = interaction.options.getString('target', true);

                const attackThreadsChannel = client.channels.cache.get(ATTACK_FORUM_CHANNEL_ID);
                if (attackThreadsChannel?.type !== ChannelType.GuildForum)
                    return interaction.reply({ embeds: [textEmbed(`Could not find attack forum channel.`)] });

                const attackThread = attackThreadsChannel.threads.cache.find((c) => c.name === target);
                if (!attackThread)
                    return interaction.reply({ embeds: [textEmbed(`Could not find thread for team \`${target}\`.`)] });

                // Reply with ack embed
                await interaction.reply({ embeds: [textEmbed(`Queued automated attacks for team \`${target}\`.`)] });

                // When attacks resolve, send it in the appropriate attack thread.
                const [logs, alerts] = await runAttacksOnLocalTarget(target);
                await attackThread.send({
                    content: formatAttackOutput(target, alerts),
                    files: [new AttachmentBuilder(Buffer.from(logs)).setName('logs.txt')]
                });
            } else if (subcommand === 'custom') {
                const target = interaction.options.getString('target', true);

                const script = interaction.options.getAttachment('script', true);
                if (!script.name.endsWith('.py'))
                    return interaction.reply({ embeds: [textEmbed(`Attack must be a valid \`.py\` file.`)] });

                const attackThreadsChannel = client.channels.cache.get(ATTACK_FORUM_CHANNEL_ID);
                if (attackThreadsChannel?.type !== ChannelType.GuildForum)
                    return interaction.reply({ embeds: [textEmbed(`Could not find attack forum channel.`)] });

                const attackThread = attackThreadsChannel.threads.cache.find((c) => c.name === target);
                if (!attackThread)
                    return interaction.reply({ embeds: [textEmbed(`Could not find thread for team \`${target}\`.`)] });

                // Reply with ack embed
                await interaction.reply({ embeds: [textEmbed(`Queued custom attack for team \`${target}\`.`)] });

                // When attacks resolve, send it in the appropriate attack thread.
                const [logs, alerts] = await runCustomAttackOnTarget(target, script.url);
                await attackThread.send({
                    content: formatCustomAttackOutput(target, alerts, interaction.user),
                    files: [new AttachmentBuilder(Buffer.from(logs)).setName('logs.txt')]
                });
            } else if (subcommand === 'update') {
                const target = interaction.options.getString('target', true);
                const ip = interaction.options.getString('ip', true);
                const portLow = interaction.options.getInteger('port_low', true);
                const portHigh = interaction.options.getInteger('port_high', true);

                await updateInfoForTeam(target, ip, portLow, portHigh);

                await writePortsFile(target, ip, portLow, portHigh);
                await lock.acquire('git', async () => {
                    await execAsync(`cd temp && git pull --ff-only && git add "${target}/" && git -c user.name="eCTF scrape bot" -c user.email="purdue@ectf.fake" commit -m "Update ports for ${target}" && git push`);
                });

                const successEmbed = new EmbedBuilder()
                    .setDescription('Successfully updated target info.')
                    .setColor('#C61130')
                await interaction.reply({ embeds: [successEmbed] });
            }

            break;
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isAutocomplete()) return;
    const input = interaction.options.getFocused();

    switch (interaction.commandName) {
        case 'submit':
            const challs = challenges
                .filter(((c) => !c.solved_by_me && c.name.toLowerCase().includes(input.toLowerCase())))
                .map((c) => ({ name: c.name, value: c.id }))
                .slice(0, 25)

            return interaction.respond(challs);

        case 'attack':
            // TODO: switch on subcommand?

            const attackThreadsChannel = client.channels.cache.get(ATTACK_FORUM_CHANNEL_ID);
            if (attackThreadsChannel?.type !== ChannelType.GuildForum)
                return interaction.respond([]);

            const targets = attackThreadsChannel.threads.cache
                .filter((c) => c.name.toLowerCase().includes(input.toLowerCase()))
                .map((c) => ({ name: c.name, value: c.name }))
                .slice(0, 25)

            return interaction.respond(targets);
    }
});

void initTargetsRepo();

void fetchAndUpdateScoreboard(true);
setInterval(fetchAndUpdateScoreboard, 1000 * 60);

void fetchAndUpdateChallenges();
setInterval(fetchAndUpdateChallenges, 1000 * 60);

void client.login(DISCORD_TOKEN);
void slack.start(BOLT_PORT);
