# DITASHA-WORKSHOP

Local Windows AI workspace with a pixel office, animated employees, projects, notes, and chat history stored on your PC.

Download `DITASHA-Workspace.exe` from [Releases](https://github.com/kaminarifoxu/DITASHA-WORKSHOP/releases/latest). Windows 10/11 x64 is required. No Node.js or Python is needed to run the app. First-time setup can install Microsoft's WebView2 Runtime.

## Amii and the office

All new requests go through Amii. Amii uses the selected AI provider to choose a team member and create a brief. Amii stays at his desk; employees come there to receive tasks, work at their own desks, and bring the result back. Coding tasks use the assigned employee’s coding model. Existing conversations keep their history and now use Amii’s coordination too. This creates text and code drafts; it does not execute code or edit files on your PC.

Amii routes writing to Nara, planning to Kira, FiveM code/assets to Rei, website code to Sora, design/branding concepts and SVG to Luna, and social media trend research to Mika. Custom employee specialties remain supported.

Mika fetches the public Google Trends Indonesia RSS feed, creates an evidence-based trend brief, and hands it to a writer, designer or another relevant specialist for a concrete deliverable. Source links and fetch time are included. These are Google search trends, not verified TikTok/Instagram viral rankings. This feature adds a fixed HTTPS request to trends.google.com; API keys are never sent there. It runs only when you ask Mika for a task. Feed failures are shown without fabricated trends. Clicking an employee card explicitly requests that employee through Amii.

Employees roam the floor while idle with a fixed-scale walking cycle, alternating steps and arm swings. Walking frames follow actual distance traveled and characters turn left/right with their route. Amii remains at his desk while other employees move. Movement runs across app views and is enabled by default even when Windows reduced motion is on. Use **Gerak karakter** above the office to switch it off. When disabled, task handoffs complete immediately. All employees share one larger office. Every employee has a separate desk, with connected corridors to Amii. The floor grows automatically when custom employees are added; there are no room pages. Scroll within the office to see the full floor on smaller windows. The ten built-in employees have ten distinct characters; the custom employee picker offers all ten styles.

## AI and data

Choose ChatGPT plan sign-in, OpenRouter, Groq, Gemini, OpenAI API, or a custom HTTPS OpenAI-compatible endpoint in Settings. Assign a provider and model to each employee, or inherit the office defaults. OpenRouter starts in free-only mode with zero-price provider caps; paid models require disabling that option. API billing is separate from a ChatGPT subscription. Keys are encrypted with Windows DPAPI, not embedded in source or releases. The workspace UI works offline; AI and app updates need internet.

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

See [README.txt](README.txt) for file locations and setup details, and [THIRD-PARTY.txt](THIRD-PARTY.txt) for dependency notices. No customer data, ChatGPT credential, OpenRouter key, or GitHub token belongs in this repository.

## Board workflow and coordinated projects (3.6.0)
Amii posts tasks at the shared office board. Assigned specialists collect their briefs and return to their own desks; their board cards show queued, working, completed or interrupted states. Each specialist carries completed results back to Amii. Website creation uses Mika (audience and market research), Luna (visual design), then Sora (complete code based on the preceding contributions). Larger tasks can use up to six relevant specialists in dependency order. Explicit requests for one named employee remain individual tasks.

Mika uses Google search trends when relevant; this is not a design-gallery browser or proof of design popularity. If live research fails during a team website project, the team continues with clearly labeled general recommendations. All contributions appear in the final saved reply. Failed team jobs do not overwrite saved conversation history. Existing local projects, chats and settings use the same storage.

## Parallel website team (3.7.0)
Mika alone collects the first brief, researches and posts the findings at the board. Luna and Sora then collect the research and start independent AI requests concurrently. After both finish, Sora integrates Luna's final design into the completed code; both employees report to Amii together. Finished employees wait at their desks. The native worker pool supports up to three simultaneous AI/RSS requests and only becomes idle once all active workers finish, preserving updater restart protection. One OpenRouter key is sufficient; provider rate limits still apply. No paid requests or new provider keys are enabled by this update.

## ChatGPT plan connection (3.8.0)

Open Settings, choose **Continue with ChatGPT**, and complete sign-in and plan-usage consent in the official OpenAI browser page. Eligible accounts can use their existing plan allowance; this does not create a separate allowance. Successful sign-in with available models selects ChatGPT as the AI provider. Choose general and coding models from the catalog returned for that account. OpenRouter remains available as a manual provider choice. There is no automatic provider fallback.

Use **Manage usage / Kelola penggunaan** to set app limits and disable additional-credit use if you want included usage only. Tokens are kept in a DPAPI-encrypted local credential file, excluded from project backups and never returned to the WebView. Sign-out attempts remote session revocation, clears local tokens and reports if remote revocation was not confirmed. The stable host and each verified account/client mapping remain for later sign-in.

This implementation follows the official local personal/open-source OAuth flow at https://developers.openai.com/siwc/token-sharing-open-source/sign-in and uses https://api.openai.com/v1/responses with store:false and stream:true. Model availability and access are decided by OpenAI. It does not use scraped ChatGPT sessions or backend-api endpoints. Native parsing/security tests and compilation are checked; live sign-in, account eligibility and native Windows UI require manual testing on Windows.

## Provider and employee settings (3.9.0)

Fixes the invalid ChatGPT login host identifier by replacing old identifiers with a stable UUID v4 URN. Existing workspace data is preserved. Retry Continue with ChatGPT in Settings.

Add provider keys in Settings, load the model catalog or enter an exact model ID, then choose each employee’s provider/model under **AI untuk setiap karyawan** and click **Simpan model & karyawan**. Custom endpoints require HTTPS. Keys remain encrypted with Windows DPAPI and are excluded from backups; model assignments are included. A job keeps its provider/model choices throughout its team handoffs. Up to three requests can run concurrently across providers; rate limits still apply. Live account login and API calls require testing on Windows.

## ChatGPT response handling (3.9.1)

The response parser now accepts optional spaces after SSE data fields, multiline events, CR/LF line endings, a UTF-8 BOM, and completed JSON Responses. Completed refusal text is displayed. Failed, incomplete, empty, malformed or disconnected responses remain failed jobs; usage, session, token-limit and content-filter errors have specific messages. No automatic retry is made, preventing duplicate usage charges. Offline regression tests cover these cases; live account requests require Windows testing.

## Chat UI and files (3.10.0)

Chat replies render safe Markdown headings, lists, links, tables and code blocks. The office/task-board preview is collapsible. Delete individual chats or clear all chats using the trash controls and confirmation dialog; projects, notes, employees and AI settings are retained.

Attach up to five UTF-8 text/code files (60,000 characters per file; 120,000 total). Supported formats include TXT, Markdown, CSV, JSON, HTML/CSS/JS/TS, Lua, XML/YAML, configuration files and source code. Attachments are sent as reference data to the selected team providers and persisted with the chat and local backup. PDF, Office documents, images, archives and binary assets are not supported by this version. Very large combined history is rejected with a clear message instead of silently truncating files. Failed requests retain the draft and attachments.

Ask for named file deliverables. Complete fenced code blocks become downloadable file cards; **Unduh jawaban** saves the full reply as Markdown. File buttons use the Windows Save dialog. Generated content is not executed automatically. Native Windows dialog behavior and full UI require user testing on Windows.

## Recommended free team (3.12.1)

First launch with a saved OpenRouter key applies the recommended ten-person preset once: Gemma 4 31B for coordination, writing, planning, design, social, finance, email and file management; North Mini Code for FiveM and websites. Model settings use at least 8192 output tokens. Existing keys, custom employees and other provider settings are preserved. Recommended models are free; existing paid opt-in remains unchanged. After migration, user changes persist. Settings has a reapply button, alternative model IDs and visible work instructions. Built-in prompts emphasize complete deliverables, evidence and correct task-allocation formats. Live model availability and quota still depend on the provider. Laguna free endpoint is listed as ending October 31, 2026.


Version 3.12.1: operational employees
- Achi: white-haired character; manual IDR income/expense ledger, monthly budgets, CSV export, and AI review using recorded totals. Ledger is part of workspace backups. No bank connection or transfers.
- Lora: brown-haired character; up to 20 Gmail/IMAP accounts using provider app passwords, TLS 1.2 on port 993 and server certificate validation. Tests connection before saving. Credentials use Windows CurrentUser DPAPI and stay out of workspace backups. Manual inbox checks fetch 20 latest headers, unread counts, and selected text MIME previews; EXAMINE and BODY.PEEK preserve unread status. AI drafts never send mail. Chat inbox-check requests read metadata from configured accounts. OAuth-only accounts are not supported.
- Dante: black-haired character with glasses and brown jacket; user-selected allowed folders, bounded recursive inventory, UTF-8 text previews, and reviewed rename/move operations inside a selected folder. Rejects path traversal, junction/symlink access and existing destinations. No delete, overwrite or execution. Chat file requests can read allowed inventories; changes remain user-operated. Folder grants are PC-specific and excluded from workspace backups.
- All three have distinct idle/walk/work vector sprites, roles, model selections, task-board handoffs and reporting through Amii. New roles inherit Amii’s saved model choice on first launch.
- Tools require Windows PowerShell 5.1, included with Windows 10/11. Desktop compilation, adapter/ledger tests, PowerShell parser/MIME tests and isolated real file-operation tests pass. Actual Gmail authentication, DPAPI and full Windows UI require checking on the user PC.

Version 3.12.1: all ten employees now use one consistent chibi vector character system in office, chat, team cards, and the avatar picker. Hair, clothing, glasses and accessories preserve each identity. Shared head/body proportions stay fixed across idle, walk and work; walking alternates legs/arms and working adds a tablet. Previous raster sprite atlases are no longer used by the frontend.
