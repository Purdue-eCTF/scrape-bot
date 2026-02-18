// @ts-ignore
import zulipInit from '@ky28059/zulip-js';
import { ChannelType, GuildForumTag } from 'discord.js';

// Utils
import { client } from '../bot';
import { gravatarUrl } from '../util/gravatar';
import { truncate } from '../util/misc';


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

        // Mirror selected zulip channels to discord
        const category = client.channels.cache.get('1470601140113506407');
        if (category?.type !== ChannelType.GuildCategory) return;

        const name = e.message.display_recipient.toLowerCase().replaceAll(' ', '-');
        const topic = e.message.subject.replace(/^✔ /, '');
        const resolved = e.message.subject.startsWith('✔ ');
        const content = e.message.content
            .replace(/\[(.+?)]\((\/.+?)\)/g, `[$1](${process.env.ZULIP_REALM}$2)`) // Replace relative links with absolute

        const forum = category.children.cache.find((v) => v.name === name);
        if (forum?.type !== ChannelType.GuildForum) return;

        const thread = forum.threads.cache.find((t) => t.name === topic)
            ?? await forum.threads.create({ name: topic, message: { content: '*[Zulip mirror truncated above this point]*' } });

        // Mirror the resolved status of the topic as a discord forum channel tag
        if (resolved) {
            const resTag: GuildForumTag = forum.availableTags.find((t) => t.name === 'Resolved')
                ?? await forum.setAvailableTags([{ name: 'Resolved', emoji: { id: null, name: '✅' }, moderated: true }])
                    .then(f => f.availableTags.find((t) => t.name === 'Resolved')!);

            await thread.setAppliedTags([resTag.id]);
        } else if (thread.appliedTags.length > 0) {
            await thread.setAppliedTags([]);
        }

        const hook = (await forum.fetchWebhooks()).find((v) => v.name === WEBHOOK_NAME)
            ?? await forum.createWebhook({ name: WEBHOOK_NAME });

        await hook.send({
            content: truncate(content, 2000, '...\n\n-# Message truncated; view full message on Zulip'),
            username: e.message.sender_full_name,
            avatarURL: e.message.avatar_url ?? gravatarUrl(e.message.sender_email),
            threadId: thread.id,
            allowedMentions: { parse: [] }
        });
    }, ['message']);
}
