#!/usr/bin/env python3
"""
PulseTCP — Multi-Threaded TCP Chat & Telemetry Server with Secure Authentication
Tools: Python sockets (AF_INET, SOCK_STREAM), threading (1 thread per client + locks),
       sqlite3 persistent user store, PBKDF2-HMAC-SHA256 salted password hashing.
Concepts: TCP client-server model, TCP_NODELAY low-latency framing, concurrent auth & locks.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import re
import signal
import socket
import sqlite3
import sys
import threading
import time
import zlib
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


CHANNELS = ["general", "infra-telemetry", "system-alerts"]
PBKDF2_ITERATIONS = 260_000
USERNAME_RE = re.compile(r"^[a-zA-Z0-9_-]{3,24}$")


def hash_password(password: str, salt: Optional[bytes] = None) -> str:
    """Hash a password using PBKDF2-HMAC-SHA256 with a random 16-byte salt."""
    if salt is None:
        salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against a stored PBKDF2-HMAC-SHA256 hash in constant time."""
    try:
        algo, iter_str, salt_hex, hash_hex = stored_hash.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        iterations = int(iter_str)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
    except (ValueError, TypeError):
        return False

    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(dk, expected)


class UserAuthStore:
    """Thread-safe SQLite store for user registration and credential verification."""

    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        self._lock = threading.Lock()
        parent = os.path.dirname(os.path.abspath(db_path))
        if parent and not os.path.exists(parent):
            os.makedirs(parent, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._lock:
            with self._connect() as conn:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL COLLATE NOCASE,
                        password_hash TEXT NOT NULL,
                        role TEXT NOT NULL DEFAULT 'CLIENT',
                        created_at REAL NOT NULL,
                        last_login_at REAL
                    )
                    """
                )
                conn.commit()
            try:
                os.chmod(self.db_path, 0o600)
            except OSError:
                pass
        self._seed_default_accounts()

    def _seed_default_accounts(self) -> None:
        defaults = [
            ("dev_alex", "AlexPulse#2026", "CLIENT"),
            ("alice_core", "AlicePulse#2026", "ADMIN"),
            ("bob_infra", "BobPulse#2026", "CLIENT"),
            ("dana_sec", "DanaPulse#2026", "CLIENT"),
        ]
        for username, pw, role in defaults:
            self.register_user(username, pw, role=role, ignore_existing=True)

    def validate_credentials_format(
        self, username: str, password: str
    ) -> Tuple[bool, str, str]:
        cleaned = username.strip().lstrip("@")
        if not USERNAME_RE.match(cleaned):
            return (
                False,
                cleaned,
                "Username must be 3-24 characters (letters, numbers, _ or -).",
            )
        if not password or len(password) < 6:
            return (
                False,
                cleaned,
                "Password must be at least 6 characters long.",
            )
        if len(password) > 128:
            return False, cleaned, "Password must be at most 128 characters."
        return True, cleaned, ""

    def register_user(
        self,
        username: str,
        password: str,
        role: str = "CLIENT",
        ignore_existing: bool = False,
    ) -> Tuple[bool, str, Optional[dict]]:
        valid, cleaned, err = self.validate_credentials_format(username, password)
        if not valid:
            return False, err, None

        pw_hash = hash_password(password)
        now = time.time()
        with self._lock:
            with self._connect() as conn:
                existing = conn.execute(
                    "SELECT id, username FROM users WHERE username = ?", (cleaned,)
                ).fetchone()
                if existing:
                    if ignore_existing:
                        return True, "Account exists", dict(existing)
                    return (
                        False,
                        f"409 USER_EXISTS: Username @{cleaned} is already registered.",
                        None,
                    )
                cur = conn.execute(
                    """
                    INSERT INTO users (username, password_hash, role, created_at, last_login_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (cleaned, pw_hash, role, now, now),
                )
                conn.commit()
                return (
                    True,
                    "201 REGISTERED",
                    {
                        "id": cur.lastrowid,
                        "username": cleaned,
                        "role": role,
                        "created_at": now,
                    },
                )

    def authenticate_user(
        self, username: str, password: str
    ) -> Tuple[bool, str, Optional[dict]]:
        cleaned = username.strip().lstrip("@")
        if not cleaned or not password:
            return False, "Username and password are required.", None

        with self._lock:
            with self._connect() as conn:
                row = conn.execute(
                    "SELECT id, username, password_hash, role, created_at FROM users WHERE username = ?",
                    (cleaned,),
                ).fetchone()
                if not row:
                    # Constant-time dummy check to avoid timing side-channel
                    verify_password(
                        password,
                        "pbkdf2_sha256$260000$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000",
                    )
                    return False, "401 INVALID_CREDENTIALS: Invalid username or password.", None

                if not verify_password(password, row["password_hash"]):
                    return False, "401 INVALID_CREDENTIALS: Invalid username or password.", None

                now = time.time()
                conn.execute(
                    "UPDATE users SET last_login_at = ? WHERE id = ?",
                    (now, row["id"]),
                )
                conn.commit()
                return (
                    True,
                    "200 AUTH_GRANTED",
                    {
                        "id": row["id"],
                        "username": row["username"],
                        "role": row["role"],
                        "last_login_at": now,
                    },
                )

    def user_count(self) -> int:
        with self._lock:
            with self._connect() as conn:
                row = conn.execute("SELECT COUNT(*) AS cnt FROM users").fetchone()
                return int(row["cnt"]) if row else 0


@dataclass
class ClientSession:
    fd: int
    conn: socket.socket
    ip: str
    port: int
    nick: str
    channel: str = "general"
    thread_name: str = ""
    role: str = "CLIENT"
    authenticated: bool = False
    is_virtual: bool = False
    connected_at: float = field(default_factory=time.time)
    last_rtt_ms: float = 0.42
    tx_bytes: int = 0
    rx_bytes: int = 0
    seq: int = 1000
    state: str = "SYN_RECV"
    send_lock: threading.Lock = field(default_factory=threading.Lock)

    def to_public_dict(self) -> dict:
        return {
            "fd": self.fd,
            "ip": self.ip,
            "port": self.port,
            "nick": self.nick,
            "channel": self.channel,
            "threadName": self.thread_name,
            "role": self.role,
            "authenticated": self.authenticated,
            "isVirtual": self.is_virtual,
            "connectedAt": self.connected_at,
            "lastRttMs": round(self.last_rtt_ms, 2),
            "txBytes": self.tx_bytes,
            "rxBytes": self.rx_bytes,
            "state": self.state,
        }


class PulseTCPServer:
    def __init__(
        self,
        host: str = "0.0.0.0",
        port: int = 9090,
        db_path: str = "python/users.db",
    ) -> None:
        self.host = host
        self.port = port
        self.auth_store = UserAuthStore(db_path)
        self.server_socket: Optional[socket.socket] = None
        self.running = False
        self.started_at = time.time()

        # Shared state protected by explicit thread locks
        self.clients: Dict[int, ClientSession] = {}
        self.nicknames: Dict[str, int] = {}
        self.clients_lock = threading.Lock()
        self.nicknames_lock = threading.Lock()
        self.broadcast_lock = threading.Lock()

        # Global server telemetry counters
        self.metrics_lock = threading.Lock()
        self.total_tx_bytes = 0
        self.total_rx_bytes = 0
        self.total_packets = 0
        self.thread_counter = 0

    def _next_thread_label(self) -> str:
        with self.metrics_lock:
            self.thread_counter += 1
            return f"Thread-{self.thread_counter}"

    def _build_packet_meta(
        self,
        src_port: int,
        dst_port: int,
        payload_bytes: bytes,
        seq: int,
        flags: Optional[List[str]] = None,
    ) -> dict:
        crc = zlib.crc32(payload_bytes) & 0xFFFFFFFF
        ack = (seq + len(payload_bytes)) & 0xFFFFFFFF
        hex_preview = " ".join(f"{b:02x}" for b in payload_bytes[:24])
        ascii_preview = "".join(
            chr(b) if 32 <= b <= 126 else "." for b in payload_bytes[:24]
        )
        return {
            "srcPort": src_port,
            "dstPort": dst_port,
            "seq": seq,
            "ack": ack,
            "flags": flags or ["PSH", "ACK"],
            "winSize": 65535,
            "checksum": f"0x{crc:08X}",
            "byteLength": len(payload_bytes),
            "hexPreview": hex_preview,
            "asciiPreview": ascii_preview,
        }

    def _send_frame(self, session: ClientSession, payload: dict) -> bool:
        raw = (json.dumps(payload, separators=(",", ":")) + "\n").encode("utf-8")
        try:
            with session.send_lock:
                session.conn.sendall(raw)
            with self.metrics_lock:
                session.tx_bytes += len(raw)
                self.total_tx_bytes += len(raw)
                self.total_packets += 1
            return True
        except OSError:
            return False

    def _snapshot_peers(self) -> List[dict]:
        with self.clients_lock:
            return [
                s.to_public_dict()
                for s in self.clients.values()
                if s.authenticated
            ]

    def _server_stats_payload(self) -> dict:
        with self.clients_lock:
            authed_peers = [s for s in self.clients.values() if s.authenticated]
            peer_count = len(authed_peers)
            threads = [
                {
                    "threadName": s.thread_name,
                    "fd": s.fd,
                    "nick": s.nick,
                    "state": s.state,
                    "channel": s.channel,
                    "port": s.port,
                    "lastRttMs": round(s.last_rtt_ms, 2),
                    "authenticated": s.authenticated,
                }
                for s in self.clients.values()
            ]
        with self.metrics_lock:
            return {
                "host": self.host,
                "port": self.port,
                "activeClients": peer_count,
                "registeredUsers": self.auth_store.user_count(),
                "activePythonThreads": threading.active_count(),
                "workers": threads,
                "totalTxBytes": self.total_tx_bytes,
                "totalRxBytes": self.total_rx_bytes,
                "totalPackets": self.total_packets,
                "uptimeSec": round(time.time() - self.started_at, 1),
                "nickLockState": "UNLOCKED (0 queued)",
                "tcpNoDelay": True,
                "channels": CHANNELS,
            }

    def _broadcast_frame(
        self,
        payload: dict,
        exclude_fd: Optional[int] = None,
        require_auth: bool = True,
    ) -> int:
        with self.broadcast_lock:
            with self.clients_lock:
                targets = [
                    s
                    for fd, s in self.clients.items()
                    if fd != exclude_fd and (not require_auth or s.authenticated)
                ]
            sent = 0
            for target in targets:
                if self._send_frame(target, payload):
                    sent += 1
            return sent

    def _sanitize_nick(self, raw_nick: str) -> str:
        cleaned = raw_nick.strip().lstrip("@")
        allowed = "".join(ch for ch in cleaned if ch.isalnum() or ch in ("_", "-"))
        return allowed[:24]

    def _bind_authenticated_nick(
        self, session: ClientSession, username: str, role: str
    ) -> Tuple[bool, str]:
        with self.nicknames_lock:
            existing_fd = self.nicknames.get(username)
            if existing_fd is not None and existing_fd != session.fd:
                # Allow replacing stale virtual socket or reject duplicate active session
                with self.clients_lock:
                    existing_session = self.clients.get(existing_fd)
                if existing_session and existing_session.authenticated:
                    return (
                        False,
                        f"409 SESSION_ACTIVE: @{username} is already logged in on fd:{existing_fd}.",
                    )
            if session.nick in self.nicknames and self.nicknames[session.nick] == session.fd:
                del self.nicknames[session.nick]
            self.nicknames[username] = session.fd
            session.nick = username
            session.role = role
            session.authenticated = True
            session.state = "ESTABLISHED"
            return True, "200 AUTH_GRANTED"

    def _change_nick(
        self, session: ClientSession, requested: str
    ) -> Tuple[bool, str, str]:
        cleaned = self._sanitize_nick(requested)
        if not cleaned or len(cleaned) < 2:
            return (
                False,
                session.nick,
                "Handle must be at least 2 alphanumeric/underscore characters.",
            )

        with self.nicknames_lock:
            existing_fd = self.nicknames.get(cleaned)
            if existing_fd is not None and existing_fd != session.fd:
                return (
                    False,
                    session.nick,
                    f"409 NICK_IN_USE: @{cleaned} is already active on fd:{existing_fd}",
                )
            old_nick = session.nick
            if old_nick in self.nicknames and self.nicknames[old_nick] == session.fd:
                del self.nicknames[old_nick]
            self.nicknames[cleaned] = session.fd
            session.nick = cleaned
            return True, old_nick, "200 NICK_OK"

    def _complete_login(
        self,
        session: ClientSession,
        user_record: dict,
        action: str,
        pkt_meta: dict,
        channel: str = "general",
    ) -> None:
        ok, bind_msg = self._bind_authenticated_nick(
            session, user_record["username"], user_record.get("role", "CLIENT")
        )
        if not ok:
            self._send_frame(
                session,
                {
                    "type": "auth:error",
                    "action": action,
                    "code": "SESSION_ACTIVE",
                    "message": bind_msg,
                    "timestamp": time.time(),
                    "packet": pkt_meta,
                },
            )
            return

        if channel in CHANNELS:
            session.channel = channel

        self._send_frame(
            session,
            {
                "type": "auth:success",
                "action": action,
                "message": f"Authenticated as @{session.nick} via PBKDF2-HMAC-SHA256",
                "self": session.to_public_dict(),
                "peers": self._snapshot_peers(),
                "stats": self._server_stats_payload(),
                "packet": pkt_meta,
                "timestamp": time.time(),
            },
        )

        self._broadcast_frame(
            {
                "type": "peer:joined",
                "peer": session.to_public_dict(),
                "peers": self._snapshot_peers(),
                "stats": self._server_stats_payload(),
                "packet": pkt_meta,
                "timestamp": time.time(),
            },
            exclude_fd=session.fd,
            require_auth=True,
        )

    def _handle_auth_action(
        self,
        session: ClientSession,
        action: str,
        username: str,
        password: str,
        pkt_meta: dict,
        channel: str = "general",
        is_virtual: bool = False,
    ) -> None:
        session.is_virtual = is_virtual
        if action == "register":
            ok, msg, user_record = self.auth_store.register_user(username, password)
            if not ok or not user_record:
                self._send_frame(
                    session,
                    {
                        "type": "auth:error",
                        "action": "register",
                        "code": "REGISTER_FAILED",
                        "message": msg,
                        "timestamp": time.time(),
                        "packet": pkt_meta,
                    },
                )
                return
            self._complete_login(session, user_record, "register", pkt_meta, channel)
            return

        if action == "login":
            ok, msg, user_record = self.auth_store.authenticate_user(username, password)
            if not ok or not user_record:
                self._send_frame(
                    session,
                    {
                        "type": "auth:error",
                        "action": "login",
                        "code": "INVALID_CREDENTIALS",
                        "message": msg,
                        "timestamp": time.time(),
                        "packet": pkt_meta,
                    },
                )
                return
            self._complete_login(session, user_record, "login", pkt_meta, channel)
            return

    def _handle_logout(self, session: ClientSession, pkt_meta: dict) -> None:
        if not session.authenticated:
            self._send_frame(
                session,
                {
                    "type": "auth:logged_out",
                    "self": session.to_public_dict(),
                    "timestamp": time.time(),
                },
            )
            return

        old_nick = session.nick
        with self.nicknames_lock:
            if self.nicknames.get(old_nick) == session.fd:
                del self.nicknames[old_nick]
        session.authenticated = False
        session.state = "UNAUTHENTICATED"
        session.nick = f"unauth_{session.fd}"

        self._send_frame(
            session,
            {
                "type": "auth:logged_out",
                "oldNick": old_nick,
                "self": session.to_public_dict(),
                "peers": self._snapshot_peers(),
                "stats": self._server_stats_payload(),
                "packet": pkt_meta,
                "timestamp": time.time(),
            },
        )
        self._broadcast_frame(
            {
                "type": "peer:left",
                "fd": session.fd,
                "nick": old_nick,
                "threadName": session.thread_name,
                "peers": self._snapshot_peers(),
                "stats": self._server_stats_payload(),
                "packet": pkt_meta,
                "timestamp": time.time(),
            },
            exclude_fd=session.fd,
            require_auth=True,
        )

    def _handle_command_or_message(
        self,
        session: ClientSession,
        text: str,
        raw_bytes: bytes,
        client_ts: Optional[float] = None,
    ) -> None:
        t0 = time.perf_counter_ns()
        trimmed = text.strip()
        if not trimmed:
            return

        session.seq += len(raw_bytes)
        pkt_meta = self._build_packet_meta(
            src_port=session.port,
            dst_port=self.port,
            payload_bytes=raw_bytes,
            seq=session.seq,
            flags=["PSH", "ACK"],
        )

        # Auth CLI commands work even before authentication
        if trimmed.startswith("/register "):
            parts = trimmed[10:].strip().split(" ", 1)
            if len(parts) < 2:
                self._send_frame(
                    session,
                    {
                        "type": "auth:error",
                        "action": "register",
                        "code": "INVALID_SYNTAX",
                        "message": "Usage: /register <username> <password>",
                        "timestamp": time.time(),
                    },
                )
                return
            self._handle_auth_action(session, "register", parts[0], parts[1], pkt_meta)
            return

        if trimmed.startswith("/login "):
            parts = trimmed[7:].strip().split(" ", 1)
            if len(parts) < 2:
                self._send_frame(
                    session,
                    {
                        "type": "auth:error",
                        "action": "login",
                        "code": "INVALID_SYNTAX",
                        "message": "Usage: /login <username> <password>",
                        "timestamp": time.time(),
                    },
                )
                return
            self._handle_auth_action(session, "login", parts[0], parts[1], pkt_meta)
            return

        if trimmed == "/logout":
            self._handle_logout(session, pkt_meta)
            return

        if trimmed == "/ping" or trimmed.startswith("/ping "):
            dispatch_us = round((time.perf_counter_ns() - t0) / 1000.0, 2)
            self._send_frame(
                session,
                {
                    "type": "system:pong",
                    "fd": session.fd,
                    "nick": session.nick,
                    "threadName": session.thread_name,
                    "clientTs": client_ts,
                    "serverTs": time.time() * 1000.0,
                    "dispatchUs": dispatch_us,
                    "packet": pkt_meta,
                    "stats": self._server_stats_payload(),
                },
            )
            return

        # Enforce authentication for all chat/room commands
        if not session.authenticated:
            self._send_frame(
                session,
                {
                    "type": "system:error",
                    "code": "AUTH_REQUIRED",
                    "message": "401 AUTH_REQUIRED: Please register or log in before joining rooms or sending messages.",
                    "timestamp": time.time(),
                    "packet": pkt_meta,
                },
            )
            return

        # 1. /nick <handle>
        if trimmed.startswith("/nick "):
            requested = trimmed[6:].strip()
            ok, old_nick, status_msg = self._change_nick(session, requested)
            dispatch_us = round((time.perf_counter_ns() - t0) / 1000.0, 2)
            if ok:
                self._broadcast_frame(
                    {
                        "type": "peer:nick_changed",
                        "fd": session.fd,
                        "oldNick": old_nick,
                        "newNick": session.nick,
                        "threadName": session.thread_name,
                        "status": status_msg,
                        "dispatchUs": dispatch_us,
                        "timestamp": time.time(),
                        "packet": pkt_meta,
                        "peers": self._snapshot_peers(),
                        "stats": self._server_stats_payload(),
                    }
                )
            else:
                self._send_frame(
                    session,
                    {
                        "type": "system:error",
                        "code": "NICK_CONFLICT",
                        "message": status_msg,
                        "timestamp": time.time(),
                        "packet": pkt_meta,
                    },
                )
            return

        # 2. /msg @user <message>
        if trimmed.startswith("/msg "):
            rest = trimmed[5:].strip()
            parts = rest.split(" ", 1)
            if len(parts) < 2 or not parts[1].strip():
                self._send_frame(
                    session,
                    {
                        "type": "system:error",
                        "code": "INVALID_WHISPER",
                        "message": "Usage: /msg @<handle> <message>",
                        "timestamp": time.time(),
                    },
                )
                return

            target_handle = self._sanitize_nick(parts[0])
            whisper_body = parts[1].strip()
            with self.nicknames_lock:
                target_fd = self.nicknames.get(target_handle)
            with self.clients_lock:
                target_session = (
                    self.clients.get(target_fd) if target_fd is not None else None
                )

            if target_session is None or not target_session.authenticated:
                self._send_frame(
                    session,
                    {
                        "type": "system:error",
                        "code": "PEER_NOT_FOUND",
                        "message": f"404 PEER_OFFLINE: @{target_handle} is not attached to any authenticated socket.",
                        "timestamp": time.time(),
                    },
                )
                return

            dispatch_us = round((time.perf_counter_ns() - t0) / 1000.0, 2)
            nonce = f"0x{zlib.crc32((session.nick + whisper_body + str(time.time())).encode()) & 0xFFFFFFFF:08X}"
            whisper_frame = {
                "type": "message:whisper",
                "id": f"w-{int(time.time() * 1000)}-{session.seq}",
                "fromNick": session.nick,
                "fromFd": session.fd,
                "fromThread": session.thread_name,
                "toNick": target_session.nick,
                "toFd": target_session.fd,
                "toThread": target_session.thread_name,
                "text": whisper_body,
                "nonce": nonce,
                "dispatchUs": dispatch_us,
                "timestamp": time.time(),
                "packet": pkt_meta,
                "stats": self._server_stats_payload(),
            }
            self._send_frame(target_session, whisper_frame)
            if target_session.fd != session.fd:
                self._send_frame(session, whisper_frame)
            return

        # 3. /join #<channel>
        if trimmed.startswith("/join "):
            ch = trimmed[6:].strip().lstrip("#").lower()
            if ch not in CHANNELS:
                ch = "general"
            old_ch = session.channel
            session.channel = ch
            self._broadcast_frame(
                {
                    "type": "peer:channel_switched",
                    "fd": session.fd,
                    "nick": session.nick,
                    "oldChannel": old_ch,
                    "channel": ch,
                    "timestamp": time.time(),
                    "peers": self._snapshot_peers(),
                    "stats": self._server_stats_payload(),
                }
            )
            return

        # 4. /stats
        if trimmed.startswith("/stats"):
            self._send_frame(
                session,
                {
                    "type": "system:stats",
                    "timestamp": time.time(),
                    "stats": self._server_stats_payload(),
                    "packet": pkt_meta,
                },
            )
            return

        # 5. /broadcast <text> or standard room broadcast
        is_explicit_broadcast = trimmed.startswith("/broadcast ")
        body = trimmed[11:].strip() if is_explicit_broadcast else trimmed
        if not body:
            return

        dispatch_us = round((time.perf_counter_ns() - t0) / 1000.0, 2)
        bcast_frame = {
            "type": "message:broadcast",
            "id": f"m-{int(time.time() * 1000)}-{session.seq}",
            "fromNick": session.nick,
            "fromFd": session.fd,
            "fromThread": session.thread_name,
            "channel": "general" if is_explicit_broadcast else session.channel,
            "isGlobalBroadcast": is_explicit_broadcast,
            "text": body,
            "dispatchUs": dispatch_us,
            "timestamp": time.time(),
            "packet": pkt_meta,
            "stats": self._server_stats_payload(),
        }
        self._broadcast_frame(bcast_frame)

    def handle_client(self, conn: socket.socket, addr: tuple) -> None:
        fd = conn.fileno()
        ip, port = addr[0], addr[1]
        thread_label = self._next_thread_label()
        threading.current_thread().name = thread_label

        try:
            conn.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        except OSError:
            pass

        session = ClientSession(
            fd=fd,
            conn=conn,
            ip=ip,
            port=port,
            nick=f"unauth_{fd}",
            thread_name=thread_label,
            authenticated=False,
            state="AUTH_REQUIRED",
        )

        with self.clients_lock:
            self.clients[fd] = session

        syn_packet = self._build_packet_meta(
            src_port=port,
            dst_port=self.port,
            payload_bytes=f"SYN_ACK fd:{fd} {ip}:{port}".encode("utf-8"),
            seq=session.seq,
            flags=["SYN", "ACK"],
        )

        # Send welcome / auth-required handshake frame to connecting socket
        self._send_frame(
            session,
            {
                "type": "welcome",
                "authRequired": True,
                "self": session.to_public_dict(),
                "peers": self._snapshot_peers(),
                "stats": self._server_stats_payload(),
                "packet": syn_packet,
                "timestamp": time.time(),
            },
        )

        buffer = b""
        try:
            while self.running:
                chunk = conn.recv(4096)
                if not chunk:
                    break
                with self.metrics_lock:
                    session.rx_bytes += len(chunk)
                    self.total_rx_bytes += len(chunk)
                buffer += chunk

                while b"\n" in buffer:
                    line_bytes, buffer = buffer.split(b"\n", 1)
                    line_bytes = line_bytes.rstrip(b"\r")
                    if not line_bytes:
                        continue
                    line_str = line_bytes.decode("utf-8", errors="replace").strip()
                    if not line_str:
                        continue

                    if line_str.startswith("{"):
                        try:
                            obj = json.loads(line_str)
                            msg_type = obj.get("type", "chat")
                            pkt_meta = self._build_packet_meta(
                                src_port=session.port,
                                dst_port=self.port,
                                payload_bytes=line_bytes,
                                seq=session.seq + len(line_bytes),
                                flags=["PSH", "ACK"],
                            )
                            if msg_type in ("register", "login"):
                                self._handle_auth_action(
                                    session,
                                    action=msg_type,
                                    username=str(obj.get("username", "")),
                                    password=str(obj.get("password", "")),
                                    pkt_meta=pkt_meta,
                                    channel=str(obj.get("channel", "general")),
                                    is_virtual=bool(obj.get("isVirtual", False)),
                                )
                            elif msg_type == "logout":
                                self._handle_logout(session, pkt_meta)
                            elif msg_type == "rtt_report":
                                rtt = float(obj.get("rttMs", session.last_rtt_ms))
                                session.last_rtt_ms = max(0.05, min(999.0, rtt))
                            elif msg_type == "ping":
                                self._handle_command_or_message(
                                    session,
                                    "/ping",
                                    line_bytes,
                                    client_ts=obj.get("clientTs"),
                                )
                            elif msg_type == "chat":
                                text = str(obj.get("text", ""))
                                ch = obj.get("channel")
                                if session.authenticated and ch in CHANNELS:
                                    session.channel = ch
                                self._handle_command_or_message(
                                    session,
                                    text,
                                    line_bytes,
                                    client_ts=obj.get("clientTs"),
                                )
                            else:
                                self._handle_command_or_message(
                                    session, str(obj.get("text", line_str)), line_bytes
                                )
                        except json.JSONDecodeError:
                            self._handle_command_or_message(session, line_str, line_bytes)
                    else:
                        self._handle_command_or_message(session, line_str, line_bytes)
        except OSError:
            pass
        finally:
            was_authed = session.authenticated
            old_nick = session.nick
            with self.nicknames_lock:
                if self.nicknames.get(old_nick) == fd:
                    del self.nicknames[old_nick]
            with self.clients_lock:
                if fd in self.clients:
                    del self.clients[fd]
            try:
                conn.close()
            except OSError:
                pass

            if was_authed:
                fin_packet = self._build_packet_meta(
                    src_port=port,
                    dst_port=self.port,
                    payload_bytes=f"FIN_ACK fd:{fd} @{old_nick}".encode("utf-8"),
                    seq=session.seq + 1,
                    flags=["FIN", "ACK"],
                )
                self._broadcast_frame(
                    {
                        "type": "peer:left",
                        "fd": fd,
                        "nick": old_nick,
                        "threadName": session.thread_name,
                        "peers": self._snapshot_peers(),
                        "stats": self._server_stats_payload(),
                        "packet": fin_packet,
                        "timestamp": time.time(),
                    },
                    require_auth=True,
                )

    def start(self) -> None:
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server_socket.bind((self.host, self.port))
        self.server_socket.listen(128)
        self.server_socket.settimeout(1.0)
        self.running = True
        print(
            f"[PulseTCP] Python TCP Server listening on {self.host}:{self.port} (AF_INET, SOCK_STREAM)",
            flush=True,
        )

        while self.running:
            try:
                conn, addr = self.server_socket.accept()
                worker = threading.Thread(
                    target=self.handle_client,
                    args=(conn, addr),
                    daemon=True,
                )
                worker.start()
            except socket.timeout:
                continue
            except OSError:
                break

    def stop(self) -> None:
        self.running = False
        with self.clients_lock:
            for session in list(self.clients.values()):
                try:
                    session.conn.close()
                except OSError:
                    pass
            self.clients.clear()
        if self.server_socket:
            try:
                self.server_socket.close()
            except OSError:
                pass
            self.server_socket = None


def main() -> None:
    parser = argparse.ArgumentParser(description="PulseTCP Multi-Threaded Socket Server")
    parser.add_argument("--host", default="0.0.0.0", help="Bind host (default 0.0.0.0)")
    parser.add_argument("--port", type=int, default=9090, help="Bind TCP port (default 9090)")
    parser.add_argument(
        "--db", default="python/users.db", help="SQLite user credential store path"
    )
    args = parser.parse_args()

    server = PulseTCPServer(host=args.host, port=args.port, db_path=args.db)

    def handle_sig(_signum: int, _frame: object) -> None:
        server.stop()
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_sig)
    signal.signal(signal.SIGINT, handle_sig)

    try:
        server.start()
    except KeyboardInterrupt:
        server.stop()


if __name__ == "__main__":
    main()
