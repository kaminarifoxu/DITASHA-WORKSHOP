#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
(cd assets && x86_64-w64-mingw32-windres app.rc -O coff -o app.res.o)
x86_64-w64-mingw32-gcc src/desktop.c assets/app.res.o -isystem vendor -municode -mwindows -Os -s -Wall -Wextra -Werror -Wno-misleading-indentation -Wno-unknown-pragmas -o DITASHA-Workspace.exe -lole32 -lshell32 -luser32 -lgdi32 -lwinhttp -lcrypt32
