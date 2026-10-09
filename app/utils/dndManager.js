import EventEmitter from 'events'
import log from 'electron-log/main.js'
import { getFocusAssist } from 'windows-focus-assist'
import dbus from '@particle/dbus-next'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'

// Teams call detection: Teams holds the microphone during a call or meeting.
// Windows keeps per-app microphone usage times under this key; an app is
// treated as using the microphone while its LastUsedTimeStart is newer than
// its LastUsedTimeStop. This key is not documented by Microsoft, so verify the
// behaviour on Windows (see the 'Teams call' log lines).
const MICROPHONE_CONSENT_STORE = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone'
// New Teams (MSIX package) and classic Teams (NonPackaged, path with '#' separators)
const TEAMS_CONSENT_KEY = /(\\MSTeams_8wekyb3d8bbwe|#ms-teams\.exe|#teams\.exe)$/i

class DndManager extends EventEmitter {
  constructor (settings) {
    super()
    this.settings = settings
    this.monitorDnd = settings.get('monitorDnd')
    this.monitorDndCheckInterval = settings.get('monitorDndCheckInterval')
    this.timer = null
    this.isOnDnd = false
    this._teamsInCall = false

    this._unsupDEErrorShown = false
    this._errorLogged = {}

    if (DndManager.shouldMonitor(settings)) {
      this.start()
    }
  }

  static shouldMonitor (settings) {
    return settings.get('monitorDnd') || DndManager.shouldMonitorTeamsCall(settings)
  }

  static shouldMonitorTeamsCall (settings) {
    return process.platform === 'win32' && settings.get('monitorTeamsCall')
  }

  start () {
    if (this.timer) return
    this.monitorDnd = true
    this._checkDnd()
    log.info('Stretchly: starting Do Not Disturb monitoring')
    if (process.platform === 'linux') {
      log.info(`System: Your Desktop seems to be ${this._desktopEnvironment}.`)
    }
  }

  stop () {
    if (!this.timer) return
    this.monitorDnd = false
    this.isOnDnd = false
    clearInterval(this.timer)
    this.timer = null
    if (this.__sessionBus) {
      this.__sessionBus.disconnect()
      this.__sessionBus = null
    }
    log.info('Stretchly: stopping Do Not Disturb monitoring')
  }

  get _desktopEnvironment () {
    // https://specifications.freedesktop.org/mime-apps-spec/latest/file.html
    // https://specifications.freedesktop.org/menu-spec/latest/onlyshowin-registry.html
    return process.env.XDG_CURRENT_DESKTOP || 'unknown'
  }

  async _isDndEnabledLinux () {
    const de = this._desktopEnvironment.toLowerCase()
    const sessionBus = this._getOrCreateSessionBus()
    switch (true) {
      case de.includes('kde'):
        try {
          const obj = await sessionBus.getProxyObject('org.freedesktop.Notifications', '/org/freedesktop/Notifications')
          const properties = obj.getInterface('org.freedesktop.DBus.Properties')
          const dndEnabled = await properties.Get('org.freedesktop.Notifications', 'Inhibited')
          if (await dndEnabled.value) {
            return true
          }
        } catch (e) {
          this._logErrorOnce('kde', e)
        }
        break
      case de.includes('xfce'):
        try {
          const obj = await sessionBus.getProxyObject('org.xfce.Xfconf', '/org/xfce/Xfconf')
          const properties = obj.getInterface('org.xfce.Xfconf')
          const dndEnabled = await properties.GetProperty('xfce4-notifyd', '/do-not-disturb')
          if (await dndEnabled.value) {
            return true
          }
        } catch (e) {
          this._logErrorOnce('xfce', e)
        }
        break
      case de.includes('gnome') || de.includes('unity'):
        try {
          const asyncExec = this._getOrCreateAsyncExec()
          const { stdout } = await asyncExec('gsettings get org.gnome.desktop.notifications show-banners')
          if (stdout.replace(/[^0-9a-zA-Z]/g, '') === 'false') {
            return true
          }
        } catch (e) {
          this._logErrorOnce('gnome/unity', e)
        }
        break
      case de.includes('cinnamon'):
        try {
          const asyncExec = this._getOrCreateAsyncExec()
          const { stdout } = await asyncExec('gsettings get org.cinnamon.desktop.notifications display-notifications')
          if (stdout.replace(/[^0-9a-zA-Z]/g, '') === 'false') {
            return true
          }
        } catch (e) {
          this._logErrorOnce('cinnamon', e)
        }
        break
      case de.includes('mate'):
        try {
          const asyncExec = this._getOrCreateAsyncExec()
          const { stdout } = await asyncExec('gsettings get org.mate.NotificationDaemon do-not-disturb')
          if (stdout.replace(/[^0-9a-zA-Z]/g, '') === 'true') {
            return true
          }
        } catch (e) {
          this._logErrorOnce('mate', e)
        }
        break
      case de.includes('lxqt'): {
        const configHome = process.env.XDG_CONFIG_HOME
        return await this._getConfigValue(
          join(configHome && isAbsolute(configHome) ? configHome : join(homedir(), '.config'), 'lxqt', 'notifications.conf'),
          'doNotDisturb'
        )
      }
      default:
        if (!this._unsupDEErrorShown) {
          log.info(`Stretchly: ${this._desktopEnvironment} not supported for DND detection, yet.`)
          this._unsupDEErrorShown = true
        }
        return false
    }
  }

  _getOrCreateSessionBus () {
    if (!this.__sessionBus) {
      const bus = dbus.sessionBus()
      this.__sessionBus = bus
      bus.on('error', () => { this.__sessionBus = null })
      bus.on('close', () => { this.__sessionBus = null })
    }
    return this.__sessionBus
  }

  async _doNotDisturb () {
    // TODO also check for session state? https://github.com/felixrieseberg/electron-notification-state/tree/master#session-state
    if (this.monitorDnd) {
      if (process.platform === 'win32') {
        if (this.settings.get('monitorDnd')) {
          let wfa = 0
          try {
            wfa = getFocusAssist().value
          } catch (e) { wfa = -1 } // getFocusAssist() throw an error if OS isn't windows
          if (wfa === 1 || wfa === 2) {
            return true
          }
        }
        if (DndManager.shouldMonitorTeamsCall(this.settings)) {
          return await this._isTeamsInCall()
        }
        return false
      } else if (process.platform === 'darwin') {
        const macOSMajorVersion = parseInt(process.getSystemVersion().split('.')[0])
        let cmd = ''
        if (macOSMajorVersion >= 26) {
          cmd = 'defaults read com.apple.controlcenter "NSStatusItem VisibleCC FocusModes"'
        } else {
          cmd = 'defaults read com.apple.controlcenter "NSStatusItem Visible FocusModes"'
        }
        try {
          const asyncExec = this._getOrCreateAsyncExec()
          const { stdout } = await asyncExec(cmd)
          if (stdout.replace(/[^0-9a-zA-Z]/g, '') === '1') {
            return true
          }
        } catch (e) {
          if (!e.message.includes('The domain/default pair of (com.apple.controlcenter, NSStatusItem VisibleCC FocusModes) does not exist')) {
            // On macOS Tahoe 26.0, this entry would not exist if no focus mode is enabled
            this._logErrorOnce('macos', e)
          }
        }
      } else if (process.platform === 'linux') {
        return await this._isDndEnabledLinux()
      }
    } else {
      return false
    }
  }

  async _isTeamsInCall () {
    try {
      const asyncExec = this._getOrCreateAsyncExec()
      const { stdout } = await asyncExec(`reg query "${MICROPHONE_CONSENT_STORE}" /s`, { windowsHide: true })
      const inCall = this._teamsUsesMicrophone(stdout)
      if (inCall !== this._teamsInCall) {
        log.info(`Stretchly: Teams call ${inCall ? 'detected' : 'ended'}`)
        this._teamsInCall = inCall
      }
      return inCall
    } catch (e) {
      this._logErrorOnce('teams', e)
      return false
    }
  }

  _teamsUsesMicrophone (regOutput) {
    const apps = {}
    let currentKey = null
    for (const line of regOutput.split(/\r?\n/)) {
      if (line.startsWith('HKEY_')) {
        currentKey = TEAMS_CONSENT_KEY.test(line.trim()) ? line.trim() : null
        continue
      }
      if (!currentKey) continue
      const match = line.trim().match(/^(LastUsedTimeStart|LastUsedTimeStop)\s+REG_QWORD\s+(0x[0-9a-f]+)$/i)
      if (match) {
        apps[currentKey] = apps[currentKey] || { LastUsedTimeStart: 0n, LastUsedTimeStop: 0n }
        apps[currentKey][match[1]] = BigInt(match[2])
      }
    }
    return Object.values(apps).some(app => app.LastUsedTimeStart > app.LastUsedTimeStop)
  }

  _getOrCreateAsyncExec () {
    if (!this.__asyncExec) {
      this.__asyncExec = promisify(exec)
    }
    return this.__asyncExec
  }

  async _getConfigValue (filePath, key) {
    try {
      const data = await readFile(filePath, 'utf8')
      const lines = data.split('\n')
      for (const line of lines) {
        const [configKey, value] = line.split('=')
        if (configKey.trim() === key) {
          return value.trim().toLowerCase() === 'true'
        }
      }
      return false
    } catch (e) {
      this._logErrorOnce(`config-read-${filePath}`, e)
      return false
    }
  }

  _logErrorOnce (environment, error) {
    const errorKey = `${environment}-${error.code || error.message.substring(0, 20)}`
    if (!this._errorLogged[errorKey]) {
      log.error(`Stretchly: DND detection error in ${environment}:`, error)
      this._errorLogged[errorKey] = true
    }
  }

  _checkDnd () {
    this.timer = setInterval(async () => {
      const doNotDisturb = await this._doNotDisturb()
      if (!this.isOnDnd && doNotDisturb) {
        this.isOnDnd = true
        this.emit('dndStarted')
      }
      if (this.isOnDnd && !doNotDisturb) {
        this.isOnDnd = false
        this.emit('dndFinished')
      }
    }, this.monitorDndCheckInterval)
  }
}

export default DndManager
