import { SlashCommandBuilder, REST, Routes } from 'discord.js';
import { DISCORD_TOKEN } from './auth';


const globalCommands = [
    new SlashCommandBuilder()
        .setName('refresh')
        .setDescription('Manually re-fetches the scoreboard data.')
        .toJSON(),
    new SlashCommandBuilder()
        .setName('load')
        .setDescription('Loads a target from the specified Slack URL (useful if Tom crashed before pushing).')
        .addStringOption((option) => option
            .setName('url')
            .setDescription('The URL to fetch the target from.')
            .setRequired(true)),
    new SlashCommandBuilder()
        .setName('attack')
        .setDescription('Attack commands')
        .addSubcommand((c) => c
            .setName('target')
            .setDescription('(re)run automated attacks on the specified target.')
            .addStringOption((option) => option
                .setName('target')
                .setDescription('The target to attack.')
                .setAutocomplete(true)
                .setRequired(true)))
        .addSubcommand((c) => c
            .setName('custom')
            .setDescription('Run a custom attack on the specified target.')
            .addStringOption((option) => option
                .setName('target')
                .setDescription('The target to attack.')
                .setAutocomplete(true)
                .setRequired(true))
            .addAttachmentOption((option) => option
                .setName('script')
                .setDescription('The script to run.')
                .setRequired(true)))
        .addSubcommand((c) => c
            .setName('update')
            .setDescription('Update the IP and port for the specified target.')
            .addStringOption((option) => option
                .setName('target')
                .setDescription('The target to update.')
                .setAutocomplete(true)
                .setRequired(true))
            .addStringOption((option) => option
                .setName('ip')
                .setDescription('The new IP.')
                .setRequired(true))
            .addIntegerOption((option) => option
                .setName('port_low')
                .setDescription('The new low port.')
                .setRequired(true))
            .addIntegerOption((option) => option
                .setName('port_high')
                .setDescription('The new high port.')
                .setRequired(true)))
];

const clientId = '1199441161077674105';
const rest = new REST({ version: '9' }).setToken(DISCORD_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        // Register global commands
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: globalCommands }
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
