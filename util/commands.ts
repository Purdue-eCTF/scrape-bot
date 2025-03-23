import type {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    SlashCommandOptionsOnlyBuilder
} from 'discord.js';


export type Command = {
    data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder,
    execute: (interaction: ChatInputCommandInteraction) => Promise<any>,
    autocomplete?: (interaction: AutocompleteInteraction) => Promise<any>
}
