<script setup lang="ts">
interface CollectionMetadata {
  id: string;
  name: string;
  campaignId: string;
  lastSync: string;
  postCount: number;
}

// Get all collections
const firstLoad = ref(true);
const collections = ref<CollectionMetadata[]>([]);

onMounted(async () => {
  try {
    const response = await $fetch<CollectionMetadata[]>('/api/collections');
    collections.value = response;
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

        <!-- Empty State -->
        <UCard v-if="!firstLoad && collections.length === 0" class="shadow-lg">
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

        <!-- Collections Grid -->
        <div v-else class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <UCard
            v-for="collection in collections"
            :key="collection.id"
            class="hover:shadow-xl transition-shadow cursor-pointer"
            @click="navigateTo(`/collections/${collection.id}`)"
          >
            <template #header>
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                    {{ collection.name }}
                  </h3>
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
      </div>
    </main>
  </div>
</template>
