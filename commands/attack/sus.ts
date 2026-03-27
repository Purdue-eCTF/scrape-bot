import type { Subcommand } from '../../util/commands';
import { ChannelType, SlashCommandSubcommandBuilder } from 'discord.js';
import { ATTACK_FORUM_CHANNEL_ID } from '../../config';

// Utils
import { publishAttackRequest } from '../../modules/attackPub';
import { textEmbed } from '../../util/embeds';
import { autocompleteLocalTargets } from '../../util/autocomplete';


export default {
    data: new SlashCommandSubcommandBuilder()
        .setName('sus')
        .setDescription('(re)run SUS fuzzing on the specified target.')
        .addStringOption((option) => option
            .setName('target')
            .setDescription('The target to attack.')
            .setAutocomplete(true)
            .setRequired(true)),

    async execute(interaction) {
        const target = interaction.options.getString('target', true);

        const attackThreadsChannel = interaction.client.channels.cache.get(ATTACK_FORUM_CHANNEL_ID);
        if (attackThreadsChannel?.type !== ChannelType.GuildForum)
            return interaction.reply({ embeds: [textEmbed(`Could not find attack forum channel.`)] });

        const attackThread = attackThreadsChannel.threads.cache.find((c) => c.name === target);
        if (!attackThread)
            return interaction.reply({ embeds: [textEmbed(`Could not find thread for team \`${target}\`.`)] });

        // Reply with ack embed
        await publishAttackRequest(target, 'sus');
        await interaction.reply({ embeds: [textEmbed(`Queued SUS fuzzing for team \`${target}\`.`)] });
    },
    autocomplete: autocompleteLocalTargets
} satisfies Subcommand;
