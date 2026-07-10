import { Request, Response } from 'express';
import { Community, Post } from '../models';
import mongoose from 'mongoose';

export const createCommunity = async (req: Request, res: Response) => {
  try {
    const creatorId = (req.user as any)?._id;
    const { name, description } = req.body;

    if (!name || !description) {
      return res.status(400).json({ message: 'Name and description are required' });
    }

    const existing = await Community.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
    if (existing) {
      return res.status(400).json({ message: 'Community with this name already exists' });
    }

    const community = new Community({
      name: name.trim(),
      description: description.trim(),
      creator: creatorId,
      members: [creatorId],
    });

    await community.save();
    return res.status(201).json(community);
  } catch (error: any) {
    console.error('Error creating community:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const listCommunities = async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search as string, $options: 'i' } },
        { description: { $regex: search as string, $options: 'i' } },
      ];
    }

    const list = await Community.find(query)
      .sort({ createdAt: -1 })
      .populate('creator', 'name avatarUrl');

    return res.status(200).json(list);
  } catch (error: any) {
    console.error('Error listing communities:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getCommunityDetails = async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const community = await Community.findById(communityId)
      .populate('creator', 'name avatarUrl')
      .populate('members', 'name avatarUrl readinessIndex');

    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }

    return res.status(200).json(community);
  } catch (error: any) {
    console.error('Error fetching community details:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const toggleJoinCommunity = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { communityId } = req.params;

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }

    const userIdObj = new mongoose.Types.ObjectId(userId);
    const memberIndex = community.members.findIndex((id) => id.toString() === userId.toString());

    let isJoined = false;
    if (memberIndex > -1) {
      // Leave
      community.members.splice(memberIndex, 1);
    } else {
      // Join
      community.members.push(userIdObj);
      isJoined = true;
    }

    await community.save();
    return res.status(200).json({
      isJoined,
      members: community.members,
      membersCount: community.members.length,
    });
  } catch (error: any) {
    console.error('Error toggling join community:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getCommunityPosts = async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;

    const posts = await Post.find({ community: communityId })
      .sort({ createdAt: -1 })
      .populate('author', 'name avatarUrl readinessIndex');

    return res.status(200).json(posts);
  } catch (error: any) {
    console.error('Error fetching community posts:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const createCommunityPost = async (req: Request, res: Response) => {
  try {
    const authorId = (req.user as any)?._id;
    const { communityId } = req.params;
    const { content, attachments = [] } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }

    // Optional constraint: must be a member to post
    const isMember = community.members.some((id) => id.toString() === authorId.toString());
    if (!isMember) {
      return res.status(403).json({ message: 'You must join this community to post' });
    }

    const post = new Post({
      author: authorId,
      content,
      attachments,
      community: communityId,
    });

    await post.save();
    const populatedPost = await Post.findById(post._id).populate('author', 'name avatarUrl readinessIndex');

    return res.status(201).json(populatedPost);
  } catch (error: any) {
    console.error('Error creating community post:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
