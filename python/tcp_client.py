#!/usr/bin/env python3
"""
PulseTCP — Standalone Python TCP CLI Client with User Authentication
Connects directly to tcp_server.py using AF_INET / SOCK_STREAM and a dedicated receiver thread.
Supports /register <user> <pass>, /login <user> <pass>, /join #<room>, /msg @<user> <msg>, /broadcast <msg>.
"""

from __future__ import annotations

import argparse
import getpass
import json
import socket
import sys
import threading


def receive_loop(sock: socket.socket) -> None:
    buf = b""
    try:
        while True:
            chunk = sock.recv(4096)
            if not chunk:
                print("\n[DISCONNECTED] Server closed TCP stream.")
                break
            buf += chunk
            while b"\n" in buf:
                line, buf = buf.split(b"\n", 1)
                text = line.decode("utf-8", errors="replace").strip()
                if not text:
                    continue
                try:
                    frame = json.loads(text)
                    ftype = frame.get("type")
                    if ftype == "welcome":
                        me = frame.get("self", {})
                        print(
                            f"[HANDSHAKE] fd:{me.get('fd')} thread={me.get('threadName')} (use /register or /login)"
                        )
                    elif ftype == "auth:success":
                        me = frame.get("self", {})
                        print(
                            f"[AUTH_GRANTED] Logged in as @{me.get('nick')} in #{me.get('channel')}"
                        )
                    elif ftype == "auth:error":
                        print(f"[AUTH_ERROR] {frame.get('message')}")
                    elif ftype == "auth:logged_out":
                        print("[LOGOUT] Session unauthenticated. Use /login or /register.")
                    elif ftype == "message:broadcast":
                        print(
                            f"[#{frame.get('channel')} @{frame.get('fromNick')}]: {frame.get('text')}"
                        )
                    elif ftype == "message:whisper":
                        print(
                            f"[WHISPER @{frame.get('fromNick')} -> @{frame.get('toNick')}]: {frame.get('text')}"
                        )
                    elif ftype == "peer:joined":
                        p = frame.get("peer", {})
                        print(f"[JOIN] @{p.get('nick')} connected (fd:{p.get('fd')})")
                    elif ftype == "peer:left":
                        print(f"[LEFT] @{frame.get('nick')} disconnected")
                    elif ftype == "system:pong":
                        print(f"[PONG] dispatch={frame.get('dispatchUs')}us")
                    elif ftype == "system:error":
                        print(f"[ERROR] {frame.get('message')}")
                except json.JSONDecodeError:
                    print(text)
    except OSError:
        pass


def main() -> None:
    parser = argparse.ArgumentParser(description="PulseTCP Authenticated CLI Client")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=9090)
    parser.add_argument("--user", help="Username for login/registration")
    parser.add_argument("--password", help="Password (prompted securely if omitted)")
    parser.add_argument("--register", action="store_true", help="Register new account")
    args = parser.parse_args()

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
    sock.connect((args.host, args.port))

    recv_thread = threading.Thread(target=receive_loop, args=(sock,), daemon=True)
    recv_thread.start()

    if args.user:
        pw = args.password or getpass.getpass("Password: ")
        action = "register" if args.register else "login"
        sock.sendall(
            (
                json.dumps({"type": action, "username": args.user, "password": pw})
                + "\n"
            ).encode("utf-8")
        )

    try:
        for line in sys.stdin:
            cmd = line.rstrip("\n")
            if cmd == "/quit":
                break
            sock.sendall((cmd + "\n").encode("utf-8"))
    except KeyboardInterrupt:
        pass
    finally:
        sock.close()


if __name__ == "__main__":
    main()
