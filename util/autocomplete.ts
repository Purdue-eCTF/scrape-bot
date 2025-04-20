import { AutocompleteInteraction, ChannelType } from 'discord.js';
import { ATTACK_FORUM_CHANNEL_ID } from '../config';


export async function autocompleteTargets(interaction: AutocompleteInteraction) {
    const input = interaction.options.getFocused();

    const attackThreadsChannel = interaction.client.channels.cache.get(ATTACK_FORUM_CHANNEL_ID);
    if (attackThreadsChannel?.type !== ChannelType.GuildForum)
        return interaction.respond([]);

    const targets = attackThreadsChannel.threads.cache
        .filter((c) => c.name.toLowerCase().includes(input.toLowerCase()))
        .map((c) => ({ name: c.name, value: c.name }))
        .slice(0, 25)

    return interaction.respond(targets);
}
