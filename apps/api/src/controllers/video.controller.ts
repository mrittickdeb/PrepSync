import { Request, Response } from 'express';
import { Video, Comment } from '../models';
import mongoose from 'mongoose';

export const createVideo = async (req: Request, res: Response) => {
  try {
    const authorId = (req.user as any)?._id;
    const { title, description = '', url, thumbnailUrl = '', duration = '00:00', tags = [] } = req.body;

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
    });

    await video.save();
    const populatedVideo = await Video.findById(video._id).populate('author', 'name avatarUrl readinessIndex');

    return res.status(201).json(populatedVideo);
  } catch (error: any) {
    console.error('Error creating video:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const listVideos = async (req: Request, res: Response) => {
  try {
    const { search, tag } = req.query;
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

    const videos = await Video.find(query)
      .sort({ createdAt: -1 })
      .populate('author', 'name avatarUrl readinessIndex');

    return res.status(200).json(videos);
  } catch (error: any) {
    console.error('Error listing videos:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getVideo = async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;

    // Increment views
    const video = await Video.findByIdAndUpdate(
      videoId,
      { $inc: { views: 1 } },
      { new: true }
    ).populate('author', 'name avatarUrl readinessIndex');

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
      // Unlike
      video.likes.splice(likeIndex, 1);
    } else {
      // Like
      video.likes.push(userIdObj);
    }

    await video.save();
    return res.status(200).json({
      likes: video.likes,
      likesCount: video.likes.length,
      isLiked: !(likeIndex > -1),
    });
  } catch (error: any) {
    console.error('Error toggling video like:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getVideoComments = async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;

    const comments = await Comment.find({ video: videoId })
      .sort({ createdAt: 1 })
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

    // Increment comment count on Video
    await Video.findByIdAndUpdate(videoId, { $inc: { commentsCount: 1 } });

    const populatedComment = await Comment.findById(comment._id).populate('author', 'name avatarUrl readinessIndex');

    return res.status(201).json(populatedComment);
  } catch (error: any) {
    console.error('Error adding video comment:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
