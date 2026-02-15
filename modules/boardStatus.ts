import { Subscriber } from 'zeromq';
import { EmbedBuilder } from 'discord.js';
import { client } from '../bot';

// Config
import { PROV_STATUS_PORT, STATUS_CHANNEL_ID, STATUS_MESSAGE_ID } from '../config';


export async function initBoardStatusSubscription() {
    const sock = new Subscriber();

    sock.plainUsername = 'user';
    sock.plainPassword = process.env.AUTH_SECRET!;
    sock.connect(`tcp://provision_server:${PROV_STATUS_PORT}`);
    sock.subscribe();

    for await (const [msg] of sock) {
        try {
            const parsed = JSON.parse(msg.toString()) as BoardStatusUpdateBody;
            await updateBoardStatus(parsed);
        } catch (e) {
            console.error('Malformed board status message', e);
        }
    }
}

async function updateBoardStatus(req: BoardStatusUpdateBody) {
    const channel = client.channels.cache.get(STATUS_CHANNEL_ID);
    if (!channel?.isSendable())
        return console.error('[BUILD] Could not find build status channel!');

    const message = channel.messages.cache.get(STATUS_MESSAGE_ID)
        ?? await channel.messages.fetch(STATUS_MESSAGE_ID)
        ?? channel.lastMessage;

    const boardStatus = req.boards.map((d, i) => `${i + 1}. ${formatBoardShort(d)}`).join('\n')
        || '*No boards connected.*'
    const queueStatus = req.queue.map((d, i) => `${i + 1}. ${formatQueueShort(d)}`).join('\n')
        || '*No connections queued.*'

    const statusEmbed = new EmbedBuilder()
        .setTitle('Board provision status')
        .addFields(
            { name: 'Boards:', value: boardStatus },
            { name: 'Queue:', value: queueStatus }
        )
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

type BoardQueue = {
    name: string,
    start: number, // epoch s
}

type BoardStatusUpdateBody = {
    boards: BoardStatus[],
    queue: BoardQueue[]
}

function formatBoardShort(c: BoardStatus) {
    const name = `\`${c.name}\` [\`${c.type}\`]`;

    if (!c.online)
        return `\\🔴 ${name} offline`;
    if (c.user !== null)
        return `\\🟡 ${name} in use by user \`${c.user}\``;

    return `\\🟢 ${name} available`;
}

function formatQueueShort(c: BoardQueue) {
    const ts = Math.floor(c.start);
    return `\`${c.name}\` queued <t:${ts}:R>`;
}
