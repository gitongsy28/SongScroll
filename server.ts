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

// Track quota cooldown so 429 errors immediately fall back to web chords scraper without spamming failed requests
let quotaCooldownUntil = 0;

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

// Search YouTube for video accompaniment tracks with priority for official/remastered/lyrics
async function searchYouTubeVideo(query: string, preferredKeywords: string[] = []): Promise<{ url: string; title: string } | null> {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const regex = /"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})".*?"title":\{"runs":\[\{"text":"([^"]+)"/g;
    const items: { id: string; title: string }[] = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      items.push({ id: match[1], title: match[2] });
      if (items.length >= 8) break;
    }

    if (items.length === 0) {
      // Fallback simple videoId finder
      const simpleMatches = [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map((m) => m[1]);
      const uniqueIds = [...new Set(simpleMatches)];
      if (uniqueIds.length > 0) {
        return {
          url: `https://www.youtube.com/watch?v=${uniqueIds[0]}`,
          title: query,
        };
      }
      return null;
    }

    // Try finding one that matches preferred keywords (e.g. "official music video", "remastered", "with lyrics")
    if (preferredKeywords.length > 0) {
      const matchPref = items.find((item) => {
        const t = item.title.toLowerCase();
        return preferredKeywords.some((kw) => t.includes(kw.toLowerCase()));
      });
      if (matchPref) {
        return {
          url: `https://www.youtube.com/watch?v=${matchPref.id}`,
          title: matchPref.title,
        };
      }
    }

    return {
      url: `https://www.youtube.com/watch?v=${items[0].id}`,
      title: items[0].title,
    };
  } catch (err) {
    console.warn(`YouTube search error for "${query}":`, err);
    return null;
  }
}

// Fetch chords directly from web sources (tabs.ultimate-guitar.com via DDG search index)
async function fetchChordsFromWeb(title: string, artist: string): Promise<{
  chordProBody: string;
  key?: string;
  capo?: number;
} | null> {
  try {
    const query = `${title} ${artist} chords`;
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) return null;
    const html = await res.text();
    const hrefs = [...html.matchAll(/uddg=([^&"]+)/g)].map((m) => decodeURIComponent(m[1]));
    const ugLinks = [...new Set(hrefs.filter((h) => h.includes('tabs.ultimate-guitar.com/tab/')))];

    for (const link of ugLinks.slice(0, 4)) {
      try {
        const tabRes = await fetch(link, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        if (!tabRes.ok) continue;
        const tabHtml = await tabRes.text();
        const match = tabHtml.match(/class="js-store" data-content="([^"]+)"/);
        if (!match) continue;

        const unescaped = match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        const json = JSON.parse(unescaped);
        const tabView = json?.store?.page?.data?.tab_view;
        const wikiContent = tabView?.wiki_tab?.content;
        const meta = tabView?.meta || {};
        const capo = typeof meta.capo === 'number' ? meta.capo : parseInt(meta.capo || '0', 10) || 0;
        const tonality = meta.tonality_name || '';

        if (wikiContent && (wikiContent.includes('[ch]') || wikiContent.includes('[tab]'))) {
          const parsed = convertUgWikiToChordPro(wikiContent, capo);
          return {
            chordProBody: parsed.body,
            key: tonality || parsed.detectedKey || (capo > 0 ? 'G' : 'C'),
            capo: capo,
          };
        }
      } catch (tabErr) {
        console.warn('Error fetching tab from link:', link, tabErr);
      }
    }
  } catch (err) {
    console.warn('Error searching web for chords:', err);
  }
  return null;
}

// Convert Ultimate Guitar wiki tab format into clean ChordPro format with inline chords
function convertUgWikiToChordPro(ugContent: string, capo: number = 0): { body: string; detectedKey?: string } {
  let detectedKey = '';
  const keyMatch = ugContent.match(/(?:key|tonality)\s*:\s*([A-Ga-g][#b]?m?)/i);
  if (keyMatch) detectedKey = keyMatch[1];

  // Remove [tab] and [/tab] tags
  let text = ugContent.replace(/\[\/?tab\]/gi, '');

  // Convert [ch]Chord[/ch] -> [Chord]
  text = text.replace(/\[ch\]([^\[\]]+)\[\/ch\]/gi, '[$1]');

  const lines = text.split(/\r?\n/);
  const resultLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      resultLines.push('');
      continue;
    }

    // Section headings like [Intro], [Verse 1], [Chorus]
    const sectionMatch = trimmed.match(/^\[(Intro|Verse|Chorus|Bridge|Outro|Pre-Chorus|Solo|Interlude)([^\]]*)\]/i);
    if (sectionMatch) {
      const type = sectionMatch[1].toLowerCase();
      const rest = sectionMatch[2].trim();
      const title = (sectionMatch[1] + (rest ? ' ' + rest : '')).trim();
      if (type === 'chorus') {
        resultLines.push('{start_of_chorus}');
        resultLines.push(`{comment: ${title}}`);
      } else {
        resultLines.push(`{comment: ${title}}`);
      }
      continue;
    }

    // Skip ASCII tab lines like e|---0---|
    if (/^[eBGDAE1-7]?\s*\|[-0-9/\\hpsbrt~|xX><+*()# ]{4,}\|?$/i.test(trimmed)) {
      continue;
    }

    // Ignore contributor info lines like "Tabbed by: ..." or "Difficulty: ..."
    if (/^(?:tabbed by|difficulty|tuning|author|bpm):/i.test(trimmed)) {
      continue;
    }

    // Check if line is purely chords
    const withoutChords = rawLine.replace(/\[[A-Za-z0-9#b/+\*\s]+\]/g, '');
    const hasChords = /\[[A-Za-z0-9#b/+\*\s]+\]/.test(rawLine);
    const isChordOnly = hasChords && withoutChords.trim().length === 0;

    // Check next line to see if it is a matching lyric line
    let nextIdx = i + 1;
    while (nextIdx < lines.length && !lines[nextIdx].trim()) {
      nextIdx++;
    }
    const nextLine = nextIdx < lines.length ? lines[nextIdx] : '';
    const isNextLineChord = /\[[A-Za-z0-9#b/+\*\s]+\]/.test(nextLine) && nextLine.replace(/\[[A-Za-z0-9#b/+\*\s]+\]/g, '').trim().length === 0;
    const isNextLineSection = nextLine.trim().startsWith('[') && nextLine.trim().endsWith(']');
    const isNextLineLyrics = nextLine.trim().length > 0 && !isNextLineChord && !isNextLineSection && !/^[eBGDAE1-7]?\s*\|/i.test(nextLine.trim());

    if (isChordOnly && isNextLineLyrics && nextIdx === i + 1) {
      // Find all chords with their positions in rawLine
      const chordMatches: { chord: string; pos: number }[] = [];
      const cRegex = /\[([A-Za-z0-9#b/+\*\s]+)\]/g;
      let m;
      while ((m = cRegex.exec(rawLine)) !== null) {
        chordMatches.push({ chord: m[1], pos: m.index });
      }

      // Merge inline into nextLine
      let merged = '';
      let lastPos = 0;
      for (const cm of chordMatches) {
        if (cm.pos > lastPos) {
          merged += nextLine.slice(lastPos, cm.pos);
        }
        merged += `[${cm.chord}]`;
        lastPos = Math.max(lastPos, cm.pos);
      }
      if (lastPos < nextLine.length) {
        merged += nextLine.slice(lastPos);
      }
      resultLines.push(merged.trimEnd());
      i = nextIdx; // Skip nextLine as it has been merged
    } else {
      resultLines.push(rawLine.trimEnd());
    }
  }

  return {
    body: resultLines.join('\n'),
    detectedKey,
  };
}

// Merge LRC timestamps into ChordPro lines
function mergeLrcTimestampsWithChords(lrcText: string, chordProBody: string): string {
  const lrcLines: { tag: string; cleanText: string }[] = [];
  for (const rawLine of lrcText.split(/\r?\n/)) {
    const m = rawLine.match(/^\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\](.*)$/);
    if (m) {
      lrcLines.push({
        tag: m[0].slice(0, m[0].indexOf(']') + 1),
        cleanText: m[3].trim().toLowerCase().replace(/[^\w\s]/g, ''),
      });
    }
  }

  if (lrcLines.length === 0) return chordProBody;

  const outLines: string[] = [];
  let lrcIdx = 0;

  for (const line of chordProBody.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('{') || /^\[(?:intro|verse|chorus|bridge|outro)/i.test(trimmed)) {
      outLines.push(line);
      continue;
    }

    // Already has LRC timestamp
    if (/^\[\d{1,2}:\d{2}/.test(trimmed)) {
      outLines.push(line);
      continue;
    }

    const lyricOnly = trimmed.replace(/\[[^\]]+\]/g, '').trim().toLowerCase().replace(/[^\w\s]/g, '');
    if (!lyricOnly || lyricOnly.length < 2) {
      outLines.push(line);
      continue;
    }

    let matchedTag = '';
    // Search a moving window of LRC lines
    for (let j = lrcIdx; j < Math.min(lrcIdx + 6, lrcLines.length); j++) {
      const lrcItem = lrcLines[j];
      if (lrcItem.cleanText && (lrcItem.cleanText.includes(lyricOnly.slice(0, 14)) || lyricOnly.includes(lrcItem.cleanText.slice(0, 14)))) {
        matchedTag = lrcItem.tag;
        lrcIdx = j + 1;
        break;
      }
    }

    if (!matchedTag && lrcIdx < lrcLines.length) {
      matchedTag = lrcLines[lrcIdx].tag;
      lrcIdx++;
    }

    if (matchedTag) {
      outLines.push(`${matchedTag}${trimmed}`);
    } else {
      outLines.push(line);
    }
  }

  return outLines.join('\n');
}

app.post('/api/auto-create-song', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { title, artist } = req.body as AutoCreateRequest;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Song title is required' });
    }

    const songTitle = title.trim();
    const songArtist = (artist || '').trim();

    // 1. Fetch synced lyrics from LRCLIB open database in parallel with YouTube searches
    const [lrcData, fullSongVid, karaokeVid, btNoVocalVid, btWithVocalVid] = await Promise.all([
      fetchLrclibLyrics(songTitle, songArtist),
      searchYouTubeVideo(
        `${songTitle} ${songArtist} official music video remastered`,
        ['official music video', 'official video', 'remastered', 'with lyrics', 'official audio']
      ),
      searchYouTubeVideo(
        `${songTitle} ${songArtist} karaoke instrumental no vocal`,
        ['karaoke', 'instrumental', 'no vocal', 'lyrics']
      ),
      searchYouTubeVideo(
        `${songTitle} ${songArtist} backing track no guitar no vocal`,
        ['no guitar', 'backing track', 'karaoke', 'instrumental']
      ),
      searchYouTubeVideo(
        `${songTitle} ${songArtist} backing track no guitar with vocal`,
        ['backing track', 'with vocal', 'guitar backing track']
      ),
    ]);

    // Construct actual direct URLs
    const fullSongUrl = fullSongVid?.url || `https://www.youtube.com/results?search_query=${encodeURIComponent(songTitle + ' ' + songArtist + ' official video')}`;
    const fullSongDesc = fullSongVid?.title ? `Full Song (${fullSongVid.title.slice(0, 45)})` : 'Full Song (Official Music Video)';

    const karaokeUrl = karaokeVid?.url || `https://www.youtube.com/results?search_query=${encodeURIComponent(songTitle + ' ' + songArtist + ' karaoke instrumental')}`;
    const karaokeDesc = karaokeVid?.title ? `Karaoke (${karaokeVid.title.slice(0, 45)})` : 'Karaoke (Instrumental)';

    const btNoVocalUrl = btNoVocalVid?.url || `https://www.youtube.com/results?search_query=${encodeURIComponent(songTitle + ' ' + songArtist + ' backing track no guitar')}`;
    const btNoVocalDesc = btNoVocalVid?.title ? `Back Track w/o Vocal (${btNoVocalVid.title.slice(0, 40)})` : 'Back Track w/o Vocal (No Guitar)';

    const btWithVocalUrl = btWithVocalVid?.url || `https://www.youtube.com/results?search_query=${encodeURIComponent(songTitle + ' ' + songArtist + ' backing track')}`;
    const btWithVocalDesc = btWithVocalVid?.title ? `Back Track with Vocal (${btWithVocalVid.title.slice(0, 40)})` : 'Back Track with Vocal';

    let chordProText = '';
    let usedSource = '';

    // 2. Attempt AI generation if GEMINI_API_KEY is available
    if (process.env.GEMINI_API_KEY) {
      try {
        let lrcContextPrompt = '';
        if (lrcData?.syncedLyrics) {
          lrcContextPrompt = `\nReference synced LRC lyrics with timestamps:\n"""\n${lrcData.syncedLyrics}\n"""\n`;
        }

        const prompt = `You are an expert music director and ChordPro specialist.
Search the internet to create a complete, accurate ChordPro (.cho) file for the song:
Title: "${songTitle}"
Artist: "${songArtist}"

Requirements:
1. Provide the song's ORIGINAL KEY, TEMPO (BPM), TIME SIGNATURE, RELEASE YEAR, ERA, and DURATION.
2. Direct YouTube links to embed:
   BackTrack1: ${fullSongUrl} (${fullSongDesc})
   BackTrack2: ${karaokeUrl} (${karaokeDesc})
   BackTrack3: ${btNoVocalUrl} (${btNoVocalDesc})
   BackTrack4: ${btWithVocalUrl} (${btWithVocalDesc})
3. CHORDS IN ORIGINAL KEY:
   - YOU MUST INCLUDE ACCURATE CHORDS throughout the entire song (Intro, Verses, Chorus, Bridge, Outro).
   - Embed chords INLINE with lyrics using brackets, e.g. [G]When the night [Em]has come.
4. LRC TIMESTAMPS:
   - Every lyric line MUST start with an LRC timestamp [mm:ss.xx] followed immediately by inline chords and lyrics (e.g. [00:15.20][G]When the night [Em]has come).
5. Beautify and format header directives exactly in this order:
   {title: ${songTitle}}
   {artist: ${songArtist}}
   {key: ...}
   {Year: ...}
   {Era: ...}
   {capo: 0}
   {tempo: ...}
   {time: ...}
   {duration: ...}
   {meta: ScrollSpeed : 18}

   {meta: BackTrack1 : ${fullSongDesc} : ${fullSongUrl} : }
   {meta: BackTrack2 : ${karaokeDesc} : ${karaokeUrl} : }
   {meta: BackTrack3 : ${btNoVocalDesc} : ${btNoVocalUrl} : }
   {meta: BackTrack4 : ${btWithVocalDesc} : ${btWithVocalUrl} : }

   followed by 2 blank lines, then the timestamped song body.
${lrcContextPrompt}

Output ONLY the raw ChordPro text inside a single \`\`\`chordpro code block, with no conversational fluff.`;

        // Check if currently in quota cooldown
        if (Date.now() < quotaCooldownUntil) {
          console.log('Gemini is currently in quota cooldown, using fast web chords & LRCLIB fallback directly.');
        } else {
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
          } catch (groundingError: any) {
            const errMessage = String(groundingError?.message || '');
            const errFull = `${errMessage} ${String(groundingError)} ${groundingError?.status || ''} ${groundingError?.code || ''}`;
            const isQuota =
              groundingError?.status === 'RESOURCE_EXHAUSTED' ||
              groundingError?.code === 429 ||
              groundingError?.error?.code === 429 ||
              errFull.includes('RESOURCE_EXHAUSTED') ||
              errFull.includes('429') ||
              errFull.includes('quota') ||
              errFull.includes('rate-limit') ||
              errFull.includes('billing');

            if (isQuota) {
              quotaCooldownUntil = Date.now() + 5 * 60 * 1000;
              console.log('Gemini API quota reached (RESOURCE_EXHAUSTED / 429), switching to web chords scraper & LRCLIB.');
            } else {
              try {
                aiResponse = await ai.models.generateContent({
                  model: 'gemini-3.8-flash',
                  contents: prompt,
                  config: {
                    temperature: 0.2,
                  },
                });
              } catch (ungroundedErr: any) {
                const uErrMessage = String(ungroundedErr?.message || '');
                const uErrFull = `${uErrMessage} ${String(ungroundedErr)}`;
                if (uErrFull.includes('RESOURCE_EXHAUSTED') || uErrFull.includes('429') || uErrFull.includes('quota')) {
                  quotaCooldownUntil = Date.now() + 5 * 60 * 1000;
                  console.log('Gemini quota reached on ungrounded generation, falling back to web chords.');
                }
              }
            }
          }

          if (aiResponse) {
            const rawOutput = aiResponse.text || '';
            const match = rawOutput.match(/```(?:chordpro|text)?\s*([\s\S]*?)\s*```/i);
            const candidate = match ? match[1].trim() : rawOutput.trim();
            // Check if candidate actually contains chords like [G], [Am], etc.
            if (candidate && /\[[A-G][#b]?m?[0-9]?[^\]]*\]/.test(candidate)) {
              chordProText = candidate;
              usedSource = 'gemini';
            }
          }
        }
      } catch (aiErr: any) {
        console.log('Gemini generation completed with web fallback:', aiErr?.message || aiErr);
      }
    }

    // 3. If Gemini didn't return chords or was unavailable, fetch authentic chords from web scraper
    if (!chordProText || !/\[[A-G][#b]?m?[0-9]?[^\]]*\]/.test(chordProText)) {
      console.log(`Fetching chords directly from web sources for "${songTitle}" by "${songArtist}"...`);
      const webChordData = await fetchChordsFromWeb(songTitle, songArtist);

      let chordBody = '';
      let songKey = 'C';
      let songCapo = 0;

      if (webChordData?.chordProBody && /\[[A-G][#b]?m?[0-9]?[^\]]*\]/.test(webChordData.chordProBody)) {
        chordBody = webChordData.chordProBody;
        songKey = webChordData.key || 'C';
        songCapo = webChordData.capo || 0;
        usedSource = 'web-chords';
      } else if (lrcData?.syncedLyrics || lrcData?.plainLyrics) {
        chordBody = (lrcData.syncedLyrics || lrcData.plainLyrics || '').trim();
        usedSource = 'lrclib';
      }

      // Merge LRC timestamps into chordBody if available
      if (lrcData?.syncedLyrics && chordBody) {
        chordBody = mergeLrcTimestampsWithChords(lrcData.syncedLyrics, chordBody);
      }

      const songDuration = formatDurationMinutes(lrcData?.duration);

      chordProText = `{title: ${songTitle}}
{artist: ${songArtist || 'Unknown Artist'}}
{key: ${songKey}}
{capo: ${songCapo}}
{tempo: 120}
{duration: ${songDuration}}
{meta: ScrollSpeed : 18}

{meta: BackTrack1 : ${fullSongDesc} : ${fullSongUrl} : }
{meta: BackTrack2 : ${karaokeDesc} : ${karaokeUrl} : }
{meta: BackTrack3 : ${btNoVocalDesc} : ${btNoVocalUrl} : }
{meta: BackTrack4 : ${btWithVocalDesc} : ${btWithVocalUrl} : }


${chordBody}`;
    }

    if (!chordProText.includes('{title:')) {
      chordProText = `{title: ${songTitle}}\n{artist: ${songArtist}}\n` + chordProText;
    }

    res.json({
      success: true,
      chordPro: chordProText,
      hasLrcTimestamps: /\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/.test(chordProText),
      source: usedSource,
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
