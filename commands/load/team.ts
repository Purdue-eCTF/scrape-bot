import type { Subcommand } from '../../util/commands';
import { SlashCommandSubcommandBuilder } from 'discord.js';
import { readdir } from 'node:fs/promises';

// Utils
import { textEmbed } from '../../util/embeds';
import { loadAndDecryptTeam } from '../../modules/zulip';
import { autocompleteRemoteTargets } from '../../util/autocomplete';


export default {
    data: new SlashCommandSubcommandBuilder()
        .setName('team')
        .setDescription('Loads the package for the specified team (useful if Tom crashed before pushing).')
        .addStringOption((option) => option
            .setName('team')
            .setDescription('The team to load.')
            .setAutocomplete(true)
            .setRequired(true))
        .addStringOption((option) => option
            .setName('key')
            .setDescription('The decryption key to use.')
            .setRequired(true)),

    async execute(interaction) {
        const team = interaction.options.getString('team', true);
        const key = interaction.options.getString('key', true);
        await interaction.deferReply();

        const files = await readdir('./temp');
        if (files.includes(team))
            return interaction.editReply({ embeds: [textEmbed('Team already loaded!')] });

        await loadAndDecryptTeam(team, key);
        return interaction.editReply({ embeds: [textEmbed('Loaded new target.')] });
    },
    autocomplete: autocompleteRemoteTargets
} satisfies Subcommand;
