<template>
    <div>
        <div v-if="visible" class="notification-banner">
            <div class="notification-content">
                <p class="notification-message">Enable notifications to get rain and heat alerts</p>
                <div class="notification-actions">
                    <button class="enable-btn" @click="handleEnable">Enable</button>
                    <button class="dismiss-btn" @click="handleDismiss">Not Now</button>
                </div>
            </div>
        </div>

        <div v-if="showConfirmation" class="notification-banner confirmation-banner">
            <div class="notification-content">
                <p class="notification-message">✅ Notifications enabled</p>
            </div>
        </div>
    </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { requestNotificationPermission } from '@/utils/notifications'

const STORAGE_KEY = 'weather-notification-prompt-dismissed'
const visible = ref(false)
const showConfirmation = ref(false)

function handleDismiss() {
    if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(STORAGE_KEY, 'true')
    }
    visible.value = false
}

async function handleEnable() {
    const granted = await requestNotificationPermission()
    if (granted) {
        visible.value = false
        showConfirmation.value = true
        setTimeout(() => {
            showConfirmation.value = false
        }, 2000)
        if (typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.setItem(STORAGE_KEY, 'true')
        }
    } else {
        handleDismiss()
    }
}

onMounted(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return
    }

    const dismissed = window.sessionStorage.getItem(STORAGE_KEY) === 'true'
    if (Notification.permission === 'default' && !dismissed) {
        visible.value = true
    }
})
</script>

<style scoped>
.notification-banner {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    z-index: 100;
    background: rgba(15, 23, 42, 0.96);
    border-left: 4px solid #22c55e;
    padding: 12px 16px;
    display: flex;
    justify-content: center;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.18);
}

.notification-content {
    width: min(100%, 1200px);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
}

.notification-message {
    margin: 0;
    color: #e2e8f0;
    font-size: 0.95rem;
    line-height: 1.4;
    font-weight: 500;
}

.notification-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.enable-btn,
.dismiss-btn {
    border: none;
    border-radius: 999px;
    font-size: 0.9rem;
    padding: 8px 14px;
    cursor: pointer;
}

.enable-btn {
    background: #22c55e;
    color: #0f172a;
}

.dismiss-btn {
    background: transparent;
    color: #cbd5e1;
    border: 1px solid rgba(148, 163, 184, 0.45);
}

.confirmation-banner {
    border-left-color: #22c55e;
}
</style>
