<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string
    /** 方案速配等页：右侧操作区容器 */
    toolbar?: boolean
    /** 略收紧顶栏上下留白（仍与主标题字级一致） */
    compact?: boolean
  }>(),
  {
    toolbar: false,
    compact: false,
  },
)
</script>

<template>
  <header
    class="app-header"
    :class="{
      'app-header--toolbar': props.toolbar,
      'app-header--compact': props.compact && !props.toolbar,
    }"
  >
    <div v-if="props.toolbar" class="app-header__toolbar">
      <div class="app-header__center-block">
        <h1 class="app-header__title">{{ props.title }}</h1>
      </div>
      <div class="app-header__trailing">
        <slot name="trailing" />
      </div>
    </div>
    <div v-else class="app-header__simple">
      <h1 class="app-header__title">{{ props.title }}</h1>
    </div>
  </header>
</template>

<style scoped>
/** 全局页标题：统一字级（顶栏居中 / 工具栏） */
.app-header__title {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  line-height: 1.3;
  letter-spacing: -0.01em;
  word-break: break-word;
}

.app-header {
  padding: 12px 16px 10px;
}

.app-header--compact {
  padding: 10px 12px 8px;
}

.app-header__simple {
  text-align: center;
}

.app-header__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.app-header__center-block {
  flex: 1;
  min-width: 0;
  text-align: center;
}

.app-header__trailing {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.app-header__trailing :deep(*) {
  margin: 0;
}
</style>
