"""Local Docker-only Railway simulation. Creates and removes synthetic containers/volumes.

Build first: docker build -t aftertone:railway .
Run: python3 scripts/smoke_railway.py --output /tmp/aftertone-railway-metrics.json
No Railway credentials, CLI or cloud resources are used.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import http.client
import json
import secrets
import statistics
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def docker(*args: str, check: bool = True, input: str | None = None) -> str:
    result = subprocess.run(["docker", *args], capture_output=True, text=True, input=input)
    if check and result.returncode:
        raise RuntimeError(result.stderr)
    return (result.stdout + (result.stderr if args[0] == "logs" else "")).strip()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", default="aftertone:railway")
    parser.add_argument("--baseline-image")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    suffix = secrets.token_hex(5)
    name = "aftertone-railway-test-" + suffix
    volume = name + "-data"
    password = "synthetic-only-password-" + suffix
    owner_hash = docker(
        "run",
        "--rm",
        "-i",
        "--entrypoint",
        "python",
        args.image,
        "-c",
        "from argon2 import PasswordHasher; import sys; print(PasswordHasher().hash(sys.stdin.read()))",
        input=password,
    )
    environment = {
        "AFTERTONE_WEB_ORIGIN": "https://temporary-test.up.railway.app",
        "AFTERTONE_OWNER_PASSWORD_HASH": owner_hash,
        "RAILWAY_SERVICE_ID": "synthetic-local-service",
        "RAILWAY_VOLUME_MOUNT_PATH": "/data",
        "RAILWAY_RUN_UID": "0",
        "AFTERTONE_INIT_VOLUME": "1",
        "PORT": "18765",
    }
    metrics = {
        "image": args.image,
        "environment": "local Docker; 1 CPU, 512 MiB; synthetic data",
        "measurements": {},
    }
    port = 0
    with tempfile.TemporaryDirectory(prefix=name) as temporary:
        temporary = Path(temporary)
        env_file = temporary / "synthetic.env"
        try:
            docker("volume", "create", volume)
            # A real root-owned mount masks the image's /data ownership, as on Railway.
            docker(
                "run",
                "--rm",
                "--user",
                "0:0",
                "--mount",
                f"type=volume,src={volume},dst=/data",
                "--entrypoint",
                "sh",
                args.image,
                "-c",
                "chown 0:0 /data && chmod 700 /data",
            )

            def start(*, maintenance=False, allow_empty=False, image=None, root=True):
                nonlocal port
                docker("rm", "-f", name, check=False)
                values = {
                    **environment,
                    "AFTERTONE_MAINTENANCE": "1" if maintenance else "0",
                    "AFTERTONE_ALLOW_EMPTY_DATABASE": "1" if allow_empty else "0",
                }
                env_file.write_text("".join(f"{key}={value}\n" for key, value in values.items()))
                env_file.chmod(0o600)
                run = [
                    "run",
                    "-d",
                    "--name",
                    name,
                    "--env-file",
                    str(env_file),
                    "--read-only",
                    "--tmpfs",
                    "/tmp:size=64m,mode=1777",
                    "--memory",
                    "512m",
                    "--cpus",
                    "1",
                    "--mount",
                    f"type=volume,src={volume},dst=/data",
                    "-p",
                    "127.0.0.1::18765",
                ]
                if root:
                    run += ["--user", "0:0"]
                else:
                    run += ["--cap-drop", "ALL", "--security-opt", "no-new-privileges:true"]
                run += [image or args.image]
                started = time.perf_counter()
                docker(*run)
                info = json.loads(docker("inspect", name))[0]
                bindings = (info["NetworkSettings"].get("Ports") or {}).get("18765/tcp")
                port = int(bindings[0]["HostPort"]) if bindings else 0
                return started

            def request(method, path, payload=None, *, cookie=None, csrf=None, multipart=None):
                headers = {}
                body = None
                if payload is not None:
                    body = json.dumps(payload)
                    headers["Content-Type"] = "application/json"
                if multipart is not None:
                    body, content_type = multipart
                    headers["Content-Type"] = content_type
                if method != "GET":
                    headers["Origin"] = environment["AFTERTONE_WEB_ORIGIN"]
                if cookie:
                    headers["Cookie"] = cookie
                if csrf:
                    headers["X-CSRF-Token"] = csrf
                conn = http.client.HTTPConnection("127.0.0.1", port, timeout=30)
                started = time.perf_counter()
                try:
                    conn.request(method, path, body, headers)
                    response = conn.getresponse()
                    return (
                        response.status,
                        dict(response.getheaders()),
                        response.read(),
                        (time.perf_counter() - started) * 1000,
                    )
                finally:
                    conn.close()

            def ready(started):
                for _ in range(200):
                    try:
                        response = request("GET", "/health")
                        if response[0] == 200:
                            return round(time.perf_counter() - started, 3)
                    except (OSError, http.client.HTTPException):
                        pass
                    info = json.loads(docker("inspect", name))[0]
                    if not info["State"]["Running"]:
                        raise RuntimeError("Container exited: " + docker("logs", name))
                    time.sleep(0.1)
                raise RuntimeError("Container readiness timed out")

            def expect_failure():
                result = json.loads(docker("wait", name))
                assert result != 0, "Misconfigured container unexpectedly succeeded"
                return docker("logs", name)  # Never print configuration or credentials.

            def memory(phase):
                script = """import json
from pathlib import Path
status=dict(line.split(':',1) for line in Path('/proc/1/status').read_text().splitlines() if ':' in line)
read=lambda name: int(Path('/sys/fs/cgroup/'+name).read_text())
print(json.dumps({'rss_mib':round(int(status['VmRSS'].split()[0])/1024,2),'process_peak_mib':round(int(status['VmHWM'].split()[0])/1024,2),'container_current_mib':round(read('memory.current')/1024**2,2),'container_peak_mib':round(read('memory.peak')/1024**2,2),'uid':status['Uid'].split(),'effective_capabilities':status['CapEff'].strip()}))"""
                value = json.loads(docker("exec", name, "python", "-c", script))
                assert value["uid"] == ["10001"] * 4
                assert int(value["effective_capabilities"], 16) == 0
                metrics["measurements"][phase] = value

            if args.baseline_image:
                start(image=args.baseline_image, root=False)
                expect_failure()
                metrics["baseline_nonroot_on_root_owned_volume"] = "rejected as expected"
            start()
            assert "database missing" in expect_failure()
            metrics["startup_seconds"] = ready(start(allow_empty=True))
            memory("idle_before_login")
            assert request("GET", "/")[0] == 200
            assert request("GET", "/library")[0] == 200
            for path in ["/docs", "/openapi.json", "/api/nonexistent"]:
                assert request("GET", path)[0] == 404
            assert request("GET", "/api/albums")[0] == 200
            assert request("POST", "/api/artists", {"name": "Anonymous"})[0] == 401
            assert request("POST", "/api/auth/login", {"password": "wrong"})[0] == 401
            status, headers, body, login_ms = request(
                "POST", "/api/auth/login", {"password": password}
            )
            assert status == 200
            cookie = headers["set-cookie"].split(";", 1)[0]
            assert all(
                flag in headers["set-cookie"]
                for flag in ["__Host-", "Secure", "HttpOnly", "SameSite=strict"]
            )
            csrf = json.loads(body)["csrf_token"]
            metrics["login_ms"] = round(login_ms, 2)
            memory("after_argon2_login")
            assert request("POST", "/api/artists", {"name": "No CSRF"}, cookie=cookie)[0] == 403
            payload = {
                "title": "Synthetic Railway journal",
                "artists": [{"name": "Synthetic artist"}],
                "tracks": [{"position": 1, "title": "Synthetic track"}],
            }
            status, _, body, write_ms = request(
                "POST", "/api/albums", payload, cookie=cookie, csrf=csrf
            )
            assert status == 201
            album = json.loads(body)
            metrics["sqlite_album_write_ms"] = round(write_ms, 2)
            revision_payload = {
                "coherence": "7",
                "emotion": "8",
                "album_notes": "SYNTHETIC PRIVATE NOTE",
                "tracks": [{"track_id": album["tracks"][0]["id"], "score": "9"}],
            }
            response = request(
                "POST",
                f"/api/albums/{album['id']}/revisions",
                revision_payload,
                cookie=cookie,
                csrf=csrf,
            )
            assert response[0] == 201
            revision = json.loads(response[2])
            revision_path = f"/api/albums/{album['id']}/revisions/{revision['id']}"
            assert b"SYNTHETIC PRIVATE NOTE" not in request("GET", revision_path)[2]
            assert b"SYNTHETIC PRIVATE NOTE" in request("GET", revision_path, cookie=cookie)[2]

            # Generate synthetic media/workbook in a short-lived exec process.
            media = base64.b64decode(
                docker(
                    "exec",
                    name,
                    "python",
                    "-c",
                    "from PIL import Image; from io import BytesIO; import base64; b=BytesIO(); Image.new('RGB',(3600,3600),'navy').save(b,format='PNG'); print(base64.b64encode(b.getvalue()).decode())",
                )
            )

            def form(data, filename, mime):
                boundary = "aftertone-test-boundary"
                return (
                    f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\nContent-Type: {mime}\r\n\r\n'.encode()
                    + data
                    + f"\r\n--{boundary}--\r\n".encode(),
                    f"multipart/form-data; boundary={boundary}",
                )

            response = request(
                "PUT",
                f"/api/albums/{album['id']}/cover",
                cookie=cookie,
                csrf=csrf,
                multipart=form(media, "synthetic.png", "image/png"),
            )
            assert response[0] == 200, response[2]
            cover_path = json.loads(response[2])["cover_url"]
            response = request(
                "PUT",
                f"/api/artists/{album['artists'][0]['id']}/image",
                cookie=cookie,
                csrf=csrf,
                multipart=form(media, "synthetic.png", "image/png"),
            )
            assert response[0] == 200, response[2]
            portrait_path = json.loads(response[2])["image_url"]
            stored_media = {
                path: hashlib.sha256(request("GET", path)[2]).hexdigest()
                for path in [cover_path, portrait_path]
            }
            memory("after_12_96_megapixel_images")
            workbook = base64.b64decode(
                docker(
                    "exec",
                    name,
                    "python",
                    "-c",
                    "from openpyxl import Workbook; from io import BytesIO; import base64; w=Workbook(); s=w.active; s.append(['ALBUM','ARTISTA','PRECALIFICACION','COHERENCIA','EMOCION']); [s.append(['Synthetic '+str(i),'Synthetic artist',None,None,None]) for i in range(250)]; b=BytesIO(); w.save(b); print(base64.b64encode(b.getvalue()).decode())",
                )
            )
            response = request(
                "POST",
                "/api/imports/legacy-ratings/preview",
                cookie=cookie,
                csrf=csrf,
                multipart=form(
                    workbook,
                    "synthetic.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ),
            )
            assert response[0] == 200, response[2]
            assert len(json.loads(response[2])["rows"]) == 250
            memory("after_250_row_excel_preview")
            for key, path in [
                ("health_median_ms", "/health"),
                ("album_list_median_ms", "/api/albums"),
            ]:
                metrics[key] = round(
                    statistics.median(request("GET", path)[3] for _ in range(7)), 2
                )
            failure = subprocess.run(
                ["docker", "exec", name, "python", "/app/runtime.py"],
                capture_output=True,
                text=True,
            )
            assert failure.returncode != 0 and "Another Aftertone" in failure.stderr
            docker("stop", name)
            metrics["redeploy_startup_seconds"] = ready(start())
            assert (
                json.loads(request("GET", revision_path)[2])["final_rating"]
                == revision["final_rating"]
            )
            for path, expected in stored_media.items():
                assert hashlib.sha256(request("GET", path)[2]).hexdigest() == expected
            response = request("POST", "/api/auth/logout", {}, cookie=cookie, csrf=csrf)
            assert response[0] == 200
            assert (
                request("POST", "/api/artists", {"name": "Revoked"}, cookie=cookie, csrf=csrf)[0]
                == 401
            )
            docker("stop", name)
            ready(start(maintenance=True))
            assert json.loads(request("GET", "/health")[2])["status"] == "maintenance"
            for method, path in [
                ("GET", "/library"),
                ("GET", "/api/albums"),
                ("POST", "/api/albums"),
                ("GET", cover_path),
            ]:
                assert request(method, path)[0] == 503
            docker(
                "exec",
                name,
                "python",
                "/app/runtime.py",
                "python",
                "/app/scripts/backup.py",
                "create",
                "--database",
                "/data/aftertone.sqlite3",
                "--media",
                "/data/covers",
                "--destination",
                "/data/backups/synthetic.tar.gz",
            )
            archive = temporary / "downloaded.tar.gz"
            docker("cp", f"{name}:/data/backups/synthetic.tar.gz", str(archive))
            verified = subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "scripts/backup.py"),
                    "restore",
                    "--archive",
                    str(archive),
                    "--destination",
                    str(temporary / "verified"),
                ],
                capture_output=True,
                text=True,
            )
            assert verified.returncode == 0, verified.stderr
            docker(
                "exec",
                name,
                "python",
                "/app/runtime.py",
                "python",
                "/app/scripts/backup.py",
                "restore",
                "--archive",
                "/data/backups/synthetic.tar.gz",
                "--destination",
                "/data/recovered",
            )
            docker("stop", name)
            environment.update(
                {
                    "AFTERTONE_DATABASE_URL": "sqlite:////data/recovered/aftertone.sqlite3",
                    "AFTERTONE_COVER_DIR": "/data/recovered/covers",
                }
            )
            ready(start())
            assert (
                json.loads(request("GET", revision_path)[2])["final_rating"]
                == revision["final_rating"]
            )
            for path, expected in stored_media.items():
                assert hashlib.sha256(request("GET", path)[2]).hexdigest() == expected
            memory("after_restore")
            # Preserve the existing Compose path: image USER, no Railway settings,
            # all capabilities dropped, read-only root and the same durable journal.
            docker("stop", name)
            environment = {
                key: value
                for key, value in environment.items()
                if not key.startswith("RAILWAY_") and key != "AFTERTONE_INIT_VOLUME"
            }
            ready(start(root=False))
            assert (
                json.loads(request("GET", revision_path)[2])["final_rating"]
                == revision["final_rating"]
            )
            memory("vps_unprivileged_runtime")
            metrics["vps_unprivileged_compatibility"] = "PASS"
            metrics["image_size_mib"] = round(
                int(docker("image", "inspect", args.image, "--format", "{{.Size}}")) / 1024**2, 2
            )
            metrics["result"] = (
                "PASS: root-volume initialization/drop, dynamic PORT, migrations, public/private API, cookies/CSRF, lock, redeploy/media persistence, maintenance, downloaded archive verification and restored-volume startup"
            )
            if args.output:
                args.output.write_text(json.dumps(metrics, indent=2) + "\n")
            print(json.dumps(metrics, indent=2))
        finally:
            docker("rm", "-f", name, check=False)
            docker("volume", "rm", volume, check=False)


if __name__ == "__main__":
    main()
