import { CTFD_API_KEY, CTFD_EMAIL, CTFD_PASSWORD } from '../auth';


let cachedSession: string | null = null;
let cachedNonce: string | null = null;
let sessionExpiry = new Date();


type ScoreboardResponse = {
    success: true,
    data: ScoreboardData[],
}

type ScoreboardData = {
    pos: number,
    account_id: number,
    account_url: string,
    account_type: "user",
    oauth_id: null,
    name: string,
    score: number,
    bracket_id: null,
    bracket_name: null
}

export async function getScoreboard() {
    return await (await fetch('https://ectf.ctfd.io/api/v1/scoreboard', {
        headers: { 'Authorization': CTFD_API_KEY }
    })).json() as ScoreboardResponse;
}

type ChallengesResponse = {
    success: true,
    data: ChallengeData[]
}

export type ChallengeData = {
    id: number,
    type: 'standard',
    name: string,
    category: string,
    script: string,
    solved_by_me: boolean,
    solves: number,
    tags: string[],
    template: string,
    value: number,
}

export async function getChallenges() {
    const { session } = await getAuthedSessionNonce();

    return await (await fetch("https://ectf.ctfd.io/api/v1/challenges", {
        headers: { cookie: session }
    })).json() as ChallengesResponse;
}

function extractNonce(raw: string) {
    return raw.match(/'csrfNonce': "(.+?)"/)![1];
}

export async function getAuthedSessionNonce() {
    // If we have a cached, non-expired session, use it
    if (new Date() < sessionExpiry && cachedSession && cachedNonce)
        return { session: cachedSession, nonce: cachedNonce };

    const res = await fetch('https://ectf.ctfd.io/login');

    const [session] = res.headers.getSetCookie()[0].split('; ');
    const nonce = extractNonce(await res.text());

    const formData = new FormData();
    formData.append('name', CTFD_EMAIL);
    formData.append('password', CTFD_PASSWORD);
    formData.append('_submit', 'Submit');
    formData.append('nonce', nonce);

    const loginRes = await fetch("https://ectf.ctfd.io/login", {
        method: 'POST',
        headers: { cookie: session },
        redirect: 'manual',
        body: formData,
    });

    const [authedSession, expiresGmt] = loginRes.headers.getSetCookie()[0].split('; ');
    const authedRaw = await (await fetch('https://ectf.ctfd.io/challenges', {
        headers: { cookie: authedSession }
    })).text();

    // Cache session data and expiry date
    cachedSession = authedSession;
    cachedNonce = extractNonce(authedRaw);
    sessionExpiry = new Date(expiresGmt.slice(8));

    return {
        nonce: cachedNonce,
        session: cachedSession,
    };
}

type FlagSubmissionResponse = {
    success: true,
    data: {
        status: "incorrect", // TODO
        message: "Incorrect"
    }
}

export async function submitFlag(id: number, flag: string) {
    const { session, nonce } = await getAuthedSessionNonce();

    return await (await fetch('https://ectf.ctfd.io/api/v1/challenges/attempt', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Csrf-Token': nonce,
            cookie: session,
        },
        body: JSON.stringify({ challenge_id: id, submission: flag }),
    })).json() as FlagSubmissionResponse;
}
