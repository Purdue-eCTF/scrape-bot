import { ActivityType, Client, Collection, EmbedBuilder } from 'discord.js';
import { CronJob } from 'cron';

// Modules
import commands from './commands';
import { fetchAndUpdateScoreboard } from './modules/scoreboard';
import { Command, CommandGroup } from './util/commands';
import { generateReportEmbed } from './commands/report';

// Config
import { SCOREBOARD_NOTIFY_CHANNEL_ID } from './config';


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
