<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { onMount, tick } from "svelte";
  import { rankMissedWords } from "$lib/history";
  import { formatTtt, session } from "$lib/session.svelte";
  import { isSpeechAvailable } from "$lib/speech";
  import {
    isLanguage,
    isPracticeMode,
    pickMissedSessionWords,
    type Language,
  } from "$lib/words";

  let speechOk = $state(true);
  let stageEl: HTMLElement | undefined = $state();

  function isReplayKey(event: KeyboardEvent): boolean {
    return (
      event.key === "Escape" ||
      event.code === "Escape" ||
      event.key === ";" ||
      event.code === "Semicolon"
    );
  }

  function onKeydown(event: KeyboardEvent) {
    if (session.phase !== "active") return;

    if (isReplayKey(event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      session.replay();
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      session.backspace();
      return;
    }

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      session.submit();
      return;
    }

    if (
      event.key.length === 1 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      event.preventDefault();
      session.typeChar(event.key.toLowerCase());
    }
  }

  async function focusStage() {
    await tick();
    stageEl?.focus({ preventScroll: true });
  }

  async function startMissedSession(lang: Language) {
    const ranked = await rankMissedWords(lang);
    const words = pickMissedSessionWords(ranked);
    if (words.length === 0) {
      goto("/");
      return false;
    }
    session.start(lang, { words, mode: "missed" });
    return true;
  }

  onMount(() => {
    speechOk = isSpeechAvailable();
    let cancelled = false;

    // Capture on document so Esc isn't lost to other listeners
    document.addEventListener("keydown", onKeydown, true);

    void (async () => {
      const langParam = page.url.searchParams.get("lang");
      if (!isLanguage(langParam)) {
        goto("/");
        return;
      }

      const modeParam = page.url.searchParams.get("mode");
      const mode = isPracticeMode(modeParam) ? modeParam : "random";

      if (mode === "missed") {
        const started = await startMissedSession(langParam);
        if (cancelled || !started) return;
      } else {
        session.start(langParam);
      }

      if (!cancelled) void focusStage();
    })();

    return () => {
      cancelled = true;
      document.removeEventListener("keydown", onKeydown, true);
    };
  });

  async function again() {
    if (session.mode === "missed") {
      const started = await startMissedSession(session.language);
      if (!started) return;
    } else {
      session.start(session.language);
    }
    void focusStage();
  }

  function home() {
    session.reset();
    goto("/");
  }
</script>

<main class="practice">
  <header class="top">
    <a class="brand" href="/" tabindex="-1" onclick={() => session.reset()}
      >TypeByEar</a
    >
    {#if session.phase !== "done"}
      <p class="progress" aria-live="polite">
        {#if session.mode === "missed"}
          <span class="mode-tag">Misspellings</span>
        {/if}
        {session.progress.current} / {session.progress.total}
      </p>
    {/if}
  </header>

  {#if session.phase === "done" && session.summary}
    {@const s = session.summary}
    <section class="summary" aria-labelledby="summary-title">
      <p class="brand-echo">TypeByEar</p>
      <h1 id="summary-title">Session complete</h1>
      {#if s.mode === "missed"}
        <p class="mode-note">Misspellings drill</p>
      {/if}
      <p class="saved" role="status">Saved on this device</p>
      <ul class="stats">
        <li>
          <span class="label">Accuracy</span>
          <span class="value">{s.accuracy}%</span>
          <span class="sub">{s.correct} of {s.total} words</span>
        </li>
        <li>
          <span class="label">TTT</span>
          <span class="value">{formatTtt(s.tttMs)}</span>
          <span class="sub">median time to type</span>
        </li>
        <li>
          <span class="label">CPM</span>
          <span class="value">{s.cpm}</span>
          <span class="sub">median chars / min</span>
        </li>
      </ul>
      {#if session.completed.length > 0}
        <p class="done-words" aria-label="Words from this session">
          {#each session.completed as item, i (i + item.word)}
            <span class={["dw", item.correct ? "ok" : "bad"]}>{item.word}</span>
          {/each}
        </p>
      {/if}
      <div class="actions">
        <button type="button" class="primary" onclick={again}
          >Practice again</button
        >
        <a class="ghost linkish" href="/results">Results</a>
        <button type="button" class="ghost" onclick={home}>Home</button>
      </div>
    </section>
  {:else}
    <section
      class="stage"
      bind:this={stageEl}
      tabindex="-1"
      aria-label="Typing practice"
    >
      {#if !speechOk}
        <p class="warn" role="status">
          Speech unavailable — type by ear if you can, or wait for the reveal.
        </p>
      {/if}

      {#if session.completed.length > 0}
        <p class="history" aria-live="polite" aria-label="Revealed words">
          {#each session.completed as item, i (i + item.word)}
            <span class={["hw", item.correct ? "ok" : "bad"]}>{item.word}</span>
          {/each}
        </p>
      {/if}

      <p class="typed" aria-live="polite">
        {#if session.input.length === 0}
          <span class="caret" aria-hidden="true"></span>
          <span class="placeholder">type what you hear</span>
        {:else}
          {#each session.charStatuses as status, i (session.index + "-" + i + "-" + session.input[i])}
            <span class={["ch", status]}>{session.input[i]}</span>
          {/each}
          <span class="caret" aria-hidden="true"></span>
        {/if}
      </p>

      <div class="bar">
        <button
          type="button"
          class="replay"
          tabindex="-1"
          onclick={() => session.replay()}
        >
          Hear again
        </button>
        <span class="keys">Space / Enter · Esc / ` / ; to hear again</span>
      </div>
    </section>
  {/if}
</main>

<style>
  .practice {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    padding: clamp(1.25rem, 4vw, 2.5rem);
  }

  .top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
  }

  .brand {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--teal-deep);
    text-decoration: none;
  }

  .progress {
    margin: 0;
    font-variant-numeric: tabular-nums;
    color: var(--ink-soft);
    font-size: 0.95rem;
    display: flex;
    align-items: baseline;
    gap: 0.55rem;
  }

  .mode-tag {
    font-size: 0.8rem;
    color: var(--teal-deep);
    opacity: 0.85;
  }

  .mode-note {
    margin: 0 0 0.35rem;
    font-size: 0.9rem;
    color: var(--teal-deep);
  }

  .stage {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.75rem;
    text-align: center;
    outline: none;
  }

  .warn {
    margin: 0;
    max-width: 28rem;
    color: var(--incorrect);
    font-size: 0.95rem;
  }

  .history,
  .done-words {
    margin: 0;
    max-width: min(40rem, 100%);
    font-family: var(--font-mono);
    font-size: clamp(0.95rem, 2.2vw, 1.15rem);
    line-height: 1.7;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.35rem 0.85rem;
    animation: rise 0.35s ease-out;
  }

  .hw.ok,
  .dw.ok {
    color: color-mix(in srgb, var(--ink-soft) 75%, var(--correct));
  }

  .hw.bad,
  .dw.bad {
    color: var(--incorrect);
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 0.18em;
  }

  .typed {
    margin: 0;
    min-height: 3.5rem;
    font-family: var(--font-mono);
    font-size: clamp(2rem, 6vw, 3.25rem);
    font-weight: 500;
    letter-spacing: 0.04em;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 0.05em;
  }

  .placeholder {
    font-family: var(--font-body);
    font-size: 1.1rem;
    font-weight: 400;
    letter-spacing: 0;
    color: color-mix(in srgb, var(--ink-soft) 70%, transparent);
  }

  .ch.correct {
    color: var(--correct);
  }

  .ch.incorrect {
    color: var(--incorrect);
  }

  .caret {
    display: inline-block;
    width: 0.12em;
    height: 1.05em;
    margin-left: 0.05em;
    background: var(--teal);
    animation: blink 1s steps(1) infinite;
    vertical-align: text-bottom;
  }

  .bar {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .replay {
    border: 1px solid color-mix(in srgb, var(--teal) 40%, transparent);
    background: var(--surface);
    color: var(--teal-deep);
    padding: 0.65rem 1.25rem;
    border-radius: 0.35rem;
    font-weight: 600;
    backdrop-filter: blur(6px);
    transition: background 0.2s ease;
  }

  .replay:hover {
    background: color-mix(in srgb, white 70%, var(--mist));
  }

  .keys {
    font-size: 0.85rem;
    color: var(--ink-soft);
  }

  .summary {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    max-width: 28rem;
    margin: 0 auto;
    animation: rise 0.55s ease-out;
  }

  .brand-echo {
    font-family: var(--font-display);
    font-size: 2rem;
    font-weight: 700;
    color: var(--teal-deep);
    margin: 0 0 0.5rem;
  }

	.summary h1 {
		font-family: var(--font-display);
		font-weight: 500;
		font-size: 1.5rem;
		margin: 0 0 0.5rem;
	}

	.saved {
		margin: 0 0 1.5rem;
		font-size: 0.9rem;
		color: var(--ink-soft);
	}

	.stats {
    list-style: none;
    margin: 0 0 1.5rem;
    padding: 0;
    display: grid;
    gap: 1.5rem;
  }

  .stats li {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    column-gap: 1rem;
    align-items: baseline;
  }

  .label {
    grid-column: 1;
    color: var(--ink-soft);
    font-size: 0.95rem;
  }

  .value {
    grid-column: 2;
    grid-row: 1 / span 2;
    font-family: var(--font-display);
    font-size: 2.75rem;
    font-weight: 700;
    color: var(--teal-deep);
    line-height: 1;
  }

  .sub {
    grid-column: 1;
    font-size: 0.9rem;
    color: var(--ink-soft);
  }

  .done-words {
    margin: 0 0 2rem;
    justify-content: flex-start;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .primary,
  .ghost {
    padding: 0.75rem 1.35rem;
    border-radius: 0.4rem;
    font-weight: 600;
  }

  .primary {
    border: none;
    background: var(--teal-deep);
    color: #f4fbfa;
  }

  .ghost {
    border: 1px solid color-mix(in srgb, var(--teal) 40%, transparent);
    background: transparent;
    color: var(--teal-deep);
  }

  a.ghost.linkish {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
    padding: 0.75rem 1.35rem;
    border-radius: 0.4rem;
    font-weight: 600;
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(0.5rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
