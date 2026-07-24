# TypeByEar

**Hear it. Type it.**

Audio-first touch typing practice. Words stay hidden — the app speaks one, you type it from memory. Letter colors show how you’re doing as you go.

## Why train this way?

I used to practice on sites that show a line of text to copy. I felt fast — until I typed my own words. Suddenly I was much slower. That gap is what TypeByEar trains.

Real typing is generative: you think a word (or hear one), then produce it on the keyboard without looking it up letter by letter. TypeByEar practices that loop:

- **No peeking** — the target isn’t on screen, so you can’t “cheat” by matching shapes. You have to retrieve the spelling and fire the keys.
- **Closer to real work** — dictation, notes from a call, coding from thought, chat replies: you type from sound or intention, not from a line of text beside the caret.
- **Spelling under pressure** — hearing a word and typing it forces orthography and muscle memory together, instead of letting your eyes carry the spelling for you.
- **Attention on the keyboard feel** — without visual copy to lean on, you’re nudged toward touch typing: listen, trust your hands, glance at feedback only when you need it.
- **Honest speed** — time-to-type starts after the word is spoken. The metric reflects how fast you produce the word, not how fast you can read and mirror it.

Short sessions keep the focus on accuracy and recall, with history so you can see whether that skill is actually improving.

## Features

- **Audio-only prompts** — practice without reading the target word
- **Live letter feedback** — characters turn correct / incorrect as you type
- **English & Dutch** — switch language before starting a session (preference is saved in this browser)
- **Session length** — choose 10, 25, or 50 prompts per round (saved preference)
- **Keys mode** — pick letters, numbers, and symbols on a keyboard; hear a key, type it
- **Slow keys** — drill characters with the slowest hearing→type reaction
- **Replay & peek** — press `Esc` to hear the prompt again; hold `Esc` to briefly show the target
- **Local history** — results are saved in this browser (IndexedDB), with trend charts on the results page

## How to practice

1. Choose **English** or **Nederlands** and a session length on the home page
2. Click **Start session** (words) or **Train keys** (characters)
3. Listen, then type what you heard
4. For words: press **Space** or **Enter** to submit. For keys: typing the character submits.
5. Review your summary, then practice again or open **Results** to track progress

| Key | Action |
| --- | --- |
| Characters | Type the word or key |
| Backspace | Delete last character (words) |
| Space / Enter | Submit (words) |
| Esc | Replay the spoken prompt |
| Hold Esc | Peek at the target while held |

Speech uses the browser’s [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API). If speech isn’t available, you can still practice — wrong answers reveal the word.

## Tech stack

- [SvelteKit](https://svelte.dev/docs/kit) + [Svelte 5](https://svelte.dev)
- TypeScript
- Vite
- IndexedDB for session history

## Developing

```sh
npm install
npm run dev
```

Open the app in a browser (or run `npm run dev -- --open`).

## Building

```sh
npm run build
npm run preview
```

## Live demo

**https://garethloot.github.io/typebyear/**

## Deploy (GitHub Pages)

This app uses [`@sveltejs/adapter-static`](https://svelte.dev/docs/kit/adapter-static) and deploys from `.github/workflows/deploy.yml` on every push to `main`.

Local production build with the same base path:

```sh
BASE_PATH=/typebyear npm run build
BASE_PATH=/typebyear npm run preview
```

## Project layout

```
src/
  routes/           # Home, practice, and results pages
  lib/
    session.svelte.ts   # Session state & scoring
    speech.ts           # TTS helpers
    history.ts          # IndexedDB persistence
    prefs.ts            # Language & session-length preferences
    keys.ts             # Key layouts, presets, slow-key ranking helpers
    words/              # EN / NL word banks
    components/         # Progress chart, key picker, shortcut hints
```

## License

Private / unpublished — adjust this section if you open-source the project.
