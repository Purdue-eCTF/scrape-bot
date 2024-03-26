import {SlashCommandBuilder} from '@discordjs/builders';
import {REST} from '@discordjs/rest';
import {Routes} from 'discord-api-types/v9';
import {DISCORD_TOKEN} from './auth';


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
        .setName('submit')
        .setDescription('Generates a user script to scrape and submit a flag at the earliest opportunity.')
        .addStringOption((option) => option
            .setName('team')
            .setDescription('The name of the team the flag belongs to.')
            .setRequired(true))
        .addStringOption((option) => option
            .setName('flag')
            .setDescription('The flag to submit.')
            .setRequired(true))
        .addIntegerOption((option) => option
            .setName('challenge')
            .setDescription('The challenge to submit the flag for.')
            .addChoices({
                name: 'Operational Pin Extract',
                value: 7
            }, {
                name: 'Operational Pump Swap',
                value: 8
            }, {
                name: 'Damaged Boot',
                value: 9
            }, {
                name: 'Supply Chain Boot',
                value: 10
            }, {
                name: 'Supply Chain Extract',
                value: 11
            }, {
                name: 'Black Box Boot',
                value: 12
            }, {
                name: 'Black Box Extract',
                value: 13
            })
            .setRequired(true))
        .addIntegerOption((option) => option
            .setName('delay')
            .setDescription('The delay, in milliseconds, to wait before trying again. Defaults to 1000ms.'))
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
