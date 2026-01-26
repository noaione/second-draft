<script setup lang="ts">
const password = ref('');
const error = ref('');
const loading = ref(false);
const route = useRoute();
const router = useRouter();

const login = async () => {
  error.value = '';
  loading.value = true;

  try {
    const response = await $fetch<{ success: boolean; message: string }>('/api/auth/login', {
      method: 'POST',
      body: { password: password.value },
    });

    if (response.success) {
      // Redirect to the original page or home
      const redirect = (route.query.redirect as string) || '/';
      await router.push(redirect);
    }
  } catch (e: any) {
    error.value = e.data?.message || 'Invalid password';
  } finally {
    loading.value = false;
  }
};

const handleSubmit = () => {
  if (password.value) {
    login();
  }
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
    <div class="max-w-md w-full space-y-8">
      <div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white"> protected content </h2>
        <p class="mt-2 text-center text-sm text-gray-600 dark:text-gray-400"> please enter the password to continue </p>
      </div>
      <form class="mt-8 space-y-6" @submit.prevent="handleSubmit">
        <div>
          <label for="password" class="sr-only">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
            placeholder="Password"
            :disabled="loading" />
        </div>
        <div v-if="error" class="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
          <p class="text-sm text-red-800 dark:text-red-400"> {{ error }} </p>
        </div>
        <div>
          <button
            type="submit"
            :disabled="loading || !password"
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="loading">Authenticating...</span>
            <span v-else>Sign in</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
