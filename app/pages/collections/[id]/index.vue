<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import { toRaw } from 'vue';
import type { TableColumn } from '@nuxt/ui';

const route = useRoute();
const collectionId = route.params.id as string;

interface PostMetadata {
  title: string;
  postId: string;
  publishedAt: string;
  author: string;
  collectionName: string;
  collectionId: string;
}

interface CollectionMetadata {
  id: string;
  name: string;
  campaignId: string;
  lastSync: string;
  postCount: number;
}

const NuxtLink = resolveComponent('NuxtLink')

const collection = ref<CollectionMetadata | null>(null);
const posts = ref<PostMetadata[]>([]);
const sortedPosts = ref<PostMetadata[]>([]);
const sortBy = ref<{ column: string; direction: 'asc' | 'desc' }>({
  column: 'postId',
  direction: 'asc'
});
const search = ref('');

onMounted(async () => {
  try {
    const [collectionData, postsData] = await Promise.all([
      $fetch<CollectionMetadata>(`/api/collections/${collectionId}`),
      $fetch<PostMetadata[]>(`/api/collections/${collectionId}/posts`),
    ]);
    
    collection.value = collectionData;
    posts.value = postsData;

    useSeoMeta({
      title: collectionData.name,
      description: `Read posts from the collection "${collectionData.name}" on #seconddraft.`,
      ogTitle: collectionData.name,
      ogDescription: `Read posts from the collection "${collectionData.name}" on #seconddraft.`,
      ogType: 'website',
    });
  } catch (error) {
    console.error('Error loading collection:', error);
  }
});

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const columns: TableColumn<PostMetadata>[] = [
  {
    accessorKey: 'title',
    header: 'title',
    cell: ({ row }) => {
      // Link to post
      const postId = row.original.postId;
      const url = `/collections/${collectionId}/posts/${postId}`;
      return h(
        NuxtLink,
        {
          to: url,
          class: 'text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-200 font-medium',
        },
        row.getValue('title')
      );
    }
  },
  {
    accessorKey: 'publishedAt',
    header: 'published',
    cell: ({ row }) => {
      return new Date(row.getValue('publishedAt')).toLocaleString('en-US', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    }
  },
  {
    accessorKey: 'actions',
    header: '',
    cell: ({ row }) => {
      // Link to post
      const postId = row.original.postId;
      const url = `/collections/${collectionId}/posts/${postId}`;
      return h(
        NuxtLink,
        {
          to: url,
          class: 'text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-200 font-medium'
        },
        'read'
      );
    }
  }
];

function onSort(column: { key: string; direction?: 'asc' | 'desc' }) {
  if (sortBy.value.column === column.key) {
    sortBy.value.direction = sortBy.value.direction === 'asc' ? 'desc' : 'asc';
  } else {
    sortBy.value.column = column.key;
    sortBy.value.direction = column.direction || 'asc';
  }
}

watch(search, () => {
  // Reset sorting when search changes
  sortBy.value = { column: 'postId', direction: 'asc' };
});

watch(posts, () => {
  // Reset sorting when posts change
  sortBy.value = { column: 'postId', direction: 'asc' };
});

// Set sorted posts when posts updated
watch([posts, search], ([newPosts, searchData]) => {
  let filtered = toRaw(newPosts);
  
  // Filter by search
  if (searchData.trim().length > 0) {
    const searchLower = searchData.toLowerCase();
    filtered = filtered.filter(post => 
      post.title.toLowerCase().includes(searchLower) ||
      post.postId.includes(searchLower)
    );
  }

  // Sort
  const sortedData = [...filtered].sort((a, b) => {
    let aVal: any;
    let bVal: any;
    
    if (sortBy.value.column === 'postId') {
      aVal = parseInt(a.postId);
      bVal = parseInt(b.postId);
    } else if (sortBy.value.column === 'publishedAt') {
      aVal = new Date(a.publishedAt).getTime();
      bVal = new Date(b.publishedAt).getTime();
    } else {
      aVal = (a as any)[sortBy.value.column];
      bVal = (b as any)[sortBy.value.column];
    }
    
    if (sortBy.value.direction === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });
  sortedPosts.value = sortedData;
})
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-black">
    <!-- Top Navigation -->
    <header class="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center gap-4">
            <UButton
              to="/"
              variant="ghost"
              color="neutral"
              icon="lucide:arrow-left"
              size="sm"
            >
              Home
            </UButton>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div class="space-y-6">
        <!-- Collection Header -->
        <div v-if="collection" class="space-y-2">
          <h1 class="text-4xl font-bold text-gray-900 dark:text-white">
            {{ collection.name }}
          </h1>
          <div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div class="flex items-center gap-2">
              <UIcon name="lucide:file" />
              <span>{{ collection.postCount }} chapters</span>
            </div>
            <div class="flex items-center gap-2">
              <UIcon name="lucide:refresh-ccw" />
              <span>last synced {{ formatDate(collection.lastSync) }}</span>
            </div>
          </div>
        </div>

        <UCard v-if="sortedPosts.length === 0" class="shadow-lg">
          <div class="text-center py-12">
            <UIcon name="lucide:file" class="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              no chapters found
            </h3>
            <p class="text-gray-600 dark:text-gray-400">
              This collection doesn't have any posts yet.
            </p>
          </div>
        </UCard>
        <UCard v-else class="shadow-lg">
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
                chapters
              </h2>
              <UInput
                v-model="search"
                placeholder="search chapters..."
                icon="lucide:search"
                size="sm"
                class="w-64"
              />
            </div>
          </template>

          <UTable
            :data="sortedPosts"
            :columns="columns"
            :sort="sortBy"
            @update:sort="onSort"
          />
        </UCard>
      </div>
    </main>
  </div>
</template>

