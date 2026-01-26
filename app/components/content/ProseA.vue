<template>
  <NuxtLink
    :href="props.href"
    :target="props.target"
    class="text-rose-400 hover:text-rose-500 transition-colors hover:underline decoration-dashed"
  >
    <slot />
  </NuxtLink>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  href: string;
  target?: string;
}>(), {
  href: '',
  target: undefined,
});
</script>
