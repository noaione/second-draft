<script setup lang="ts">
enum ResultNew {
  None = 'none',
  Chapter = 'chapter',
  Series = 'series',
}

interface CollectionMetadata {
  id: string;
  name: string;
  campaignId: string;
  lastSync: string;
  postCount: number;
  author?: string;
  hasNew?: ResultNew;
}

interface ReadingState {
  id: string;
  cid: string;
}

interface CachedCounter {
  cid: string;
  count: number;
}

const cachedCounter = useLocalStorage<CachedCounter[]>('cached-counters', []);

// Get all collections
const firstLoad = ref(true);
const collections = ref<CollectionMetadata[]>([]);

const UNKNOWN_AUTHOR = 'Unknown author';

const displayAuthor = (author?: string) => {
  const value = author?.trim();
  if (!value || /^unknown (?:author|creator)$/i.test(value)) {
    return UNKNOWN_AUTHOR;
  }
  return value;
};

const collectionsByAuthor = computed(() => {
  const grouped = new Map<string, CollectionMetadata[]>();

  for (const collection of collections.value) {
    const author = displayAuthor(collection.author);
    const authorCollections = grouped.get(author);
    if (authorCollections) {
      authorCollections.push(collection);
    } else {
      grouped.set(author, [collection]);
    }
  }

  return Array.from(grouped, ([author, authorCollections]) => ({
    author,
    collections: authorCollections.sort((a, b) => a.name.localeCompare(b.name)),
  })).sort((a, b) => {
    if (a.author === UNKNOWN_AUTHOR && b.author === UNKNOWN_AUTHOR) return 0;
    if (a.author === UNKNOWN_AUTHOR) return 1;
    if (b.author === UNKNOWN_AUTHOR) return -1;
    return a.author.localeCompare(b.author);
  });
});

onMounted(async () => {
  try {
    const response = await $fetch<CollectionMetadata[]>('/api/collections');
    // Set hasNew
    for (const collection of response) {
      collection.hasNew = hasNewChapters(collection);
    }

    collections.value = response;
    // Set cached counters
    const mergedCounters = [];
    for (const collection of collections.value) {
      mergedCounters.push({ cid: collection.id, count: collection.postCount });
    }

    cachedCounter.value = mergedCounters;
  } catch (error) {
    console.error('Error loading collections:', error);
  } finally {
    firstLoad.value = false;
  }
});

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const hasNewChapters = (collection: CollectionMetadata): ResultNew => {
  const countRead = cachedCounter.value.find(c => c.cid === collection.id)?.count;
  if (!countRead) return ResultNew.Series; // new series!
  return collection.postCount > countRead ? ResultNew.Chapter : ResultNew.None;
}

const logout = async () => {
  await $fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
};
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-black">
    <!-- Top Navigation -->
    <header class="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <h1 class="text-xl font-bold text-gray-900 dark:text-white">
            #seconddraft
          </h1>
          <UButton
            variant="ghost"
            color="neutral"
            icon="lucide:log-out"
            @click="logout"
          >
            exit
          </UButton>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div class="space-y-8">
        <!-- Header -->
        <div class="space-y-2">
          <h2 class="text-4xl font-bold text-gray-900 dark:text-white">
            #drafts
          </h2>
          <p class="text-gray-600 dark:text-gray-400">
            browse and manage your #drafts collections
          </p>
        </div>

        <!-- Loading State -->
        <div v-if="firstLoad" class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 items-start">
          <UCard v-for="n in 6" :key="n">
            <template #header>
              <div class="flex items-start justify-between">
                <USkeleton class="h-6 w-2/3" />
                <USkeleton class="h-5 w-5 rounded-full" />
              </div>
            </template>

            <div class="space-y-3">
              <USkeleton class="h-4 w-1/2" />
              <USkeleton class="h-4 w-1/3" />
              <USkeleton class="h-4 w-2/3" />
            </div>

            <template #footer>
              <USkeleton class="h-8 w-full" />
            </template>
          </UCard>
        </div>

        <!-- Empty State -->
        <UCard v-else-if="collections.length === 0" class="shadow-lg">
          <div class="text-center py-12">
            <UIcon name="lucide:folder-open" class="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              no collections found
            </h3>
            <p class="text-gray-600 dark:text-gray-400 mb-6">
              run the CLI tool to create and sync collections
            </p>
          </div>
        </UCard>

        <!-- Collections grouped by author -->
        <div v-else class="space-y-10">
          <UCollapsible
            v-for="group in collectionsByAuthor"
            :key="group.author"
            as="section"
            default-open
            :unmount-on-hide="false"
          >
            <template #default="{ open }">
              <button
                type="button"
                class="group flex w-full items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
              >
                <UIcon name="lucide:circle-user-round" class="size-6 text-gray-500 dark:text-gray-400" />
                <h3 class="text-2xl font-semibold text-gray-900 dark:text-white">
                  {{ group.author }}
                </h3>
                <UBadge color="neutral" variant="subtle">
                  {{ group.collections.length }}
                  {{ group.collections.length === 1 ? 'collection' : 'collections' }}
                </UBadge>
                <UIcon
                  name="lucide:chevron-down"
                  class="ml-auto size-5 text-gray-400 transition-transform duration-200 group-hover:text-gray-600 dark:group-hover:text-gray-300"
                  :class="{ '-rotate-90': !open }"
                />
              </button>
            </template>

            <template #content>
              <div class="grid grid-cols-1 gap-6 pt-4 sm:grid-cols-2 lg:grid-cols-3 items-start">
                <UCard
                  v-for="collection in group.collections"
                  :key="collection.id"
                  class="hover:shadow-xl transition-shadow cursor-pointer"
                  @click="navigateTo(`/collections/${collection.id}`)"
                >
                  <template #header>
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <h4 class="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                          {{ collection.name }}
                        </h4>
                      </div>
                      <UIcon name="lucide:chevron-right" class="w-5 h-5 text-gray-400" />
                    </div>
                  </template>

                  <div class="space-y-3">
                    <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <UIcon name="lucide:file" />
                      <span>{{ collection.postCount }} chapters</span>
                    </div>
                    <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <UIcon name="lucide:clock" />
                      <span>last synced {{ formatDate(collection.lastSync) }}</span>
                    </div>
                    <UBadge v-if="collection.hasNew && collection.hasNew !== ResultNew.None" :color="collection.hasNew === ResultNew.Series ? 'success' : 'info'" variant="subtle">
                      {{ collection.hasNew === ResultNew.Chapter ? 'new chapter' : 'new series' }}
                    </UBadge>
                  </div>

                  <template #footer>
                    <UButton
                      :to="`/collections/${collection.id}`"
                      block
                      color="neutral"
                      variant="ghost"
                      trailing-icon="lucide:arrow-right"
                    >
                      view collection
                    </UButton>
                  </template>
                </UCard>
              </div>
            </template>
          </UCollapsible>
        </div>
      </div>
    </main>
  </div>
</template>
