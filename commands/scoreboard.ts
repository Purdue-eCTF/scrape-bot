import type { Command } from '../util/commands';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { lastUpdated, scoreboard } from '../modules/scoreboard';

// Utils
import { chunked } from '../util/misc';
import { paginate } from '../util/embeds';


export default {
    data: new SlashCommandBuilder()
        .setName('scoreboard')
        .setDescription('Sends the top teams on the eCTF scoreboard.'),

    async execute(interaction) {
        const sorted = Object.values(scoreboard)
            .toSorted((a, b) => a.rank - b.rank)

        const pages = chunked(sorted, 10).map((chunk) => {
            const desc = chunk
                .map((data) => `${data.rank}. [${data.name}](${data.href}) — ${data.points} points`)
                .join('\n')

            return new EmbedBuilder()
                .setTitle('eCTF scoreboard')
                .setDescription(desc)
                .setColor('#C61130')
                .setFooter({ text: `Last fetched ${lastUpdated.toLocaleString()}` })
                .setTimestamp();
        });

        return paginate(interaction, pages);
    }
} satisfies Command;
