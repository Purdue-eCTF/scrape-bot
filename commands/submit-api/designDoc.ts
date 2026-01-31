import type { Subcommand } from '../../util/commands';
import { EmbedBuilder, SlashCommandBuilder, SlashCommandSubcommandBuilder } from 'discord.js';
import { challenges, ctfdClient, wrapFlagForChallenge } from '../../modules/challenges';
import { submitDesignDoc } from '../../util/api';


export default {
    data: new SlashCommandSubcommandBuilder()
        .setName('design-doc')
        .setDescription('Submits the attached design doc to MITRE.')
        .addAttachmentOption((option) => option
            .setName('doc')
            .setDescription('The doc to submit.')
            .setRequired(true)),

    async execute(interaction) {
        const doc = interaction.options.getAttachment('doc', true);
        const raw = await fetch(doc.url).then(res => res.blob());

        const res = await submitDesignDoc(doc.name, raw);

        const challs = challenges.filter((c) => c.name.startsWith('Design Document'));
        for (const c of challs) {
            // ...
        }

        // const res = await ctfdClient.submitFlag(id, flag);

        // const submitEmbed = new EmbedBuilder()
        //     .setTitle('Team photo submission')
        //     .setDescription(`**Flag:** \`${flag}\`\n**Status:** ${res.status}\n**Message:** ${res.message}`)
        //     .setColor('#C61130')
        //     .setTimestamp();
        // return interaction.reply({ embeds: [submitEmbed] });
    }
} satisfies Subcommand;
