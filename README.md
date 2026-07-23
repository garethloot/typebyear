# Tabtype

**Hear it. Type it.**

Audio-first touch typing practice. Words stay hidden — the app speaks one, you type it from memory. Letter colors show how you’re doing as you go.

## Features

- **Audio-only prompts** — practice without reading the target word
- **Live letter feedback** — characters turn correct / incorrect as you type
- **English & Dutch** — switch language before starting a session
- **25-word sessions** — short, focused rounds with accuracy, time-to-type, and CPM
- **Replay anytime** — press `Esc` or `;` to hear the word again
- **Local history** — results are saved in this browser (IndexedDB), with trend charts on the results page

## How to practice

1. Choose **English** or **Nederlands** on the home page
2. Click **Start session**
3. Listen, then type the word
4. Press **Space** or **Enter** to submit
5. Review your summary, then practice again or open **Results** to track progress

| Key | Action |
| --- | --- |
| Letters | Type the word |
| Backspace | Delete last character |
| Space / Enter | Submit |
| Esc / `;` | Replay the spoken word |

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

To deploy, install a [SvelteKit adapter](https://svelte.dev/docs/kit/adapters) for your host if needed (`adapter-auto` is included by default).

## Project layout

```
src/
  routes/           # Home, practice, and results pages
  lib/
    session.svelte.ts   # Session state & scoring
    speech.ts           # TTS helpers
    history.ts          # IndexedDB persistence
    words/              # EN / NL word banks
    components/         # Progress chart
```

## License

Private / unpublished — adjust this section if you open-source the project.
