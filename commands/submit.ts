import type { Command } from '../util/commands';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { challenges, ctfdClient, wrapFlagForChallenge } from '../modules/challenges';


export default {
    data: new SlashCommandBuilder()
        .setName('submit')
        .setDescription('Automatically submits the given flag to the given challenge on CTFd.')
        .addIntegerOption((option) => option
            .setName('challenge')
            .setDescription('The challenge to submit a flag for.')
            .setAutocomplete(true)
            .setRequired(true))
        .addStringOption((option) => option
            .setName('flag')
            .setDescription('The flag to submit.')
            .setRequired(true)),

    async execute(interaction) {
        const id = interaction.options.getInteger('challenge', true);
        const challName = challenges.find((c) => c.id === id)!.name;

        const flag = wrapFlagForChallenge(challName, interaction.options.getString('flag', true));
        const res = await ctfdClient.submitFlag(id, flag);

        const submitEmbed = new EmbedBuilder()
            .setTitle(`Flag submission for \`${challName}\``)
            .setDescription(`**Flag:** \`${flag}\`\n**Status:** ${res.status}\n**Message:** ${res.message}`)
            .setColor('#C61130')
            .setTimestamp();
        return interaction.reply({ embeds: [submitEmbed] });
    },
    async autocomplete(interaction) {
        const input = interaction.options.getFocused();
        const challs = challenges
            .filter(((c) => !c.solved_by_me && c.name.toLowerCase().includes(input.toLowerCase())))
            .map((c) => ({ name: c.name, value: c.id }))
            .slice(0, 25)

        return interaction.respond(challs);
    }
} satisfies Command;
