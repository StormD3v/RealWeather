<template>
  <div class="weather-trends-card">
    <h3>Weather Trends</h3>
    
    <div class="trends-content">
      <div class="trends-grid">
        <!-- Temperature Trend -->
        <div class="trend-card">
          <div class="trend-header">
            <span class="trend-icon">🌡️</span>
            <span class="trend-name">Temperature</span>
          </div>
          <div class="trend-value">{{ Math.round(currentWeather?.main?.temp || 0) }}&deg;{{ unitSymbol }}</div>
          <div class="trend-change">
            <span class="trend-arrow">{{ getTrendArrow(trendIndicators.temperature) }}</span>
            <span class="trend-amount">{{ getTrendAmount(trendIndicators.temperature, 'temp') }}</span>
          </div>
        </div>
        
        <!-- Humidity Trend -->
        <div class="trend-card">
          <div class="trend-header">
            <span class="trend-icon">💧</span>
            <span class="trend-name">Humidity</span>
          </div>
          <div class="trend-value">{{ currentWeather?.main?.humidity || 0 }}%</div>
          <div class="trend-change">
            <span class="trend-arrow">{{ getTrendArrow(trendIndicators.humidity) }}</span>
            <span class="trend-amount">{{ getTrendAmount(trendIndicators.humidity, 'humidity') }}</span>
          </div>
        </div>
        
        <!-- Wind Speed Trend -->
        <div class="trend-card">
          <div class="trend-header">
            <span class="trend-icon">💨</span>
            <span class="trend-name">Wind Speed</span>
          </div>
          <div class="trend-value">{{ currentWeather?.wind?.speed || 0 }} km/h</div>
          <div class="trend-change">
            <span class="trend-arrow">{{ getTrendArrow(trendIndicators.windSpeed) }}</span>
            <span class="trend-amount">{{ getTrendAmount(trendIndicators.windSpeed, 'wind') }}</span>
          </div>
        </div>
        
        <!-- Rain Chance Trend -->
        <div class="trend-card">
          <div class="trend-header">
            <span class="trend-icon">🌧️</span>
            <span class="trend-name">Rain Chance</span>
          </div>
          <div class="trend-value">{{ Math.round(currentWeather?.rain?.chance || 0) }}%</div>
          <div class="trend-change">
            <span class="trend-arrow">{{ getTrendArrow(trendIndicators.rainChance) }}</span>
            <span class="trend-amount">{{ getTrendAmount(trendIndicators.rainChance, 'rain') }}</span>
          </div>
        </div>
        
        <!-- Pressure Trend -->
        <div class="trend-card">
          <div class="trend-header">
            <span class="trend-icon">📊</span>
            <span class="trend-name">Pressure</span>
          </div>
          <div class="trend-value">{{ currentWeather?.main?.pressure && currentWeather?.main?.pressure > 0 ? currentWeather?.main?.pressure : 'N/A' }} hPa</div>
          <div class="trend-change">
            <span class="trend-arrow">{{ getTrendArrow(trendIndicators.pressure) }}</span>
            <span class="trend-amount">{{ getTrendAmount(trendIndicators.pressure, 'pressure') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  currentWeather: {
    type: Object,
    default: null
  },
  trendIndicators: {
    type: Object,
    default: () => ({})
  },
  unitSymbol: {
    type: String,
    default: 'C'
  }
})

function getTrendArrow(trend) {
  if (trend === 'up') return '↑'
  if (trend === 'down') return '↓'
  return '→'
}

function getTrendAmount(trend, type) {
  if (!trend || trend === 'stable') return 'stable'
  
  const prefix = trend === 'up' ? '+' : '-'
  
  switch (type) {
    case 'temp':
      return `${prefix}3°C`
    case 'humidity':
      return `${prefix}5%`
    case 'wind':
      return `${prefix}2 km/h`
    case 'rain':
      return `${prefix}15%`
    case 'pressure':
      return 'stable'
    default:
      return `${prefix}0`
  }
}
</script>

<style scoped>
.weather-trends-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.weather-trends-card h3 {
  margin: 0 0 20px 0;
  font-size: 20px;
  font-weight: 600;
  color: white;
}

.trends-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
}

.trends-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  flex: 1;
}

.trend-card {
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.trend-card:hover {
  background: rgba(255, 255, 255, 0.12);
  transform: translateY(-2px);
}

.trend-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.trend-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.trend-name {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.trend-value {
  font-size: 24px;
  font-weight: 700;
  color: white;
  margin-bottom: 8px;
}

.trend-change {
  display: flex;
  align-items: center;
  gap: 6px;
}

.trend-arrow {
  font-size: 16px;
  font-weight: 600;
}

.trend-arrow.up {
  color: rgba(34, 197, 94, 0.9);
}

.trend-arrow.down {
  color: rgba(239, 68, 68, 0.9);
}

.trend-arrow.stable {
  color: rgba(255, 255, 255, 0.8);
}

.trend-amount {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}

@media (max-width: 768px) {
  .trends-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .trend-card {
    padding: 14px;
  }
  
  .trend-value {
    font-size: 20px;
  }
  
  .weather-trends-card h3 {
    font-size: 18px;
  }
}
</style>
