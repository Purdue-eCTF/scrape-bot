import {
    ActivityType,
    ChannelType,
    Client,
    Collection,
    CommandInteraction,
    EmbedBuilder
} from 'discord.js';
import { CronJob } from 'cron';
import express from 'express';
import bodyParser from 'body-parser';

// Modules
import { BuildStatusUpdateReq, formatCommitShort, formatPiStatus, statusToColor } from './modules/status';
import { fetchAndUpdateScoreboard, scoreboard } from './modules/scoreboard';
import { Command, CommandGroup, getAllCommands } from './util/commands';

// Config
import {
    ATTACK_FORUM_CHANNEL_ID,
    ATTACK_NOTIFY_CHANNEL_ID,
    DESIGN_REPO_URL,
    EXPRESS_PORT,
    FAILURE_CHANNEL_ID,
    SCOREBOARD_NOTIFY_CHANNEL_ID,
    STATUS_CHANNEL_ID,
    STATUS_MESSAGE_ID
} from './config';


declare module 'discord.js' {
    interface Client {
        commands: Collection<string, Command | CommandGroup>;
    }
}

export const client = new Client({
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

export async function broadcastDiffs(interaction?: CommandInteraction) {
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
    client.commands = new Collection();

    const commands = await getAllCommands();
    for (const command of commands) {
        console.log(`[DISC] Loaded /${command.data.name}`);
        client.commands.set(command.data.name, command);
    }

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

    const raw = client.commands.get(interaction.commandName);
    if (!raw) return;

    const command = 'commands' in raw
        ? raw.commands[interaction.options.getSubcommand()]
        : raw
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch {
        // TODO ...
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isAutocomplete()) return;

    const raw = client.commands.get(interaction.commandName);
    if (!raw) return;

    const command = 'commands' in raw
        ? raw.commands[interaction.options.getSubcommand()]
        : raw
    if (!command?.autocomplete) return;

    try {
        await command.autocomplete(interaction);
    } catch {
        // TODO ...
    }
});
