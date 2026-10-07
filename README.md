# DITASHA-WORKSHOP

Local Windows AI workspace with a pixel office, animated employees, projects, notes, and chat history stored on your PC.

Download `DITASHA-Workspace.exe` from [Releases](https://github.com/kaminarifoxu/DITASHA-WORKSHOP/releases/latest). Windows 10/11 x64 is required. No Node.js or Python is needed to run the app. First-time setup can install Microsoft's WebView2 Runtime.

## Amii and the office

All new requests go through Amii. Amii uses a free AI call to choose a team member and create a brief. Amii stays at his desk; employees come there to receive tasks, work at their own desks, and bring the result back. Coding tasks use the free coding route. Existing conversations keep their history and now use Amii’s coordination too. This creates text and code drafts; it does not execute code or edit files on your PC.

Amii routes writing to Nara, planning to Kira, FiveM code/assets to Rei, website code to Sora, design/branding concepts and SVG to Luna, and social media trend research to Mika. Custom employee specialties remain supported.

Mika fetches the public Google Trends Indonesia RSS feed, creates an evidence-based trend brief, and hands it to a writer, designer or another relevant specialist for a concrete deliverable. Source links and fetch time are included. These are Google search trends, not verified TikTok/Instagram viral rankings. This feature adds a fixed HTTPS request to trends.google.com; API keys are never sent there. It runs only when you ask Mika for a task. Feed failures are shown without fabricated trends. Clicking an employee card explicitly requests that employee through Amii.

Employees roam the floor while idle with a fixed-scale walking cycle, alternating steps and arm swings. Walking frames follow actual distance traveled and characters turn left/right with their route. Amii remains at his desk while other employees move. Movement runs across app views and is enabled by default even when Windows reduced motion is on. Use **Gerak karakter** above the office to switch it off. When disabled, task handoffs complete immediately. Extra rooms contain Amii and up to three specialists; the active task automatically opens the specialist’s room.

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
