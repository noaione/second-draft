<template>
  <component :is="tag" :style="style" data-is-styled>
    <slot />
  </component>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  style: string;
  tag: string;
}>(), {
  style: '',
  tag: 'p',
});
</script>
