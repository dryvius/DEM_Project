<script setup lang="ts">
import { onMounted, useId } from 'vue'
import { useEpgisMap } from '@/composables/useEpgisMap'

const mapContainerId = `epgis-map-${useId().replace(/:/g, '')}`

const { loadState, errorInfo, initMap } = useEpgisMap(mapContainerId)

onMounted(() => {
  void initMap()
})
</script>

<template>
  <div class="epgis-map-root">
    <div :id="mapContainerId" class="epgis-map-canvas" />

    <div v-if="loadState === 'loading'" class="epgis-map-overlay" role="status">
      <span class="epgis-map-spinner" aria-hidden="true" />
      <p>正在加载思极地图与高程数据…</p>
    </div>

    <div v-else-if="loadState === 'error'" class="epgis-map-overlay epgis-map-overlay--error" role="alert">
      <p class="epgis-map-error-title">地图加载失败</p>
      <p class="epgis-map-error-message">{{ errorInfo?.message }}</p>
      <ul class="epgis-map-hint">
        <li>确认已配置 <code>.env</code> 中的思极地图密钥</li>
        <li>
          确认 <code>terrain-server</code> 已启动：
          <code>cd terrain-server &amp;&amp; npm start</code>
        </li>
        <li>开发模式下 Vite 会将 <code>/terrain</code> 代理到 <code>localhost:8080</code></li>
      </ul>
    </div>

    <aside v-else-if="loadState === 'ready'" class="epgis-map-badge">
      本地 GEM 高程 · 秦岭演示视角
    </aside>
  </div>
</template>

<style scoped>
.epgis-map-root {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 480px;
  overflow: hidden;
  border-radius: 8px;
  background: #0f1419;
}

.epgis-map-canvas {
  width: 100%;
  height: 100%;
}

.epgis-map-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
  color: #e8eaed;
  background: rgb(15 20 25 / 88%);
}

.epgis-map-overlay--error {
  color: #fecaca;
}

.epgis-map-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgb(255 255 255 / 20%);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: epgis-spin 0.8s linear infinite;
}

@keyframes epgis-spin {
  to {
    transform: rotate(360deg);
  }
}

.epgis-map-error-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.epgis-map-error-message {
  margin: 0;
  max-width: 520px;
  font-size: 0.9rem;
  line-height: 1.5;
  color: #fca5a5;
}

.epgis-map-hint {
  margin: 8px 0 0;
  padding-left: 1.25rem;
  max-width: 520px;
  font-size: 0.8125rem;
  line-height: 1.6;
  text-align: left;
  color: #d1d5db;
}

.epgis-map-hint code {
  font-size: 0.75rem;
  color: #93c5fd;
}

.epgis-map-badge {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 5;
  padding: 6px 10px;
  font-size: 12px;
  color: #f3f4f6;
  background: rgb(0 0 0 / 55%);
  border-radius: 4px;
  pointer-events: none;
}
</style>
