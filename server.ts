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

// Fetch chords directly from web sources (Ultimate Guitar direct search + DDG fallback)
async function fetchChordsFromWeb(title: string, artist: string): Promise<{
  chordProBody: string;
  key?: string;
  capo?: number;
} | null> {
  const ugHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  const ugLinks: string[] = [];

  try {
    // Primary: Direct Ultimate Guitar search sorted by votes/rating for Chords tabs
    const ugQuery = `${title} ${artist}`.trim();
    const ugSearchUrl = `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(ugQuery)}`;
    const ugRes = await fetch(ugSearchUrl, { headers: ugHeaders });
    if (ugRes.ok) {
      const ugHtml = await ugRes.text();
      const storeMatch = ugHtml.match(/class="js-store" data-content="([^"]+)"/);
      if (storeMatch) {
        const unescaped = storeMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        const json = JSON.parse(unescaped);
        const results = json?.store?.page?.data?.results || [];
        const chordTabs = results
          .filter((item: any) => item?.type === 'Chords' && item?.tab_url)
          .sort((a: any, b: any) => {
            const scoreA = (Number(a.rating) || 0) * Math.log10((Number(a.votes) || 0) + 10);
            const scoreB = (Number(b.rating) || 0) * Math.log10((Number(b.votes) || 0) + 10);
            return scoreB - scoreA;
          });
        for (const t of chordTabs.slice(0, 4)) {
          ugLinks.push(t.tab_url);
        }
      }
    }
  } catch (ugSearchErr) {
    console.warn('Direct UG search failed, trying DuckDuckGo fallback:', ugSearchErr);
  }

  // Fallback: DuckDuckGo search index if direct UG search returned nothing
  if (ugLinks.length === 0) {
    try {
      const query = `${title} ${artist} chords`;
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await fetch(searchUrl, { headers: ugHeaders });
      if (res.ok) {
        const html = await res.text();
        const hrefs = [...html.matchAll(/uddg=([^&"']+)/g)].map((m) => decodeURIComponent(m[1]));
        for (const h of hrefs) {
          if (h.includes('tabs.ultimate-guitar.com/tab/') && !ugLinks.includes(h)) {
            ugLinks.push(h);
          }
        }
      }
    } catch (ddgErr) {
      console.warn('Error searching DuckDuckGo for chords:', ddgErr);
    }
  }

  for (const link of ugLinks.slice(0, 4)) {
    try {
      const tabRes = await fetch(link, { headers: ugHeaders });
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

  return null;
}

// Helper to format seconds to [mm:ss.xx]
function formatLrcTagServer(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const mins = Math.floor(clamped / 60);
  const rem = clamped % 60;
  const secs = Math.floor(rem);
  const centi = Math.floor((rem - secs) * 100);
  return `[${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centi.toString().padStart(2, '0')}]`;
}

// Convert Ultimate Guitar wiki tab format into clean ChordPro format with inline chords
function convertUgWikiToChordPro(ugContent: string, capo: number = 0): { body: string; detectedKey?: string } {
  let detectedKey = '';
  const keyMatch = ugContent.match(/(?:key|tonality)\s*:\s*([A-Ga-g][#b]?m?)/i);
  if (keyMatch) detectedKey = keyMatch[1];

  // Decode HTML entities commonly found in UG wiki content (e.g. &#039;, &amp;, &quot;)
  let text = ugContent
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ');

  // Remove [tab] and [/tab] tags
  text = text.replace(/\[\/?tab\]/gi, '');

  // Convert [ch]Chord[/ch] -> [Chord]
  text = text.replace(/\[ch\]([^\[\]]+)\[\/ch\]/gi, '[$1]');

  const lines = text.split(/\r?\n/);
  const resultLines: string[] = [];
  let inInstrumentalSection = false;

  // Matches bracketed chords like [Am7], [G/B], [F#m7b5], [C(add9)]
  const bracketChordRegex = /\[([A-G][A-Za-z0-9#b/+\*\(\)ø°]*)\]/g;

  const isPureChordLine = (line: string): boolean => {
    const hasChord = /\[([A-G][A-Za-z0-9#b/+\*\(\)ø°]*)\]/.test(line);
    if (!hasChord) return false;
    // Strip chords and common chord-line punctuation/repeat markers: | - / * . () x2 N.C.
    const leftover = line
      .replace(/\[([A-G][A-Za-z0-9#b/+\*\(\)ø°]*)\]/g, '')
      .replace(/\bN\.?C\.?\b/gi, '')
      .replace(/\bx\s*\d+\b/gi, '')
      .replace(/[\s|\-\/\*\.\(\)~,]+/g, '');
    return leftover.length === 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      resultLines.push('');
      continue;
    }

    // Section headings like [Intro], [Verse 1], [Chorus], [Guitar Solo], [Pre-Chorus], [Outro]
    const sectionMatch = trimmed.match(/^\[(Intro|Verse|Chorus|Bridge|Outro|Pre-Chorus|Post-Chorus|Solo|Guitar Solo|Interlude|Instrumental|Hook|Refrain|Breakdown|Riff|Tag|Coda|Ending)([^\]]*)\]/i);
    if (sectionMatch) {
      const type = sectionMatch[1].toLowerCase();
      const rest = sectionMatch[2].trim();
      const title = (sectionMatch[1] + (rest ? ' ' + rest : '')).trim();
      inInstrumentalSection = /^(intro|solo|guitar solo|outro|interlude|instrumental|riff|breakdown)$/i.test(type);
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
    if (/^(?:tabbed by|difficulty|tuning|author|bpm|capo):/i.test(trimmed)) {
      continue;
    }

    const isChordOnly = isPureChordLine(rawLine);

    if (isChordOnly) {
      // Look ahead up to 2 lines (allowing at most 1 blank line between chords and lyrics)
      let nextIdx = i + 1;
      while (nextIdx < lines.length && !lines[nextIdx].trim() && nextIdx - i <= 2) {
        nextIdx++;
      }
      const nextLine = nextIdx < lines.length ? lines[nextIdx] : '';
      const nextTrimmed = nextLine.trim();
      const isNextSection = nextTrimmed.startsWith('[') && /^\[(Intro|Verse|Chorus|Bridge|Outro|Pre-Chorus|Post-Chorus|Solo|Guitar Solo|Interlude|Instrumental|Hook|Refrain|Riff|Tag|Coda|Ending)/i.test(nextTrimmed);
      const isNextTab = /^[eBGDAE1-7]?\s*\|/i.test(nextTrimmed);
      const isNextChord = isPureChordLine(nextLine);
      const isNextLyrics =
        nextTrimmed.length > 0 &&
        !isNextChord &&
        !isNextSection &&
        !isNextTab &&
        !/^(?:tabbed by|difficulty|tuning|author|bpm):/i.test(nextTrimmed);

      // Merge chords inline into lyrics if not purely instrumental OR if genuine lyrics sit right below
      if (isNextLyrics && (!inInstrumentalSection || nextIdx === i + 1)) {
        const chordMatches: { chord: string; visualPos: number }[] = [];
        let m;
        let bracketOffset = 0;
        bracketChordRegex.lastIndex = 0;
        while ((m = bracketChordRegex.exec(rawLine)) !== null) {
          chordMatches.push({
            chord: m[1],
            visualPos: Math.max(0, m.index - bracketOffset),
          });
          // Each [Chord] adds 2 characters ('[' and ']') that didn't exist in UG visual spacing
          bracketOffset += 2;
        }

        let merged = '';
        let lastPos = 0;
        for (const cm of chordMatches) {
          const targetPos = Math.min(cm.visualPos, nextLine.length);
          if (targetPos > lastPos) {
            merged += nextLine.slice(lastPos, targetPos);
          }
          if (cm.visualPos > nextLine.length && lastPos >= nextLine.length) {
            merged += ' ';
          }
          merged += `[${cm.chord}]`;
          lastPos = Math.max(lastPos, targetPos);
        }
        if (lastPos < nextLine.length) {
          merged += nextLine.slice(lastPos);
        }
        resultLines.push(merged.trimEnd());
        i = nextIdx; // Skip nextLine as it has been merged
        continue;
      }
    }

    resultLines.push(rawLine.trimEnd());
  }

  return {
    body: resultLines.join('\n'),
    detectedKey,
  };
}

// Merge LRC timestamps into ALL ChordPro lyric lines cleanly from start to end of song
function mergeLrcTimestampsWithChords(lrcText: string, chordProBody: string, totalDurationSec?: number): string {
  const lrcLines: { timeSec: number; tag: string; cleanText: string; words: string[] }[] = [];
  for (const rawLine of lrcText.split(/\r?\n/)) {
    const m = rawLine.match(/^\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\](.*)$/);
    if (m) {
      const mins = parseInt(m[1], 10);
      const secs = parseFloat(m[2]);
      const clean = m[3].trim().toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!clean) continue; // skip empty musical spacer tags in LRC
      lrcLines.push({
        timeSec: mins * 60 + secs,
        tag: formatLrcTagServer(mins * 60 + secs),
        cleanText: clean,
        words: clean.split(' ').filter((w) => w.length > 1),
      });
    }
  }

  if (lrcLines.length === 0) return chordProBody;

  const lines = chordProBody.split(/\r?\n/);

  const isLyricTarget = (trimmed: string): boolean => {
    if (!trimmed) return false;
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) return false;
    if (/^\[(intro|verse|chorus|bridge|outro|pre-chorus|post-chorus|solo|guitar solo|interlude|instrumental|hook|refrain|riff|tag|coda|ending)/i.test(trimmed)) {
      return false;
    }
    if (/^[eBGDAE1-7]?\s*\|/i.test(trimmed)) return false;
    // Skip chord fingering / voicing legend lines like "Em7   0-2-2-0-3-3", "G/F# 2-x-0-0-3-3", or "Capo 2"
    if (/^[A-G][A-Za-z0-9#b/+\*\(\)]*\s+[0-9xX](?:[- ]?[0-9xX]){3,5}\b/.test(trimmed)) return false;
    if (/^(?:capo|tuning|strumming|rhythm|note|chords used|key|tempo|time signature)(?:\s*:|\s+\d|\s+on\b)/i.test(trimmed)) return false;
    // Strip chords and punctuation to see if actual lyrics exist
    const lyricOnly = trimmed
      .replace(/\[[^\]]+\]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!lyricOnly || lyricOnly.length < 2) return false;
    if (/^(x?\s*\d+|instrumental|guitar solo|solo|repeat|fade out)$/i.test(lyricOnly)) return false;
    return true;
  };

  const getCleanWords = (trimmed: string) => {
    const clean = trimmed
      .replace(/\[[^\]]+\]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      clean,
      words: clean.split(' ').filter((w) => w.length > 1),
    };
  };

  const computeSimilarity = (aClean: string, aWords: string[], bClean: string, bWords: string[]): number => {
    if (!aClean || !bClean) return 0;
    if (aClean === bClean) return 1.0;
    if (aClean.length >= 10 && bClean.includes(aClean.slice(0, 14))) return 0.9;
    if (bClean.length >= 10 && aClean.includes(bClean.slice(0, 14))) return 0.9;
    if (aWords.length === 0 || bWords.length === 0) return 0;
    const setB = new Set(bWords);
    let hits = 0;
    for (const w of aWords) {
      if (setB.has(w)) hits++;
    }
    return hits / Math.max(aWords.length, bWords.length);
  };

  // Identify indices of all lyric lines
  const lyricLineIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (isLyricTarget(trimmed)) {
      lyricLineIndices.push(i);
    }
  }

  if (lyricLineIndices.length === 0) return chordProBody;

  const assignedTimes: (number | null)[] = new Array(lyricLineIndices.length).fill(null);
  let lrcIdx = 0;

  for (let t = 0; t < lyricLineIndices.length; t++) {
    const rawTrimmed = lines[lyricLineIndices[t]].trim();

    // Already has LRC timestamp
    const existingM = rawTrimmed.match(/^\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]/);
    if (existingM) {
      assignedTimes[t] = parseInt(existingM[1], 10) * 60 + parseFloat(existingM[2]);
      continue;
    }

    if (lrcIdx >= lrcLines.length) break;

    const { clean, words } = getCleanWords(rawTrimmed);

    // Search forward window up to 6 lines for strong match
    let bestJ = -1;
    let bestScore = 0;
    const windowEnd = Math.min(lrcLines.length, lrcIdx + 6);
    for (let j = lrcIdx; j < windowEnd; j++) {
      const score = computeSimilarity(clean, words, lrcLines[j].cleanText, lrcLines[j].words);
      // Require stronger score when jumping ahead (> lrcIdx) so short common phrases don't skip verses
      const minThreshold = j === lrcIdx ? 0.45 : 0.65;
      if (score >= minThreshold && score > bestScore) {
        bestScore = score;
        bestJ = j;
        if (score >= 0.9) break;
      }
    }

    if (bestJ >= 0) {
      assignedTimes[t] = lrcLines[bestJ].timeSec;
      lrcIdx = bestJ + 1;
    } else {
      // Check if current line is actually the second half of the previously matched LRC line (split-line lyrics in UG)
      let isSplitContinuationOfPrev = false;
      if (lrcIdx > 0 && clean.length >= 6) {
        const prevLrc = lrcLines[lrcIdx - 1];
        if (prevLrc.cleanText.includes(clean)) {
          isSplitContinuationOfPrev = true;
        } else {
          const prevOverlap = computeSimilarity(clean, words, prevLrc.cleanText, prevLrc.words);
          const currOverlap = computeSimilarity(clean, words, lrcLines[lrcIdx].cleanText, lrcLines[lrcIdx].words);
          if (prevOverlap >= 0.35 && currOverlap < 0.25) {
            isSplitContinuationOfPrev = true;
          }
        }
      }

      if (!isSplitContinuationOfPrev) {
        // Check if the NEXT lyric line strongly matches lrcLines[lrcIdx] (e.g. current line is an ad-lib or intro cue)
        let nextMatchesCurrentLrc = false;
        if (t + 1 < lyricLineIndices.length) {
          const nextClean = getCleanWords(lines[lyricLineIndices[t + 1]].trim());
          const nextScore = computeSimilarity(nextClean.clean, nextClean.words, lrcLines[lrcIdx].cleanText, lrcLines[lrcIdx].words);
          if (nextScore >= 0.6) {
            nextMatchesCurrentLrc = true;
          }
        }

        if (!nextMatchesCurrentLrc) {
          // Sequential fallback consumes 1 LRC item cleanly
          assignedTimes[t] = lrcLines[lrcIdx].timeSec;
          lrcIdx++;
        }
      }
      // If split continuation or next line matches current LRC, leave assignedTimes[t] null to be smoothly interpolated below
    }
  }

  // Fill any null gaps (both mid-song split lines AND remaining lines in the second half of the song)
  // 1. Ensure anchor on index 0 if missing
  if (assignedTimes[0] === null) {
    assignedTimes[0] = lrcLines[0].timeSec;
  }

  // 2. Interpolate interior nulls cleanly
  let i = 0;
  while (i < assignedTimes.length) {
    if (assignedTimes[i] === null) {
      const prevIdx = i - 1;
      const prevTime = assignedTimes[prevIdx]!;
      let nextIdx = i + 1;
      while (nextIdx < assignedTimes.length && assignedTimes[nextIdx] === null) {
        nextIdx++;
      }
      if (nextIdx < assignedTimes.length) {
        const nextTime = assignedTimes[nextIdx]!;
        const steps = nextIdx - prevIdx;
        const stepSec = Math.max(0.5, (nextTime - prevTime) / steps);
        for (let k = prevIdx + 1; k < nextIdx; k++) {
          assignedTimes[k] = prevTime + stepSec * (k - prevIdx);
        }
        i = nextIdx;
      } else {
        // 3. Trailing lines without LRC entries (second half / extended outro):
        // Extrapolate progressively based on average pace up to totalDurationSec
        const lastKnownTime = prevTime;
        const avgPace = prevIdx > 0 ? Math.min(6.5, Math.max(2.5, lastKnownTime / prevIdx)) : 4.0;
        const remainingCount = assignedTimes.length - 1 - prevIdx;
        let stepSec = avgPace;
        if (totalDurationSec && totalDurationSec > lastKnownTime + 4) {
          const availableEnd = Math.max(lastKnownTime + remainingCount * 1.5, totalDurationSec - 4);
          stepSec = Math.min(7.0, Math.max(1.5, (availableEnd - lastKnownTime) / remainingCount));
        }
        for (let k = prevIdx + 1; k < assignedTimes.length; k++) {
          assignedTimes[k] = lastKnownTime + stepSec * (k - prevIdx);
        }
        break;
      }
    } else {
      i++;
    }
  }

  // Enforce strict monotonicity across all stamped lyric lines and apply tags
  let runningMax = 0;
  for (let t = 0; t < lyricLineIndices.length; t++) {
    const rawIdx = lyricLineIndices[t];
    const trimmed = lines[rawIdx].trim();
    if (/^\[\d{1,2}:\d{2}/.test(trimmed)) {
      runningMax = Math.max(runningMax, assignedTimes[t] || 0);
      continue;
    }
    const stampSec = Math.max(runningMax, assignedTimes[t] ?? runningMax);
    runningMax = stampSec + 0.1;
    lines[rawIdx] = `${formatLrcTagServer(stampSec)}${trimmed}`;
  }

  return lines.join('\n');
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
   - For all vocal/lyric sections (Verse, Pre-Chorus, Chorus, Bridge, etc.), ALWAYS embed chords INLINE within the lyrics using brackets, e.g. [G]When the night [Em]has come (never on a separate line above the lyrics).
   - Keep chords standalone ONLY in purely instrumental sections (e.g. Intro riff, Guitar Solo, Outro riff).
4. LRC TIMESTAMPS:
   - EVERY lyric line from the first verse all the way to the very last lyric line of the song MUST start with an LRC timestamp [mm:ss.xx] followed immediately by inline chords and lyrics (e.g. [00:15.20][G]When the night [Em]has come). Do NOT drop timestamps in the second half or final choruses.
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
              if (lrcData?.syncedLyrics) {
                chordProText = mergeLrcTimestampsWithChords(lrcData.syncedLyrics, chordProText, lrcData.duration);
              }
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
        chordBody = mergeLrcTimestampsWithChords(lrcData.syncedLyrics, chordBody, lrcData.duration);
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
