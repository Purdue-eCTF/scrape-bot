// @ts-ignore
import zulipInit from '@ky28059/zulip-js';
import { ChannelType } from 'discord.js';

// Utils
import { client } from '../bot';
import { gravatarUrl } from '../util/gravatar';


const WEBHOOK_NAME = 'zulip-mirror'

export async function initZulipClient() {
    const zulip = await zulipInit({
        username: process.env.ZULIP_USERNAME,
        apiKey: process.env.ZULIP_API_KEY,
        realm: process.env.ZULIP_REALM,
    });

    await zulip.callOnEachEvent(async (e: any) => {
        if (e.type !== 'message') return; // TODO?

        console.log(e.message);

        const category = client.channels.cache.get('1470601140113506407');
        if (category?.type !== ChannelType.GuildCategory) return;

        const name = e.message.display_recipient.toLowerCase().replaceAll(' ', '-');
        const topic = e.message.subject;

        const forum = category.children.cache.find((v) => v.name === name);
        if (forum?.type !== ChannelType.GuildForum) return;

        const thread = forum.threads.cache.find((t) => t.name === topic)
            ?? await forum.threads.create({ name: topic, message: { content: '*[Zulip mirror truncated above this point]*' } });

        const hook = (await forum.fetchWebhooks()).find((v) => v.name === WEBHOOK_NAME)
            ?? await forum.createWebhook({ name: WEBHOOK_NAME });

        await hook.send({
            content: e.message.content,
            username: e.message.sender_full_name,
            avatarURL: e.message.avatar_url ?? gravatarUrl(e.message.sender_email),
            threadId: thread.id,
            allowedMentions: { parse: [] }
        });
    }, ['message']);
}
