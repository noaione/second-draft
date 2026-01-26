import { isAuthenticated } from '../utils/auth';

/**
 * Global authentication middleware
 * Protects all routes except /login and API routes
 */
export default defineEventHandler(async (event) => {
  const path = event.path;

  // Skip authentication for these paths
  const publicPaths = [
    '/login',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/check',
  ];

  // Skip authentication for public assets
  if (path.startsWith('/_nuxt/') || publicPaths.includes(path)) {
    return;
  }
  if (path.startsWith('/assets/') || path.startsWith('/_fonts/') || path.startsWith('/favicon') || path.startsWith('/site.webmanifest') || path.startsWith('/robots.txt') || path.startsWith('/__nuxt_content/')) {
    return;
  }

  if (path.startsWith('/api/')) {
    // For API routes, return 401 if not authenticated
    const authenticated = await isAuthenticated(event);
    if (!authenticated) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized',
      });
    }
    return;
  }

  // Check if user is authenticated
  const authenticated = await isAuthenticated(event);
  if (!authenticated) {
    // Redirect to login page
    if (!path.startsWith('/login')) {
      return sendRedirect(event, '/login?redirect=' + encodeURIComponent(path));
    }
  }
});
