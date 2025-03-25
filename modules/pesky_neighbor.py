#!/usr/bin/env python3
import json
import sys
import traceback

from ectf25.utils.decoder import DecoderIntf
from loguru import logger


def conn():
	r = DecoderIntf(sys.argv[1], timeout=5, write_timeout=5)

	return r


def equal_timestamps(r: DecoderIntf):
	frame = bytes.fromhex(frames[1][0]["encoded"])
	print(r.decode(frame))
	print(r.decode(frame))


def per_channel_timestamp(r: DecoderIntf):
	frame1 = frames[1][1]
	frame2 = next(
		frame for frame in frames[0] if frame["timestamp"] > frame1["timestamp"]
	)
	print(r.decode(bytes.fromhex(frame2["encoded"])))
	print(r.decode(bytes.fromhex(frame1["encoded"])))


def channel_0_monotonic(r: DecoderIntf):
	frame1 = bytes.fromhex(frames[0][0]["encoded"])
	frame2 = bytes.fromhex(frames[0][1]["encoded"])
	print(r.decode(frame2))
	print(r.decode(frame1))


attacks = [equal_timestamps, per_channel_timestamp, channel_0_monotonic]


def main():
	r = conn()
	global frames
	with open("frames.json") as f:
		frames = json.load(f)
	for attack in attacks:
		logger.info(f"Running {attack.__name__}")
		try:
			attack(r)
		except Exception:
			traceback.print_exc()


if __name__ == "__main__":
	main()
