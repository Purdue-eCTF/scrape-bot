import {App} from '@slack/bolt';
import {SLACK_SIGNING_SECRET, SLACK_TOKEN} from '../auth';


export const app = new App({
    token: SLACK_TOKEN,
    signingSecret: SLACK_SIGNING_SECRET
});

app.message(async ({message}) => {
    console.log(message);
});
