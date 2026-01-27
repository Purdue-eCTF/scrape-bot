import { EmbedBuilder } from 'discord.js';
import { client } from '../bot';

// Config
import { STATUS_CHANNEL_ID, STATUS_MESSAGE_ID } from '../config';


async function updateBoardStatus(req: BoardStatus[]) {
    const channel = client.channels.cache.get(STATUS_CHANNEL_ID);
    if (!channel?.isSendable())
        return console.error('[BUILD] Could not find build status channel!');

    const message = channel.messages.cache.get(STATUS_MESSAGE_ID)
        ?? await channel.messages.fetch(STATUS_MESSAGE_ID)
        ?? channel.lastMessage;

    const boardStatus = req.map((d, i) => `${i + 1}. ${formatBoardShort(d)}`).join('\n')
        || '*No boards connected.*'

    const statusEmbed = new EmbedBuilder()
        .setTitle('Board provision status')
        .setDescription(boardStatus)
        .setColor('#27272a')
        .setTimestamp()

    if (!message?.editable) return channel.send({ embeds: [statusEmbed] }); // TODO
    return message.edit({ embeds: [statusEmbed] });
}

type BoardStatus = {
    name: string,
    user: string | null,
    online: boolean
}

function formatBoardShort(c: BoardStatus) {
    if (!c.online)
        return `\\🔴 [\`${c.name}\`] offline`;
    if (c.user !== null)
        return `\\🟡 [\`${c.name}\`] in use by user \`${c.user}\``;

    return `\\🟢 [\`${c.name}\`] available`;
}
