import json
import os
import socket
import tempfile
import threading
import time
import unittest

from python.tcp_server import PulseTCPServer, hash_password, verify_password


def _recv_until(sock: socket.socket, predicate, timeout: float = 3.0):
    deadline = time.time() + timeout
    sock.settimeout(0.2)
    buf = b""
    frames = []
    while time.time() < deadline:
        try:
            chunk = sock.recv(4096)
            if not chunk:
                break
            buf += chunk
            while b"\n" in buf:
                line, buf = buf.split(b"\n", 1)
                if line.strip():
                    frame = json.loads(line.decode("utf-8"))
                    frames.append(frame)
                    if predicate(frame):
                        return frame, frames
        except socket.timeout:
            continue
    return None, frames


class TestPulseTCPServer(unittest.TestCase):
    def setUp(self) -> None:
        self.tmpdir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.tmpdir.name, "test_users.db")
        self.server = PulseTCPServer(host="127.0.0.1", port=0, db_path=self.db_path)
        self.sock_ready = threading.Event()

        def run():
            self.server.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.server.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.server.server_socket.bind(("127.0.0.1", 0))
            self.server.port = self.server.server_socket.getsockname()[1]
            self.server.server_socket.listen(32)
            self.server.server_socket.settimeout(0.5)
            self.server.running = True
            self.sock_ready.set()
            while self.server.running:
                try:
                    conn, addr = self.server.server_socket.accept()
                    threading.Thread(
                        target=self.server.handle_client, args=(conn, addr), daemon=True
                    ).start()
                except socket.timeout:
                    continue
                except OSError:
                    break

        self.server_thread = threading.Thread(target=run, daemon=True)
        self.server_thread.start()
        self.sock_ready.wait(timeout=2.0)

    def tearDown(self) -> None:
        self.server.stop()
        self.server_thread.join(timeout=2.0)
        self.tmpdir.cleanup()

    def _connect_and_register(self, username: str, password: str) -> socket.socket:
        c = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        c.connect(("127.0.0.1", self.server.port))
        welcome, _ = _recv_until(c, lambda f: f.get("type") == "welcome")
        self.assertIsNotNone(welcome)
        self.assertTrue(welcome.get("authRequired"))

        c.sendall(
            (json.dumps({"type": "register", "username": username, "password": password}) + "\n").encode(
                "utf-8"
            )
        )
        authed, _ = _recv_until(
            c, lambda f: f.get("type") == "auth:success" and f.get("self", {}).get("nick") == username
        )
        self.assertIsNotNone(authed)
        return c

    def test_password_hashing_uses_salted_pbkdf2(self) -> None:
        h1 = hash_password("SecretPass123")
        h2 = hash_password("SecretPass123")
        self.assertNotEqual(h1, h2)
        self.assertTrue(h1.startswith("pbkdf2_sha256$"))
        self.assertTrue(verify_password("SecretPass123", h1))
        self.assertFalse(verify_password("WrongPass123", h1))

    def test_unauthenticated_client_blocked_and_login_flow(self) -> None:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect(("127.0.0.1", self.server.port))
        try:
            _recv_until(sock, lambda f: f.get("type") == "welcome")
            sock.sendall(b"unauthorized chat attempt\n")
            err, _ = _recv_until(sock, lambda f: f.get("type") == "system:error")
            self.assertIsNotNone(err)
            self.assertEqual(err["code"], "AUTH_REQUIRED")

            # Register new user
            sock.sendall(
                (json.dumps({"type": "register", "username": "zoe_net", "password": "StrongPassword9"}) + "\n").encode(
                    "utf-8"
                )
            )
            reg_ok, _ = _recv_until(sock, lambda f: f.get("type") == "auth:success")
            self.assertIsNotNone(reg_ok)

            # Logout and re-login with wrong password -> rejected, then right password -> accepted
            sock.sendall(b"/logout\n")
            logged_out, _ = _recv_until(sock, lambda f: f.get("type") == "auth:logged_out")
            self.assertIsNotNone(logged_out)

            sock.sendall(
                (json.dumps({"type": "login", "username": "zoe_net", "password": "BadPassword"}) + "\n").encode(
                    "utf-8"
                )
            )
            bad_login, _ = _recv_until(sock, lambda f: f.get("type") == "auth:error")
            self.assertIsNotNone(bad_login)

            sock.sendall(
                (json.dumps({"type": "login", "username": "zoe_net", "password": "StrongPassword9"}) + "\n").encode(
                    "utf-8"
                )
            )
            good_login, _ = _recv_until(sock, lambda f: f.get("type") == "auth:success")
            self.assertIsNotNone(good_login)
        finally:
            sock.close()

    def test_concurrent_broadcast_and_private_whisper(self) -> None:
        alice = self._connect_and_register("alice_test", "PassAlice123")
        bob = self._connect_and_register("bob_test", "PassBob123")
        charlie = self._connect_and_register("charlie_test", "PassCharlie123")

        try:
            alice.sendall(b"/broadcast hello cluster\n")
            bob_msg, _ = _recv_until(
                bob,
                lambda f: f.get("type") == "message:broadcast" and f.get("text") == "hello cluster",
            )
            charlie_msg, _ = _recv_until(
                charlie,
                lambda f: f.get("type") == "message:broadcast" and f.get("text") == "hello cluster",
            )
            self.assertIsNotNone(bob_msg)
            self.assertIsNotNone(charlie_msg)

            alice.sendall(b"/msg @bob_test secret key 99\n")
            bob_whisper, _ = _recv_until(
                bob,
                lambda f: f.get("type") == "message:whisper" and f.get("text") == "secret key 99",
            )
            self.assertIsNotNone(bob_whisper)

            charlie_leaked, _ = _recv_until(
                charlie,
                lambda f: f.get("type") == "message:whisper",
                timeout=0.4,
            )
            self.assertIsNone(charlie_leaked)

            charlie.sendall(b"/nick alice_test\n")
            err, _ = _recv_until(charlie, lambda f: f.get("type") == "system:error")
            self.assertIsNotNone(err)
            self.assertEqual(err["code"], "NICK_CONFLICT")
        finally:
            alice.close()
            bob.close()
            charlie.close()


if __name__ == "__main__":
    unittest.main()
