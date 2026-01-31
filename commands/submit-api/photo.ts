import type { Subcommand } from '../../util/commands';
import { EmbedBuilder, SlashCommandSubcommandBuilder } from 'discord.js';
import { challenges, ctfdClient } from '../../modules/challenges';
import { submitTeamPhoto } from '../../util/api';


export default {
    data: new SlashCommandSubcommandBuilder()
        .setName('photo')
        .setDescription('Submits the attached team photo to MITRE.')
        .addAttachmentOption((option) => option
            .setName('photo')
            .setDescription('The photo to submit.')
            .setRequired(true)),

    async execute(interaction) {
        const photo = interaction.options.getAttachment('photo', true);
        const raw = await fetch(photo.url).then(res => res.blob());

        const res = await submitTeamPhoto(photo.name, raw);

        const resEmbed = new EmbedBuilder()
            .setTitle('Team photo submission')
            .setColor('#C61130')
            .setTimestamp();

        if ('detail' in res) {
            resEmbed.setDescription(`Submission failed with status \`${res.status}\`:\n\`\`\`${res.detail}\`\`\``);
            return interaction.reply({ embeds: [resEmbed] });
        }

        resEmbed.setDescription(`Submitted successfully with flag:\n\`\`\`${res.flag_hex}\`\`\``);

        const chall = challenges.find((c) => c.name === 'Team Photo');
        if (chall) {
            const r = await ctfdClient.submitFlag(chall.id, res.flag_hex);
            resEmbed.addFields({
                name: chall.name,
                value: `**Message:** ${r.message} (\`${r.status}\`)`
            });
        }

        return interaction.reply({ embeds: [resEmbed] });
    }
} satisfies Subcommand;
