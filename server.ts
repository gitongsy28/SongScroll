import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Initialize Gemini SDK with User-Agent as required by AI Studio guidelines
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface AutoCreateRequest {
  title: string;
  artist: string;
}

// Fetch synced lyrics from LRCLIB open public API
async function fetchLrclibLyrics(title: string, artist: string): Promise<{ syncedLyrics?: string; plainLyrics?: string; duration?: number } | null> {
  try {
    const cleanTitle = title.trim();
    const cleanArtist = artist.trim();

    // Direct match attempt
    if (cleanArtist) {
      const getUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}`;
      const res = await fetch(getUrl, {
        headers: { 'User-Agent': 'SongScroll-ChordPro-Player/1.0' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && (data.syncedLyrics || data.plainLyrics)) {
          return {
            syncedLyrics: data.syncedLyrics,
            plainLyrics: data.plainLyrics,
            duration: data.duration,
          };
        }
      }
    }

    // Search fallback
    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle + ' ' + cleanArtist)}`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'SongScroll-ChordPro-Player/1.0' },
    });
    if (searchRes.ok) {
      const list = await searchRes.json();
      if (Array.isArray(list) && list.length > 0) {
        const best = list.find((item) => item.syncedLyrics) || list[0];
        if (best) {
          return {
            syncedLyrics: best.syncedLyrics,
            plainLyrics: best.plainLyrics,
            duration: best.duration,
          };
        }
      }
    }
  } catch (err) {
    console.warn('LRCLIB fetch failed, falling back to Gemini web search:', err);
  }
  return null;
}

// Format seconds into "m:ss"
function formatDurationMinutes(seconds?: number): string {
  if (!seconds || isNaN(seconds)) return '3:30';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', server: 'SongScroll full-stack', timestamp: Date.now() });
});

app.post('/api/auto-create-song', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { title, artist } = req.body as AutoCreateRequest;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Song title is required' });
    }

    const songTitle = title.trim();
    const songArtist = (artist || '').trim();

    // 1. Fetch synced lyrics from LRCLIB if available
    const lrcData = await fetchLrclibLyrics(songTitle, songArtist);

    let lrcContextPrompt = '';
    if (lrcData?.syncedLyrics) {
      lrcContextPrompt = `\nHere are reference synced LRC lyrics with exact timestamps:\n"""\n${lrcData.syncedLyrics}\n"""\n`;
    }

    // 2. Query Gemini 3.8 Flash with Google Search grounding
    const prompt = `You are an expert music director and ChordPro specialist.
Search the internet to create a complete, accurate ChordPro (.cho) file for the song:
Title: "${songTitle}"
Artist: "${songArtist}"

Requirements:
1. Identify the song's ORIGINAL KEY, TEMPO (BPM), TIME SIGNATURE, RELEASE YEAR, ERA (e.g. 70s, 80s, 90s, 00s, 10s, 20s), and DURATION.
2. Search and retrieve real YouTube URLs for these 4 accompaniment BackTracks:
   - "Full Song" (Official music video or official audio reference)
   - "Karaoke" (Full music instrumental without vocal for karaoke)
   - "Back Track w/o Vocal" (Accompaniment track with no guitar part and no vocal part)
   - "Back Track with Vocal" (Accompaniment track with no guitar part, but with vocal part)
   If a specific isolated guitar backing track is not found, use the best available guitar backing track, acoustic backing track, or rehearsal instrumental from YouTube.
3. Chords & Lyrics:
   - Provide chords in the ORIGINAL key.
   - Embed chords inline like [G]Amazing [D]grace.
   - Use standard sections: {comment: Verse 1}, {start_of_chorus}, {end_of_chorus}, {comment: Verse 2}, etc.
4. LRC Timestamps on every lyric line:
   - Every lyric line MUST start with an LRC timestamp in the exact format [mm:ss.xx] (e.g. [00:12.30][G]Amazing [D]grace).
   - Use the reference timestamps if provided, or search the official track timeline to assign realistic timestamps from start to finish.
5. Beautify and format header directives exactly in this order:
   {title: ...}
   {artist: ...}
   {key: ...}
   {Year: ...}
   {Era: ...}
   {capo: 0}
   {tempo: ...}
   {time: ...}
   {duration: ...}
   {meta: ScrollSpeed : 18}

   {meta: BackTrack1 : Full Song (Official Audio) : <youtube_url> : }
   {meta: BackTrack2 : Karaoke (No Vocal) : <youtube_url> : }
   {meta: BackTrack3 : Back Track w/o Vocal (No Guitar No Vocal) : <youtube_url> : }
   {meta: BackTrack4 : Back Track with Vocal (No Guitar with Vocal) : <youtube_url> : }

   followed by 2 blank lines, then the timestamped song body.
${lrcContextPrompt}

Output ONLY the raw ChordPro text inside a single \`\`\`chordpro code block, with no conversational fluff.`;

    let chordProText = '';

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY environment variable is not set');
      }

      let aiResponse;
      try {
        aiResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            temperature: 0.2,
          },
        });
      } catch (groundingError) {
        console.warn('Search grounding failed, attempting ungrounded generation:', groundingError);
        aiResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            temperature: 0.2,
          },
        });
      }

      const rawOutput = aiResponse.text || '';
      const match = rawOutput.match(/```(?:chordpro|text)?\s*([\s\S]*?)\s*```/i);
      chordProText = match ? match[1].trim() : rawOutput.trim();
    } catch (aiError: any) {
      console.warn('Gemini generation failed, checking fallback to LRCLIB lyrics:', aiError);
      if (lrcData?.syncedLyrics || lrcData?.plainLyrics) {
        const lines = (lrcData.syncedLyrics || lrcData.plainLyrics || '').trim();
        chordProText = `{title: ${songTitle}}
{artist: ${songArtist || 'Unknown Artist'}}
{key: C}
{tempo: 120}
{duration: ${formatDurationMinutes(lrcData.duration)}}
{meta: ScrollSpeed : 18}

{meta: BackTrack1 : Full Song (Search) : https://www.youtube.com/results?search_query=${encodeURIComponent(songTitle + ' ' + songArtist + ' official audio')} : }
{meta: BackTrack2 : Karaoke (Search) : https://www.youtube.com/results?search_query=${encodeURIComponent(songTitle + ' ' + songArtist + ' karaoke instrumental')} : }
{meta: BackTrack3 : Back Track w/o Vocal : https://www.youtube.com/results?search_query=${encodeURIComponent(songTitle + ' ' + songArtist + ' backing track no guitar')} : }
{meta: BackTrack4 : Back Track with Vocal : https://www.youtube.com/results?search_query=${encodeURIComponent(songTitle + ' ' + songArtist + ' backing track')} : }


${lines}`;
      } else {
        throw aiError;
      }
    }

    if (!chordProText.includes('{title:')) {
      chordProText = `{title: ${songTitle}}\n{artist: ${songArtist}}\n` + chordProText;
    }

    res.json({
      success: true,
      chordPro: chordProText,
      hasLrcTimestamps: /\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/.test(chordProText),
      source: lrcData?.syncedLyrics ? 'lrclib+gemini' : 'gemini',
    });
  } catch (error: any) {
    console.error('Error generating song:', error);
    res.status(500).json({
      error: error.message || 'Failed to auto-search and generate song',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Fallback for dev mode SPA HTML serving
    app.use('*', async (req, res, next) => {
      if (req.method !== 'GET') return next();
      try {
        const fs = await import('fs');
        let template = fs.readFileSync(path.resolve('index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SongScroll full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
