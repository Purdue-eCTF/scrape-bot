import { ChallengeData, getChallenges } from './ctfd';


export let challenges: ChallengeData[] = [];

export async function fetchAndUpdateChallenges() {
    console.log('[CHALL] Re-fetching eCTF challenges');

    const res = await getChallenges();
    challenges = res.data;
}
