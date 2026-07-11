import { Request, Response } from 'express';
import { LiveStream } from '../models';

export const goLive = async (req: Request, res: Response) => {
  try {
    const hostId = (req.user as any)?._id;
    const { title, description = '', category = 'General' } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    // Check if user already has an active stream
    const existingStream = await LiveStream.findOne({ host: hostId, status: 'live' });
    if (existingStream) {
      return res.status(400).json({ message: 'You already have an active stream. End it before starting a new one.' });
    }

    // Generate unique room name from host ID + timestamp
    const roomName = `stream-${hostId}-${Date.now()}`;

    const stream = new LiveStream({
      title,
      description,
      host: hostId,
      roomName,
      category,
    });

    await stream.save();
    const populated = await LiveStream.findById(stream._id).populate('host', 'name avatarUrl readinessIndex');

    return res.status(201).json(populated);
  } catch (error: any) {
    console.error('Error going live:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const listActiveStreams = async (req: Request, res: Response) => {
  try {
    const { search, category } = req.query;
    const query: any = { status: 'live' };

    if (search) {
      query.$or = [
        { title: { $regex: search as string, $options: 'i' } },
        { description: { $regex: search as string, $options: 'i' } },
      ];
    }

    if (category && category !== 'All') {
      query.category = category;
    }

    const streams = await LiveStream.find(query)
      .sort({ createdAt: -1 })
      .populate('host', 'name avatarUrl readinessIndex');

    return res.status(200).json(streams);
  } catch (error: any) {
    console.error('Error listing streams:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getStream = async (req: Request, res: Response) => {
  try {
    const { streamId } = req.params;

    const stream = await LiveStream.findByIdAndUpdate(
      streamId,
      { $inc: { viewers: 1 } },
      { new: true }
    ).populate('host', 'name avatarUrl readinessIndex');

    if (!stream) {
      return res.status(404).json({ message: 'Stream not found' });
    }

    return res.status(200).json(stream);
  } catch (error: any) {
    console.error('Error fetching stream:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const endStream = async (req: Request, res: Response) => {
  try {
    const hostId = (req.user as any)?._id;
    const { streamId } = req.params;

    const stream = await LiveStream.findById(streamId);
    if (!stream) {
      return res.status(404).json({ message: 'Stream not found' });
    }

    if (stream.host.toString() !== hostId.toString()) {
      return res.status(403).json({ message: 'Only the host can end this stream' });
    }

    stream.status = 'ended';
    await stream.save();

    return res.status(200).json({ message: 'Stream ended', stream });
  } catch (error: any) {
    console.error('Error ending stream:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
