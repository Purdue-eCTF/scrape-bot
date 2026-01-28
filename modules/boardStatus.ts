import { Subscriber } from 'zeromq';
import { EmbedBuilder } from 'discord.js';
import { client } from '../bot';

// Config
import { PROV_STATUS_PORT, STATUS_CHANNEL_ID, STATUS_MESSAGE_ID } from '../config';


export async function initBoardStatusSubscription() {
    const sock = new Subscriber();

    sock.connect(`tcp://127.0.0.1:${PROV_STATUS_PORT}`);
    sock.subscribe();

    for await (const msg of sock) {
        console.log('board', msg); // TODO
    }
}

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
    return message.edit({ embeds: [message.embeds[0], statusEmbed] });
}

type BoardStatus = {
    name: string,
    user: string | null,
    online: boolean,
    type: 'DEV' | 'ATTACK'
}

function formatBoardShort(c: BoardStatus) {
    const name = `\`${c.name}\` [\`${c.type}\`]`;

    if (!c.online)
        return `\\🔴 ${name} offline`;
    if (c.user !== null)
        return `\\🟡 ${name} in use by user \`${c.user}\``;

    return `\\🟢 ${name} available`;
}
