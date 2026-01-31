import type { Subcommand } from '../../util/commands';
import { EmbedBuilder, SlashCommandSubcommandBuilder } from 'discord.js';
import { challenges, ctfdClient } from '../../modules/challenges';
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

        const resEmbed = new EmbedBuilder()
            .setTitle('Design doc submission')
            .setColor('#C61130')
            .setTimestamp();

        if ('detail' in res) {
            resEmbed.setDescription(`Submission failed with status \`${res.status}\`:\n\`\`\`${res.detail}\`\`\``);
            return interaction.reply({ embeds: [resEmbed] });
        }

        resEmbed.setDescription(`Submitted successfully with flag:\n\`\`\`${res.flag_hex}\`\`\``);

        const challs = challenges.filter((c) => c.name.startsWith('Design Document'));
        for (const c of challs) {
            const r = await ctfdClient.submitFlag(c.id, res.flag_hex);
            resEmbed.addFields({
                name: c.name,
                value: `**Message:** ${r.message} (\`${r.status}\`)`
            });
        }

        return interaction.reply({ embeds: [resEmbed] });
    }
} satisfies Subcommand;
