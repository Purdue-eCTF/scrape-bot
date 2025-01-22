import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { DISCORD_TOKEN } from './auth';


const globalCommands = [
    new SlashCommandBuilder()
        .setName('scoreboard')
        .setDescription('Sends the top teams on the eCTF scoreboard.')
        .toJSON(),
    new SlashCommandBuilder()
        .setName('refresh')
        .setDescription('Manually re-fetches the scoreboard data.')
        .toJSON(),
    new SlashCommandBuilder()
        .setName('report')
        .setDescription('Sends the current day\'s eCTF scoreboard report.')
        .toJSON(),
    new SlashCommandBuilder()
        .setName('challenges')
        .setDescription('Gets the top 10 remaining challenges sorted by solves and points.')
        .toJSON()
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
