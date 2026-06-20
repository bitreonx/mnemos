"""Mnemos — the memory layer for software.

This package is a thin shim around a prebuilt Node SEA binary.
On `pip install`, it copies the right binary for the user's platform
into the Python environment's bin/ directory so that `mnemos` is
available on PATH.
"""

from __future__ import annotations

import os
import platform
import shutil
import stat
import sys
from pathlib import Path

__version__ = "0.3.0"

# Map (system, machine) -> filename inside _bundled/
_BINARY_MAP = {
    ("Linux", "x86_64"):   "mnemos-bin-linux-x64",
    ("Linux", "aarch64"):  "mnemos-bin-linux-arm64",
    ("Darwin", "x86_64"):  "mnemos-bin-macos-x64",
    ("Darwin", "arm64"):   "mnemos-bin-macos-arm64",
    ("Windows", "AMD64"):  "mnemos-bin-windows-x64.exe",
    ("Windows", "x86_64"): "mnemos-bin-windows-x64.exe",
}


def _bundled_binary_name() -> str | None:
    return _BINARY_MAP.get((platform.system(), platform.machine()))


def _bundled_path() -> Path | None:
    name = _bundled_binary_name()
    if not name:
        return None
    return Path(__file__).parent / "_bundled" / name


def _install_binary() -> None:
    """Copy the bundled binary next to the running Python interpreter
    so it lands on PATH (Scripts\ on Windows, bin/ elsewhere)."""
    src = _bundled_path()
    if not src or not src.exists():
        # No binary for this platform — silently no-op.
        # Users will see the error only if they try to run `mnemos`.
        return

    exe_dir = Path(sys.executable).parent
    dst_name = "mnemos.exe" if os.name == "nt" else "mnemos"
    dst = exe_dir / dst_name

    try:
        shutil.copyfile(src, dst)
        if os.name != "nt":
            current = dst.stat().st_mode
            dst.chmod(current | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    except OSError:
        # Read-only system Python, etc. — leave it; user can run via `python -m mnemos`.
        pass


def _run() -> None:
    """Console-script entry point: `mnemos ...`."""
    src = _bundled_path()
    if not src or not src.exists():
        sys.stderr.write(
            "mnemos: no prebuilt binary for this platform "
            f"({platform.system()} {platform.machine()}).\n"
            "Install via npm instead: pip install getmnemos  # or: npm i -g getmnemos\n"
        )
        sys.exit(1)

    import subprocess
    args = [str(src), *sys.argv[1:]]
    try:
        exit_code = subprocess.call(args)
    except KeyboardInterrupt:
        exit_code = 130
    sys.exit(exit_code)


# Run the install shim on import (PEP 517 wheels run this on install).
_install_binary()


if __name__ == "__main__":
    _run()
