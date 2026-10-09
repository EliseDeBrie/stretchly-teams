import { vi } from 'vitest'
import 'chai/register-should'
import { join } from 'path'
import { homedir } from 'node:os'
import DndManager from '../app/utils/dndManager'
import Store from 'electron-store'
import defaultSettings from '../app/utils/defaultSettings'
import { rm } from 'node:fs/promises'

const timeout = process.env.CI ? 30000 : 10000

describe('dndManager', function () {
  vi.setConfig({ testTimeout: timeout })
  let settings = null
  let dndManager = null

  beforeEach(() => {
    settings = new Store({
      cwd: join(__dirname),
      name: 'test-settings-dndManager',
      defaults: defaultSettings
    })
    dndManager = new DndManager(settings)
  })

  it('should be running with default settings', () => new Promise((resolve) => {
    dndManager.isOnDnd.should.be.equal(false)
    dndManager.monitorDnd.should.be.equal(true)
    resolve()
  }))

  it('should not be running with monitorDnd: false and monitorTeamsCall: false', () => new Promise((resolve) => {
    settings.set('monitorDnd', false)
    settings.set('monitorTeamsCall', false)
    dndManager.stop()
    dndManager = null
    dndManager = new DndManager(settings)
    dndManager.isOnDnd.should.be.equal(false)
    dndManager.monitorDnd.should.be.equal(false)
    resolve()
  }))

  it('should be running with monitorDnd: false and monitorTeamsCall: true only on Windows', () => new Promise((resolve) => {
    settings.set('monitorDnd', false)
    settings.set('monitorTeamsCall', true)
    dndManager.stop()
    dndManager = null
    dndManager = new DndManager(settings)
    dndManager.isOnDnd.should.be.equal(false)
    dndManager.monitorDnd.should.be.equal(process.platform === 'win32')
    resolve()
  }))

  it('should be running with monitorDnd: true', () => new Promise((resolve) => {
    settings.set('monitorDnd', true)
    dndManager.stop()
    dndManager = null
    dndManager = new DndManager(settings)
    dndManager.isOnDnd.should.be.equal(false)
    dndManager.monitorDnd.should.be.equal(true)
    resolve()
  }))

  it('should start when start()', () => new Promise((resolve) => {
    dndManager.stop()
    dndManager.start()
    dndManager.isOnDnd.should.be.equal(false)
    dndManager.monitorDnd.should.be.equal(true)
    resolve()
  }))

  it('should stop when stop()', () => new Promise((resolve) => {
    dndManager.stop()
    dndManager.monitorDnd.should.be.equal(false)
    dndManager.isOnDnd.should.be.equal(false)
    resolve()
  }))

  it('does not create a second timer when start() is called twice', () => new Promise((resolve) => {
    dndManager.stop()
    dndManager.start()
    const timer = dndManager.timer
    dndManager.start()
    dndManager.timer.should.be.equal(timer)
    resolve()
  }))

  it('should find correct value of LXQt config file', async () => {
    const value = await dndManager._getConfigValue(join(__dirname, '/test-lxqt.conf'), 'doNotDisturb')
    value.should.be.equal(true)
  })

  it('resolves the LXQt config path', async () => {
    dndManager.stop()
    const originalDesktop = process.env.XDG_CURRENT_DESKTOP
    const originalConfigHome = process.env.XDG_CONFIG_HOME
    let configPath

    process.env.XDG_CURRENT_DESKTOP = 'LXQt'
    dndManager._getOrCreateSessionBus = () => ({})
    dndManager._getConfigValue = async (filePath) => {
      configPath = filePath
      return true
    }

    try {
      process.env.XDG_CONFIG_HOME = join(__dirname, 'xdg-config')
      await dndManager._isDndEnabledLinux()
      configPath.should.equal(join(process.env.XDG_CONFIG_HOME, 'lxqt', 'notifications.conf'))

      delete process.env.XDG_CONFIG_HOME
      await dndManager._isDndEnabledLinux()
      configPath.should.equal(join(homedir(), '.config', 'lxqt', 'notifications.conf'))

      process.env.XDG_CONFIG_HOME = 'relative-config'
      await dndManager._isDndEnabledLinux()
      configPath.should.equal(join(homedir(), '.config', 'lxqt', 'notifications.conf'))
    } finally {
      if (typeof originalDesktop === 'undefined') {
        delete process.env.XDG_CURRENT_DESKTOP
      } else {
        process.env.XDG_CURRENT_DESKTOP = originalDesktop
      }
      if (typeof originalConfigHome === 'undefined') {
        delete process.env.XDG_CONFIG_HOME
      } else {
        process.env.XDG_CONFIG_HOME = originalConfigHome
      }
    }
  })

  describe('Teams call detection', () => {
    const base = 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone'
    const entry = (key, start, stop) => [
      `${base}\\${key}`,
      '    Value    REG_SZ    Allow',
      `    LastUsedTimeStart    REG_QWORD    ${start}`,
      `    LastUsedTimeStop    REG_QWORD    ${stop}`,
      ''
    ].join('\r\n')

    it('detects new Teams using the microphone', () => {
      dndManager._teamsUsesMicrophone(entry('MSTeams_8wekyb3d8bbwe', '0x1dc3a1b2c3d4e5f', '0x0')).should.equal(true)
    })

    it('detects classic Teams using the microphone', () => {
      dndManager._teamsUsesMicrophone(entry('NonPackaged\\C:#Users#me#AppData#Local#Microsoft#Teams#current#Teams.exe', '0x1dc3a1b2c3d4e5f', '0x1dc3a1b2c3d4e00')).should.equal(true)
    })

    it('does not detect Teams after the call ended', () => {
      dndManager._teamsUsesMicrophone(entry('MSTeams_8wekyb3d8bbwe', '0x1dc3a1b2c3d4e5f', '0x1dc3a1b2c3d4fff')).should.equal(false)
    })

    it('does not detect Teams that never used the microphone', () => {
      dndManager._teamsUsesMicrophone(entry('MSTeams_8wekyb3d8bbwe', '0x0', '0x0')).should.equal(false)
    })

    it('ignores other apps using the microphone', () => {
      const output = entry('Microsoft.WindowsSoundRecorder_8wekyb3d8bbwe', '0x1dc3a1b2c3d4e5f', '0x0') +
        entry('NonPackaged\\C:#Program Files#Zoom#bin#Zoom.exe', '0x1dc3a1b2c3d4e5f', '0x0') +
        entry('MSTeams_8wekyb3d8bbwe', '0x1dc3a1b2c3d4e5f', '0x1dc3a1b2c3d4fff')
      dndManager._teamsUsesMicrophone(output).should.equal(false)
    })

    it('returns false when the registry query fails', async () => {
      dndManager._getOrCreateAsyncExec = () => async () => { throw new Error('reg failed') }
      const inCall = await dndManager._isTeamsInCall()
      inCall.should.equal(false)
    })

    it('only monitors Teams calls on Windows', () => {
      settings.set('monitorTeamsCall', true)
      DndManager.shouldMonitorTeamsCall(settings).should.equal(process.platform === 'win32')
      settings.set('monitorTeamsCall', false)
      DndManager.shouldMonitorTeamsCall(settings).should.equal(false)
    })
  })

  it('should return something for _desktopEnvironment', () => new Promise((resolve) => {
    dndManager._desktopEnvironment.should.not.be.equal(null)
    resolve()
  }))

  afterEach(async () => {
    dndManager.stop()
    dndManager = null

    if (settings) {
      await rm(join(__dirname, '/test-settings-dndManager.json'), { force: true })
      settings = null
    }
  })
})
