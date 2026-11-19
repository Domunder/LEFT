/**
 * The browser's camera: one `getUserMedia` stream in a hidden <video>, drawn
 * through the look on a canvas every frame.
 *
 * Asks for the largest 4:3 picture the phone will give (up to the app's
 * 3024x4032); what a browser hands a web page is usually smaller than what the
 * app gets, and the print is never upscaled.
 */

export type Facing = 'environment' | 'user';

export type CameraFailure = 'unsupported' | 'insecure' | 'denied' | 'unavailable';

export class CameraError extends Error {
  constructor(readonly kind: CameraFailure) {
    super(kind);
    this.name = 'CameraError';
  }
}

export class BrowserCamera {
  readonly video: HTMLVideoElement;
  private stream: MediaStream | null = null;
  facing: Facing = 'environment';

  constructor() {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    this.video = video;
  }

  get ready(): boolean {
    return this.video.readyState >= 2 && this.video.videoWidth > 0;
  }

  get width() {
    return this.video.videoWidth;
  }

  get height() {
    return this.video.videoHeight;
  }

  async start(facing: Facing = this.facing): Promise<void> {
    if (!window.isSecureContext) throw new CameraError('insecure');
    if (!navigator.mediaDevices?.getUserMedia) throw new CameraError('unsupported');

    this.stop();
    this.facing = facing;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false, // Photos only — never the microphone.
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 4032 },
          height: { ideal: 3024 },
          aspectRatio: { ideal: 4 / 3 },
        },
      });
    } catch (e) {
      const name = (e as { name?: string }).name;
      if (name === 'NotAllowedError' || name === 'SecurityError') throw new CameraError('denied');
      throw new CameraError('unavailable');
    }

    this.video.srcObject = this.stream;
    await this.video.play().catch(() => undefined);
    if (!this.ready) {
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        this.video.addEventListener('loadeddata', done, { once: true });
        setTimeout(done, 3000);
      });
    }
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }

  get running() {
    return this.stream !== null;
  }

  private get track(): MediaStreamTrack | null {
    return this.stream?.getVideoTracks()[0] ?? null;
  }

  /** True when the LED can be lit from a web page (Chrome on Android, mostly). */
  get hasTorch(): boolean {
    const caps = this.track?.getCapabilities?.() as { torch?: boolean } | undefined;
    return Boolean(caps?.torch);
  }

  async torch(on: boolean): Promise<boolean> {
    const track = this.track;
    if (!track || !this.hasTorch) return false;
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      return true;
    } catch {
      return false;
    }
  }

  /** Whether the phone has a second camera to flip to. */
  async canFlip(): Promise<boolean> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === 'videoinput').length > 1;
    } catch {
      return false;
    }
  }
}
