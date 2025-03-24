import type { Command } from '../util/commands';
import { SlashCommandBuilder } from 'discord.js';
import { broadcastDiffs } from '../bot';


export default {
    data: new SlashCommandBuilder()
        .setName('report')
        .setDescription('Sends the current day\'s eCTF scoreboard report.'),

    async execute(interaction) {
        await broadcastDiffs(interaction);
    }
} satisfies Command;
