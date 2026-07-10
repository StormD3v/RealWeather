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
                <p class="notification-message">Notifications enabled</p>
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
  z-index: var(--lc-z-toast);
  background: rgba(10, 18, 35, 0.96);
  border-top: 1px solid var(--lc-border-glass);
  border-left: 4px solid var(--lc-success);
  padding: var(--lc-sp-3) var(--lc-sp-4);
  display: flex;
  justify-content: center;
  box-shadow: 0 -4px 24px rgba(0,0,0,0.22);
  backdrop-filter: var(--lc-blur-sm);
}

.notification-content {
  width: min(100%, 1200px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--lc-sp-3);
  flex-wrap: wrap;
}

.notification-message {
  margin: 0;
  color: var(--lc-text-primary);
  font-size: var(--lc-text-body-sm);
  line-height: var(--lc-leading-normal);
  font-weight: var(--lc-weight-medium);
}

.notification-actions { display: flex; gap: var(--lc-sp-3); flex-wrap: wrap; }

.enable-btn,
.dismiss-btn {
  border: none;
  border-radius: var(--lc-radius-pill);
  font-size: var(--lc-text-body-sm);
  font-family: var(--lc-font-family);
  padding: 8px var(--lc-sp-4);
  cursor: pointer;
  font-weight: var(--lc-weight-semibold);
  transition: opacity var(--lc-transition-hover), transform var(--lc-transition-hover);
}

.enable-btn { background: var(--lc-success); color: #0f172a; }
.enable-btn:hover { opacity: 0.9; transform: translateY(-1px); }

.dismiss-btn {
  background: transparent;
  color: var(--lc-text-muted);
  border: 1px solid var(--lc-border-glass);
}

.dismiss-btn:hover { background: var(--lc-surface-overlay); }

.confirmation-banner { border-left-color: var(--lc-success); }
</style>
