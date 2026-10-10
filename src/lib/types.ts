export type GenerationMode = 'text' | 'image' | 'audio';
export type Model = 'ltx-2-5-fast' | 'ltx-2-5-pro';
export type Resolution = '720p' | '1080p' | '1440p' | '4K';
export type AspectRatio = '16:9' | '9:16';
export type Fps = 24 | 25 | 48 | 50;
export interface GenerationSettings {
  model: Model;
  resolution: Resolution;
  aspectRatio: AspectRatio;
  fps: Fps;
  duration: number;
}
interface RequestBase { settings: GenerationSettings; prompt: string }
export interface TextGenerationRequest extends RequestBase { mode: 'text' }
export interface ImageGenerationRequest extends RequestBase {
  mode: 'image'; image: File; finalFrame?: File;
}
export interface AudioGenerationRequest extends RequestBase {
  mode: 'audio'; audio: File; audioDuration: number;
}
export type GenerationRequest = TextGenerationRequest | ImageGenerationRequest | AudioGenerationRequest;
export interface Mp4Output {
  url: string;
  filename: string;
  mimeType: 'video/mp4';
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  isMock?: boolean;
}
export interface JobSubmission { jobId: string; createdAt: string }
export interface JobStatusResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  output?: Mp4Output;
  error?: string;
}
export interface GenerationService {
  submit(request: GenerationRequest, signal?: AbortSignal): Promise<JobSubmission>;
  getStatus(jobId: string, signal?: AbortSignal): Promise<JobStatusResponse>;
}
