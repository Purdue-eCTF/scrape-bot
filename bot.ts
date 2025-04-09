import {
    ActivityType,
    ChannelType,
    Client,
    Collection,
    CommandInteraction,
    EmbedBuilder
} from 'discord.js';
import { CronJob } from 'cron';

// Modules
import { fetchAndUpdateScoreboard, scoreboard } from './modules/scoreboard';
import { Command, CommandGroup, getAllCommands } from './util/commands';

// Config
import {
    ATTACK_FORUM_CHANNEL_ID,
    ATTACK_NOTIFY_CHANNEL_ID,
    SCOREBOARD_NOTIFY_CHANNEL_ID
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

export async function attackThreadExists(name: string) {
    const attackThreadsChannel = client.channels.cache.get(ATTACK_FORUM_CHANNEL_ID);
    if (attackThreadsChannel?.type !== ChannelType.GuildForum) return;

    return attackThreadsChannel.threads.cache.some((c) => c.name === name);
}

export async function broadcastPeskySubmit(team: string, message: string) {
    const channel = client.channels.cache.get(ATTACK_NOTIFY_CHANNEL_ID);
    if (!channel?.isSendable()) return;

    const pushEmbed = new EmbedBuilder()
        .setTitle(`Pesky neighbor flag submitted for team ${team}`)
        .setDescription(message)
        .setColor('#C61130')
        .setTimestamp();

    await channel.send({ embeds: [pushEmbed] });
}

client.once('ready', async () => {
    // Load commands
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
