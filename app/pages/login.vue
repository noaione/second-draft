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
  <div class="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 px-4">
    <div class="max-w-md w-full space-y-2">
      <div>
        <h2 class="text-center text-3xl font-bold text-zinc-900 dark:text-white"> protected content </h2>
        <p class="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400"> please enter the password to continue </p>
      </div>
      <form class="mt-8 space-y-6" @submit.prevent="handleSubmit">
        <div>
          <label for="password" class="sr-only">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-zinc-900 dark:text-white bg-white dark:bg-zinc-800 focus:outline-none focus:ring-rose-500 focus:border-rose-500 focus:z-10 sm:text-sm"
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
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="loading">Authenticating...</span>
            <span v-else>Sign in</span>
          </button>
        </div>
      </form>

      <div class="mt-8 text-center font-medium">
        <p>
          powered by 
          <a href="https://github.com/noaione/second-draft" target="_blank" rel="noopener noreferer" class="hover:underline decoration-dashed font-bold">#seconddraft</a>
        </p>
      </div>
    </div>
  </div>
</template>
