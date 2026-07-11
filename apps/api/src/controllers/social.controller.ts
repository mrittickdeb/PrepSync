import { Request, Response } from 'express';
import { User, Post, Comment } from '../models';
import mongoose from 'mongoose';

// ─── Create Post (supports text, media, poll) ───
export const createPost = async (req: Request, res: Response) => {
  try {
    const authorId = (req.user as any)?._id;
    const { content, attachments = [], postType = 'text', poll } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Post content is required' });
    }

    const postData: any = {
      author: authorId,
      content,
      attachments,
      postType,
    };

    // Determine postType from content
    if (poll && poll.options && poll.options.length >= 2) {
      postData.postType = 'poll';
      postData.poll = {
        options: poll.options.map((opt: string) => ({ text: opt, votes: [] })),
        expiresAt: poll.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000), // Default 24h
      };
    } else if (attachments.length > 0) {
      postData.postType = 'media';
    }

    const post = new Post(postData);
    await post.save();
    const populatedPost = await Post.findById(post._id).populate('author', 'name avatarUrl readinessIndex followers following');

    return res.status(201).json(populatedPost);
  } catch (error: any) {
    console.error('Error creating post:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Get Feed (For You / Following) ───
export const getFeed = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { tab = 'foryou' } = req.query;
    const currentUser = await User.findById(userId);

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    let posts;

    if (tab === 'following') {
      // Following tab: only posts from followed users + self, no community posts
      const authorIds = [...currentUser.following, currentUser._id];
      posts = await Post.find({ author: { $in: authorIds }, community: { $exists: false } })
        .sort({ createdAt: -1 })
        .populate('author', 'name avatarUrl readinessIndex followers following')
        .limit(50);
    } else {
      // For You tab: all public posts (no community posts), sorted by engagement
      posts = await Post.find({ community: { $exists: false } })
        .sort({ createdAt: -1 })
        .populate('author', 'name avatarUrl readinessIndex followers following')
        .limit(50);
    }

    // Increment impressions for returned posts
    const postIds = posts.map((p) => p._id);
    await Post.updateMany({ _id: { $in: postIds } }, { $inc: { impressions: 1 } });

    return res.status(200).json(posts);
  } catch (error: any) {
    console.error('Error fetching feed:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Toggle Like ───
export const toggleLikePost = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const userIdObj = new mongoose.Types.ObjectId(userId);
    const likeIndex = post.likes.findIndex((id) => id.toString() === userId.toString());

    if (likeIndex > -1) {
      post.likes.splice(likeIndex, 1);
    } else {
      post.likes.push(userIdObj);
    }

    await post.save();
    return res.status(200).json({
      likes: post.likes,
      likesCount: post.likes.length,
      isLiked: !(likeIndex > -1),
    });
  } catch (error: any) {
    console.error('Error toggling post like:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Toggle Bookmark ───
export const toggleBookmark = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const userIdObj = new mongoose.Types.ObjectId(userId);
    const bmIndex = post.bookmarks.findIndex((id) => id.toString() === userId.toString());

    if (bmIndex > -1) {
      post.bookmarks.splice(bmIndex, 1);
    } else {
      post.bookmarks.push(userIdObj);
    }

    await post.save();
    return res.status(200).json({
      bookmarks: post.bookmarks,
      isBookmarked: !(bmIndex > -1),
    });
  } catch (error: any) {
    console.error('Error toggling bookmark:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Get Bookmarked Posts ───
export const getBookmarkedPosts = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;

    const posts = await Post.find({ bookmarks: userId })
      .sort({ createdAt: -1 })
      .populate('author', 'name avatarUrl readinessIndex followers following');

    return res.status(200).json(posts);
  } catch (error: any) {
    console.error('Error fetching bookmarks:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Toggle Repost ───
export const toggleRepost = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const userIdObj = new mongoose.Types.ObjectId(userId);
    const repostIndex = post.reposts.findIndex((id) => id.toString() === userId.toString());

    if (repostIndex > -1) {
      post.reposts.splice(repostIndex, 1);
    } else {
      post.reposts.push(userIdObj);
    }

    await post.save();
    return res.status(200).json({
      reposts: post.reposts,
      repostsCount: post.reposts.length,
      isReposted: !(repostIndex > -1),
    });
  } catch (error: any) {
    console.error('Error toggling repost:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Delete Post ───
export const deletePost = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.author.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'You can only delete your own posts' });
    }

    // Delete post and associated comments
    await Comment.deleteMany({ post: postId });
    await Post.findByIdAndDelete(postId);

    return res.status(200).json({ message: 'Post deleted' });
  } catch (error: any) {
    console.error('Error deleting post:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Get User Posts (profile view) ───
export const getUserPosts = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const posts = await Post.find({ author: userId, community: { $exists: false } })
      .sort({ isPinned: -1, createdAt: -1 })
      .populate('author', 'name avatarUrl readinessIndex followers following');

    return res.status(200).json(posts);
  } catch (error: any) {
    console.error('Error fetching user posts:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Vote on Poll ───
export const votePoll = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { postId } = req.params;
    const { optionIndex } = req.body;

    const post = await Post.findById(postId);
    if (!post || !post.poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    if (post.poll.expiresAt && new Date() > post.poll.expiresAt) {
      return res.status(400).json({ message: 'This poll has expired' });
    }

    if (optionIndex < 0 || optionIndex >= post.poll.options.length) {
      return res.status(400).json({ message: 'Invalid poll option' });
    }

    // Check if user already voted on any option
    const alreadyVoted = post.poll.options.some((opt) =>
      opt.votes.some((v) => v.toString() === userId.toString())
    );

    if (alreadyVoted) {
      return res.status(400).json({ message: 'You have already voted on this poll' });
    }

    const userIdObj = new mongoose.Types.ObjectId(userId);
    post.poll.options[optionIndex].votes.push(userIdObj);
    post.markModified('poll');
    await post.save();

    return res.status(200).json({ poll: post.poll });
  } catch (error: any) {
    console.error('Error voting on poll:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Trending Hashtags ───
export const getTrendingHashtags = async (_req: Request, res: Response) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const trending = await Post.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo }, hashtags: { $exists: true, $ne: [] } } },
      { $unwind: '$hashtags' },
      { $group: { _id: '$hashtags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    return res.status(200).json(trending);
  } catch (error: any) {
    console.error('Error fetching trending hashtags:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Posts by Hashtag ───
export const getPostsByHashtag = async (req: Request, res: Response) => {
  try {
    const { tag } = req.params;

    const posts = await Post.find({ hashtags: tag.toLowerCase() })
      .sort({ createdAt: -1 })
      .populate('author', 'name avatarUrl readinessIndex followers following')
      .limit(50);

    return res.status(200).json(posts);
  } catch (error: any) {
    console.error('Error fetching posts by hashtag:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Comments ───
export const getComments = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;

    const comments = await Comment.find({ post: postId })
      .sort({ createdAt: 1 })
      .populate('author', 'name avatarUrl readinessIndex');

    return res.status(200).json(comments);
  } catch (error: any) {
    console.error('Error fetching comments:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const addComment = async (req: Request, res: Response) => {
  try {
    const authorId = (req.user as any)?._id;
    const { postId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    const comment = new Comment({
      post: postId,
      author: authorId,
      content,
    });

    await comment.save();
    await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });

    const populatedComment = await Comment.findById(comment._id).populate('author', 'name avatarUrl readinessIndex');

    return res.status(201).json(populatedComment);
  } catch (error: any) {
    console.error('Error adding comment:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Follow / Unfollow ───
export const toggleFollow = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { targetUserId } = req.body;

    if (userId.toString() === targetUserId.toString()) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    const currentUser = await User.findById(userId);
    const targetUser = await User.findById(targetUserId);

    if (!currentUser || !targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetUserObjId = new mongoose.Types.ObjectId(targetUserId);
    const currentUserObjId = new mongoose.Types.ObjectId(userId);

    const followingIndex = currentUser.following.findIndex((id) => id.toString() === targetUserId.toString());

    let isFollowing = false;

    if (followingIndex > -1) {
      currentUser.following.splice(followingIndex, 1);
      const followerIndex = targetUser.followers.findIndex((id) => id.toString() === userId.toString());
      if (followerIndex > -1) {
        targetUser.followers.splice(followerIndex, 1);
      }
    } else {
      currentUser.following.push(targetUserObjId);
      targetUser.followers.push(currentUserObjId);
      isFollowing = true;
    }

    await currentUser.save();
    await targetUser.save();

    return res.status(200).json({
      isFollowing,
      followingCount: currentUser.following.length,
      followersCount: targetUser.followers.length,
    });
  } catch (error: any) {
    console.error('Error toggling follow:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Follow Suggestions ───
export const getFollowSuggestions = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const currentUser = await User.findById(userId);

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const excludedIds = [...currentUser.following, currentUser._id];

    const suggestions = await User.find({ _id: { $nin: excludedIds } })
      .sort({ 'readinessIndex.overall': -1 })
      .select('name avatarUrl readinessIndex followers following')
      .limit(5);

    return res.status(200).json(suggestions);
  } catch (error: any) {
    console.error('Error getting follow suggestions:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
