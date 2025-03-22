import { WebSocket } from "ws";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { SLACK_PRIVATE_CHANNEL_ID, SLACK_TEAM_ID, SLACK_GATEWAY_SERVER } from "../config";
import { SLACK_USER_TOKEN, SLACK_USER_COOKIE } from "../auth";

const HEADERS = {
    cookie: `d=${encodeURIComponent(SLACK_USER_COOKIE)}`,
};
const SLEEP = 10_000;

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

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadFile(filename: string) {
	// begin upload
	const fileSize = (await fs.stat(filename)).size;
	// I dunno what the difference is between this and files.getUploadURLExternal
	const uploadURLResponse = await fetchSlackEndpoint("files.getUploadURL", {
		filename,
		length: fileSize.toString(),
	});

	const uploadURL = uploadURLResponse.upload_url;
	const fileID = uploadURLResponse.file;

	// upload zip file
	const fileStream = createReadStream(filename);
	await fetch(uploadURL, {
		method: "POST",
		body: fileStream,
		duplex: "half",
	});

	// finish upload
	await fetchSlackEndpoint("files.completeUpload", {
		files: JSON.stringify([{ id: fileID, title: filename }]),
	});

	return fileID;
}

async function openModal(team: string, clientToken: string) {
	const socket = createSlackSocket();

	while (true) {
		const viewOpened = listenOnce(socket, "view_opened");
		await fetchSlackEndpoint("chat.command", {
			command: "/pesky_neighbor",
			channel: SLACK_PRIVATE_CHANNEL_ID,
			disp: "/pesky_neighbor",
			team_id: SLACK_TEAM_ID,
			client_token: clientToken,
		});

		const view = (await viewOpened).view;

		// check if team dropdown contains the team we want
		const selectOptions = view.blocks.find((block) => block.block_id === "selectAction")
			.elements[0].options;
		if (selectOptions.some((option) => option.value === team)) {
			socket.close();
			return view.id;
		}

		await fetchSlackEndpoint("views.close", {
			client_token: clientToken,
			view_id: view.id,
			root_view_id: view.root_view_id,
		});

		// rate limit
		await sleep(SLEEP);
	}
}

export async function peskyNeighbor(team: string, zipFilename: string) {
	const clientToken = `web-${Date.now()}`;

	const [fileID, viewId] = await Promise.all([
		uploadFile(zipFilename),
		openModal(team, clientToken),
	]);

	// submit modal
	await fetchSlackEndpoint("views.submit", {
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
