import { Request, Response } from 'express';
import { Video, Comment, User } from '../models';
import mongoose from 'mongoose';

export const createVideo = async (req: Request, res: Response) => {
  try {
    const authorId = (req.user as any)?._id;
    const { title, description = '', url, thumbnailUrl = '', duration = '00:00', tags = [], category = 'General' } = req.body;

    if (!title || !url) {
      return res.status(400).json({ message: 'Title and video URL are required' });
    }

    const video = new Video({
      title,
      description,
      url,
      thumbnailUrl,
      duration,
      author: authorId,
      tags,
      category,
    });

    await video.save();
    const populatedVideo = await Video.findById(video._id).populate('author', 'name avatarUrl readinessIndex followers');

    return res.status(201).json(populatedVideo);
  } catch (error: any) {
    console.error('Error creating video:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const listVideos = async (req: Request, res: Response) => {
  try {
    const { search, tag, category, sort = 'latest' } = req.query;
    const query: any = {};

    if (search) {
      query.$or = [
        { title: { $regex: search as string, $options: 'i' } },
        { description: { $regex: search as string, $options: 'i' } },
      ];
    }

    if (tag && tag !== 'All') {
      query.tags = tag;
    }

    if (category && category !== 'All') {
      query.category = category;
    }

    let sortBy: any = { createdAt: -1 };
    if (sort === 'popular') sortBy = { views: -1 };
    if (sort === 'trending') sortBy = { likes: -1, views: -1 };

    const videos = await Video.find(query)
      .sort(sortBy)
      .populate('author', 'name avatarUrl readinessIndex followers');

    return res.status(200).json(videos);
  } catch (error: any) {
    console.error('Error listing videos:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getVideo = async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;

    const video = await Video.findByIdAndUpdate(
      videoId,
      { $inc: { views: 1 } },
      { new: true }
    ).populate('author', 'name avatarUrl readinessIndex followers');

    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    return res.status(200).json(video);
  } catch (error: any) {
    console.error('Error fetching video:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const toggleLikeVideo = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { videoId } = req.params;

    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    const userIdObj = new mongoose.Types.ObjectId(userId);
    const likeIndex = video.likes.findIndex((id) => id.toString() === userId.toString());

    if (likeIndex > -1) {
      video.likes.splice(likeIndex, 1);
    } else {
      video.likes.push(userIdObj);
      // Remove from dislikes if present
      const dislikeIdx = video.dislikes.findIndex((id) => id.toString() === userId.toString());
      if (dislikeIdx > -1) video.dislikes.splice(dislikeIdx, 1);
    }

    await video.save();
    return res.status(200).json({
      likes: video.likes,
      dislikes: video.dislikes,
      likesCount: video.likes.length,
      dislikesCount: video.dislikes.length,
      isLiked: !(likeIndex > -1),
    });
  } catch (error: any) {
    console.error('Error toggling video like:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const toggleDislikeVideo = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { videoId } = req.params;

    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    const userIdObj = new mongoose.Types.ObjectId(userId);
    const dislikeIdx = video.dislikes.findIndex((id) => id.toString() === userId.toString());

    if (dislikeIdx > -1) {
      video.dislikes.splice(dislikeIdx, 1);
    } else {
      video.dislikes.push(userIdObj);
      // Remove from likes if present
      const likeIdx = video.likes.findIndex((id) => id.toString() === userId.toString());
      if (likeIdx > -1) video.likes.splice(likeIdx, 1);
    }

    await video.save();
    return res.status(200).json({
      likes: video.likes,
      dislikes: video.dislikes,
      likesCount: video.likes.length,
      dislikesCount: video.dislikes.length,
      isDisliked: !(dislikeIdx > -1),
    });
  } catch (error: any) {
    console.error('Error toggling dislike:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getUserVideos = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const videos = await Video.find({ author: userId })
      .sort({ createdAt: -1 })
      .populate('author', 'name avatarUrl readinessIndex followers');

    return res.status(200).json(videos);
  } catch (error: any) {
    console.error('Error fetching user videos:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getRecommendedVideos = async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const video = await Video.findById(videoId);

    let recommendations;
    if (video && video.tags.length > 0) {
      // Find videos with similar tags, excluding the current one
      recommendations = await Video.find({
        _id: { $ne: videoId },
        tags: { $in: video.tags },
      })
        .sort({ views: -1 })
        .limit(8)
        .populate('author', 'name avatarUrl readinessIndex followers');
    }

    // If not enough recommendations, fill with popular videos
    if (!recommendations || recommendations.length < 4) {
      const excludeIds = [videoId, ...(recommendations || []).map((v) => v._id)];
      const filler = await Video.find({ _id: { $nin: excludeIds } })
        .sort({ views: -1 })
        .limit(8 - (recommendations?.length || 0))
        .populate('author', 'name avatarUrl readinessIndex followers');

      recommendations = [...(recommendations || []), ...filler];
    }

    return res.status(200).json(recommendations);
  } catch (error: any) {
    console.error('Error fetching recommendations:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const subscribeToChannel = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { channelUserId } = req.params;

    if (userId.toString() === channelUserId.toString()) {
      return res.status(400).json({ message: 'You cannot subscribe to yourself' });
    }

    const currentUser = await User.findById(userId);
    const channelUser = await User.findById(channelUserId);

    if (!currentUser || !channelUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetObjId = new mongoose.Types.ObjectId(channelUserId);
    const currentObjId = new mongoose.Types.ObjectId(userId);

    const followingIndex = currentUser.following.findIndex((id) => id.toString() === channelUserId.toString());

    let isSubscribed = false;
    if (followingIndex > -1) {
      currentUser.following.splice(followingIndex, 1);
      const fi = channelUser.followers.findIndex((id) => id.toString() === userId.toString());
      if (fi > -1) channelUser.followers.splice(fi, 1);
    } else {
      currentUser.following.push(targetObjId);
      channelUser.followers.push(currentObjId);
      isSubscribed = true;
    }

    await currentUser.save();
    await channelUser.save();

    return res.status(200).json({
      isSubscribed,
      subscriberCount: channelUser.followers.length,
    });
  } catch (error: any) {
    console.error('Error subscribing:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getVideoComments = async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;

    const comments = await Comment.find({ video: videoId })
      .sort({ createdAt: -1 })
      .populate('author', 'name avatarUrl readinessIndex');

    return res.status(200).json(comments);
  } catch (error: any) {
    console.error('Error fetching video comments:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const addVideoComment = async (req: Request, res: Response) => {
  try {
    const authorId = (req.user as any)?._id;
    const { videoId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    const comment = new Comment({
      video: videoId,
      author: authorId,
      content,
    });

    await comment.save();
    await Video.findByIdAndUpdate(videoId, { $inc: { commentsCount: 1 } });

    const populatedComment = await Comment.findById(comment._id).populate('author', 'name avatarUrl readinessIndex');

    return res.status(201).json(populatedComment);
  } catch (error: any) {
    console.error('Error adding video comment:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
