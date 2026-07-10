<template>
  <div class="weather-background" aria-hidden="true">
    <div class="micro-drift">
      <transition name="weather-scene-fade" mode="out-in">
        <div class="weather-scene" :key="sceneKey">
          <div class="cinematic-tint" :class="`tint-${theme}`"></div>

          <div v-if="isClear" class="condition-layer clear-layer">
            <div v-if="!isClearNight" class="sun-core"></div>
            <div v-else class="moon-core"></div>

            <span
              class="cloud-shape layer-far"
              v-for="item in clearCloudsFar"
              :key="item.id"
              :style="item.style"
            ></span>
            <span
              class="cloud-shape layer-mid"
              v-for="item in clearCloudsMid"
              :key="item.id"
              :style="item.style"
            ></span>
            <span
              class="cloud-shape layer-front"
              v-for="item in clearCloudsFront"
              :key="item.id"
              :style="item.style"
            ></span>

            <span
              v-if="isClearNight"
              class="star-point layer-far"
              v-for="item in starsFar"
              :key="item.id"
              :style="item.style"
            ></span>
            <span
              v-if="isClearNight"
              class="star-point layer-mid"
              v-for="item in starsMid"
              :key="item.id"
              :style="item.style"
            ></span>
          </div>

          <div v-if="isClouds" class="condition-layer clouds-layer">
            <span
              class="cloud-shape layer-far"
              v-for="item in cloudsFar"
              :key="item.id"
              :style="item.style"
            ></span>
            <span
              class="cloud-shape layer-mid"
              v-for="item in cloudsMid"
              :key="item.id"
              :style="item.style"
            ></span>
            <span
              class="cloud-shape layer-front"
              v-for="item in cloudsFront"
              :key="item.id"
              :style="item.style"
            ></span>
          </div>

          <div v-if="isRainLike" class="condition-layer rain-layer">
            <span
              class="cloud-shape storm-cloud layer-far"
              v-for="item in rainCloudsFar"
              :key="item.id"
              :style="item.style"
            ></span>
            <span
              class="cloud-shape storm-cloud layer-mid"
              v-for="item in rainCloudsMid"
              :key="item.id"
              :style="item.style"
            ></span>
            <span
              class="cloud-shape storm-cloud layer-front"
              v-for="item in rainCloudsFront"
              :key="item.id"
              :style="item.style"
            ></span>
            <span
              class="rain-drop layer-far"
              v-for="item in rainFar"
              :key="item.id"
              :style="item.style"
            ></span>
            <span
              class="rain-drop layer-mid"
              v-for="item in rainMid"
              :key="item.id"
              :style="item.style"
            ></span>
            <span
              class="rain-drop layer-front"
              v-for="item in rainFront"
              :key="item.id"
              :style="item.style"
            ></span>
          </div>

          <div v-if="isSnow" class="condition-layer snow-layer">
            <span
              class="snowflake layer-far"
              v-for="item in snowFar"
              :key="item.id"
              :style="item.style"
            ></span>
            <span
              class="snowflake layer-mid"
              v-for="item in snowMid"
              :key="item.id"
              :style="item.style"
            ></span>
            <span
              class="snowflake layer-front"
              v-for="item in snowFront"
              :key="item.id"
              :style="item.style"
            ></span>
          </div>
        </div>
      </transition>

      <div v-if="isThunderstorm" class="lightning-system">
        <div class="lightning-screen" :style="lightningScreenStyle"></div>
        <div class="lightning-glow" :style="lightningGlowStyle"></div>
        <div class="lightning-dark-flicker" :style="lightningDarkStyle"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  condition: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: ''
  }
})

function rand(min, max) {
  return Math.random() * (max - min) + min
}

function createItems(count, createStyle, prefix) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    style: createStyle(index)
  }))
}

function cloudSet(count, prefix, durationRange, opacityRange, scaleRange) {
  return createItems(
    count,
    () => ({
      '--left': `${rand(-30, 100).toFixed(2)}%`,
      '--top': `${rand(4, 74).toFixed(2)}%`,
      '--duration': `${rand(durationRange[0], durationRange[1]).toFixed(2)}s`,
      '--delay': `${-rand(0, 30).toFixed(2)}s`,
      '--opacity': rand(opacityRange[0], opacityRange[1]).toFixed(2),
      '--scale': rand(scaleRange[0], scaleRange[1]).toFixed(2),
      '--zigzag': `${rand(8, 22).toFixed(2)}px`
    }),
    prefix
  )
}

function rainSet(count, prefix, durationRange, opacityRange, lengthRange) {
  return createItems(
    count,
    () => ({
      '--left': `${rand(0, 100).toFixed(2)}%`,
      '--duration': `${rand(durationRange[0], durationRange[1]).toFixed(2)}s`,
      '--delay': `${-rand(0, 30).toFixed(2)}s`,
      '--opacity': rand(opacityRange[0], opacityRange[1]).toFixed(2),
      '--length': `${rand(lengthRange[0], lengthRange[1]).toFixed(2)}px`
    }),
    prefix
  )
}

function snowSet(count, prefix, durationRange, opacityRange, sizeRange, swayRange) {
  return createItems(
    count,
    () => ({
      '--left': `${rand(0, 100).toFixed(2)}%`,
      '--duration': `${rand(durationRange[0], durationRange[1]).toFixed(2)}s`,
      '--delay': `${-rand(0, 30).toFixed(2)}s`,
      '--opacity': rand(opacityRange[0], opacityRange[1]).toFixed(2),
      '--size': `${rand(sizeRange[0], sizeRange[1]).toFixed(2)}px`,
      '--sway': `${rand(swayRange[0], swayRange[1]).toFixed(2)}px`
    }),
    prefix
  )
}

function starSet(count, prefix, durationRange) {
  return createItems(
    count,
    () => ({
      '--left': `${rand(0, 100).toFixed(2)}%`,
      '--top': `${rand(0, 68).toFixed(2)}%`,
      '--size': `${rand(1, 2.8).toFixed(2)}px`,
      '--duration': `${rand(durationRange[0], durationRange[1]).toFixed(2)}s`,
      '--delay': `${-rand(0, 30).toFixed(2)}s`,
      '--opacity': rand(0.35, 0.88).toFixed(2)
    }),
    prefix
  )
}

const normalizedCondition = computed(() => props.condition || 'Clear')
const isClearNight = computed(
  () => normalizedCondition.value === 'Clear' && props.icon.endsWith('n')
)
const isClear = computed(() => normalizedCondition.value === 'Clear')
const isClouds = computed(() => normalizedCondition.value === 'Clouds')
const isRainLike = computed(() =>
  ['Rain', 'Drizzle', 'Thunderstorm'].includes(normalizedCondition.value)
)
const isThunderstorm = computed(() => normalizedCondition.value === 'Thunderstorm')
const isSnow = computed(() => normalizedCondition.value === 'Snow')

const theme = computed(() => {
  if (isThunderstorm.value) return 'thunderstorm'
  if (isRainLike.value) return 'rain'
  if (isSnow.value) return 'snow'
  if (isClouds.value) return 'clouds'
  if (isClearNight.value) return 'clear-night'
  return 'clear'
})

const sceneKey = computed(() => `${normalizedCondition.value}-${isClearNight.value ? 'night' : 'day'}`)

const clearCloudsFar = cloudSet(5, 'clear-far', [22, 30], [0.08, 0.18], [0.8, 1.3])
const clearCloudsMid = cloudSet(4, 'clear-mid', [15, 25], [0.12, 0.24], [0.72, 1.1])
const clearCloudsFront = cloudSet(3, 'clear-front', [10, 20], [0.15, 0.3], [0.62, 0.96])

const cloudsFar = cloudSet(7, 'clouds-far', [22, 30], [0.16, 0.34], [0.9, 1.35])
const cloudsMid = cloudSet(6, 'clouds-mid', [15, 25], [0.2, 0.42], [0.8, 1.2])
const cloudsFront = cloudSet(5, 'clouds-front', [10, 20], [0.24, 0.52], [0.72, 1.05])

const rainCloudsFar = cloudSet(6, 'rain-clouds-far', [22, 30], [0.14, 0.3], [0.9, 1.3])
const rainCloudsMid = cloudSet(5, 'rain-clouds-mid', [15, 25], [0.2, 0.4], [0.8, 1.15])
const rainCloudsFront = cloudSet(4, 'rain-clouds-front', [10, 20], [0.24, 0.48], [0.72, 1.02])

const rainFar = rainSet(38, 'rain-far', [22, 30], [0.16, 0.34], [10, 17])
const rainMid = rainSet(36, 'rain-mid', [15, 25], [0.24, 0.48], [12, 20])
const rainFront = rainSet(34, 'rain-front', [10, 20], [0.3, 0.65], [14, 24])

const snowFar = snowSet(34, 'snow-far', [22, 30], [0.24, 0.48], [1.8, 3.6], [8, 18])
const snowMid = snowSet(32, 'snow-mid', [15, 25], [0.3, 0.62], [2.6, 4.6], [10, 24])
const snowFront = snowSet(30, 'snow-front', [10, 20], [0.4, 0.84], [3.2, 6.2], [14, 30])

const starsFar = starSet(28, 'star-far', [16, 30])
const starsMid = starSet(24, 'star-mid', [10, 24])

const lightningScreenOpacity = ref(0)
const lightningGlowOpacity = ref(0)
const lightningDarkOpacity = ref(0)

let lightningStartTimer = null
let lightningEndTimer = null
let lightningEchoTimer = null

function clearLightningTimers() {
  if (lightningStartTimer) {
    clearTimeout(lightningStartTimer)
    lightningStartTimer = null
  }
  if (lightningEndTimer) {
    clearTimeout(lightningEndTimer)
    lightningEndTimer = null
  }
  if (lightningEchoTimer) {
    clearTimeout(lightningEchoTimer)
    lightningEchoTimer = null
  }
}

function resetLightning() {
  lightningScreenOpacity.value = 0
  lightningGlowOpacity.value = 0
  lightningDarkOpacity.value = 0
}

function triggerLightning() {
  lightningScreenOpacity.value = rand(0.2, 0.42)
  lightningGlowOpacity.value = rand(0.28, 0.58)
  lightningDarkOpacity.value = rand(0.1, 0.2)

  lightningEndTimer = setTimeout(() => {
    lightningScreenOpacity.value = 0
    lightningGlowOpacity.value = 0
    lightningDarkOpacity.value = 0
  }, 120 + Math.round(rand(0, 70)))

  // Optional subtle echo flash to avoid robotic single pulses.
  if (Math.random() > 0.55) {
    lightningEchoTimer = setTimeout(() => {
      lightningScreenOpacity.value = rand(0.14, 0.28)
      lightningGlowOpacity.value = rand(0.2, 0.4)
      lightningDarkOpacity.value = rand(0.06, 0.14)
      lightningEndTimer = setTimeout(() => {
        lightningScreenOpacity.value = 0
        lightningGlowOpacity.value = 0
        lightningDarkOpacity.value = 0
      }, 80 + Math.round(rand(0, 60)))
    }, 130 + Math.round(rand(0, 180)))
  }

  scheduleLightning()
}

function scheduleLightning() {
  if (!isThunderstorm.value) return
  const delayMs = Math.round(rand(5000, 15000))
  lightningStartTimer = setTimeout(triggerLightning, delayMs)
}

watch(
  isThunderstorm,
  (active) => {
    clearLightningTimers()
    resetLightning()
    if (active) scheduleLightning()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  clearLightningTimers()
})

const lightningScreenStyle = computed(() => ({
  opacity: lightningScreenOpacity.value
}))

const lightningGlowStyle = computed(() => ({
  opacity: lightningGlowOpacity.value
}))

const lightningDarkStyle = computed(() => ({
  opacity: lightningDarkOpacity.value
}))
</script>

<style scoped>
.weather-background {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.micro-drift {
  position: absolute;
  inset: 0;
  animation: microDrift 46s ease-in-out infinite;
}

.weather-scene {
  position: absolute;
  inset: 0;
}

.weather-scene-fade-enter-active,
.weather-scene-fade-leave-active {
  transition: opacity 0.72s ease;
}

.weather-scene-fade-enter-from,
.weather-scene-fade-leave-to {
  opacity: 0;
}

.cinematic-tint {
  position: absolute;
  inset: 0;
  animation: tintShift 42s ease-in-out infinite alternate;
}

.tint-clear {
  background:
    radial-gradient(circle at 15% 16%, rgba(255, 214, 160, 0.36), transparent 32%),
    radial-gradient(circle at 78% 18%, rgba(167, 221, 255, 0.22), transparent 38%),
    linear-gradient(165deg, #8ed1ff 0%, #6cb8f2 42%, #5ca7df 100%);
}

html.light .tint-clear {
  background:
    radial-gradient(circle at 15% 16%, rgba(255, 220, 150, 0.55), transparent 36%),
    radial-gradient(circle at 78% 18%, rgba(180, 230, 255, 0.45), transparent 40%),
    linear-gradient(165deg, #b8deff 0%, #93c9f5 42%, #7ab8ef 100%);
}

.tint-clear-night {
  background:
    radial-gradient(circle at 20% 18%, rgba(184, 206, 255, 0.18), transparent 34%),
    radial-gradient(circle at 82% 16%, rgba(155, 187, 255, 0.14), transparent 30%),
    linear-gradient(165deg, #07172e 0%, #0f2b4f 42%, #1b4676 100%);
}

.tint-clouds {
  background:
    radial-gradient(circle at 18% 24%, rgba(220, 233, 247, 0.22), transparent 34%),
    radial-gradient(circle at 82% 20%, rgba(183, 203, 224, 0.2), transparent 36%),
    linear-gradient(165deg, #6f8fa9 0%, #6a879f 42%, #5f7a91 100%);
}

html.light .tint-clouds {
  background:
    radial-gradient(circle at 18% 24%, rgba(230, 240, 255, 0.55), transparent 38%),
    radial-gradient(circle at 82% 20%, rgba(200, 220, 240, 0.45), transparent 40%),
    linear-gradient(165deg, #a8c0d8 0%, #96afc6 42%, #8aa3bb 100%);
}

.tint-rain {
  background:
    radial-gradient(circle at 16% 20%, rgba(120, 163, 203, 0.18), transparent 34%),
    radial-gradient(circle at 82% 18%, rgba(95, 142, 187, 0.18), transparent 36%),
    linear-gradient(165deg, #2d4864 0%, #2a435c 42%, #23384d 100%);
}

.tint-thunderstorm {
  background:
    radial-gradient(circle at 10% 18%, rgba(143, 157, 190, 0.12), transparent 32%),
    radial-gradient(circle at 82% 22%, rgba(121, 138, 184, 0.1), transparent 30%),
    linear-gradient(165deg, #182435 0%, #14202f 48%, #101927 100%);
}

.tint-snow {
  background:
    radial-gradient(circle at 14% 18%, rgba(243, 249, 255, 0.22), transparent 34%),
    radial-gradient(circle at 80% 20%, rgba(213, 229, 245, 0.24), transparent 36%),
    linear-gradient(165deg, #89a7c2 0%, #7f9ab4 42%, #7490aa 100%);
}

html.light .tint-snow {
  background:
    radial-gradient(circle at 14% 18%, rgba(240, 250, 255, 0.65), transparent 38%),
    radial-gradient(circle at 80% 20%, rgba(220, 238, 250, 0.55), transparent 40%),
    linear-gradient(165deg, #b8d0e8 0%, #aac4de 42%, #9eb8d4 100%);
}

.condition-layer {
  position: absolute;
  inset: 0;
}

.layer-far {
  filter: blur(1.2px);
  opacity: 0.7;
}

.layer-mid {
  filter: blur(0.45px);
}

.layer-front {
  filter: blur(0);
}

.sun-core {
  position: absolute;
  top: 8%;
  right: 10%;
  width: 230px;
  height: 230px;
  border-radius: 50%;
  background: radial-gradient(circle at 34% 34%, rgba(255, 252, 222, 0.95), #ffd170 62%, #ffb332 100%);
  animation:
    sunPulse 13s ease-in-out infinite,
    sunDrift 18s ease-in-out infinite;
  filter: drop-shadow(0 0 28px rgba(255, 196, 86, 0.62));
  will-change: transform, filter, opacity;
}

.moon-core {
  position: absolute;
  top: 10%;
  right: 12%;
  width: 165px;
  height: 165px;
  border-radius: 50%;
  background: radial-gradient(circle at 36% 35%, rgba(248, 252, 255, 0.95), rgba(188, 208, 238, 0.72));
  animation: moonDrift 18s ease-in-out infinite;
  filter: drop-shadow(0 0 20px rgba(184, 203, 247, 0.45));
  will-change: transform, filter;
}

.cloud-shape {
  position: absolute;
  left: var(--left);
  top: var(--top);
  width: calc(132px * var(--scale));
  height: calc(54px * var(--scale));
  border-radius: 999px;
  background: rgba(237, 245, 255, var(--opacity));
  animation: cloudTravel var(--duration) linear infinite;
  animation-delay: var(--delay);
  will-change: transform, opacity;
}

.cloud-shape::before,
.cloud-shape::after {
  content: '';
  position: absolute;
  border-radius: 999px;
  background: inherit;
}

.cloud-shape::before {
  width: 45%;
  height: 132%;
  top: -42%;
  left: 14%;
}

.cloud-shape::after {
  width: 48%;
  height: 148%;
  top: -34%;
  right: 12%;
}

.rain-drop {
  position: absolute;
  left: var(--left);
  top: -24vh;
  width: 2px;
  height: var(--length);
  border-radius: 999px;
  background: linear-gradient(to bottom, rgba(168, 217, 255, 0), rgba(122, 198, 255, var(--opacity)));
  animation: rainFall var(--duration) linear infinite;
  animation-delay: var(--delay);
  will-change: transform, opacity;
}

.storm-cloud {
  background: rgba(193, 213, 237, var(--opacity));
}

.rain-drop.layer-far {
  filter: blur(0.8px);
}

.rain-drop.layer-mid {
  filter: blur(0.35px);
}

.rain-drop.layer-front {
  filter: drop-shadow(0 0 2px rgba(126, 198, 255, 0.35));
}

.snowflake {
  position: absolute;
  left: var(--left);
  top: -14vh;
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  background: rgba(244, 248, 255, var(--opacity));
  animation: snowFall var(--duration) linear infinite;
  animation-delay: var(--delay);
  will-change: transform, opacity;
}

.snowflake.layer-far {
  filter: blur(0.8px);
}

.snowflake.layer-mid {
  filter: blur(0.3px);
}

.star-point {
  position: absolute;
  left: var(--left);
  top: var(--top);
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  background: rgba(255, 255, 255, var(--opacity));
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.48);
  animation: starTwinkle var(--duration) ease-in-out infinite;
  animation-delay: var(--delay);
  will-change: opacity, transform;
}

.lightning-system {
  position: absolute;
  inset: 0;
}

.lightning-screen,
.lightning-glow,
.lightning-dark-flicker {
  position: absolute;
  inset: 0;
  transition: opacity 80ms ease-out;
  will-change: opacity, filter;
}

.lightning-screen {
  background: linear-gradient(rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0.42));
}

.lightning-glow {
  background: radial-gradient(circle at 56% 18%, rgba(255, 255, 255, 0.92), transparent 36%);
  mix-blend-mode: screen;
}

.lightning-dark-flicker {
  background: rgba(5, 12, 26, 0.28);
  mix-blend-mode: multiply;
}

@keyframes microDrift {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(0, -6px, 0);
  }
}

@keyframes tintShift {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(-1.5%, -1%, 0) scale(1.03);
  }
  100% {
    transform: translate3d(1.2%, 1%, 0) scale(1.02);
  }
}

@keyframes sunPulse {
  0%,
  100% {
    transform: scale(1);
    filter: drop-shadow(0 0 26px rgba(255, 198, 89, 0.58));
  }
  50% {
    transform: scale(1.05);
    filter: drop-shadow(0 0 42px rgba(255, 206, 108, 0.84));
  }
}

@keyframes sunDrift {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(9px, -8px, 0);
  }
}

@keyframes moonDrift {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(-7px, 7px, 0);
  }
}

@keyframes cloudTravel {
  0% {
    transform: translate3d(0, 0, 0);
  }
  25% {
    transform: translate3d(30vw, var(--zigzag), 0);
  }
  50% {
    transform: translate3d(60vw, calc(var(--zigzag) * -1), 0);
  }
  75% {
    transform: translate3d(90vw, calc(var(--zigzag) * 0.5), 0);
  }
  100% {
    transform: translate3d(125vw, 0, 0);
  }
}

@keyframes rainFall {
  0% {
    transform: translate3d(0, -22vh, 0);
    opacity: 0;
  }
  10% {
    opacity: var(--opacity);
  }
  100% {
    transform: translate3d(0, 122vh, 0);
    opacity: 0;
  }
}

@keyframes snowFall {
  0% {
    transform: translate3d(0, -14vh, 0);
  }
  25% {
    transform: translate3d(calc(var(--sway) * 0.5), 26vh, 0);
  }
  50% {
    transform: translate3d(calc(var(--sway) * -0.64), 52vh, 0);
  }
  75% {
    transform: translate3d(var(--sway), 78vh, 0);
  }
  100% {
    transform: translate3d(calc(var(--sway) * -0.35), 115vh, 0);
  }
}

@keyframes starTwinkle {
  0%,
  100% {
    opacity: 0.28;
  }
  50% {
    opacity: 1;
  }
}
</style>
