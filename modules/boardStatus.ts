import { Subscriber } from 'zeromq';
import { EmbedBuilder } from 'discord.js';
import AsyncLock from 'async-lock';
import { client } from '../bot';

// Utils
import { PROV_STATUS_PORT, STATUS_CHANNEL_ID, STATUS_MESSAGE_ID } from '../config';


export const statusLock = new AsyncLock();

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

    const boardStatus = req.boards
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((d, i) => `${i + 1}. ${formatBoardShort(d)}`)
        .join('\n');
    const queueStatus = req.queue
        .sort((a, b) => a.start - b.start)
        .map((d, i) => `${i + 1}. ${formatQueueShort(d)}`)
        .join('\n')

    const statusEmbed = new EmbedBuilder()
        .setTitle('Board provision status')
        .addFields(
            { name: 'Boards:', value: boardStatus || '*No boards connected.*' },
            { name: 'Queue:', value: queueStatus || '*No connections queued.*' }
        )
        .setColor('#27272a')
        .setTimestamp()

    await statusLock.acquire('status', async () => {
        const message = channel.messages.cache.get(STATUS_MESSAGE_ID)
            ?? await channel.messages.fetch(STATUS_MESSAGE_ID)
            ?? channel.lastMessage;

        if (!message?.editable) return channel.send({ embeds: [statusEmbed] }); // TODO
        return message.edit({ embeds: [message.embeds[0], statusEmbed] });
    });
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
