export default defineEventHandler(async (event) => {
  const collectionId = getRouterParam(event, 'id');

  if (!collectionId) {
    throw createError({
      statusCode: 400,
      message: 'Collection ID is required',
    });
  }

  try {
    // Query all posts in this collection using path pattern
    const posts = await queryCollection(event, 'content')
      .where('path', 'LIKE', `/${collectionId}/posts/%`)
      .select('path', 'title', 'postId' as any, 'publishedAt' as any, 'author' as any, 'collectionName' as any, 'collectionId' as any)
      .order('publishedAt' as any, 'DESC')
      .all();

    return posts.map((post) => ({
      id: post.postId,
      ...post,
    }))
  } catch (error: any) {
    // Return empty array if no posts found
    return [];
  }
});
