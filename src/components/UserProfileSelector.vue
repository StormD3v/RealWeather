<script setup>
import { onMounted, ref } from 'vue'

const emit = defineEmits(['profile-changed'])

const STORAGE_KEY = 'lumicast-user-profile'

const profiles = [
  { value: 'student', label: 'Student', icon: '🎓' },
  { value: 'office_worker', label: 'Office Worker', icon: '💼' },
  { value: 'business_owner', label: 'Business Owner', icon: '🏪' },
  { value: 'delivery_rider', label: 'Delivery Rider', icon: '🛵' },
  { value: 'driver', label: 'Driver', icon: '🚗' },
  { value: 'athlete', label: 'Athlete', icon: '🏃' },
  { value: 'traveler', label: 'Traveler', icon: '✈️' }
]

const selectedProfile = ref('general')

function selectProfile(profile) {
  if (selectedProfile.value === profile) return

  selectedProfile.value = profile
  localStorage.setItem(STORAGE_KEY, profile)
  emit('profile-changed', profile)
}

onMounted(() => {
  selectedProfile.value = localStorage.getItem(STORAGE_KEY) || 'general'
  emit('profile-changed', selectedProfile.value)
})
</script>

<template>
  <div class="user-profile-selector" aria-label="User profile selector">
    <button v-for="profile in profiles" :key="profile.value" type="button" class="profile-pill"
      :class="{ 'profile-pill-selected': selectedProfile === profile.value }" @click="selectProfile(profile.value)">
      <span aria-hidden="true">{{ profile.icon }}</span>
      <span>{{ profile.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.user-profile-selector {
  grid-column: 1 / -1;
  display: flex;
  gap: 8px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 2px 0;
}

.user-profile-selector::-webkit-scrollbar {
  display: none;
}

.profile-pill {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  padding: 8px 12px;
  background: rgba(7, 15, 32, 0.72);
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.86rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}

.profile-pill-selected {
  border-color: rgba(39, 192, 99, 0.9);
  background: #27c063;
  color: #ffffff;
}
</style>
