import type { Subcommand } from '../../util/commands';
import { SlashCommandSubcommandBuilder } from 'discord.js';

// Utils
import { loadTargetFromSlackUrl } from '../../modules/slack';
import { textEmbed } from '../../util/embeds';


export default {
    data: new SlashCommandSubcommandBuilder()
        .setName('url')
        .setDescription('Loads a target from the specified Slack URL (useful if Tom crashed before pushing).')
        .addStringOption((option) => option
            .setName('url')
            .setDescription('The URL to fetch the target from.')
            .setRequired(true)),

    async execute(interaction) {
        const url = interaction.options.getString('url', true);
        await interaction.deferReply();

        await loadTargetFromSlackUrl(url);
        return interaction.editReply({ embeds: [textEmbed('Loaded new target.')] });
    }
} satisfies Subcommand;
