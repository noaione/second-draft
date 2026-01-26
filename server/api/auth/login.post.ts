import { verifyPassword, setAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { password } = body;

  if (!password) {
    throw createError({
      statusCode: 400,
      message: 'Password is required',
    });
  }

  const isValid = await verifyPassword(event, password);

  if (!isValid) {
    throw createError({
      statusCode: 401,
      message: 'Invalid password',
    });
  }

  // Set authentication session
  await setAuthSession(event);

  return {
    success: true,
    message: 'Authenticated successfully',
  };
});
