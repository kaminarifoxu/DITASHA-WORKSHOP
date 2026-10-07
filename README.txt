DITASHA Workspace Local — Windows x64, version 3.1.0

This version runs the workspace ON YOUR PC. It does not load the hosted website, launch an external browser, or require ChatGPT sign-in.

START
1. Double-click DITASHA-Workspace.exe on Windows 10/11 (64-bit).
2. If Microsoft WebView2 Runtime is missing, accept first-time setup. The included Microsoft installer downloads the runtime, so initial setup requires internet. The runtime is a Windows rendering component, not a separate browser window.
3. Open Pengaturan and paste your OpenRouter API key, then click Simpan key.
4. Click an employee and send a message.

WHAT WORKS OFFLINE
- Animated virtual office. Idle employees walk through corridors; an employee returns to their desk when answering.
- Add more employees with their own names, roles and instructions.
- Create projects and edit notes.
- Read saved chats.
- Export and import local backups.
AI replies require internet because models run through OpenRouter. The app’s AI HTTP client only connects to openrouter.ai /api/v1/chat/completions. It makes no requests to the previous hosted workspace. It also contacts GitHub to check and download app updates. Normal Windows/WebView2 component installation and updates are managed separately by Microsoft.

KEY AND MODELS
No API key is included in the EXE or source archive. Enter your key on your PC.
The app encrypts the key using Windows DPAPI for the current Windows user. The key is never returned to the workspace page and is not included in backups.
General employees: openrouter/free.
Coding employees: poolside/laguna-s-2.1:free, with openrouter/free as the only fallback.
The native app fixes those routes and sets all provider max-price fields to zero. No paid-model fallback is allowed.
Free-model quotas and availability depend on OpenRouter. A stored key is not proof that it is valid; validity is checked when sending a message.

DATA ON YOUR PC
%LOCALAPPDATA%\DITASHA Workspace\LocalData\workspace.json
- Contains projects, notes, custom employees, chats and messages.
- Saved atomically. workspace.json.bak retains the previous saved version.
%LOCALAPPDATA%\DITASHA Workspace\LocalData\openrouter.key
- Windows-encrypted API key.
%LOCALAPPDATA%\DITASHA Workspace\LocalProfile
- Local WebView2 profile.
%LOCALAPPDATA%\DITASHA Workspace\Desktop-3.1.0
- App files extracted automatically from the EXE.

BACKUPS
Use Pengaturan > Export backup to save a JSON backup, and Import backup to restore it. Import replaces the existing local workspace after confirmation. Export first if you want to keep your current data. Backups exclude the API key. A new PC needs its own key entered.
The local version starts with a new local workspace. Data from the hosted website is not automatically copied or synchronized.
Local app data is limited to 16 MB; large binary files are not stored in chats.

BUILD FROM SOURCE
Requires Node.js 22+, Python 3 and a MinGW-w64 Windows x64 compiler.
In frontend: npm install, then npm run build.
In the package root: python3 pack-frontend.py, then bash build.sh.
No Node.js/Python installation is required to RUN the built EXE.
The frontend includes React, the existing DITASHA UI and local office sprites. The packed HTML/CSS/JS and images are embedded into the Windows executable.

VALIDATION
Passed: TypeScript checks, frontend production build, strict native Windows compilation, local CRUD/notes/employee tests, coding/general routing and project-context tests, failed AI/storage persistence tests, backup validation and key exclusion tests, native JSON boundary checks, and PE/resource/import checks.
Live Windows GUI execution, DPAPI on a Windows account, and a real OpenRouter response were not tested in this build environment. No live API request was made during tests.

GITHUB UPDATES
Repository: https://github.com/kaminarifoxu/DITASHA-WORKSHOP
Automatic checks and downloads are enabled by default. Checks run 5 seconds after opening the workspace and every 6 hours while open. Turn them off in Pengaturan > Update aplikasi if desired. A download already in progress may finish.
The private repository needs a GitHub fine-grained personal access token with access to DITASHA-WORKSHOP and Contents: Read-only. Create it in GitHub Settings > Developer settings > Personal access tokens > Fine-grained tokens. Save it in the app's Update panel. This key is encrypted with Windows DPAPI and excluded from workspace backups.
Only stable, newer releases are accepted. Downloads are restricted to this repository and GitHub's HTTPS asset hosts. A download must match GitHub's SHA-256 digest, expected size and Windows x64 GUI format. The token is sent only to the repository API, never to the asset CDN.
After downloading, choose Restart to install. Saved data and keys stay in LocalData. The previous executable is kept beside your EXE with the .previous suffix. Keep the EXE in a writable location such as Downloads. If replacement fails, the updater restores the previous executable.
Use Workspace > Check and download updates for a manual check or Pengaturan > Update aplikasi.

PUBLISHING YOUR NEXT VERSION
Run python3 scripts/set-version.py 3.2.0 (choose a newer version), commit your code changes, and push to main. GitHub Actions builds the app, runs Linux and Windows updater tests, then creates a versioned release with EXE, SHA-256 file and source archive. An existing version is never overwritten: bump the version for each release.
Source checkout builds also need python3 scripts/fetch-vendor.py before compiling, to obtain the pinned Microsoft SDK components and bootstrapper.

ChatGPT plan (3.8.0):
Open Pengaturan > Continue with ChatGPT. Complete browser sign-in and usage consent. Eligible accounts can share their ChatGPT plan allowance with Amii and the team. Model availability is returned by OpenAI for that account. Choose general/coding models in Settings. Manage usage opens ChatGPT settings, where you can disable extra-credit use. No automatic provider fallback. Credentials use Windows encryption and are excluded from backups. Real sign-in and account eligibility must be tested on your Windows PC.

Provider and employee settings (3.9.0):
Fixes the ChatGPT login host identifier automatically. Settings now supports OpenRouter, Groq, Gemini, OpenAI API and custom HTTPS compatible endpoints. Select each employee provider/model under AI untuk setiap karyawan, then save. Keys are encrypted and excluded from backups. OpenRouter defaults to free-only mode. API charges are separate from a ChatGPT subscription. Live login/API access requires Windows testing.

3.9.1: Fixes ChatGPT response parsing and adds specific usage/session/token-limit/connection error messages. Retry your task after opening the updated EXE.

3.10.0: Improved chat layout and Markdown formatting. Delete one/all chats with confirmation. Attach up to 5 UTF-8 text/code files. Save AI code files or the full Markdown answer using a Windows Save dialog. PDF, images, Office documents and binary assets are not supported.

3.12.1: Adds a recommended OpenRouter team preset, six suggested model options, improved built-in employee prompts and visible work instructions. Applies the preset once when an OpenRouter key is already saved. Custom employee model choices remain unchanged.


Version 3.12.1: operational employees
- Achi: white-haired character; manual IDR income/expense ledger, monthly budgets, CSV export, and AI review using recorded totals. Ledger is part of workspace backups. No bank connection or transfers.
- Lora: brown-haired character; up to 20 Gmail/IMAP accounts using provider app passwords, TLS 1.2 on port 993 and server certificate validation. Tests connection before saving. Credentials use Windows CurrentUser DPAPI and stay out of workspace backups. Manual inbox checks fetch 20 latest headers, unread counts, and selected text MIME previews; EXAMINE and BODY.PEEK preserve unread status. AI drafts never send mail. Chat inbox-check requests read metadata from configured accounts. OAuth-only accounts are not supported.
- Dante: black-haired character with glasses and brown jacket; user-selected allowed folders, bounded recursive inventory, UTF-8 text previews, and reviewed rename/move operations inside a selected folder. Rejects path traversal, junction/symlink access and existing destinations. No delete, overwrite or execution. Chat file requests can read allowed inventories; changes remain user-operated. Folder grants are PC-specific and excluded from workspace backups.
- All three have distinct idle/walk/work vector sprites, roles, model selections, task-board handoffs and reporting through Amii. New roles inherit Amii’s saved model choice on first launch.
- Tools require Windows PowerShell 5.1, included with Windows 10/11. Desktop compilation, adapter/ledger tests, PowerShell parser/MIME tests and isolated real file-operation tests pass. Actual Gmail authentication, DPAPI and full Windows UI require checking on the user PC.

Version 3.12.1: all ten employees now use one consistent chibi vector character system in office, chat, team cards, and the avatar picker. Hair, clothing, glasses and accessories preserve each identity. Shared head/body proportions stay fixed across idle, walk and work; walking alternates legs/arms and working adds a tablet. Previous raster sprite atlases are no longer used by the frontend.
