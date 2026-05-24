<template>
  <div class="activity-recommendations">
    <h3>Activity Recommendations</h3>
    
    <div class="recommendations-content">
      <div class="recommendation-message">
        <p>{{ mainRecommendation }}</p>
      </div>
      
      <div class="activity-tags">
        <div 
          v-for="activity in activityList" 
          :key="activity"
          class="activity-tag"
        >
          {{ activity }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  recommendations: {
    type: Array,
    default: () => []
  },
  currentWeather: {
    type: Object,
    default: null
  }
})

const mainRecommendation = computed(() => {
  const temp = props.currentWeather?.main?.temp
  const condition = props.currentWeather?.weather?.[0]?.main
  const rainChance = props.currentWeather?.rain?.chance
  
  if (!temp) return 'Weather data unavailable for activity recommendations.'
  
  if (rainChance > 50) {
    return 'High chance of rain. Indoor activities recommended. Consider covered venues or reschedule outdoor events.'
  }
  
  if (temp > 30) {
    return 'Very hot conditions. Plan indoor activities with cooling, or schedule outdoor activities for early morning/evening.'
  }
  
  if (temp < 10) {
    return 'Cold weather expected. Dress warmly for outdoor activities or consider indoor alternatives.'
  }
  
  if (condition === 'Clear' && temp >= 18 && temp <= 26) {
    return 'Perfect weather conditions! Ideal for outdoor activities and events.'
  }
  
  return 'Moderate weather conditions. Most activities suitable with minor adjustments.'
})

const activityList = computed(() => {
  const temp = props.currentWeather?.main?.temp
  const rainChance = props.currentWeather?.rain?.chance
  const condition = props.currentWeather?.weather?.[0]?.main
  
  const activities = []
  
  if (rainChance > 50) {
    activities.push('Indoor Sports', 'Museum Tours', 'Shopping Centers')
  } else if (temp > 30) {
    activities.push('Swimming', 'Indoor Activities', 'Evening Walks')
  } else if (temp < 10) {
    activities.push('Indoor Fitness', 'Hot Springs', 'Café Visits')
  } else if (condition === 'Clear' && temp >= 18 && temp <= 26) {
    activities.push('Outdoor Sports', 'BBQ & Picnics', 'Hiking', 'Cycling')
  } else {
    activities.push('Light Exercise', 'Walking', 'Casual Outings')
  }
  
  return activities.slice(0, 4) // Limit to 4 tags
})
</script>

<style scoped>
.activity-recommendations {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.activity-recommendations h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
  font-weight: 600;
  color: white;
}

.recommendations-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex: 1;
}

.recommendation-message {
  flex: 1;
}

.recommendation-message p {
  margin: 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.5;
}

.activity-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.activity-tag {
  padding: 8px 20px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 25px;
  font-size: 13px;
  color: white;
  font-weight: 500;
  transition: all 0.2s ease;
  letter-spacing: 0.3px;
}

.activity-tag:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

@media (max-width: 768px) {
  .recommendations-content {
    gap: 16px;
  }
  
  .activity-tags {
    gap: 6px;
  }
  
  .activity-tag {
    padding: 6px 12px;
    font-size: 11px;
  }
}
</style>
