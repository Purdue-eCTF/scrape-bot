import { CTFdClient, ChallengeData } from '@b01lers/ctfd-api';
import { CTFD_EMAIL, CTFD_PASSWORD } from '../auth';


export const ctfdClient = new CTFdClient({
    url: 'https://ectf.ctfd.io/',
    username: CTFD_EMAIL,
    password: CTFD_PASSWORD,
})

export let challenges: ChallengeData[] = [];

export async function fetchAndUpdateChallenges() {
    console.log('[CHALL] Re-fetching eCTF challenges');

    challenges = await ctfdClient.getChallenges();
}
