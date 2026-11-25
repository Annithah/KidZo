import type { VideoSource } from 'expo-video';

export const dailyRoutineVideos: Partial<Record<string, VideoSource>> = {
  'routine-video': require('../../assets/videos/routine.mp4'),
  'schedule-video': require('../../assets/videos/visual-schedule.mp4'),
  'communication-video': require('../../assets/videos/communication.mp4'),
  'screen-video': require('../../assets/videos/screen-balance.mp4'),
};
