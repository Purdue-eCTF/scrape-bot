import { readdir } from 'node:fs/promises';
import {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    SlashCommandOptionsOnlyBuilder,
    SlashCommandSubcommandBuilder
} from 'discord.js';


// TODO
export type Command = {
    data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder,
    execute: (interaction: ChatInputCommandInteraction) => Promise<any>,
    autocomplete?: (interaction: AutocompleteInteraction) => Promise<any>
}

export type Subcommand = {
    data: SlashCommandSubcommandBuilder,
    execute: (interaction: ChatInputCommandInteraction) => Promise<any>,
    autocomplete?: (interaction: AutocompleteInteraction) => Promise<any>
}

export type CommandGroup = {
    data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder,
    commands: { [key: string]: Subcommand }
}

export async function getAllCommands() {
    const files = await readdir('./commands', { withFileTypes: true });
    const ret: (Command | CommandGroup)[] = [];

    for (const file of files) {
        // Handle subcommands
        if (file.isDirectory()) {
            const commandFiles = await readdir(`./commands/${file.name}`);

            const groupData = new SlashCommandBuilder()
                .setName(file.name)
                .setDescription(`[${file.name}] command group`)
            const commands: { [key: string]: Subcommand } = {};

            // Hack: `fs` paths are relative to the currently running file, while `import` paths are relative
            // to *this* file.
            for (const name of commandFiles) {
                const command = (await import(`../commands/${file.name}/${name.slice(0, -3)}`)).default as Subcommand;
                commands[name] = command;
                groupData.addSubcommand(command.data)
            }

            ret.push({ data: groupData, commands });
            continue;
        }

        const command = (await import(`../commands/${file.name.slice(0, -3)}`)).default as Command;
        ret.push(command);
    }

    return ret;
}
