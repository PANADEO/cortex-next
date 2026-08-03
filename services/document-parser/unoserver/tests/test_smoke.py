# This sidecar has no FastAPI app to exercise with a TestClient (see
# code-python-service/SKILL.md "Testy" — that pattern assumes `main.py`,
# which this image doesn't have). Instead these are subprocess smoke tests
# against the actual binaries docker-compose.yml and the document-parser
# backend depend on — genuinely capable of catching a broken LibreOffice/UNO
# install, not `assert True` theater. Mirrors the CI job's own rationale
# (docker-build.yml comment): verify INSIDE the built image, not "the
# Dockerfile looks right".
import subprocess


def test_soffice_binary_runs():
    """apt-get installed `libreoffice*` — confirm the headless binary this
    sidecar wraps actually starts and reports a version, not just that the
    package manager exited 0."""
    result = subprocess.run(
        ["soffice", "--version"], capture_output=True, text=True, timeout=30
    )
    assert result.returncode == 0
    assert "LibreOffice" in result.stdout


def test_unoconvert_cli_is_on_path():
    """`unoconvert` is the CLI entry point document-parser's backend calls
    over RPC against this sidecar (services/document-parser/requirements.txt
    pins the same `unoserver` package) — confirm the pip install actually
    put a working console_script on PATH."""
    result = subprocess.run(
        ["unoconvert", "--version"], capture_output=True, text=True, timeout=30
    )
    assert result.returncode == 0
    assert "unoconvert" in result.stdout.lower()


def test_unoserver_server_module_imports():
    """`python3 -m unoserver.server --interface 0.0.0.0 --port 2003` is the
    EXACT command docker-compose.yml runs as this container's CMD — confirm
    the module actually imports cleanly rather than failing at container
    start time, which `docker run <tag> pytest` would otherwise never catch
    since it doesn't invoke the real CMD."""
    result = subprocess.run(
        ["python3", "-c", "import unoserver.server"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
