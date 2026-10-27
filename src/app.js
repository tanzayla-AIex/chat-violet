(function () {
const { allCards, allSets } = window.FrenchVocab;
const {
  formatTime,
  checkAnswer,
  isCorrect,
  isStarred,
  lettersOf,
  loadProgress,
  markResult,
  masteredCount,
  sampleWrong,
  shuffle,
  speak,
  starredCount,
  toggleStar,
} = window.FrenchUtils;

const MODES = [
  { id: "translate", label: "Translate", hint: "French sentences → type the English" },
  { id: "flash", label: "Flashcards", hint: "Flip through the deck" },
  { id: "learn", label: "Learn", hint: "Multiple choice, then writing" },
  { id: "write", label: "Write", hint: "Type each translation" },
  { id: "spell", label: "Spell", hint: "Listen and spell in French" },
  { id: "match", label: "Match", hint: "Tap matching pairs against the clock" },
  { id: "gravity", label: "Gravity", hint: "Type before the word hits the ground" },
  { id: "blocks", label: "Blocks", hint: "Tap letters in order to spell" },
  { id: "test", label: "Test", hint: "Mixed quiz with a score" },
];

const MIX_KEY = "french-ib-mix-v1";

function loadExcluded() {
  try {
    const raw = JSON.parse(localStorage.getItem(MIX_KEY) || "[]");
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

function saveExcluded(ids) {
  localStorage.setItem(MIX_KEY, JSON.stringify([...ids]));
}

const root = document.getElementById("root");

const state = {
  query: "",
  setId: null,
  mode: null,
  direction: "en-fr",
  progress: loadProgress(),
  listOpen: true,
  starredOnly: false,
  session: null,
  excluded: loadExcluded(),
};

window.speechSynthesis?.getVoices();

function includedSets() {
  const picked = allSets.filter((s) => !state.excluded.has(s.id));
  return picked.length ? picked : allSets;
}

function mixedSet() {
  const source = includedSets();
  const cards = source.flatMap((s) => s.cards.map((c) => ({ ...c, setTitle: s.title })));
  const skipped = allSets.length - source.length;
  return {
    id: "all",
    title: "Everything",
    subtitle: `${cards.length} terms from ${source.length} group${source.length === 1 ? "" : "s"}`,
    blurb: skipped
      ? `Mixed review with ${source.length} of ${allSets.length} groups. Uncheck anything you already know.`
      : "Every set in one deck. Uncheck groups you don’t want — for example, skip numbers.",
    accent: "#1a2744",
    cards,
  };
}

function currentSet() {
  if (state.setId === "all") return mixedSet();
  return allSets.find((s) => s.id === state.setId) || null;
}

function deckCards(set) {
  if (!state.starredOnly) return set.cards;
  const starred = set.cards.filter((c) => isStarred(state.progress, c.id));
  return starred.length ? starred : set.cards;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(inner) {
  return `<div class="app"><div class="shell">
    <button class="brand" data-home type="button"><span>FR</span><em>ab initio</em></button>
    ${inner}
  </div></div>`;
}

function endActions() {
  return `<div class="mode-actions">
    <button class="primary" data-replay>Study again</button>
    <button class="ghost" data-exit-mode>Back to set</button>
  </div>`;
}

function render() {
  const set = currentSet();
  if (set && state.mode) renderMode(set);
  else if (set) renderSet(set);
  else renderHome();
  bind();
}

function renderHome() {
  const q = state.query.trim().toLowerCase();
  const filtered = allSets.filter(
    (s) =>
      !q ||
      s.title.toLowerCase().includes(q) ||
      s.subtitle.toLowerCase().includes(q) ||
      s.cards.some((c) => c.en.toLowerCase().includes(q) || c.fr.toLowerCase().includes(q))
  );
  const totalMastered = masteredCount(allCards, state.progress);
  root.innerHTML = shell(`
    <header class="home-hero">
      <p class="eyebrow">IB French ab initio</p>
      <h1>Étudier le français</h1>
      <p class="lede">Quizlet-style practice plus a Translate mode: French phrases into English. Flashcards, learn, write, spell, match, gravity, blocks, and tests cover classroom objects, alphabet, greetings, colours, numbers, calendar, weather, family, opposites, and avoir / être.</p>
      <p class="count">${allCards.length} terms in ${allSets.length} sets · ${totalMastered} mastered</p>
      <input class="search" id="search" placeholder="Search a set or a word…" value="${esc(state.query)}" />
    </header>
    <button class="all-cta" data-open-translate>
      <strong>Translate French → English</strong>
      <span>Read a sentence in French, then type it in English</span>
    </button>
    <button class="all-cta" data-open="all">
      <strong>Study everything</strong>
      <span>${mixedSet().cards.length} cards in a mixed deck · choose which groups to include</span>
    </button>
    <div class="set-grid">
      ${filtered
        .map((s) => {
          const m = masteredCount(s.cards, state.progress);
          return `<button class="set-card" data-open="${s.id}">
            <i style="background:${s.accent}"></i>
            <h2>${esc(s.title)}</h2>
            <p>${esc(s.subtitle)}</p>
            <small>${s.cards.length} terms${m ? ` · ${m} mastered` : ""}</small>
          </button>`;
        })
        .join("")}
    </div>
    ${filtered.length === 0 ? `<p class="empty">No sets match that search.</p>` : ""}
  `);
}

function renderSet(set) {
  const mastered = masteredCount(set.cards, state.progress);
  const stars = starredCount(set.cards, state.progress);
  root.innerHTML = shell(`
    <button class="ghost back" data-home>← All sets</button>
    <div class="set-hero" style="--accent:${set.accent}">
      <p class="eyebrow">${esc(set.subtitle)}</p>
      <h1>${esc(set.title)}</h1>
      <p class="lede">${esc(set.blurb)}</p>
      <p class="count">${set.cards.length} terms · ${mastered} looking solid${stars ? ` · ${stars} starred` : ""}</p>
      <div class="dir">
        <span>Answer in</span>
        <button class="chip ${state.direction === "en-fr" ? "on" : ""}" data-dir="en-fr">French</button>
        <button class="chip ${state.direction === "fr-en" ? "on" : ""}" data-dir="fr-en">English</button>
        ${
          stars
            ? `<button class="chip ${state.starredOnly ? "on" : ""}" data-starred-only>★ Starred (${stars})</button>`
            : ""
        }
      </div>
    </div>
    <div class="modes">
      ${MODES.map(
        (m) => `<button class="mode-tile" data-mode="${m.id}">
          <strong>${m.label}</strong><span>${m.hint}</span>
        </button>`
      ).join("")}
    </div>
    ${
      set.id === "all"
        ? `<div class="mix-panel">
            <div class="mix-head">
              <div>
                <strong>Groups in this mix</strong>
                <p>${includedSets().length} of ${allSets.length} selected · tap to include or skip</p>
              </div>
              <div class="mix-tools">
                <button class="ghost" data-mix-all>Select all</button>
                <button class="ghost" data-mix-invert>Invert</button>
              </div>
            </div>
            <div class="mix-grid">
              ${allSets
                .map((s) => {
                  const on = !state.excluded.has(s.id);
                  return `<button class="mix-chip ${on ? "on" : ""}" data-mix="${s.id}" type="button">
                    <i style="background:${s.accent}"></i>
                    <b>${esc(s.title)}</b>
                    <small>${s.cards.length}</small>
                  </button>`;
                })
                .join("")}
            </div>
          </div>`
        : ""
    }
    <button class="ghost" data-toggle-list>${state.listOpen ? "Hide terms" : "Show terms"}</button>
    ${
      state.listOpen
        ? `<table class="terms"><thead><tr><th></th><th>English</th><th>Français</th><th></th></tr></thead>
      <tbody>${set.cards
        .map(
          (c) => `<tr>
            <td><button class="star ${isStarred(state.progress, c.id) ? "on" : ""}" data-star="${c.id}" aria-label="Star">★</button></td>
            <td>${esc(c.en)}</td>
            <td><b>${esc(c.fr)}</b>${c.note ? `<small>${esc(c.note)}</small>` : ""}</td>
            <td><button class="icon-btn" data-speak="${esc(c.fr)}">🔊</button></td>
          </tr>`
        )
        .join("")}</tbody></table>`
        : ""
    }
  `);
}

function startMode(mode, set) {
  const cards = shuffle(deckCards(set));
  const dir = mode === "translate" ? "fr-en" : state.direction;
  const promptOf = (c) => (dir === "fr-en" ? c.fr : c.en);
  const answerOf = (c) => (dir === "fr-en" ? c.en : c.fr);
  const answerSide = dir === "fr-en" ? "en" : "fr";

  if (mode === "flash") {
    state.session = { mode, cards, i: 0, flipped: false, known: new Set() };
  } else if (mode === "learn") {
    state.session = {
      mode,
      cards,
      queue: [...cards],
      done: [],
      typed: "",
      choice: null,
      feedback: null,
    };
  } else if (mode === "write" || mode === "spell" || mode === "translate") {
    state.session = { mode, cards, i: 0, typed: "", feedback: null, right: 0, wrong: 0 };
  } else if (mode === "match") {
    const pool = shuffle(cards).slice(0, Math.min(8, cards.length));
    const tiles = shuffle(
      pool.flatMap((c) => [
        { key: `${c.id}-en`, pair: c.id, text: c.en, side: "en" },
        { key: `${c.id}-fr`, pair: c.id, text: c.fr, side: "fr" },
      ])
    );
    state.session = {
      mode,
      pool,
      tiles,
      selected: null,
      matched: new Set(),
      wrong: [],
      started: Date.now(),
      finished: null,
      now: Date.now(),
    };
    startMatchClock();
  } else if (mode === "gravity") {
    state.session = {
      mode,
      cards,
      i: 0,
      lives: 3,
      score: 0,
      typed: "",
      falling: true,
      miss: false,
    };
  } else if (mode === "blocks") {
    state.session = makeBlocksSession(cards, 0, answerOf);
    state.session.cards = cards;
    state.session.right = 0;
    state.session.wrong = 0;
  } else if (mode === "test") {
    const n = Math.min(cards.length, 12);
    const picked = shuffle(cards).slice(0, n);
    const questions = [];
    if (cards.length >= 4) {
      questions.push({
        kind: "pair",
        items: shuffle(cards).slice(0, 4),
        links: {},
        pick: null,
      });
    }
    picked.forEach((card, idx) => {
      const kind = ["mc", "tf", "write"][idx % 3];
      if (kind === "mc") {
        const wrong = sampleWrong(cards, card, 3).map((c) => answerOf(c));
        questions.push({ kind, card, options: shuffle([answerOf(card), ...wrong]) });
      } else if (kind === "tf") {
        const shownCard = Math.random() > 0.45 ? card : sampleWrong(cards, card, 1)[0] || card;
        questions.push({
          kind,
          card,
          shown: answerOf(shownCard),
          truth: shownCard.id === card.id,
        });
      } else {
        questions.push({ kind, card });
      }
    });
    state.session = { mode, questions, i: 0, typed: "", answers: {}, review: false };
  }
  state.session.promptOf = promptOf;
  state.session.answerOf = answerOf;
  state.session.answerSide = answerSide;
  state.session.setId = set.id;
  state.mode = mode;
  render();
}

function makeBlocksSession(cards, i, answerOf) {
  const card = cards[i];
  const target = answerOf(card);
  const chars = lettersOf(target);
  const tiles = shuffle(chars.map((ch, idx) => ({ id: `${idx}-${ch}`, ch })));
  return {
    mode: "blocks",
    i,
    card,
    target,
    tiles,
    built: [],
    feedback: null,
  };
}

let matchTimer = null;
function startMatchClock() {
  clearInterval(matchTimer);
  matchTimer = setInterval(() => {
    if (!state.session || state.session.mode !== "match" || state.session.finished) {
      clearInterval(matchTimer);
      return;
    }
    state.session.now = Date.now();
    const meta = document.querySelector(".mode-meta");
    if (meta) meta.textContent = `Match · ${formatTime(state.session.now - state.session.started)}`;
  }, 200);
}

function renderMode(set) {
  const s = state.session;
  if (!s) return;
  const bar = (label) => `
    <header class="mode-bar">
      <button class="ghost" data-exit-mode>← Back</button>
      <div class="mode-meta">${label}</div>
      <span></span>
    </header>`;

  if (s.mode === "flash") {
    const card = s.cards[s.i];
    const front = state.direction === "fr-en" ? card.fr : card.en;
    const back = state.direction === "fr-en" ? card.en : card.fr;
    const starred = isStarred(state.progress, card.id);
    root.innerHTML = shell(`
      ${bar(`Flashcards · ${s.i + 1} / ${s.cards.length}${s.known.size ? ` · ${s.known.size} known` : ""}`)}
      <div class="progress-line"><span style="width:${((s.i + 1) / s.cards.length) * 100}%"></span></div>
      <div class="flash-stage">
        <button class="flash ${s.flipped ? "is-flipped" : ""}" data-flip>
          <div class="flash-inner">
            <div class="flash-face flash-front">
              <span class="tag">${state.direction === "fr-en" ? "Français" : "English"}</span>
              <p>${esc(front)}</p>
              ${card.note && !s.flipped ? `<small>${esc(card.note)}</small>` : ""}
            </div>
            <div class="flash-face flash-back">
              <span class="tag">${state.direction === "fr-en" ? "English" : "Français"}</span>
              <p>${esc(back)}</p>
              ${card.note ? `<small>${esc(card.note)}</small>` : ""}
            </div>
          </div>
        </button>
      </div>
      <div class="mode-actions">
        <button class="ghost" data-flash-step="-1">← Prev</button>
        <button class="icon-btn" data-speak="${esc(card.fr)}">🔊</button>
        <button class="star ${starred ? "on" : ""}" data-star="${card.id}">★</button>
        <button class="${s.known.has(card.id) ? "primary" : "ghost"}" data-know>${s.known.has(card.id) ? "Known ✓" : "I know this"}</button>
        <button class="ghost" data-shuffle-flash>Shuffle</button>
        <button class="ghost" data-flash-step="1">Next →</button>
      </div>
      <p class="hint center">Space or click to flip · arrows to move</p>
    `);
    return;
  }

  if (s.mode === "learn") {
    if (!s.queue.length) {
      root.innerHTML = shell(
        `<div class="mode end-card"><h2>Set complete</h2><p>You worked through all ${s.cards.length} terms in Learn mode.</p>${endActions()}</div>`
      );
      return;
    }
    const card = s.queue[0];
    const stats = state.progress[card.id] || { right: 0 };
    const useWrite = stats.right >= 1;
    const answer = s.answerOf(card);
    if (!s.options || s.optionsFor !== card.id || s.optionsWrite !== useWrite) {
      if (!useWrite) {
        const wrong = sampleWrong(s.cards, card, 3).map((c) => s.answerOf(c));
        s.options = shuffle([answer, ...wrong]);
      } else s.options = [];
      s.optionsFor = card.id;
      s.optionsWrite = useWrite;
    }
    root.innerHTML = shell(`
      ${bar(`Learn · ${s.done.length} mastered · ${s.queue.length} left`)}
      <div class="progress-line"><span style="width:${(s.done.length / s.cards.length) * 100}%"></span></div>
      <div class="prompt-card">
        <span class="tag">${state.direction === "fr-en" ? "Français" : "English"}</span>
        <h2>${esc(s.promptOf(card))}</h2>
        ${card.note ? `<p class="note">${esc(card.note)}</p>` : ""}
        <button class="icon-btn" data-speak="${esc(card.fr)}">🔊 Hear French</button>
      </div>
      ${
        useWrite
          ? `<form class="write-form" data-learn-write>
              <label>Type the ${s.answerSide === "fr" ? "French (include un/une or le/la)" : "English"}
                <input id="typed" value="${esc(s.typed)}" ${s.feedback ? "disabled" : ""} autocomplete="off" autocapitalize="off" />
              </label>
              ${s.feedback ? "" : `<button class="primary" type="submit">Check</button>`}
            </form>`
          : `<div class="choices">${s.options
              .map((opt) => {
                let cls = "choice";
                if (s.feedback) {
                  if (String(opt).toLowerCase() === String(answer).toLowerCase()) cls += " correct";
                  else if (opt === s.choice) cls += " wrong";
                }
                return `<button class="${cls}" data-learn-pick="${esc(opt)}" ${s.feedback ? "disabled" : ""}>${esc(opt)}</button>`;
              })
              .join("")}</div>`
      }
      ${
        s.feedback
          ? `<div class="feedback ${s.feedback.ok ? "ok" : "no"}">
              <strong>${s.feedback.ok ? "Correct" : "Not quite"}</strong>
              <p>${
                s.feedback.ok
                  ? "Nice."
                  : `${s.feedback.gender ? "Watch the gender: un/le masculine, une/la feminine. " : ""}Answer: ${esc(answer)}`
              }</p>
              <button class="primary" data-learn-next>Continue</button>
            </div>`
          : ""
      }
    `);
    const input = document.getElementById("typed");
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
    return;
  }

  if (s.mode === "write" || s.mode === "spell" || s.mode === "translate") {
    if (s.i >= s.cards.length) {
      const total = s.right + s.wrong;
      const title = s.mode === "spell" ? "Spelling" : s.mode === "translate" ? "Translation" : "Writing";
      root.innerHTML = shell(
        `<div class="mode end-card"><h2>${title} round done</h2><p>${s.right} / ${total} correct</p>${endActions()}</div>`
      );
      return;
    }
    const card = s.cards[s.i];
    const modeLabel = s.mode === "spell" ? "Spell" : s.mode === "translate" ? "Translate" : "Write";
    root.innerHTML = shell(`
      ${bar(`${modeLabel} · ${s.i + 1} / ${s.cards.length}`)}
      <div class="progress-line"><span style="width:${(s.i / s.cards.length) * 100}%"></span></div>
      ${
        s.mode === "spell"
          ? `<div class="prompt-card spell-prompt">
              <p class="note">Listen, then type the French you hear.</p>
              <button class="primary big" data-speak="${esc(card.fr)}">🔊 Play audio</button>
              <p class="hint">Hint: ${esc(card.en)}</p>
            </div>`
          : `<div class="prompt-card">
              <span class="tag">${s.mode === "translate" ? "Translate into English" : state.direction === "fr-en" ? "Français" : "English"}</span>
              <h2>${esc(s.promptOf(card))}</h2>
              ${card.note && s.mode !== "translate" ? `<p class="note">${esc(card.note)}</p>` : ""}
              ${s.mode === "translate" ? `<button class="icon-btn" data-speak="${esc(card.fr)}">🔊 Hear French</button>` : ""}
            </div>`
      }
      <form class="write-form" data-write>
        <label>${s.mode === "spell" ? "Type what you hear (include un/une or le/la)" : `Type the ${s.answerSide === "fr" ? "French (include un/une or le/la)" : "English"}`}
          <input id="typed" value="${esc(s.typed)}" ${s.feedback ? "disabled" : ""} autocomplete="off" autocapitalize="off" />
        </label>
        <button class="primary" type="submit">${s.feedback ? "Next" : "Check"}</button>
      </form>
      ${
        s.feedback
          ? `<div class="feedback ${s.feedback.ok ? "ok" : "no"}">
              <strong>${s.feedback.ok ? "Correct" : s.feedback.gender ? "Check the gender" : "Answer"}</strong>
              <p>${s.feedback.gender && !s.feedback.ok ? "un/le = masculine, une/la = feminine. " : ""}${esc(s.feedback.answer)} <button class="icon-btn" data-speak="${esc(card.fr)}">🔊</button></p>
            </div>`
          : ""
      }
    `);
    document.getElementById("typed")?.focus();
    return;
  }

  if (s.mode === "match") {
    const elapsed = (s.finished || s.now) - s.started;
    if (s.finished) {
      const stars = elapsed < 25000 ? "★★★" : elapsed < 45000 ? "★★☆" : "★☆☆";
      root.innerHTML = shell(`
        ${bar(`Match · ${formatTime(elapsed)}`)}
        <div class="end-card">
          <h2>${stars}</h2>
          <p>Matched ${s.pool.length} pairs in ${formatTime(elapsed)}.</p>
          ${endActions()}
        </div>`);
      return;
    }
    root.innerHTML = shell(`
      ${bar(`Match · ${formatTime(elapsed)}`)}
      <div class="match-grid">
        ${s.tiles
          .map((tile) => {
            const on = s.selected?.key === tile.key ? "on" : "";
            const matched = s.matched.has(tile.pair) ? "matched" : "";
            const miss = s.wrong.includes(tile.key) ? "miss" : "";
            return `<button class="match-tile ${on} ${matched} ${miss} ${tile.side}" data-match="${tile.key}" ${s.matched.has(tile.pair) ? "disabled" : ""}>${esc(tile.text)}</button>`;
          })
          .join("")}
      </div>
    `);
    return;
  }

  if (s.mode === "gravity") {
    if (s.lives <= 0 || s.i >= s.cards.length) {
      root.innerHTML = shell(`
        <div class="end-card">
          <h2>Gravity over</h2>
          <p>Score ${s.score} · ${s.lives > 0 ? "You cleared the round." : "The words hit the ground."}</p>
          ${endActions()}
        </div>`);
      return;
    }
    const card = s.cards[s.i];
    const duration = Math.max(4.2, 8.5 - s.i * 0.12);
    s.fallId = (s.fallId || 0) + 1;
    const fallId = s.fallId;
    root.innerHTML = shell(`
      ${bar(`Gravity · ${s.score} pts · ${"♥".repeat(s.lives)}${"♡".repeat(3 - s.lives)}`)}
      <div class="gravity-stage">
        <div class="falling" id="falling" data-fall="${fallId}" style="animation-duration:${duration}s">
          <span class="tag">${state.direction === "fr-en" ? "Français" : "English"}</span>
          <p>${esc(s.promptOf(card))}</p>
        </div>
        <div class="ground"></div>
      </div>
      <form class="write-form" data-gravity>
        <label>Type the ${s.answerSide === "fr" ? "French" : "English"}
          <input id="typed" autocomplete="off" autocapitalize="off" />
        </label>
        <button class="primary" type="submit">Enter</button>
      </form>
    `);
    document.getElementById("typed")?.focus();
    document.getElementById("falling")?.addEventListener("animationend", () => {
      if (state.session?.fallId === fallId) gravityMiss();
    });
    return;
  }

  if (s.mode === "blocks") {
    if (s.i >= s.cards.length) {
      root.innerHTML = shell(
        `<div class="end-card"><h2>Blocks complete</h2><p>${s.right} / ${s.right + s.wrong} spelled correctly</p>${endActions()}</div>`
      );
      return;
    }
    const used = new Set(s.built.map((t) => t.id));
    root.innerHTML = shell(`
      ${bar(`Blocks · ${s.i + 1} / ${s.cards.length}`)}
      <div class="progress-line"><span style="width:${(s.i / s.cards.length) * 100}%"></span></div>
      <div class="prompt-card">
        <span class="tag">Spell ${s.answerSide === "fr" ? "the French" : "the English"}</span>
        <h2>${esc(s.promptOf(s.card))}</h2>
        ${s.card.note ? `<p class="note">${esc(s.card.note)}</p>` : ""}
      </div>
      <div class="built">${s.built.map((t) => `<span>${esc(t.ch)}</span>`).join("") || `<em>Tap letters below</em>`}</div>
      <div class="blocks">
        ${s.tiles
          .map((t) =>
            used.has(t.id)
              ? `<button class="block used" disabled>${esc(t.ch)}</button>`
              : `<button class="block" data-block="${esc(t.id)}">${esc(t.ch)}</button>`
          )
          .join("")}
      </div>
      <div class="mode-actions">
        <button class="ghost" data-blocks-undo ${s.built.length ? "" : "disabled"}>Undo</button>
        <button class="ghost" data-blocks-clear>Clear</button>
        <button class="icon-btn" data-speak="${esc(s.card.fr)}">🔊</button>
      </div>
      ${
        s.feedback
          ? `<div class="feedback ${s.feedback.ok ? "ok" : "no"}">
              <strong>${s.feedback.ok ? "Correct" : "Answer"}</strong>
              <p>${esc(s.target)}</p>
              <button class="primary" data-blocks-next>Continue</button>
            </div>`
          : ""
      }
    `);
    return;
  }

  if (s.mode === "test") {
    if (s.review) {
      let score = 0;
      let total = 0;
      const rows = s.questions.map((q, idx) => {
        const a = s.answers[idx];
        if (q.kind === "pair") {
          const parts = q.items.map((c) => {
            const picked = a?.[c.id];
            const ok = picked === s.answerOf(c);
            total += 1;
            if (ok) score += 1;
            return { c, picked, ok };
          });
          return { q, parts, pair: true };
        }
        let ok = false;
        if (q.kind === "mc") ok = a === s.answerOf(q.card);
        if (q.kind === "tf") ok = a === q.truth;
        if (q.kind === "write") ok = isCorrect(a || "", q.card, s.answerSide);
        total += 1;
        if (ok) score += 1;
        return { q, a, ok, pair: false };
      });
      root.innerHTML = shell(`
        ${bar(`Test results · ${score} / ${total}`)}
        <div class="score-ring">
          <strong>${total ? Math.round((score / total) * 100) : 0}%</strong>
          <span>${score} of ${total} correct</span>
        </div>
        <ul class="review-list">
          ${rows
            .map((row) => {
              if (row.pair) {
                return row.parts
                  .map(
                    ({ c, picked, ok }) => `<li class="${ok ? "ok" : "no"}">
                    <div><b>${esc(c.en)}</b><span> — ${esc(c.fr)}</span></div>
                    <small>${ok ? "Matched" : `You matched: ${esc(String(picked ?? "—"))}`}</small>
                    <button class="icon-btn" data-speak="${esc(c.fr)}">🔊</button>
                  </li>`
                  )
                  .join("");
              }
              const { q, a, ok } = row;
              return `<li class="${ok ? "ok" : "no"}">
                <div><b>${esc(q.card.en)}</b><span> — ${esc(q.card.fr)}</span></div>
                <small>${ok ? "Correct" : `Your answer: ${esc(String(a ?? "—"))}`}</small>
                <button class="icon-btn" data-speak="${esc(q.card.fr)}">🔊</button>
              </li>`;
            })
            .join("")}
        </ul>
        ${endActions()}
      `);
      return;
    }
    const q = s.questions[s.i];
    if (q.kind === "pair") {
      const left = q.items;
      const right = q.rightOrder || (q.rightOrder = shuffle(q.items.map((c) => s.answerOf(c))));
      root.innerHTML = shell(`
        ${bar(`Test · matching · ${s.i + 1} / ${s.questions.length}`)}
        <p class="hint">Match each English term with the French.</p>
        <div class="pair-grid">
          <div class="pair-col">
            ${left
              .map((c) => {
                const done = q.links[c.id];
                return `<button class="match-tile ${q.pick === c.id ? "on" : ""} ${done ? "matched" : ""}" data-pair-left="${c.id}" ${done ? "disabled" : ""}>${esc(c.en)}</button>`;
              })
              .join("")}
          </div>
          <div class="pair-col">
            ${right
              .map((text) => {
                const taken = Object.values(q.links).includes(text);
                return `<button class="match-tile fr ${taken ? "matched" : ""}" data-pair-right="${esc(text)}" ${taken ? "disabled" : ""}>${esc(text)}</button>`;
              })
              .join("")}
          </div>
        </div>
      `);
      return;
    }
    root.innerHTML = shell(`
      ${bar(`Test · ${s.i + 1} / ${s.questions.length}`)}
      <div class="progress-line"><span style="width:${(s.i / s.questions.length) * 100}%"></span></div>
      <div class="prompt-card">
        ${
          q.kind === "mc"
            ? `<span class="tag">Multiple choice</span><h2>${esc(s.promptOf(q.card))}</h2>
               <div class="choices">${q.options.map((opt) => `<button class="choice" data-test-save="${esc(opt)}">${esc(opt)}</button>`).join("")}</div>`
            : q.kind === "tf"
            ? `<span class="tag">True or false</span><h2>${esc(s.promptOf(q.card))}</h2>
               <p class="tf-pair">= ${esc(q.shown)}</p>
               <div class="mode-actions">
                 <button class="primary" data-test-tf="true">True</button>
                 <button class="ghost" data-test-tf="false">False</button>
               </div>`
            : `<span class="tag">Written</span><h2>${esc(s.promptOf(q.card))}</h2>
               <form class="write-form" data-test-write>
                 <label>${s.answerSide === "fr" ? "French" : "English"}<input id="typed" value="${esc(s.typed)}" autocomplete="off" autocapitalize="off" /></label>
                 <button class="primary" type="submit">Next</button>
               </form>`
        }
      </div>
    `);
    document.getElementById("typed")?.focus();
  }
}

function gravityMiss() {
  const s = state.session;
  if (!s || s.mode !== "gravity" || !s.falling) return;
  s.falling = false;
  s.lives -= 1;
  s.i += 1;
  s.falling = true;
  s.typed = "";
  render();
}

function bind() {
  root.querySelector("#search")?.addEventListener("input", (e) => {
    state.query = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const again = document.getElementById("search");
    if (again) {
      again.focus();
      again.setSelectionRange(pos, pos);
    }
  });
  bindHome();

  root.querySelectorAll("[data-home]").forEach((el) =>
    el.addEventListener("click", () => {
      clearInterval(matchTimer);
      state.setId = null;
      state.mode = null;
      state.session = null;
      render();
    })
  );
  root.querySelectorAll("[data-dir]").forEach((el) =>
    el.addEventListener("click", () => {
      state.direction = el.dataset.dir;
      render();
    })
  );
  root.querySelectorAll("[data-mix]").forEach((el) =>
    el.addEventListener("click", () => {
      const id = el.dataset.mix;
      if (state.excluded.has(id)) state.excluded.delete(id);
      else {
        if (state.excluded.size >= allSets.length - 1) return;
        state.excluded.add(id);
      }
      saveExcluded(state.excluded);
      render();
    })
  );
  root.querySelector("[data-mix-all]")?.addEventListener("click", () => {
    state.excluded = new Set();
    saveExcluded(state.excluded);
    render();
  });
  root.querySelector("[data-mix-invert]")?.addEventListener("click", () => {
    const next = new Set(allSets.filter((s) => !state.excluded.has(s.id)).map((s) => s.id));
    if (next.size >= allSets.length) next.delete(allSets[0].id);
    state.excluded = next;
    saveExcluded(state.excluded);
    render();
  });
  root.querySelector("[data-starred-only]")?.addEventListener("click", () => {
    state.starredOnly = !state.starredOnly;
    render();
  });
  root.querySelectorAll("[data-mode]").forEach((el) =>
    el.addEventListener("click", () => startMode(el.dataset.mode, currentSet()))
  );
  root.querySelector("[data-toggle-list]")?.addEventListener("click", () => {
    state.listOpen = !state.listOpen;
    render();
  });
  root.querySelectorAll("[data-speak]").forEach((el) =>
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      speak(el.dataset.speak);
    })
  );
  root.querySelectorAll("[data-star]").forEach((el) =>
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      state.progress = toggleStar(state.progress, el.dataset.star);
      render();
    })
  );
  root.querySelector("[data-exit-mode]")?.addEventListener("click", () => {
    clearInterval(matchTimer);
    state.mode = null;
    state.session = null;
    render();
  });
  root.querySelector("[data-replay]")?.addEventListener("click", () => {
    const set = currentSet();
    if (set && state.mode) startMode(state.mode, set);
  });

  const s = state.session;
  root.querySelector("[data-flip]")?.addEventListener("click", () => {
    s.flipped = !s.flipped;
    render();
  });
  root.querySelectorAll("[data-flash-step]").forEach((el) =>
    el.addEventListener("click", () => {
      const d = Number(el.dataset.flashStep);
      s.flipped = false;
      s.i = (s.i + d + s.cards.length) % s.cards.length;
      render();
    })
  );
  root.querySelector("[data-shuffle-flash]")?.addEventListener("click", () => {
    s.cards = shuffle(s.cards);
    s.i = 0;
    s.flipped = false;
    render();
  });
  root.querySelector("[data-know]")?.addEventListener("click", () => {
    const card = s.cards[s.i];
    if (s.known.has(card.id)) s.known.delete(card.id);
    else s.known.add(card.id);
    s.flipped = false;
    s.i = (s.i + 1) % s.cards.length;
    render();
  });

  root.querySelector("[data-learn-write]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const card = s.queue[0];
    s.typed = document.getElementById("typed").value;
    const result = checkAnswer(s.typed, card, s.answerSide);
    const ok = result.ok;
    s.feedback = { ok, gender: result.gender };
    if (ok) speak(card.fr);
    render();
  });
  root.querySelectorAll("[data-learn-pick]").forEach((el) =>
    el.addEventListener("click", () => {
      const card = s.queue[0];
      const opt = el.dataset.learnPick;
      s.choice = opt;
      const ok = String(opt).toLowerCase() === String(s.answerOf(card)).toLowerCase();
      s.feedback = { ok };
      if (ok) speak(card.fr);
      render();
    })
  );
  root.querySelector("[data-learn-next]")?.addEventListener("click", () => {
    const card = s.queue[0];
    const ok = s.feedback.ok;
    state.progress = markResult(state.progress, card.id, ok);
    s.feedback = null;
    s.choice = null;
    s.typed = "";
    s.options = null;
    const rest = s.queue.slice(1);
    const p = state.progress[card.id];
    if (ok && (p.streak >= 2 || p.right >= 3)) {
      s.done.push(card);
      s.queue = rest;
    } else {
      const insert = Math.min(rest.length, ok ? 4 + Math.floor(Math.random() * 4) : 1);
      rest.splice(insert, 0, card);
      s.queue = rest;
    }
    render();
  });

  root.querySelector("[data-write]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const card = s.cards[s.i];
    if (s.feedback) {
      s.typed = "";
      s.feedback = null;
      s.i += 1;
      render();
      return;
    }
    s.typed = document.getElementById("typed").value;
    const side = s.mode === "spell" ? "fr" : s.answerSide;
    const result = checkAnswer(s.typed, card, side);
    const ok = result.ok;
    s.feedback = { ok, gender: result.gender, answer: side === "fr" ? card.fr : s.answerOf(card) };
    if (ok) {
      s.right += 1;
      speak(card.fr);
    } else s.wrong += 1;
    state.progress = markResult(state.progress, card.id, ok);
    render();
  });

  root.querySelector("[data-gravity]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const card = s.cards[s.i];
    const typed = document.getElementById("typed").value;
    const ok = isCorrect(typed, card, s.answerSide);
    s.falling = false;
    if (ok) {
      s.score += 10 + s.lives * 2;
      speak(card.fr);
      state.progress = markResult(state.progress, card.id, true);
    } else {
      s.lives -= 1;
      state.progress = markResult(state.progress, card.id, false);
    }
    s.i += 1;
    s.falling = true;
    render();
  });

  root.querySelectorAll("[data-block]").forEach((el) =>
    el.addEventListener("click", () => {
      if (s.feedback) return;
      const tile = s.tiles.find((t) => t.id === el.dataset.block);
      if (!tile) return;
      s.built.push(tile);
      const guess = s.built.map((t) => t.ch).join("");
      const compact = lettersOf(s.target).join("");
      if (guess.length >= compact.length) {
        const ok = isCorrect(guess, { ...s.card, fr: s.target, en: s.target, accept: s.card.accept }, s.answerSide);
        const exact = guess === compact;
        s.feedback = { ok: ok || exact };
        if (s.feedback.ok) {
          s.right += 1;
          speak(s.card.fr);
        } else s.wrong += 1;
        state.progress = markResult(state.progress, s.card.id, s.feedback.ok);
      }
      render();
    })
  );
  root.querySelector("[data-blocks-undo]")?.addEventListener("click", () => {
    if (s.feedback) return;
    s.built.pop();
    render();
  });
  root.querySelector("[data-blocks-clear]")?.addEventListener("click", () => {
    if (s.feedback) return;
    s.built = [];
    render();
  });
  root.querySelector("[data-blocks-next]")?.addEventListener("click", () => {
    const next = s.i + 1;
    const keep = { cards: s.cards, right: s.right, wrong: s.wrong, answerOf: s.answerOf, promptOf: s.promptOf, answerSide: s.answerSide };
    if (next >= s.cards.length) {
      Object.assign(s, keep, { i: next, mode: "blocks" });
    } else {
      Object.assign(s, makeBlocksSession(s.cards, next, s.answerOf), keep);
    }
    render();
  });

  root.querySelectorAll("[data-match]").forEach((el) =>
    el.addEventListener("click", () => {
      const tile = s.tiles.find((t) => t.key === el.dataset.match);
      if (!tile || s.matched.has(tile.pair) || s.finished) return;
      if (!s.selected) {
        s.selected = tile;
        s.wrong = [];
        render();
        return;
      }
      if (s.selected.key === tile.key) {
        s.selected = null;
        render();
        return;
      }
      if (s.selected.pair === tile.pair && s.selected.side !== tile.side) {
        s.matched.add(tile.pair);
        s.selected = null;
        s.wrong = [];
        if (s.matched.size === s.pool.length) s.finished = Date.now();
      } else {
        s.wrong = [s.selected.key, tile.key];
        s.selected = null;
      }
      render();
    })
  );

  root.querySelectorAll("[data-pair-left]").forEach((el) =>
    el.addEventListener("click", () => {
      const q = s.questions[s.i];
      q.pick = el.dataset.pairLeft;
      render();
    })
  );
  root.querySelectorAll("[data-pair-right]").forEach((el) =>
    el.addEventListener("click", () => {
      const q = s.questions[s.i];
      if (!q.pick) return;
      q.links[q.pick] = el.dataset.pairRight;
      q.pick = null;
      if (Object.keys(q.links).length === q.items.length) saveTest(q.links);
      else render();
    })
  );

  root.querySelectorAll("[data-test-save]").forEach((el) =>
    el.addEventListener("click", () => saveTest(el.dataset.testSave))
  );
  root.querySelectorAll("[data-test-tf]").forEach((el) =>
    el.addEventListener("click", () => saveTest(el.dataset.testTf === "true"))
  );
  root.querySelector("[data-test-write]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    saveTest(document.getElementById("typed").value);
  });
}

function bindHome() {
  root.querySelectorAll("[data-open]").forEach((el) =>
    el.addEventListener("click", () => {
      state.setId = el.dataset.open;
      state.starredOnly = false;
      if (el.dataset.open === "sentences") state.direction = "fr-en";
      render();
    })
  );
  root.querySelector("[data-open-translate]")?.addEventListener("click", () => {
    state.setId = "sentences";
    state.starredOnly = false;
    state.direction = "fr-en";
    startMode("translate", currentSet());
  });
}

function saveTest(val) {
  const s = state.session;
  s.answers[s.i] = val;
  s.typed = "";
  if (s.i >= s.questions.length - 1) s.review = true;
  else s.i += 1;
  render();
}

document.addEventListener("keydown", (e) => {
  const s = state.session;
  if (!s || s.mode !== "flash") return;
  const tag = e.target?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    s.flipped = !s.flipped;
    render();
  }
  if (e.key === "ArrowRight") {
    s.flipped = false;
    s.i = (s.i + 1) % s.cards.length;
    render();
  }
  if (e.key === "ArrowLeft") {
    s.flipped = false;
    s.i = (s.i - 1 + s.cards.length) % s.cards.length;
    render();
  }
});

render();
})();
