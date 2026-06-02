export function requestNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return Promise.resolve(false)
    }

    return Notification.requestPermission().then((permission) => permission === 'granted')
}

export function sendNotification(title, body, icon = '/favicon.ico') {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    new Notification(title, { body, icon })
}
