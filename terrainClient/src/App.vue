<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="app-shell">
    <RouterView />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 100vh;
  padding: 20px 24px 24px;
  box-sizing: border-box;
  background: linear-gradient(160deg, #0f172a 0%, #1e293b 100%);
}
</style>
