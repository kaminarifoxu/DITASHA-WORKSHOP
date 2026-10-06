# DITASHA-WORKSHOP

Local Windows AI workspace with a pixel office, animated employees, projects, notes, and chat history stored on your PC.

Download `DITASHA-Workspace.exe` from [Releases](https://github.com/kaminarifoxu/DITASHA-WORKSHOP/releases/latest). Windows 10/11 x64 is required. No Node.js or Python is needed to run the app. First-time setup can install Microsoft's WebView2 Runtime.

## AI and data

Enter your OpenRouter key in Settings. General employees use `openrouter/free`; coding employees use `poolside/laguna-s-2.1:free` with a free-only fallback. Native requests apply zero-price provider caps. Keys are encrypted with Windows DPAPI, not embedded in source or releases. The workspace UI works offline; AI and app updates need internet.

Projects, custom employees, notes and chats are stored in `%LOCALAPPDATA%\DITASHA Workspace\LocalData`. Export/import backups are available in Settings. Website data is not automatically copied.

## Automatic updates

The app checks on startup and every six hours, downloads newer stable releases automatically, verifies SHA-256/size/Windows format, and offers restart installation. Saved data and keys stay in place. The previous EXE is retained as `.previous`, with rollback if replacement fails.

This repository is private. In GitHub, create a fine-grained personal access token restricted to **DITASHA-WORKSHOP**, with **Contents: Read-only**. Enter it in **Settings → Update aplikasi**. The app encrypts it for your Windows user. Do not commit tokens or API keys.

Manual checks and restart installation are also in the native Workspace menu. Automatic downloads can be disabled in Settings.

## Publish an update

1. Change the code.
2. Run `python3 scripts/set-version.py 3.2.0`, choosing a new version.
3. Commit and push to `main`.
4. The release workflow builds and tests the app, including replacement/rollback tests on Windows, then publishes a GitHub Release.

Existing release versions are not overwritten. Failed tests stop publishing. The source archive, EXE and checksum are attached to each release.

## Build locally

Requires Node.js 22+, Python 3, and a MinGW-w64 x64 compiler.

```sh
python3 scripts/fetch-vendor.py
cd frontend
npm install
npm run check
npm run build
cd ..
python3 pack-frontend.py
bash build.sh
```

The Microsoft SDK header/loader use pinned checksums. The runtime bootstrapper is downloaded from Microsoft and its Authenticode signature is verified in the Windows CI job. React UI, images and native components are embedded into the EXE.

See [README.txt](README.txt) for file locations and setup details, and [THIRD-PARTY.txt](THIRD-PARTY.txt) for dependency notices. No customer data, OpenRouter key, or GitHub token belongs in this repository.
