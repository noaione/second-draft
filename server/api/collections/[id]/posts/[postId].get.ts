export default defineEventHandler(async (event) => {
  const collectionId = getRouterParam(event, 'id');
  const postId = getRouterParam(event, 'postId');

  if (!collectionId) {
    throw createError({
      statusCode: 400,
      message: 'Collection ID is required',
    });
  }
  if (!postId) {
    throw createError({
      statusCode: 400,
      message: 'Post ID is required',
    });
  }

  try {
    // Query all posts in this collection using path pattern
    const singlePost = await queryCollection(event, 'content')
      .where('collectionId', '=', collectionId)
      .where('postId', '=', postId)
      .first();

    if (!singlePost) {
      throw createError({
        statusCode: 404,
        message: 'Post not found',
      });
    }

    return {
      ...singlePost,
    };
  } catch (error: any) {
    // Return empty array if no posts found
    return [];
  }
});
