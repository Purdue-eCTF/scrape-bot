const CHALLENGE_FORMAT = [
    {
        name: "Expired Subscription",
        prefix: "expired_",
    },
    {
        name: "Pirated Subscription",
        prefix: "pirate_",
    },
    {
        name: "No Subscription",
        prefix: "nosub_",
    },
    {
        name: "Recording Playback",
        prefix: "recording_"
    },
    {
        name: "Pesky Neighbor",
        prefix: "neighbor_",
    },
];

export function wrapFlagForChallenge(challengeName: string, flag: string) {
    if (!flag.includes("ectf{")) {
        return flag;
    }

    const challenge = CHALLENGE_FORMAT.find(chall => challengeName.includes(chall.name));
    if (challenge) {
        return `ectf{${challenge.prefix}${flag}}`;
    } else {
        return flag;
    }
}