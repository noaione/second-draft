<template>
  <div class="min-h-screen bg-(--a11y-bg)" :style="themeStyle">
    <!-- Top Navigation -->
    <header class="sticky top-0 z-50 border-b border-(--a11y-border) bg-(--a11y-bg)">
      <div class="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div class="flex items-center justify-between h-14 sm:h-16 gap-1 sm:gap-2">
          <div class="flex items-center gap-1">
            <UButton
              to="/"
              prefetch
              variant="ghost"
              color="neutral"
              icon="lucide:house"
              size="sm"
              square
              class="sm:hidden"
            />
            <UButton
              to="/"
              prefetch
              variant="ghost"
              color="neutral"
              icon="lucide:house"
              size="sm"
              class="hidden sm:flex"
            >
              home
            </UButton>
            <UButton
              :to="`/collections/${collectionId}`"
              prefetch
              variant="ghost"
              color="neutral"
              icon="lucide:table-of-contents"
              size="sm"
              square
              class="sm:hidden"
            />
            <UButton
              :to="`/collections/${collectionId}`"
              prefetch
              variant="ghost"
              color="neutral"
              icon="lucide:table-of-contents"
              size="sm"
              class="hidden sm:flex"
            >
              collection
            </UButton>
          </div>

          <!-- Chapter Selector -->
          <div class="flex-1 min-w-0 mx-1 sm:mx-4">
            <USelect
              v-model="postId"
              :items="sortedPosts.map(p => ({ label: p.title, value: p.postId }))"
              placeholder="Select a chapter"
              class="w-full ps-4 pe-4"
              @update:model-value="(value) => navigateTo(`/collections/${collectionId}/posts/${value}`)"
              :ui="{
                leading: 'relative ps-0'
              }"
            >
              <template #leading>
                <span class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                  Ch {{ currentIndex + 1 }}/{{ sortedPosts.length }}
                </span>
              </template>
            </USelect>
          </div>

          <div class="flex items-center gap-1">
            <UPopover>
              <UButton
                variant="ghost"
                color="neutral"
                icon="lucide:case-sensitive"
                size="sm"
                square
                title="Reading display settings"
                aria-label="Reading display settings"
              />

              <template #content>
                <div class="w-72 max-w-[calc(100vw-2rem)] p-4 space-y-4">
                  <div class="flex items-center justify-between">
                    <h2 class="font-semibold text-sm">Display settings</h2>
                    <UButton variant="ghost" color="neutral" size="xs" @click="resetPreferences">
                      Reset
                    </UButton>
                  </div>

                  <UFormField label="Text size">
                    <div class="flex items-center gap-2">
                      <UButton
                        icon="lucide:minus"
                        variant="outline"
                        color="neutral"
                        size="xs"
                        square
                        :disabled="preferences.fontScale <= fontScaleMin"
                        aria-label="Decrease text size"
                        @click="adjustFontScale(-fontScaleStep)"
                      />
                      <span class="text-sm tabular-nums w-12 text-center">{{ Math.round(preferences.fontScale * 100) }}%</span>
                      <UButton
                        icon="lucide:plus"
                        variant="outline"
                        color="neutral"
                        size="xs"
                        square
                        :disabled="preferences.fontScale >= fontScaleMax"
                        aria-label="Increase text size"
                        @click="adjustFontScale(fontScaleStep)"
                      />
                    </div>
                  </UFormField>

                  <UFormField label="Font">
                    <USelect
                      v-model="preferences.fontFamily"
                      :items="FONT_FAMILY_OPTIONS.map((o) => ({ label: o.label, value: o.value }))"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField label="Line height">
                    <USelect
                      v-model="preferences.lineHeight"
                      :items="LINE_HEIGHT_OPTIONS.map((o) => ({ label: o.label, value: o.value }))"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField label="Content width">
                    <USelect
                      v-model="preferences.measure"
                      :items="MEASURE_OPTIONS.map((o) => ({ label: o.label, value: o.value }))"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField label="Text alignment">
                    <USelect
                      v-model="preferences.textAlign"
                      :items="TEXT_ALIGN_OPTIONS.map((o) => ({ label: o.label, value: o.value }))"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField label="Reading speed">
                    <USelect
                      v-model="preferences.speed"
                      :items="READING_SPEED_OPTIONS.map((o) => ({ label: `${o.label} (${BASE_WPM * o.speed} wpm)`, value: o.value }))"
                      class="w-full"
                    />
                  </UFormField>

                  <USwitch v-model="isWideLetterSpacing" label="Wide letter spacing" />

                  <UFormField label="Theme">
                    <div class="flex items-center gap-2">
                      <button
                        v-for="option in THEME_OPTIONS"
                        :key="option.value"
                        type="button"
                        class="w-7 h-7 rounded-full border-2 flex items-center justify-center cursor-pointer"
                        :class="[
                          preferences.theme === option.value ? 'border-primary' : 'border-gray-300 dark:border-gray-600',
                          option.value === 'high-contrast' ? 'ring-1 ring-inset ring-white/80' : '',
                        ]"
                        :style="{ backgroundColor: option.swatchBg }"
                        :aria-pressed="preferences.theme === option.value"
                        :aria-label="option.label"
                        :title="option.label"
                        @click="preferences.theme = option.value"
                      >
                        <UIcon
                          v-if="preferences.theme === option.value"
                          name="lucide:check"
                          class="w-4 h-4"
                          :style="{ color: option.swatchText }"
                        />
                      </button>
                    </div>
                  </UFormField>
                </div>
              </template>
            </UPopover>
            <UButton
              :to="previousPost ? `/collections/${collectionId}/posts/${previousPost.postId}` : '#'"
              prefetch
              variant="ghost"
              color="neutral"
              icon="lucide:chevron-left"
              size="sm"
              square
              class="sm:hidden"
              :class="{
                'invisible': !previousPost,
              }"
            />
            <UButton
              :to="previousPost ? `/collections/${collectionId}/posts/${previousPost.postId}` : '#'"
              prefetch
              variant="ghost"
              color="neutral"
              icon="lucide:chevron-left"
              size="sm"
              class="hidden sm:flex"
              :class="{
                'invisible': !previousPost,
              }"
            >
              previous
            </UButton>
            <UButton
              :to="nextPost ? `/collections/${collectionId}/posts/${nextPost.postId}` : '#'"
              prefetch
              variant="ghost"
              color="neutral"
              trailing-icon="lucide:chevron-right"
              size="sm"
              square
              class="sm:hidden"
              :class="{
                'invisible': !nextPost,
              }"
            />
            <UButton
              :to="nextPost ? `/collections/${collectionId}/posts/${nextPost.postId}` : '#'"
              prefetch
              variant="ghost"
              color="neutral"
              trailing-icon="lucide:chevron-right"
              size="sm"
              class="hidden sm:flex"
              :class="{
                'invisible': !nextPost,
              }"
            >
              next
            </UButton>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <UCard v-if="post" class="shadow-lg bg-(--a11y-card-bg)">
        <!-- Post Header -->
        <template #header>
          <div class="space-y-4">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 text-sm text-(--a11y-muted)">
                <UBadge color="neutral" variant="subtle">
                  Chapter {{ currentIndex + 1 }}
                </UBadge>
                <span v-if="(post as any).publishedAt">
                  {{ formatDate((post as any).publishedAt) }}
                </span>
              </div>
              <UButton
                variant="ghost"
                color="neutral"
                class="cursor-pointer"
                :icon="refreshIcon"
                size="xs"
                square
                :loading="refreshing"
                :disabled="refreshing"
                title="Force re-render from source markdown"
                @click="refreshPost"
              />
            </div>
            <h1 class="text-4xl font-bold text-(--a11y-text)" :class="fontFamilyClass">
              {{ post.title }}
            </h1>
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-(--a11y-muted)" :class="fontFamilyClass">
              <template v-if="(post as any).author">
                <div class="flex items-center gap-2">
                  <UIcon name="lucide:circle-user-round" class="w-5 h-5" />
                  <span>{{ (post as any).author }}</span>
                </div>
                <span aria-hidden="true">·</span>
              </template>
              <span class="text-sm">{{ wordCountLabel }}</span>
            </div>
          </div>
        </template>

        <!-- Post Content -->
        <div
          class="prose prose-lg max-w-none prose-headings:font-bold prose-a:text-primary prose-img:rounded-lg"
          :class="[fontFamilyClass, proseInvertClass]"
          :style="proseStyle"
          ref="readerRef"
        >
          <MDCRenderer v-if="computedBody !== null" :body="computedBody" />
        </div>

        <!-- Post Footer with Navigation -->
        <template #footer>
          <div class="flex items-center justify-between gap-2 pt-4 sm:pt-6">
            <UButton
              :to="previousPost ? `/collections/${collectionId}/posts/${previousPost.postId}` : '#'"
              variant="outline"
              color="neutral"
              icon="lucide:arrow-left"
              size="sm"
              class="flex-1 sm:hidden"
              :class="{
                'invisible': !previousPost,
              }"
            >
              prev
            </UButton>
            <UButton
              :to="previousPost ? `/collections/${collectionId}/posts/${previousPost.postId}` : '#'"
              variant="outline"
              color="neutral"
              icon="lucide:arrow-left"
              size="lg"
              class="hidden sm:flex justify-start"
              :class="{
                'invisible': !previousPost,
              }"
            >
              <div class="flex flex-col items-start">
                <span class="text-xs text-(--a11y-muted)">previous</span>
                <span class="font-medium truncate max-w-50">{{ previousPost?.title }}</span>
              </div>
            </UButton>

            <UButton
              :to="nextPost ? `/collections/${collectionId}/posts/${nextPost.postId}` : '#'"
              variant="outline"
              color="neutral"
              trailing-icon="lucide:arrow-right"
              size="sm"
              class="flex-1 sm:hidden justify-end"
              :class="{
                'invisible': !nextPost,
              }"
            >
              next
            </UButton>
            <UButton
              :to="nextPost ? `/collections/${collectionId}/posts/${nextPost.postId}` : '#'"
              variant="outline"
              color="neutral"
              trailing-icon="lucide:arrow-right"
              size="lg"
              class="hidden sm:flex"
              :class="{
                'invisible': !nextPost,
              }"
            >
              <div class="flex flex-col items-end">
                <span class="text-xs text-(--a11y-muted)">next</span>
                <span class="font-medium truncate max-w-50">{{ nextPost?.title }}</span>
              </div>
            </UButton>
          </div>
        </template>
      </UCard>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { MDCRoot } from '@nuxtjs/mdc';
import type { MinimarkTree } from 'minimark';
import { toHast } from 'minimark/hast';
import { useScroll } from '@vueuse/core';

interface ReadingState {
  id: string;
  cid: string;
}

const readerRef = useTemplateRef('readerRef');
const { y } = useWindowScroll();
const readData = useLocalStorage<ReadingState[]>('finished-reading', []);
const route = useRoute();
const collectionId = route.params.id as string;
const postId = route.params.postId as string;

const {
  preferences,
  themeStyle,
  fontFamilyClass,
  proseStyle,
  wpmRate,
  adjustFontScale,
  resetPreferences,
  fontScaleStep,
  fontScaleMin,
  fontScaleMax,
} = useReadingPreferences();

const isWideLetterSpacing = computed({
  get: () => preferences.value.letterSpacing === 'wide',
  set: (value: boolean) => {
    preferences.value.letterSpacing = value ? 'wide' : 'normal';
  },
});

// Typography plugin's dark-mode palette is meant to follow the OS via the
// `.dark` html class; once the reader picks an explicit theme, invert (or not)
// based on that choice instead so e.g. Sepia never renders white-on-cream text.
const proseInvertClass = computed(() => {
  if (preferences.value.theme === 'system') return 'dark:prose-invert';
  return preferences.value.theme === 'dark' || preferences.value.theme === 'high-contrast' ? 'prose-invert' : '';
});

interface PostMetadata {
  title: string;
  postId: string;
  publishedAt: string;
  author: string;
  collectionName: string;
  collectionId: string;
  body: MinimarkTree,
}

// Fetch current post
const { data: post } = await useFetch<PostMetadata>(`/api/collections/${collectionId}/posts/${postId}`);

if (!post.value) {
  throw createError({ statusCode: 404, statusMessage: 'Post not found', fatal: true });
}

// Fetch all posts in collection for navigation
const { data: allPosts } = await useFetch<any[]>(`/api/collections/${collectionId}/posts`);

const computedBody = computed(() => {
  if (!post.value) return null;
  return toHast(post.value.body) as MDCRoot;
});

function collectHastText(node: any, out: string[]) {
  if (!node) return;
  if (node.type === 'text' && typeof node.value === 'string') {
    out.push(node.value);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) collectHastText(child, out);
  }
}

const wordCountLabel = computed(() => {
  if (!computedBody.value) return '';
  const textChunks: string[] = [];
  collectHastText(computedBody.value, textChunks);
  const words = textChunks.join(' ').trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return '';
  const minutes = Math.max(1, Math.round(words / wpmRate.value));
  return `${words.toLocaleString()} words · ~${minutes} min read`;
});

// Use the posts list position exactly as returned by the API — chapter
// IDs don't necessarily match reading order (Wattpad authors can reorder
// their table of contents), so never re-sort by postId here.
const sortedPosts = computed(() => allPosts.value ?? []);

// Find current post index
const currentIndex = computed(() => {
  return sortedPosts.value.findIndex(p => p.postId === postId);
});

// Navigation
const previousPost = computed(() => {
  if (currentIndex.value > 0) {
    return sortedPosts.value[currentIndex.value - 1];
  }
  return null;
});

const nextPost = computed(() => {
  if (currentIndex.value < sortedPosts.value.length - 1) {
    return sortedPosts.value[currentIndex.value + 1];
  }
  return null;
});

const refreshing = ref(false);
const refreshIcon = ref('lucide:refresh-cw');

async function refreshPost() {
  if (refreshing.value) return;
  refreshing.value = true;
  try {
    const fresh = await $fetch<PostMetadata>(`/api/collections/${collectionId}/posts/${postId}/refresh`, {
      method: 'POST',
    });
    post.value = fresh;
    refreshIcon.value = 'lucide:check';
  } catch (error) {
    console.error('Failed to force re-render post:', error);
    refreshIcon.value = 'lucide:alert-circle';
  } finally {
    refreshing.value = false;
    setTimeout(() => {
      refreshIcon.value = 'lucide:refresh-cw';
    }, 1500);
  }
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

function addToFinishedReading() {
  const existing = readData.value.find(r => r.id === post.value!.postId);
  if (existing) return;
  readData.value.push({
    id: post.value!.postId,
    cid: post.value!.collectionId,
  });
}

const stop = watch(y, () => {
  const el = readerRef.value;
  if (!el) return;
  if (computedBody.value === null) return; // ignore

  const rect = el.getBoundingClientRect();
  const windowHeight = window.innerHeight;

  const elementTop = rect.top + window.scrollY;
  const elementHeight = el.offsetHeight;

  const scrolled = window.scrollY + windowHeight - elementTop;
  const progress = scrolled / elementHeight;

  if (progress >= 0.9) {
    console.log('Marked as read');
    addToFinishedReading();
    stop();
  }
});

useSeoMeta({
  title: post.value!.title,
  description: `Read "${post.value!.title}" from the "${post.value!.collectionName}" collection.`,
  ogTitle: post.value!.title,
  ogDescription: `Read "${post.value!.title}" from the "${post.value!.collectionName}" collection.`,
  ogType: 'article',
})
</script>
