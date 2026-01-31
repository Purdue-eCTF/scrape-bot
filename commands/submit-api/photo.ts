import type { Subcommand } from '../../util/commands';
import { EmbedBuilder, SlashCommandBuilder, SlashCommandSubcommandBuilder } from 'discord.js';
import { challenges, ctfdClient, wrapFlagForChallenge } from '../../modules/challenges';
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

        const challId = challenges.find((c) => c.name === 'Team Photo');
        if (!challId) {
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
