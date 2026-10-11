import type { JobStatusResponse, Mp4Output } from '../lib/types';
import type { Phase } from './moments';
import type { JourneyQuality } from './quality';

export type JourneyLength = 'snapshot' | 'film';
export interface TimelineRequest {
  place?: string;
  view?: string;
  image?: File;
  moment: string;
  length: JourneyLength;
  quality?: JourneyQuality;
}
export interface TimelineShot {
  phase: Phase;
  status: JobStatusResponse['status'];
  progress?: number;
  output?: Mp4Output;
  thumbnail?: string;
}
export interface TimelineJob extends JobStatusResponse {
  shots: TimelineShot[];
  beforeImageUrl?: string;
  finalFrameUrl?: string;
}
export interface JourneyTicket {
  jobId: string;
  provider: 'mock' | 'http';
  place?: string;
  view?: string;
  placeName: string;
  moment: string;
  length: JourneyLength;
  quality?: JourneyQuality;
}
export interface WallEntry {
  id: string;
  place: string;
  moment: string;
  thumbnail?: string;
  url: string;
  isMock?: boolean;
}
export interface TimelineService {
  submit(request: TimelineRequest, signal?: AbortSignal): Promise<{ jobId: string }>;
  getStatus(jobId: string, signal?: AbortSignal): Promise<TimelineJob>;
  getWall(signal?: AbortSignal): Promise<WallEntry[]>;
}
