import { WebSocket, RawData } from "ws";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { SLACK_PRIVATE_CHANNEL_ID, SLACK_TEAM_ID, SLACK_GATEWAY_SERVER } from "../config";
import { SLACK_USER_TOKEN, SLACK_USER_COOKIE } from "../auth";
import { ViewOutput } from "@slack/bolt";
import { WebAPICallResult } from "@slack/web-api";
import { ActionsBlock, PlainTextOption, StaticSelect } from "@slack/types";
import { WebClient } from "@slack/web-api";
import AdmZip from "adm-zip";
import { createConnection } from "node:net";
import { readLines } from "../util/socket";

const HEADERS = {
    cookie: `d=${encodeURIComponent(SLACK_USER_COOKIE)}`,
};
const SLEEP = 10_000;
const webClient = new WebClient(SLACK_USER_TOKEN, { headers: HEADERS });

// Slack API types
type FilesGetUploadUrlResponse = WebAPICallResult & {
    ok: true;
    upload_url: string;
    file: string;
};

// Slack WebSocket types
type WebSocketMessage = {
    type: string;
};

type ViewOpenedMessage = WebSocketMessage & {
    type: "view_opened";
    view_type: string;
    view_id: string;
    view: ViewOutput;
};

// Satellite frame type
type CapturedFrame = {
    channel: number;
    timestamp: number;
    encoded: string;
};

function createSlackSocket() {
    const websocketParams = {
        token: SLACK_USER_TOKEN,
        sync_desync: "1",
        slack_client: "desktop",
        start_args:
            "?agent=client&org_wide_aware=true&agent_version=1742590350&eac_cache_ts=true&cache_ts=0&name_tagging=true&only_self_subteams=true&connect_only=true&ms_latest=true",
        no_query_on_subscribe: "1",
        flannel: "3",
        lazy_channels: "1",
        gateway_server: SLACK_GATEWAY_SERVER,
        batch_presence_aware: "1",
    };
    const socket = new WebSocket(
        `wss://wss-primary.slack.com/?${new URLSearchParams(websocketParams)}`,
        {
            origin: "https://app.slack.com",
            headers: HEADERS,
        }
    );

    return socket;
}

function listenOnce<Message extends WebSocketMessage>(
    socket: WebSocket,
    type: string
): Promise<Message> {
    return new Promise((resolve, reject) => {
        function callback(msg: RawData) {
            const data = JSON.parse(msg.toString()) as Message;
            if (data.type === type) {
                resolve(data);
                socket.removeListener("message", callback);
            }
        }
        socket.on("message", callback);
    });
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadFile(filename: string, file: Buffer) {
    // begin upload
    const fileSize = file.length;
    // I dunno what the difference is between this and files.getUploadURLExternal
    const uploadURLResponse: FilesGetUploadUrlResponse = (await webClient.apiCall(
        "files.getUploadURL",
        {
            filename,
            length: fileSize,
        }
    )) as FilesGetUploadUrlResponse;

    const uploadURL = uploadURLResponse.upload_url;
    const fileID = uploadURLResponse.file;

    // upload zip file
    await fetch(uploadURL, {
        method: "POST",
        body: file,
    });

    // finish upload
    await webClient.apiCall("files.completeUpload", {
        files: JSON.stringify([{ id: fileID, title: filename }]),
    });

    return fileID;
}

async function openModal(team: string, clientToken: string): Promise<[string, PlainTextOption]> {
    // returns view id and option
    const socket = createSlackSocket();

    while (true) {
        const viewOpened: Promise<ViewOpenedMessage> = listenOnce(socket, "view_opened");
        await webClient.apiCall("chat.command", {
            command: "/pesky_neighbor",
            channel: SLACK_PRIVATE_CHANNEL_ID,
            disp: "/pesky_neighbor",
            team_id: SLACK_TEAM_ID,
            client_token: clientToken,
        });

        const view = (await viewOpened).view;

        // check if team dropdown contains the team we want
        const selectBlock = view.blocks.find((block) => block.block_id === "selectAction") as
            | ActionsBlock
            | undefined;
        if (selectBlock === undefined) {
            console.error("Could not find select block  in ", JSON.stringify(view));
            continue;
        }

        const select = selectBlock.elements[0] as StaticSelect | undefined;
        if (select === undefined) {
            console.error("Could not find select in ", JSON.stringify(view));
            continue;
        }

        const option = select.options?.find(
            (option) => option.value?.toUpperCase() === team.toUpperCase()
        );
        if (option !== undefined) {
            socket.close();
            return [view.id, option];
        }

        await webClient.apiCall("views.close", {
            client_token: clientToken,
            view_id: view.id,
            root_view_id: view.root_view_id ?? view.id,
        });

        // rate limit
        await sleep(SLEEP);
    }
}

function captureFrames(ip: string, ports: number[]) {
    const done: boolean[] = Array(ports.length).fill(false);
    function capture(channel: number) {
        return new Promise((resolve, reject) => {
            const socket = createConnection({
                host: ip,
                port: ports[channel],
            });

            const frames: CapturedFrame[] = [];
            readLines(socket, (line) => {
                const newFrame = JSON.parse(line) as CapturedFrame;
                if (newFrame.channel == channel) {
                    frames.push(newFrame);
                }
                if (frames.length >= 2) {
                    done[channel] = true;
                }
                if (done.every((x) => x)) {
                    // all channels are done capturing
                    resolve(frames);
                    socket.destroy();
                    return true;
                }
            });
        });
    }

    return Promise.all(Array.from(ports.keys()).map(capture));
}
async function createPeskyNeighborZip(team: string) {
    const zip = new AdmZip();
    const [ip, ...portStrs] = (await fs.readFile(`./temp/${team}/ports.txt`))
        .toString()
        .trim()
        .split(" ");
    const ports = portStrs.map((x) => parseInt(x, 10));
    const frames = await captureFrames(ip, ports);
    zip.addLocalFile("./modules/pesky_neighbor.py", "", "pesky_neighbor.py");
    zip.addFile("frames.json", Buffer.from(JSON.stringify(frames)));

    return await zip.toBufferPromise();
}
export async function peskyNeighbor(team: string) {
    const clientToken = `web-${Date.now()}`;

    const [fileID, [viewId, option]] = await Promise.all([
        createPeskyNeighborZip(team).then((file) => uploadFile(`${team}_pesky_neighbor.zip`, file)),
        openModal(team, clientToken),
    ]);

    // submit modal
    await webClient.apiCall("views.submit", {
        view_id: viewId,
        client_token: clientToken,
        state: JSON.stringify({
            values: {
                file_input_block_id: {
                    file_input_for_pesky_neighbor: {
                        type: "file_input",
                        files: [{ id: fileID }],
                    },
                },
                selectAction: {
                    select_vic_team: {
                        type: "static_select",
                        selected_option: option,
                    },
                },
            },
        }),
    });
}

peskyNeighbor("era");
