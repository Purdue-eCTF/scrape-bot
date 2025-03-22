import { WebSocket } from "ws";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { SLACK_PRIVATE_CHANNEL_ID, SLACK_TEAM_ID, SLACK_GATEWAY_SERVER } from "../config";
import { SLACK_USER_TOKEN, SLACK_USER_COOKIE } from "../auth";

const HEADERS = {
    cookie: `d=${encodeURIComponent(SLACK_USER_COOKIE)}`,
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

async function fetchSlackEndpoint(
	command: string,
	params: Record<string, string | readonly string[]>
) {
	let body = new FormData();
	body.append("token", SLACK_USER_TOKEN);
	let resp = await fetch(`https://slack.com/api/${command}?${new URLSearchParams(params)}`, {
		headers: HEADERS,
		body,
		method: "POST",
	}).then((resp) => resp.json());

	if (!resp.ok) {
		throw new Error(
			`Fetching ${command} with ${JSON.stringify(params)} resulted in error: ${resp.error}`
		);
	}

	return resp;
}

function listenOnce(socket: WebSocket, type: string) {
	return new Promise((resolve, reject) => {
		function callback(event) {
			let data = JSON.parse(event.toString());
			if (data.type === type) {
				resolve(data);
				socket.removeListener("message", callback);
			}
		}
		socket.on("message", callback);
	});
}

export async function peskyNeighbor(team: string, zipFilename: string) {
	const client_token = `web-${Date.now()}`;

	const socket = createSlackSocket();

	// open modal
	const viewOpened = listenOnce(socket, "view_opened");
	await fetchSlackEndpoint("chat.command", {
		command: "/pesky_neighbor",
		channel: SLACK_PRIVATE_CHANNEL_ID,
		disp: "/pesky_neighbor",
		team_id: SLACK_TEAM_ID,
		client_token: client_token,
	});

	const viewOpenedResponse = await viewOpened;
	const viewId = viewOpenedResponse.view.id;
	socket.close();

	// begin upload
	const fileSize = (await fs.stat(zipFilename)).size;
	// I dunno what the difference is between this and files.getUploadURLExternal
	const uploadURLResponse = await fetchSlackEndpoint("files.getUploadURL", {
		filename: zipFilename,
		length: fileSize.toString(),
	});

	const uploadURL = uploadURLResponse.upload_url;
	const fileID = uploadURLResponse.file;

	// upload zip file
	const fileStream = createReadStream(zipFilename);
	await fetch(uploadURL, {
		method: "POST",
		body: fileStream,
		duplex: "half",
	});

	// finish upload
	await fetchSlackEndpoint("files.completeUpload", {
		files: JSON.stringify([{ id: fileID, title: zipFilename }]),
	});

	// submit modal
	await fetchSlackEndpoint("views.submit", {
		view_id: viewId,
		client_token: client_token,
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
						selected_option: {
							text: { type: "plain_text", text: team, emoji: true },
							value: team,
						},
					},
				},
			},
		}),
	});
}
