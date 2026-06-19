/*
  Microphone capture for speech-to-text.

  We record with MediaRecorder and hand the backend Opus audio in a WebM/Ogg
  container — the encodings Google STT accepts — keeping the bitrate low so a
  spoken query stays a small upload. The chosen container is reported to the
  backend so it can match the audio encoding (see myui-backend/src/voice.ts).
*/

// Opus-in-WebM/Ogg, best first. Safari (mp4/AAC) supports none of these, so
// voiceInputSupported() returns false there and the UI degrades gracefully.
const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
];

/** Lower bitrate keeps clips small (Google STT handles speech fine at 32 kbps). */
const AUDIO_BITS_PER_SECOND = 32000;

/** The first supported recording container, or null if none are. */
export function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const type of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

/** True when this browser can record audio we can transcribe. */
export function voiceInputSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    pickMimeType() !== null
  );
}

/** Read a Blob as raw base64 (no `data:` prefix). */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the recording.'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

export interface Recording {
  base64: string;
  mimeType: string;
}

/** Distinguishes "browser can't record" from "user blocked the mic". */
export class UnsupportedRecordingError extends Error {}

/**
 * One microphone recording session. `start()` requests permission and begins
 * capturing; `stop()` resolves the audio as base64; `cancel()` aborts cleanly.
 */
export class VoiceRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private mimeType = '';

  /** Begin capturing. Throws UnsupportedRecordingError if unsupported, or the
   *  underlying DOMException (e.g. NotAllowedError) if permission is denied. */
  async start(): Promise<void> {
    const mimeType = pickMimeType();
    if (!mimeType) throw new UnsupportedRecordingError('Voice recording is not supported.');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mimeType = mimeType;
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream, {
      mimeType,
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    });
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start();
  }

  get recording(): boolean {
    return this.recorder !== null && this.recorder.state !== 'inactive';
  }

  /** Stop and resolve the captured audio as base64 + its container mime type. */
  stop(): Promise<Recording> {
    return new Promise((resolve, reject) => {
      const rec = this.recorder;
      if (!rec) {
        reject(new Error('Not recording.'));
        return;
      }
      rec.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mimeType });
        const mimeType = this.mimeType;
        this.teardown();
        blobToBase64(blob).then(
          (base64) => resolve({ base64, mimeType }),
          (err) => reject(err as Error),
        );
      };
      rec.stop();
    });
  }

  /** Abort without producing a recording (discards captured audio). */
  cancel(): void {
    const rec = this.recorder;
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null;
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    }
    this.teardown();
  }

  private teardown(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
  }
}
