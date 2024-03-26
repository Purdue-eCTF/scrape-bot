import {WebClient} from '@slack/web-api';
import {SLACK_TOKEN} from '../auth';
import WebSocket from 'ws';


const client = new WebClient(SLACK_TOKEN);

export async function initSocket() {
    const res = await client.rtm.connect({token: SLACK_TOKEN});
    if (!res.ok || !res.url)
        return console.log(`Unable to connect to rtm endpoint with error: ${res.error}`)

    const socket = new WebSocket(res.url);
    socket.on('message', (m) => {
        console.log(m.toString())
    });
}

type MessageElement = {
    type: 'message',
    channel: string, // slack ID
    user: string, // slack ID
    text: string,
    ts: string
}
