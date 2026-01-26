<template>
  <div class="min-h-screen bg-white dark:bg-black">
    <!-- Top Navigation -->
    <header class="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
      <div class="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div class="flex items-center justify-between h-14 sm:h-16 gap-1 sm:gap-2">
          <div class="flex items-center gap-1">
            <UButton
              to="/"
              variant="ghost"
              color="neutral"
              icon="lucide:house"
              size="sm"
              square
              class="sm:hidden"
            />
            <UButton
              to="/"
              variant="ghost"
              color="neutral"
              icon="lucide:house"
              size="sm"
              class="hidden sm:flex"
            >
              Home
            </UButton>
            <UButton
              :to="`/collections/${collectionId}`"
              variant="ghost"
              color="neutral"
              icon="lucide:arrow-left"
              size="sm"
              square
              class="sm:hidden"
            />
            <UButton
              :to="`/collections/${collectionId}`"
              variant="ghost"
              color="neutral"
              icon="lucide:arrow-left"
              size="sm"
              class="hidden sm:flex"
            >
              Collection
            </UButton>
          </div>

          <!-- Chapter Selector -->
          <div class="flex-1 min-w-0 mx-1 sm:mx-4">
            <USelect
              v-model="postId"
              :items="sortedPosts.map(p => ({ label: p.title, value: p.postId }))"
              placeholder="Select a chapter"
              class="w-full"
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
            <UButton
              v-if="previousPost"
              :to="`/collections/${collectionId}/posts/${previousPost.postId}`"
              variant="ghost"
              color="neutral"
              icon="lucide:chevron-left"
              size="sm"
              square
              class="sm:hidden"
            />
            <UButton
              v-if="previousPost"
              :to="`/collections/${collectionId}/posts/${previousPost.postId}`"
              variant="ghost"
              color="neutral"
              icon="lucide:chevron-left"
              size="sm"
              class="hidden sm:flex"
            >
              Previous
            </UButton>
            <UButton
              v-if="nextPost"
              :to="`/collections/${collectionId}/posts/${nextPost.postId}`"
              variant="ghost"
              color="neutral"
              trailing-icon="lucide:chevron-right"
              size="sm"
              square
              class="sm:hidden"
            />
            <UButton
              v-if="nextPost"
              :to="`/collections/${collectionId}/posts/${nextPost.postId}`"
              variant="ghost"
              color="neutral"
              trailing-icon="lucide:chevron-right"
              size="sm"
              class="hidden sm:flex"
            >
              Next
            </UButton>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <UCard v-if="post" class="shadow-lg">
        <!-- Post Header -->
        <template #header>
          <div class="space-y-4">
            <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <UBadge color="neutral" variant="subtle">
                Chapter {{ currentIndex + 1 }}
              </UBadge>
              <span v-if="(post as any).publishedAt">
                {{ formatDate((post as any).publishedAt) }}
              </span>
            </div>
            <h1 class="text-4xl font-bold text-gray-900 dark:text-white">
              {{ post.title }}
            </h1>
            <div v-if="(post as any).author" class="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <UIcon name="lucide:circle-user-round" class="w-5 h-5" />
              <span>{{ (post as any).author }}</span>
            </div>
          </div>
        </template>

        <!-- Post Content -->
        <div class="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary prose-img:rounded-lg text-base">
          <AwesomeRender :value="post" />
        </div>

        <!-- Post Footer with Navigation -->
        <template #footer>
          <div class="flex items-center justify-between gap-2 pt-4 sm:pt-6 border-t border-gray-200 dark:border-gray-800">
            <UButton
              v-if="previousPost"
              :to="`/collections/${collectionId}/posts/${previousPost.postId}`"
              variant="outline"
              color="neutral"
              icon="lucide:arrow-left"
              size="sm"
              class="flex-1 sm:hidden"
            >
              Prev
            </UButton>
            <UButton
              v-if="previousPost"
              :to="`/collections/${collectionId}/posts/${previousPost.postId}`"
              variant="outline"
              color="neutral"
              icon="lucide:arrow-left"
              size="lg"
              class="hidden sm:flex"
            >
              <div class="flex flex-col items-start">
                <span class="text-xs text-gray-500 dark:text-gray-400">Previous</span>
                <span class="font-medium truncate max-w-50">{{ previousPost.title }}</span>
              </div>
            </UButton>
            <div v-else class="flex-1" />

            <UButton
              v-if="nextPost"
              :to="`/collections/${collectionId}/posts/${nextPost.postId}`"
              variant="outline"
              color="neutral"
              trailing-icon="lucide:arrow-right"
              size="sm"
              class="flex-1 sm:hidden"
            >
              Next
            </UButton>
            <UButton
              v-if="nextPost"
              :to="`/collections/${collectionId}/posts/${nextPost.postId}`"
              variant="outline"
              color="neutral"
              trailing-icon="lucide:arrow-right"
              size="lg"
              class="hidden sm:flex"
            >
              <div class="flex flex-col items-end">
                <span class="text-xs text-gray-500 dark:text-gray-400">Next</span>
                <span class="font-medium truncate max-w-50">{{ nextPost.title }}</span>
              </div>
            </UButton>
          </div>
        </template>
      </UCard>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { MinimarkTree } from 'minimark';

const route = useRoute();
const collectionId = route.params.id as string;
const postId = route.params.postId as string;

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

// Sort posts by postId (numeric) - ascending order for chapters
const sortedPosts = computed(() => {
  if (!allPosts.value) return [];
  return [...allPosts.value].sort((a, b) => {
    return parseInt(a.postId) - parseInt(b.postId);
  });
});

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

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

useSeoMeta({
  title: post.value!.title,
  description: `Read "${post.value!.title}" from the "${post.value!.collectionName}" collection.`,
  ogTitle: post.value!.title,
  ogDescription: `Read "${post.value!.title}" from the "${post.value!.collectionName}" collection.`,
  ogType: 'article',
})
</script>
