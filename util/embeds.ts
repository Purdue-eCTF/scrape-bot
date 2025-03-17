import { EmbedBuilder } from 'discord.js';


export function textEmbed(desc: string) {
    return new EmbedBuilder()
        .setDescription(desc)
        .setColor('#C61130')
}
