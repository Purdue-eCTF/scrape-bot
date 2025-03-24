import type { Command } from '../util/commands';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { challenges } from '../modules/challenges';

// Utils
import { chunked } from '../util/misc';
import { paginate } from '../util/embeds';


export default {
    data: new SlashCommandBuilder()
        .setName('challenges')
        .setDescription('Gets the remaining challenges sorted by solves and points.'),

    async execute(interaction) {
        const sorted = challenges
            .filter((c) => !c.solved_by_me && !c.name.endsWith(' - Late'))
            .toSorted((a, b) => (b.solves - a.solves) || (b.value - a.value));

        const pages = chunked(sorted, 10).map((chunk, i) => {
            const desc = chunk
                .map((c, j) => `${(i * 10) + j + 1}. **${c.name}** (${c.value} pts): solved by ${c.solves}`)
                .join('\n');

            return new EmbedBuilder()
                .setTitle('eCTF challenges')
                .setDescription(`Remaining challenges by solves and points:\n${desc}`)
                .setColor('#C61130')
                .setTimestamp();
        });

        return paginate(interaction, pages);
    }
} satisfies Command;
