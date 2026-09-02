import { Song } from '../types';
import { createSongFromChordPro } from './chordpro';

export const SAMPLE_CHORDPRO_DATA: { filename: string; chordpro: string }[] = [
  {
    filename: 'Eagles - Hotel California.cho',
    chordpro: `{title: Hotel California}
{artist: Eagles}
{era: 70s}
{tempo: 75}
{time: 4/4}
{key: Bm}
{capo: 7}
{duration: 6:30}

{comment: Intro}
[Bm]  [F#7]  [A]  [E7]  [G]  [D]  [Em]  [F#7]

{comment: Verse 1}
[Bm]On a dark desert highway, [F#7]cool wind in my hair
[A]Warm smell of colitas, [E7]rising up through the air
[G]Up ahead in the distance, [D]I saw a shimmering light
[Em]My head grew heavy and my sight grew dim, [F#7]I had to stop for the night

{comment: Verse 2}
[Bm]There she stood in the doorway; [F#7]I heard the mission bell
[A]And I was thinking to myself, "This could be [E7]Heaven or this could be Hell"
[G]Then she lit up a candle, [D]and she showed me the way
[Em]There were voices down the corridor, [F#7]I thought I heard them say...

{start_of_chorus}
[G]Welcome to the Hotel Cali[D]fornia
Such a [F#7]lovely place (such a lovely place), such a [Bm]lovely face
[G]Plenty of room at the Hotel Cali[D]fornia
Any [Em]time of year (any time of year) you can [F#7]find it here
{end_of_chorus}

{comment: Verse 3}
[Bm]Her mind is Tiffany-twisted, [F#7]she got the Mercedes bends
[A]She got a lot of pretty, pretty boys, [E7]that she calls friends
[G]How they dance in the courtyard, [D]sweet summer sweat
[Em]Some dance to remember, [F#7]some dance to forget

{comment: Verse 4}
[Bm]So I called up the Captain, [F#7]"Please bring me my wine"
He said, [A]"We haven't had that spirit here since [E7]nineteen sixty-nine"
[G]And still those voices are calling from [D]far away
[Em]Wake you up in the middle of the night, [F#7]just to hear them say...

{start_of_chorus}
[G]Welcome to the Hotel Cali[D]fornia
Such a [F#7]lovely place (such a lovely place), such a [Bm]lovely face
They [G]livin' it up at the Hotel Cali[D]fornia
What a [Em]nice surprise (what a nice surprise), bring your [F#7]alibis
{end_of_chorus}

{start_of_bridge}
[Bm]Mirrors on the ceiling, [F#7]the pink champagne on ice
And she said, [A]"We are all just prisoners here, [E7]of our own device"
[G]And in the master's chambers, [D]they gathered for the feast
[Em]They stab it with their steely knives, but they [F#7]just can't kill the beast
{end_of_bridge}

{comment: Outro}
[Bm]Last thing I remember, I was [F#7]running for the door
[A]I had to find the passage back to the [E7]place I was before
[G]"Relax," said the night man, "We are [D]programmed to receive
[Em]You can check out any time you like, but [F#7]you can never leave!"`
  },
  {
    filename: 'Leonard Cohen - Hallelujah.cho',
    chordpro: `{title: Hallelujah}
{artist: Leonard Cohen}
{era: 80s}
{tempo: 60}
{time: 6/8}
{key: C}
{duration: 4:36}

{comment: Intro}
[C]  [Am]  [C]  [Am]

{comment: Verse 1}
Now I've [C]heard there was a [Am]secret chord
That [C]David played, and it [Am]pleased the Lord
But [F]you don't really [G]care for music, [C]do you? [G]
It [C]goes like this: the [F]fourth, the [G]fifth
The [Am]minor fall, the [F]major lift
The [G]baffled king com[E7]posing Halle[Am]lujah

{start_of_chorus}
Halle[F]lujah, Halle[Am]lujah
Halle[F]lujah, Halle[C]lu----[G]--[C]jah [Am] [C] [Am]
{end_of_chorus}

{comment: Verse 2}
Your [C]faith was strong but you [Am]needed proof
You [C]saw her bathing [Am]on the roof
Her [F]beauty and the [G]moonlight over[C]threw you [G]
She [C]tied you to a [F]kitchen [G]chair
She [Am]broke your throne, and she [F]cut your hair
And [G]from your lips she [E7]drew the Halle[Am]lujah

{start_of_chorus}
Halle[F]lujah, Halle[Am]lujah
Halle[F]lujah, Halle[C]lu----[G]--[C]jah [Am] [C] [Am]
{end_of_chorus}

{comment: Verse 3}
Well, [C]baby, I've been [Am]here before
I [C]know this room, I've [Am]walked this floor
I [F]used to live a[G]lone before I [C]knew you [G]
And I've [C]seen your flag on the [F]marble [G]arch
And [Am]Love is not a [F]victory march
It's a [G]cold and it's a [E7]broken Halle[Am]lujah

{start_of_chorus}
Halle[F]lujah, Halle[Am]lujah
Halle[F]lujah, Halle[C]lu----[G]--[C]jah [Am] [C] [Am]
{end_of_chorus}`
  },
  {
    filename: 'The Beatles - Let It Be.cho',
    chordpro: `{title: Let It Be}
{artist: The Beatles}
{era: 70s}
{tempo: 72}
{time: 4/4}
{key: C}
{duration: 4:03}

{comment: Intro}
[C]  [G]  [Am]  [F]  [C]  [G]  [F]  [C]

{comment: Verse 1}
When I [C]find myself in [G]times of trouble, [Am]Mother Mary [F]comes to me
[C]Speaking words of [G]wisdom, let it [F]be [C]
And [C]in my hour of [G]darkness, she is [Am]standing right in [F]front of me
[C]Speaking words of [G]wisdom, let it [F]be [C]

{start_of_chorus}
Let it [Am]be, let it [G]be, let it [F]be, let it [C]be
[C]Whisper words of [G]wisdom, let it [F]be [C]
{end_of_chorus}

{comment: Verse 2}
And [C]when the broken [G]hearted people [Am]living in the [F]world agree
[C]There will be an [G]answer, let it [F]be [C]
For [C]though they may be [G]parted, there is [Am]still a chance that [F]they will see
[C]There will be an [G]answer, let it [F]be [C]

{start_of_chorus}
Let it [Am]be, let it [G]be, let it [F]be, let it [C]be
[C]There will be an [G]answer, let it [F]be [C]
{end_of_chorus}

{start_of_bridge}
[F]  [Em]  [Dm]  [C]  [Bb]  [F/A]  [G]  [F]  [C]
{end_of_bridge}

{comment: Verse 3}
And [C]when the night is [G]cloudy, there is [Am]still a light that [F]shines on me
[C]Shine until to[G]morrow, let it [F]be [C]
I [C]wake up to the [G]sound of music, [Am]Mother Mary [F]comes to me
[C]Speaking words of [G]wisdom, let it [F]be [C]`
  },
  {
    filename: 'Bob Dylan - Knockin On Heavens Door.cho',
    chordpro: `{title: Knockin' on Heaven's Door}
{artist: Bob Dylan}
{era: 70s}
{tempo: 68}
{time: 4/4}
{key: G}
{duration: 3:15}

{comment: Intro}
[G]  [D]  [Am]
[G]  [D]  [C]

{comment: Verse 1}
[G]Mama, [D]take this badge off of [Am]me
[G]I can't [D]use it any[C]more
[G]It's gettin' [D]dark, too dark to [Am]see
[G]I feel I'm [D]knockin' on heaven's [C]door

{start_of_chorus}
[G]Knock, knock, [D]knockin' on heaven's [Am]door
[G]Knock, knock, [D]knockin' on heaven's [C]door
[G]Knock, knock, [D]knockin' on heaven's [Am]door
[G]Knock, knock, [D]knockin' on heaven's [C]door
{end_of_chorus}

{comment: Verse 2}
[G]Mama, [D]put my guns in the [Am]ground
[G]I can't [D]shoot them any[C]more
[G]That long black [D]cloud is comin' [Am]down
[G]I feel I'm [D]knockin' on heaven's [C]door

{start_of_chorus}
[G]Knock, knock, [D]knockin' on heaven's [Am]door
[G]Knock, knock, [D]knockin' on heaven's [C]door
[G]Knock, knock, [D]knockin' on heaven's [Am]door
[G]Knock, knock, [D]knockin' on heaven's [C]door
{end_of_chorus}`
  },
  {
    filename: 'Ben E King - Stand By Me.cho',
    chordpro: `{title: Stand By Me}
{artist: Ben E. King}
{era: 60s}
{tempo: 118}
{time: 4/4}
{key: A}
{duration: 3:00}

{comment: Intro Bass Riff}
[A]  [F#m]  [D]  [E7]  [A]

{comment: Verse 1}
When the [A]night has come, and the [F#m]land is dark
And the [D]moon is the [E7]only light we'll [A]see
No, I [A]won't be afraid, no, I [F#m]won't be afraid
Just as [D]long as you [E7]stand, stand by [A]me

{start_of_chorus}
So darling, darling, [A]stand by me, oh, [F#m]stand by me
Oh, [D]stand, [E7]stand by me, [A]stand by me
{end_of_chorus}

{comment: Verse 2}
If the [A]sky that we look upon should [F#m]tumble and fall
Or the [D]mountain should [E7]crumble to the [A]sea
I won't [A]cry, I won't cry, no, I [F#m]won't shed a tear
Just as [D]long as you [E7]stand, stand by [A]me

{start_of_chorus}
And darling, darling, [A]stand by me, oh, [F#m]stand by me
Oh, [D]stand now, [E7]stand by me, [A]stand by me
{end_of_chorus}`
  },
  {
    filename: 'Vance Joy - Riptide.cho',
    chordpro: `{title: Riptide}
{artist: Vance Joy}
{era: 10s}
{tempo: 102}
{time: 4/4}
{key: Am}
{capo: 1}
{duration: 3:24}

{comment: Intro}
[Am]  [G]  [C]  [C]

{comment: Verse 1}
[Am]I was scared of [G]dentists and the [C]dark
[Am]I was scared of [G]pretty girls and [C]starting conversations
[Am]Oh, all my [G]friends are turning [C]green
You're the [Am]magician's as[G]sistant in their [C]dream

{start_of_chorus}
[Am]Oh, [G]ooh, [C]ooh
[Am]Oh, and they [G]come unstuck [C]
[Am]Lady, [G]running down to the [C]riptide
Taken away to the [Am]dark side, [G]I wanna be your [C]left hand man
I [Am]love you [G]when you're singing that [C]song and
I got a lump in my [Am]throat 'cause [G]you're gonna sing the words [C]wrong
{end_of_chorus}

{comment: Verse 2}
[Am]There's this movie that I [G]think you'll like
This [C]guy decides to quit his job and heads to New York City
This [Am]cowboy's [G]running from himself [C]
And [Am]she's been living on the [G]highest shelf [C]

{start_of_chorus}
[Am]Lady, [G]running down to the [C]riptide
Taken away to the [Am]dark side, [G]I wanna be your [C]left hand man
I [Am]love you [G]when you're singing that [C]song and
I got a lump in my [Am]throat 'cause [G]you're gonna sing the words [C]wrong
{end_of_chorus}`
  },
  {
    filename: 'Oasis - Wonderwall.cho',
    chordpro: `{title: Wonderwall}
{artist: Oasis}
{era: 90s}
{tempo: 87}
{time: 4/4}
{key: Em}
{capo: 2}
{duration: 4:18}

{comment: Intro}
[Em7]  [G]  [Dsus4]  [A7sus4]  (x4)

{comment: Verse 1}
[Em7]Today is [G]gonna be the day that they're [Dsus4]gonna throw it back to [A7sus4]you
[Em7]By now you [G]should've somehow rea[Dsus4]lized what you gotta [A7sus4]do
[Em7]I don't believe that [G]anybody [Dsus4]feels the way I [A7sus4]do
About you [Cadd9]now [Dsus4] [A7sus4]

{comment: Verse 2}
[Em7]Backbeat, the [G]word is on the street that the [Dsus4]fire in your heart is [A7sus4]out
[Em7]I'm sure you've [G]heard it all before, but you [Dsus4]never really had a [A7sus4]doubt
[Em7]I don't believe that [G]anybody [Dsus4]feels the way I [A7sus4]do
About you [Em7]now [G] [Dsus4] [A7sus4]

{start_of_bridge}
And [Cadd9]all the roads we [Dsus4]have to walk are [Em7]winding
And [Cadd9]all the lights that [Dsus4]lead us there are [Em7]blinding
[Cadd9]There are many [Dsus4]things that I would [G]like to [D/F#]say to [Em7]you
But I don't know [A7sus4]how
{end_of_bridge}

{start_of_chorus}
Because [Cadd9]maybe, [Em7] [G]
You're [Em7]gonna be the one that [Cadd9]saves me [Em7] [G]
And [Em7]after [Cadd9]all, [Em7] [G]
You're my [Em7]wonder[Cadd9]wall [Em7] [G] [Em7]
{end_of_chorus}`
  }
];

export function getInitialSongs(): Song[] {
  return SAMPLE_CHORDPRO_DATA.map((item, index) => {
    const song = createSongFromChordPro(item.chordpro, `/Music/ChordPro/${item.filename}`, item.filename);
    song.id = `sample_${index + 1}`;
    return song;
  });
}
