<script setup lang="ts">
import EpgisMap from '@/components/EpgisMap.vue'
</script>

<template>
  <section class="map-view">
    <header class="map-view__header">
      <h1>思极地图 v3 · 陕西省高程</h1>
      <p>
        底图为思极<strong>影像</strong>，地形为本地
        <strong>陕西省 GEM</strong>（terrain-server）。要看到山体隆起，需保持一定
        <strong>俯仰角</strong>（默认约 75°）并将缩放保持在
        <strong>z=10</strong>（当前 MBTiles 仅含该层级）。滚轮缩放，按住右键或
        Ctrl+拖动可调整俯仰与方向。
      </p>
    </header>
    <EpgisMap class="map-view__map" />
  </section>
</template>

<style scoped>
.map-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.map-view__header h1 {
  margin: 0 0 8px;
  font-size: 1.375rem;
  font-weight: 600;
  color: #f9fafb;
}

.map-view__header p {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.6;
  color: #9ca3af;
}

.map-view__header strong {
  color: #60a5fa;
  font-weight: 600;
}

.map-view__map {
  flex: 1;
  min-height: 0;
}
</style>
