import api from './api';

export interface RoomParticipant {
  displayName: string;
  role: 'interviewer' | 'candidate';
  isGuest: boolean;
}

export interface CreateRoomResponse {
  roomId: string;
  inviteCode: string;
  link: string;
}

export interface RoomDetails {
  roomId: string;
  inviteCode: string;
  status: 'waiting' | 'active' | 'ended';
  participants: RoomParticipant[];
  code?: string;
  codeLanguage?: string;
  whiteboardState?: string;
  createdAt: string;
}

export interface JoinRoomResponse {
  roomId: string;
  inviteCode: string;
  status: 'waiting' | 'active' | 'ended';
  participants: RoomParticipant[];
  message?: string;
}

export async function createRoom(): Promise<CreateRoomResponse> {
  const { data } = await api.post('/rooms');
  return data;
}

export async function getRoomByCode(inviteCode: string): Promise<RoomDetails> {
  const { data } = await api.get(`/rooms/${inviteCode}`);
  return data;
}

export async function joinRoom(
  roomId: string,
  displayName?: string,
): Promise<JoinRoomResponse> {
  const { data } = await api.post(`/rooms/${roomId}/join`, { displayName });
  return data;
}

export async function endRoom(roomId: string): Promise<{ roomId: string; status: string; endedAt: string }> {
  const { data } = await api.patch(`/rooms/${roomId}/end`);
  return data;
}

export async function switchRole(roomId: string): Promise<{ roomId: string; participants: RoomParticipant[] }> {
  const { data } = await api.patch(`/rooms/${roomId}/role`);
  return data;
}
