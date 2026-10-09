# Stretchly Teams

<img src="stretchly_128x128.png" align="right" alt="Stretchly logo">

> **The break time reminder app that leaves your Teams calls alone**

*Stretchly Teams* is a fork of [Stretchly](https://github.com/hovancik/stretchly) by Jan Hovancik. It reminds you to take breaks like Stretchly does, and on Windows it also **pauses breaks while you are in a Microsoft Teams call or meeting**. Breaks resume automatically when the call ends.

Everything else works as in Stretchly. For all features and advanced preferences, see the [original Stretchly README](UPSTREAM_README.md).

## Table of contents
- [Install](#install)
- [Teams call detection](#teams-call-detection)
- [Differences from Stretchly](#differences-from-stretchly)
- [Development](#development)
- [Releasing](#releasing)
- [Credits](#credits)
- [License](#license)

## Install

Stretchly Teams currently supports **Windows only**.

Download the latest installer (`Stretchly Teams Setup <version>.exe`) or the portable version (`Stretchly Teams Portable <version>.exe`) from the [Releases page](https://github.com/EliseDeBrie/stretchly-teams/releases).

- The installer is **not code-signed**. Windows SmartScreen may show "Windows protected your PC"; choose *More info* → *Run anyway* if you trust this build.
- Stretchly Teams is a **separate app** from Stretchly: it has its own settings file and can be installed next to the original. Your Stretchly settings are not copied over. If you no longer want the original Stretchly, uninstall it yourself, so you don't get two break reminders.
- Silent install for all users (run as administrator):
  ```cmd
  "Stretchly Teams Setup <version>.exe" /S /allusers
  ```

### Command line

When Stretchly Teams is running, the installer adds the `stretchly-teams` command to PATH (instead of Stretchly's `stretchly`). For example: `stretchly-teams pause -d 1h`. Run `stretchly-teams help` for all commands. The built-in help examples still say `stretchly`; use `stretchly-teams` instead.

## Teams call detection

### What it does
While Microsoft Teams is in a call or meeting, Stretchly Teams pauses break scheduling, the same way Stretchly pauses for Do Not Disturb. During the call the tray tooltip shows "Do Not Disturb is on" (the app uses its existing Do Not Disturb pause for this). When the call ends, breaks are reset and start again.

It works with the new Teams app (`ms-teams.exe`, package `MSTeams_8wekyb3d8bbwe`) and with classic Teams (`Teams.exe`).

### How it works
Every 2 seconds (by default) the app reads, from the Windows registry, which apps are using the microphone:

```
HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone
```

Teams counts as "in a call" while its entry there has a `LastUsedTimeStart` that is newer than its `LastUsedTimeStop`, meaning Teams currently has the microphone open.

> **Note:** Microsoft does not document this registry key. The detection is based on the assumption that Teams keeps the microphone open for the whole call. Check the log file for `Stretchly: Teams call detected` / `Stretchly: Teams call ended` lines to see what the app detects. If a call is not detected, please [open an issue](https://github.com/EliseDeBrie/stretchly-teams/issues).

### Known limitations
- Only Teams calls are detected, not Zoom, Webex, etc.
- A call where Teams does not open your microphone (for example, no microphone connected) is not detected.
- If Teams keeps the microphone open after a call ends, breaks stay paused until Teams releases it.

### Settings
In the app: **Preferences → Settings → "Show breaks even during Microsoft Teams calls"**. Leave it unticked (default) to pause breaks during calls.

In the preferences file (open it with `Ctrl + D` in Preferences → About, then click the settings file link):

| Setting | Default | Meaning |
| --- | --- | --- |
| `monitorTeamsCall` | `true` | Pause breaks during Teams calls. |
| `monitorTeamsCallCheckInterval` | `2000` | How often (in milliseconds) Teams is checked. Takes effect after restarting the app. |

Teams detection works independently of the Do Not Disturb setting (`monitorDnd`): you can keep breaks during Focus Assist and still pause them for Teams calls.

## Differences from Stretchly

- Pauses breaks during Microsoft Teams calls (Windows).
- App name *Stretchly Teams*, app ID `io.github.elisedebrie.stretchlyteams`, own settings folder (`%APPDATA%\Stretchly Teams`).
- Update checks and "download latest version" links point to this repository's releases. Pre-releases are not offered as updates.
- Windows builds: installer, portable and 7z only (no Microsoft Store package). No macOS or Linux builds are published.
- Only the English texts were renamed to "Stretchly Teams"; other languages still say "Stretchly".
- Contributor Preferences and the donation links still belong to the original Stretchly project and support its author.

## Development

You need [Node.js](https://nodejs.org/) (the version in `.nvmrc`) and Git.

```sh
git clone https://github.com/EliseDeBrie/stretchly-teams
cd stretchly-teams
npm install
npm run dev     # start the app with logging
npm run lint    # code style (standard)
npm test        # unit tests (vitest)
```

Build a Windows installer locally with `npm run dist` (on Windows).

## Releasing

1. Update `version` in `package.json` and the root `version` entries in `package-lock.json`, and move the *Unreleased* items in [CHANGELOG.md](CHANGELOG.md) under the new version.
2. Merge to `main`, then create and push a tag `v<version>` (for example `v1.0.0`), or run the **Packages build** workflow manually from the Actions tab.
3. The workflow builds the Windows packages and uploads them to a GitHub **pre-release** for that version.
4. After testing the pre-release on Windows, edit the release on GitHub and untick *Set as a pre-release*. Only then is it offered to users through the in-app update check.

## Credits

Stretchly Teams is built on [Stretchly](https://github.com/hovancik/stretchly), created by [Jan Hovancik](https://hovancik.net/) and its [contributors](https://github.com/hovancik/stretchly/graphs/contributors). This fork is based on Stretchly commit [`52929e5`](https://github.com/hovancik/stretchly/commit/52929e5) (after release 1.22.1). If you like the app, consider [supporting the original author](https://github.com/sponsors/hovancik).

This fork is not affiliated with or endorsed by the Stretchly project or Microsoft. Microsoft Teams is a trademark of Microsoft Corporation.

## License

BSD-2-Clause, see [LICENSE](LICENSE). The original Stretchly copyright notice is kept as the license requires.
