import { isAuthenticated } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  return {
    authenticated: await isAuthenticated(event),
  };
});
