// @ts-ignore
import zulipInit from 'zulip-js';


;(async () => {
    const zulip = await zulipInit({
        username: process.env.ZULIP_USERNAME,
        apiKey: process.env.ZULIP_API_KEY,
        realm: process.env.ZULIP_REALM,
    });

    console.log(await zulip.streams.subscriptions.retrieve());

    // const res = await zulip.users.me.subscriptions.add({
    //     subscriptions: JSON.stringify([{ name: 'off topic' }]),
    // })
})()
