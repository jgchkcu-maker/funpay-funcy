export const AUTO_RESTORE_ALARM_NAME = 'fpToolsAutoRestore';

export function syncAutoRestoreAlarm(alarms, restoreEnabled, disableEnabled) {
    if (!alarms || typeof alarms.create !== 'function' || typeof alarms.clear !== 'function') {
        throw new Error('Auto-restore alarms are unavailable.');
    }

    if (restoreEnabled || disableEnabled) {
        alarms.create(AUTO_RESTORE_ALARM_NAME, {
            delayInMinutes: 1,
            periodInMinutes: 5
        });
        return true;
    }

    alarms.clear(AUTO_RESTORE_ALARM_NAME);
    return false;
}
