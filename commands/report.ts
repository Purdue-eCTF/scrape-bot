import type { Command } from '../util/commands';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { scoreboard } from '../modules/scoreboard';


export default {
    data: new SlashCommandBuilder()
        .setName('report')
        .setDescription('Sends the current day\'s eCTF scoreboard report.'),

    async execute(interaction) {
        const diffEmbed = generateReportEmbed();
        await interaction.reply({ embeds: [diffEmbed] });
    }
} satisfies Command;

export function generateReportEmbed() {
    const totalDiffs: string[] = [];

    for (const team of Object.values(scoreboard)) {
        const diffs: string[] = [];

        if (team.prevPoints !== team.points)
            diffs.push(`[points: ${team.prevPoints} → ${team.points}]`)

        if (diffs.length) {
            // Push rank only if other diffs already exist, so that one team jumping 15 ranks
            // doesn't cause 14 other lines of diffs.
            if (team.prevRank !== team.rank)
                diffs.push(`[rank: ${team.prevRank} → ${team.rank}]`);

            // For 2026: display only the team's shortened name, e.g.
            // "University of California, Los Angeles - UCLA" -> "UCLA"
            const shortName = team.name.split(' - ')[1];
            totalDiffs.push(`[${shortName}](${team.href}): ${diffs.join(' ')}`);
        }
    }

    return new EmbedBuilder()
        .setTitle(`eCTF scoreboard report for ${new Date().toLocaleDateString()}`)
        .setDescription(totalDiffs.length ? totalDiffs.join('\n') : '*No scoreboard changes detected.*')
        .setColor('#C61130')
        .setTimestamp();
}
