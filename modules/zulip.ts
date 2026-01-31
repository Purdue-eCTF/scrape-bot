// @ts-ignore
import zulipInit from '@ky28059/zulip-js';


export async function initZulipClient() {
    const zulip = await zulipInit({
        username: process.env.ZULIP_USERNAME,
        apiKey: process.env.ZULIP_API_KEY,
        realm: process.env.ZULIP_REALM,
    });

    await zulip.callOnEachEvent((e: any) => console.log(e), ['message']);
}
