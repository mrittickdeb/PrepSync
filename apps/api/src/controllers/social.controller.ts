import { Request, Response } from 'express';
import { User, Post, Comment } from '../models';
import mongoose from 'mongoose';

export const createPost = async (req: Request, res: Response) => {
  try {
    const authorId = (req.user as any)?._id;
    const { content, attachments = [] } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Post content is required' });
    }

    const post = new Post({
      author: authorId,
      content,
      attachments,
    });

    await post.save();
    const populatedPost = await Post.findById(post._id).populate('author', 'name avatarUrl readinessIndex');

    return res.status(201).json(populatedPost);
  } catch (error: any) {
    console.error('Error creating post:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getFeed = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const currentUser = await User.findById(userId);

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get list of followed user IDs, including current user
    const authorIds = [...currentUser.following, currentUser._id];

    // Try finding posts from followed users + self
    let posts = await Post.find({ author: { $in: authorIds } })
      .sort({ createdAt: -1 })
      .populate('author', 'name avatarUrl readinessIndex')
      .limit(50);

    // Fallback to general public feed if followed users feed is empty
    if (posts.length === 0) {
      posts = await Post.find()
        .sort({ createdAt: -1 })
        .populate('author', 'name avatarUrl readinessIndex')
        .limit(50);
    }

    return res.status(200).json(posts);
  } catch (error: any) {
    console.error('Error fetching feed:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

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
      // Unlike
      post.likes.splice(likeIndex, 1);
    } else {
      // Like
      post.likes.push(userIdObj);
    }

    await post.save();
    return res.status(200).json({
      likes: post.likes,
      likesCount: post.likes.length,
      isLiked: ! (likeIndex > -1),
    });
  } catch (error: any) {
    console.error('Error toggling post like:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

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

    // Increment comment count on Post
    await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });

    const populatedComment = await Comment.findById(comment._id).populate('author', 'name avatarUrl readinessIndex');

    return res.status(201).json(populatedComment);
  } catch (error: any) {
    console.error('Error adding comment:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

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
      // Unfollow
      currentUser.following.splice(followingIndex, 1);
      
      const followerIndex = targetUser.followers.findIndex((id) => id.toString() === userId.toString());
      if (followerIndex > -1) {
        targetUser.followers.splice(followerIndex, 1);
      }
    } else {
      // Follow
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

export const getFollowSuggestions = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const currentUser = await User.findById(userId);

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Exclude self and already followed users
    const excludedIds = [...currentUser.following, currentUser._id];

    const suggestions = await User.find({ _id: { $nin: excludedIds } })
      .sort({ 'readinessIndex.overall': -1 })
      .select('name avatarUrl readinessIndex followers')
      .limit(5);

    return res.status(200).json(suggestions);
  } catch (error: any) {
    console.error('Error getting follow suggestions:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
