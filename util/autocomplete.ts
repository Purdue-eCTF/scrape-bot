import { AutocompleteInteraction, ChannelType } from 'discord.js';
import { ATTACK_FORUM_CHANNEL_ID } from '../config';
import { getPackages } from './api';


export async function autocompleteLocalTargets(interaction: AutocompleteInteraction) {
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

export async function autocompleteRemoteTargets(interaction: AutocompleteInteraction) {
    const input = interaction.options.getFocused();

    const res = await getPackages();
    const targets = res
        .filter((c) => c.toLowerCase().includes(input.toLowerCase()))
        .map((c) => ({ name: c, value: c }))
        .slice(0, 25)

    return interaction.respond(targets);
}
