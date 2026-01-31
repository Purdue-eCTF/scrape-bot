import { ActivityType, ChannelType, Client, Collection, EmbedBuilder } from 'discord.js';
import { CronJob } from 'cron';

// Modules
import commands from './commands';
import { fetchAndUpdateScoreboard } from './modules/scoreboard';
import { Command, CommandGroup } from './util/commands';
import { generateReportEmbed } from './commands/report';

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

// Load commands
client.commands = new Collection();
for (const command of commands) {
    client.commands.set(command.data.name, command);
}

let broadcastDiffsJob: CronJob;

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
    const attackThread = await getAttackThreadIfExists(name);
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

export async function getAttackThreadIfExists(name: string) {
    const attackThreadsChannel = client.channels.cache.get(ATTACK_FORUM_CHANNEL_ID);
    if (attackThreadsChannel?.type !== ChannelType.GuildForum) return;

    return attackThreadsChannel.threads.cache.find((c) => c.name === name);
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

client.once('clientReady', async () => {
    console.log(`[DISC] Logged in as ${client.user?.tag}!`);

    // Broadcast diffs daily
    broadcastDiffsJob = CronJob.from({
        cronTime: '0 0 0 * * *',
        onTick: async () => {
            const channel = client.channels.cache.get(SCOREBOARD_NOTIFY_CHANNEL_ID);
            if (channel?.isSendable()) {
                const diffEmbed = generateReportEmbed();
                await channel.send({ embeds: [diffEmbed] });
            }

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
    } catch (e) {
        console.error(e);

        // Send error log in discord
        const errorEmbed = new EmbedBuilder()
            .setTitle(`Error occurred while running \`/${interaction.commandName}\``)
            .setDescription(`\`\`\`\n${(e as any).message}\`\`\``)
            .setColor('#C61130')
            .setTimestamp();

        // If the interaction hasn't been replied to yet, we can reply with the embed
        if (!interaction.replied)
            return interaction.reply({ embeds: [errorEmbed] });

        // Otherwise, fall back to sending the embed in the channel
        if (!interaction.channel?.isSendable()) return;
        await interaction.channel.send({ embeds: [errorEmbed] });
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
    } catch (e) {
        console.error(e);
    }
});
