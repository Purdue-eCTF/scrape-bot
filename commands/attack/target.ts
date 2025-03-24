import type { Subcommand } from '../../util/commands';
import { AttachmentBuilder, ChannelType, SlashCommandSubcommandBuilder } from 'discord.js';
import { ATTACK_FORUM_CHANNEL_ID } from '../../config';

// Utils
import { formatAttackOutput, runAttacksOnLocalTarget } from '../../modules/attack';
import { textEmbed } from '../../util/embeds';


export default {
    data: new SlashCommandSubcommandBuilder()
        .setName('target')
        .setDescription('(re)run automated attacks on the specified target.')
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
        await interaction.reply({ embeds: [textEmbed(`Queued automated attacks for team \`${target}\`.`)] });

        // When attacks resolve, send it in the appropriate attack thread.
        const [logs, alerts] = await runAttacksOnLocalTarget(target);
        await attackThread.send({
            content: formatAttackOutput(target, alerts),
            files: [new AttachmentBuilder(Buffer.from(logs)).setName('logs.txt')]
        });
    },
    async autocomplete(interaction) {
        const input = interaction.options.getFocused();

        const attackThreadsChannel = interaction.client.channels.cache.get(ATTACK_FORUM_CHANNEL_ID);
        if (attackThreadsChannel?.type !== ChannelType.GuildForum)
            return interaction.respond([]);

        const targets = attackThreadsChannel.threads.cache
            .filter((c) => c.name.toLowerCase().includes(input.toLowerCase()))
            .map((c) => ({ name: c.name, value: c.name }))
            .slice(0, 25)

        return interaction.respond(targets);
    }
} satisfies Subcommand;
