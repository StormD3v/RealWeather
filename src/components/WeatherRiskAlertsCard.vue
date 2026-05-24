<template>
  <div class="weather-risk-alerts-card">
    <h3>Weather Risk Alerts</h3>
    
    <div class="alerts-content" v-if="hasAlerts">
      <div 
        v-for="alert in activeAlerts" 
        :key="alert.id"
        class="alert-item"
        :class="alert.severity"
      >
        <div class="alert-icon">{{ alert.icon }}</div>
        <div class="alert-info">
          <div class="alert-title">{{ alert.title }}</div>
          <div class="alert-description">{{ alert.description }}</div>
        </div>
      </div>
    </div>
    
    <div class="no-alerts" v-else>
      <div class="no-alerts-icon">✓</div>
      <div class="no-alerts-text">No severe weather alerts</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  forecastData: {
    type: Array,
    default: () => []
  },
  currentWeather: {
    type: Object,
    default: null
  }
})

const hasAlerts = computed(() => {
  return activeAlerts.value.length > 0
})

const activeAlerts = computed(() => {
  if (!props.forecastData || props.forecastData.length === 0 || !props.currentWeather) {
    return []
  }

  const alerts = []
  const currentTemp = props.currentWeather?.main?.temp || 0
  const currentWind = props.currentWeather?.wind?.speed || 0
  const currentRainChance = props.currentWeather?.rain?.chance || 0
  const currentCondition = props.currentWeather?.weather?.[0]?.main?.toLowerCase() || ''

  // Check for heavy rain
  const upcomingRain = props.forecastData.slice(0, 24).some(hour => 
    (hour?.rain?.chance || 0) > 70
  )
  
  if (upcomingRain) {
    alerts.push({
      id: 'heavy-rain',
      icon: '🌧️',
      title: 'Heavy Rain Expected',
      description: 'Possible reduction in outdoor activity.',
      severity: 'high'
    })
  }

  // Check for storm conditions
  if (currentCondition.includes('storm') || currentCondition.includes('thunder')) {
    alerts.push({
      id: 'storm',
      icon: '⛈️',
      title: 'Storm Warning',
      description: 'Severe weather detected. Seek shelter immediately.',
      severity: 'severe'
    })
  }

  // Check for heatwave
  const upcomingHighTemp = props.forecastData.slice(0, 48).some(hour => 
    (hour?.main?.temp || 0) > 35
  )
  
  if (upcomingHighTemp && currentTemp > 30) {
    alerts.push({
      id: 'heatwave',
      icon: '🔥',
      title: 'Heatwave Alert',
      description: 'Extreme heat conditions. Stay hydrated and avoid prolonged sun exposure.',
      severity: 'severe'
    })
  }

  // Check for high wind
  const upcomingHighWind = props.forecastData.slice(0, 24).some(hour => 
    (hour?.wind?.speed || 0) > 25
  )
  
  if (upcomingHighWind) {
    alerts.push({
      id: 'high-wind',
      icon: '💨',
      title: 'High Wind Warning',
      description: 'Strong winds expected. Secure outdoor objects and avoid travel.',
      severity: 'high'
    })
  }

  return alerts.slice(0, 4) // Limit to 4 most important alerts
})
</script>

<style scoped>
.weather-risk-alerts-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.weather-risk-alerts-card h3 {
  margin: 0 0 20px 0;
  font-size: 20px;
  font-weight: 600;
  color: white;
}

.alerts-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.alert-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.alert-item.high {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.alert-item.severe {
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid rgba(220, 38, 38, 0.3);
}

.alert-item:hover {
  transform: translateY(-2px);
}

.alert-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.alert-info {
  flex: 1;
}

.alert-title {
  font-size: 16px;
  font-weight: 600;
  color: white;
  margin-bottom: 6px;
}

.alert-description {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.4;
}

.no-alerts {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
}

.no-alerts-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 50%;
  font-size: 24px;
  color: white;
  margin-bottom: 12px;
}

.no-alerts-text {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.8);
}

@media (max-width: 768px) {
  .alert-item {
    padding: 12px;
    gap: 10px;
  }
  
  .alert-icon {
    width: 28px;
    height: 28px;
    font-size: 18px;
  }
  
  .alert-title {
    font-size: 14px;
  }
  
  .alert-description {
    font-size: 13px;
  }
  
  .weather-risk-alerts-card h3 {
    font-size: 18px;
  }
}
</style>
