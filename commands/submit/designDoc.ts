import type { Subcommand } from '../../util/commands';
import { EmbedBuilder, SlashCommandBuilder, SlashCommandSubcommandBuilder } from 'discord.js';
import { challenges, ctfdClient, wrapFlagForChallenge } from '../../modules/challenges';


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
        const raw = await fetch(doc.url).then(res => res.arrayBuffer());

        console.log(raw);

        // const challName = challenges.find((c) => c.id === id)!.name;

        // const flag = wrapFlagForChallenge(challName, interaction.options.getString('flag', true));
        // const res = await ctfdClient.submitFlag(id, flag);

        // const submitEmbed = new EmbedBuilder()
        //     .setTitle('Team photo submission')
        //     .setDescription(`**Flag:** \`${flag}\`\n**Status:** ${res.status}\n**Message:** ${res.message}`)
        //     .setColor('#C61130')
        //     .setTimestamp();
        // return interaction.reply({ embeds: [submitEmbed] });
    }
} satisfies Subcommand;
