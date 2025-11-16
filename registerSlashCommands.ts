import { REST, Routes } from 'discord.js';
import { DISCORD_TOKEN } from './auth';
import commands from './commands';


const clientId = '1199441161077674105';
const rest = new REST().setToken(DISCORD_TOKEN);

(async () => {
    try {
        const body = commands.map(c => c.data);

        console.log('Started refreshing application (/) commands.');

        // Register global commands
        await rest.put(
            Routes.applicationCommands(clientId),
            { body }
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
