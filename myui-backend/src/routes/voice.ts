import { Router } from 'express';
import { requireUser } from '../middleware/auth';
import { wrap } from '../http';
import { isVoiceConfigured, synthesize, transcribe } from '../voice';

/*
  Voice routes — Speech-to-Text (mic) and Text-to-Speech (speaker), proxied to
  Google's REST APIs by voice.ts. New, self-contained routes: they touch none of
  the chat / streaming / auth / conversation logic.

  Both are gated on a configured Google Speech API key. When it is unset they
  answer { error: "voice_not_configured" } (503) so the UI can show a friendly
  "voice isn't set up yet" notice instead of failing — and every line below is
  real, so the feature works the instant the key is set.
*/

const router = Router();
router.use(requireUser);

// POST /bff/voice/tts  { text, languageCode?, voiceName? }  ->  audio/mpeg (MP3)
router.post(
  '/tts',
  wrap(async (req, res) => {
    if (!isVoiceConfigured()) {
      res.status(503).json({ error: 'voice_not_configured' });
      return;
    }
    const text = String(req.body?.text ?? '').trim();
    if (!text) {
      res.status(400).json({ error: 'There is no text to read aloud.' });
      return;
    }
    const languageCode = typeof req.body?.languageCode === 'string' ? req.body.languageCode : undefined;
    const voiceName = typeof req.body?.voiceName === 'string' ? req.body.voiceName : undefined;
    try {
      const audio = await synthesize(text, { languageCode, voiceName });
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'no-store');
      res.send(audio);
    } catch (err) {
      res.status(502).json({ error: `Text-to-speech failed: ${(err as Error).message}` });
    }
  }),
);

// POST /bff/voice/stt  { audio: <base64>, mimeType?, preferredLanguage? }  ->  { text }
router.post(
  '/stt',
  wrap(async (req, res) => {
    if (!isVoiceConfigured()) {
      res.status(503).json({ error: 'voice_not_configured' });
      return;
    }
    const audio = typeof req.body?.audio === 'string' ? req.body.audio : '';
    if (!audio) {
      res.status(400).json({ error: 'No audio was received.' });
      return;
    }
    const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType : undefined;
    const preferredLanguage =
      typeof req.body?.preferredLanguage === 'string' ? req.body.preferredLanguage : undefined;
    try {
      const text = await transcribe(audio, { mimeType, preferredLanguage });
      res.json({ text });
    } catch (err) {
      res.status(502).json({ error: `Speech recognition failed: ${(err as Error).message}` });
    }
  }),
);

export default router;
