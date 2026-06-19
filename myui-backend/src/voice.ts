import { config } from './config';

/*
  Google Cloud Speech client — Speech-to-Text + Text-to-Speech over the REST
  API, authenticated with a plain API key (?key=...), NOT a service-account JSON
  and NOT the @google-cloud client libraries. The key lives only here
  (server-side, from GOOGLE_SPEECH_API_KEY) and never reaches the browser.
  Mirrors the encapsulation style of ragflow.ts.

    TTS:  POST texttospeech.googleapis.com/v1/text:synthesize?key=...
          { input:{text}, voice:{languageCode,name}, audioConfig:{audioEncoding:"MP3"} }
          -> { audioContent: <base64 MP3> }
    STT:  POST speech.googleapis.com/v1/speech:recognize?key=...
          { config:{encoding,sampleRateHertz,languageCode,alternativeLanguageCodes}, audio:{content:<base64>} }
          -> { results:[{ alternatives:[{ transcript }] }] }

  When the key is empty the feature is disabled: callers check
  isVoiceConfigured() and return a graceful "voice_not_configured" response, so
  nothing here runs without a key.
*/

const TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const STT_URL = 'https://speech.googleapis.com/v1/speech:recognize';

/** Google TTS rejects input longer than 5000 bytes; stay safely under it. */
const TTS_MAX_BYTES = 4800;

/** True once a Google Speech API key is configured. */
export function isVoiceConfigured(): boolean {
  return Boolean(config.googleSpeech.apiKey);
}

/* ────────────────────────────────────────────────────────────────────────────
   VOICE CONFIG — edit this map to change how each language sounds.

   Each entry maps a language code to one Google voice. Defaults use Chirp3-HD,
   Google's most natural ("HD") tier. Full catalogue + audio samples:
     https://cloud.google.com/text-to-speech/docs/voices

   How to edit an entry:
     - voiceName    Swap the trailing name to change voice / gender. Chirp3-HD
                    names look like "<locale>-Chirp3-HD-<Name>".
                      Female: Aoede, Kore, Leda, Zephyr
                      Male:   Puck, Charon, Fenrir, Orus
                    e.g. "en-IN-Chirp3-HD-Charon" = a male Indian-English voice.
     - speakingRate Speed, 0.25-4.0 (1.0 = normal). Lower is slower.
     - pitch        Pitch shift, -20.0 to 20.0 (0.0 = normal). ONLY the classic
                    Neural2 / WaveNet tiers honour pitch; Chirp3-HD voices reject
                    it, so pitch is sent only for non-Chirp voices. Leave Chirp
                    entries at pitch: 0.0.

   To add a language: add `"<locale>": { voiceName, speakingRate, pitch }` below.
   Any language NOT listed here falls back to a Neural2 / locale-default voice
   (see NEURAL2_FALLBACK and detectLanguage), so nothing breaks.
   ──────────────────────────────────────────────────────────────────────────── */
interface VoiceSettings {
  /** Exact Google voice name, e.g. "en-IN-Chirp3-HD-Aoede". */
  voiceName: string;
  /** Playback speed, 0.25-4.0; 1.0 is normal. */
  speakingRate: number;
  /** Pitch shift, -20.0 to 20.0; ignored for Chirp3-HD voices. */
  pitch: number;
}

const VOICE_CONFIG: Record<string, VoiceSettings> = {
  'hi-IN': { voiceName: 'hi-IN-Chirp3-HD-Kore', speakingRate: 1.0, pitch: 0.0 }, // Hindi, female
  'en-IN': { voiceName: 'en-IN-Chirp3-HD-Aoede', speakingRate: 1.0, pitch: 0.0 }, // Indian English, female
  // Add a 3rd language here, e.g.:
  // 'ta-IN': { voiceName: 'ta-IN-Chirp3-HD-Leda', speakingRate: 1.0, pitch: 0.0 },
};

/*
  Named Neural2 fallbacks for the two main languages, used only if their
  Chirp3-HD entry above is removed. Every other detected language falls back to
  a gender-only default and lets Google pick a valid voice for that locale.
*/
const NEURAL2_FALLBACK: Record<string, string> = {
  'hi-IN': 'hi-IN-Neural2-A',
  'en-IN': 'en-IN-Neural2-A',
};

interface Voice {
  languageCode: string;
  name?: string;
  ssmlGender?: 'FEMALE' | 'MALE';
}

/*
  Lightweight, dependency-free language pick by Unicode script. The assistant
  answers in the user's language, so we read the reply back in a matching Indian
  locale: Hindi (Devanagari) -> hi-IN, the other Indic scripts -> their locale,
  everything else (incl. Latin/English) -> en-IN. The locale is then looked up
  in VOICE_CONFIG above to choose the actual voice.
*/
function detectLanguage(text: string): string {
  // Detect the dominant Indic script by Unicode block (all-ASCII source: we test
  // code points, never literal characters, so the file stays encoding-safe).
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (c === undefined) continue;
    if (c >= 0x0900 && c <= 0x097f) return 'hi-IN'; // Devanagari (Hindi)
    if (c >= 0x0980 && c <= 0x09ff) return 'bn-IN'; // Bengali
    if (c >= 0x0a00 && c <= 0x0a7f) return 'pa-IN'; // Gurmukhi (Punjabi)
    if (c >= 0x0a80 && c <= 0x0aff) return 'gu-IN'; // Gujarati
    if (c >= 0x0b80 && c <= 0x0bff) return 'ta-IN'; // Tamil
    if (c >= 0x0c00 && c <= 0x0c7f) return 'te-IN'; // Telugu
    if (c >= 0x0c80 && c <= 0x0cff) return 'kn-IN'; // Kannada
    if (c >= 0x0d00 && c <= 0x0d7f) return 'ml-IN'; // Malayalam
  }
  return 'en-IN'; // default: Indian English
}

/*
  Resolve a language code (and an optional explicit voiceName override from the
  request) to the concrete voice + prosody to send to Google. Preference order:
  explicit override -> Chirp3-HD from VOICE_CONFIG -> named Neural2 fallback ->
  gender-only locale default (Google picks a valid voice).
*/
function resolveVoice(
  languageCode: string,
  voiceNameOverride?: string,
): { voice: Voice; speakingRate: number; pitch: number } {
  if (voiceNameOverride) {
    return { voice: { languageCode, name: voiceNameOverride }, speakingRate: 1.0, pitch: 0.0 };
  }
  const cfg = VOICE_CONFIG[languageCode];
  if (cfg) {
    return { voice: { languageCode, name: cfg.voiceName }, speakingRate: cfg.speakingRate, pitch: cfg.pitch };
  }
  const fallback = NEURAL2_FALLBACK[languageCode];
  if (fallback) {
    return { voice: { languageCode, name: fallback }, speakingRate: 1.0, pitch: 0.0 };
  }
  return { voice: { languageCode, ssmlGender: 'FEMALE' }, speakingRate: 1.0, pitch: 0.0 };
}

/** Truncate to a maximum UTF-8 byte length without splitting a code point. */
function truncateToBytes(text: string, maxBytes: number): string {
  const enc = new TextEncoder();
  if (enc.encode(text).length <= maxBytes) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (enc.encode(text.slice(0, mid)).length <= maxBytes) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo);
}

export interface SynthOptions {
  languageCode?: string;
  voiceName?: string;
}

/** One TTS audioConfig; `pitch` is optional because Chirp3-HD voices reject it. */
interface AudioConfig {
  audioEncoding: string;
  speakingRate: number;
  pitch?: number;
}

/** Synthesize speech for `text`; resolves to an MP3 buffer (audio/mpeg). */
export async function synthesize(text: string, opts: SynthOptions = {}): Promise<Buffer> {
  const body = truncateToBytes(text, TTS_MAX_BYTES);
  const languageCode = opts.languageCode ?? detectLanguage(body);
  const { voice, speakingRate, pitch } = resolveVoice(languageCode, opts.voiceName);

  const audioConfig: AudioConfig = { audioEncoding: 'MP3', speakingRate };
  // Chirp3-HD voices reject the `pitch` parameter; send pitch only for the
  // classic Neural2 / WaveNet tiers, and only when it actually shifts the pitch.
  const isChirp = /-Chirp/i.test(voice.name ?? '');
  if (!isChirp && pitch !== 0) audioConfig.pitch = pitch;

  let res = await postSynthesis(body, voice, audioConfig);
  if (!res.ok) {
    const detail = await describeError(res);
    // Graceful pitch fallback: if a voice unexpectedly rejects pitch, drop it
    // and retry once rather than failing the whole request.
    if (audioConfig.pitch !== undefined && /pitch/i.test(detail)) {
      delete audioConfig.pitch;
      res = await postSynthesis(body, voice, audioConfig);
      if (!res.ok) throw new Error(await describeError(res));
    } else {
      throw new Error(detail);
    }
  }
  const data = (await res.json()) as { audioContent?: string };
  if (!data.audioContent) throw new Error('Google returned no audio.');
  return Buffer.from(data.audioContent, 'base64');
}

/** POST a single synthesize request to Google TTS. */
function postSynthesis(body: string, voice: Voice, audioConfig: AudioConfig): Promise<Response> {
  return fetch(`${TTS_URL}?key=${encodeURIComponent(config.googleSpeech.apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: { text: body }, voice, audioConfig }),
  });
}

// Primary language plus auto-detect across India's major languages. Google's v1
// recognizer accepts a primary languageCode plus up to 3 alternativeLanguageCodes,
// so we send the top three from this list; the full set is kept for reference and
// easy reordering (Hindi, Bengali, Tamil lead by number of speakers).
const STT_PRIMARY_LANGUAGE = 'en-IN';
const STT_ALTERNATIVE_LANGUAGES = ['hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'mr-IN', 'gu-IN', 'kn-IN', 'pa-IN'];
const STT_MAX_ALTERNATIVES = 3;

/** Map a browser MediaRecorder mime type to a Google STT audio encoding. */
function encodingFor(mimeType: string | undefined): string {
  const m = (mimeType ?? '').toLowerCase();
  if (m.includes('ogg')) return 'OGG_OPUS';
  if (m.includes('webm')) return 'WEBM_OPUS';
  return 'WEBM_OPUS'; // the MediaRecorder default we coordinate with the frontend
}

export interface TranscribeOptions {
  mimeType?: string;
}

/** Transcribe base64-encoded audio to text. Returns '' if nothing recognized. */
export async function transcribe(audioBase64: string, opts: TranscribeOptions = {}): Promise<string> {
  const content = audioBase64.replace(/^data:[^;]+;base64,/, '');
  const res = await fetch(`${STT_URL}?key=${encodeURIComponent(config.googleSpeech.apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config: {
        encoding: encodingFor(opts.mimeType),
        // MediaRecorder always encodes Opus at 48 kHz regardless of the mic's
        // input rate, so 48000 is correct AND required: the v1 recognizer
        // rejects OGG/WEBM_OPUS sent with no sampleRateHertz ("Opus sample rate
        // (0) not in supported rates"), and a value that disagrees with the
        // stream silently yields an empty transcript. Do not omit this.
        sampleRateHertz: 48000,
        languageCode: STT_PRIMARY_LANGUAGE,
        alternativeLanguageCodes: STT_ALTERNATIVE_LANGUAGES.slice(0, STT_MAX_ALTERNATIVES),
        // Accuracy: "latest_long" is tuned for natural, conversational speech;
        // useEnhanced opts into the enhanced recognizer; automatic punctuation
        // makes transcripts read cleanly.
        model: 'latest_long',
        useEnhanced: true,
        enableAutomaticPunctuation: true,
      },
      audio: { content },
    }),
  });
  if (!res.ok) throw new Error(await describeError(res));
  const data = (await res.json()) as {
    results?: { alternatives?: { transcript?: string }[] }[];
  };
  return (data.results ?? [])
    .map((r) => r.alternatives?.[0]?.transcript ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Pull a useful message out of a Google error response. */
async function describeError(res: Response): Promise<string> {
  let detail = `${res.status} ${res.statusText}`;
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    if (body.error?.message) detail = body.error.message;
  } catch {
    /* non-JSON error body */
  }
  return `Google Speech API error: ${detail}`;
}
