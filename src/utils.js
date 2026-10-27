(function () {
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/['’]/g, "'")
    .replace(/[?!.]/g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function expandContractions(s) {
  return s
    .replace(/\bit's\b/g, "it is")
    .replace(/\bi'm\b/g, "i am")
    .replace(/\byou're\b/g, "you are")
    .replace(/\bwe're\b/g, "we are")
    .replace(/\bthey're\b/g, "they are")
    .replace(/\bshe's\b/g, "she is")
    .replace(/\bhe's\b/g, "he is")
    .replace(/\bthat's\b/g, "that is")
    .replace(/\bwhat's\b/g, "what is")
    .replace(/\bhow's\b/g, "how is")
    .replace(/\bthere's\b/g, "there is")
    .replace(/\bi've\b/g, "i have")
    .replace(/\byou've\b/g, "you have")
    .replace(/\bwe've\b/g, "we have");
}

function answersFor(card, side = "fr") {
  const primary = side === "fr" ? card.fr : card.en;
  const extra = side === "fr" ? card.accept || [] : card.acceptEn || card.accept || [];
  return [primary, ...extra];
}

const DET_GENDER = {
  un: "m",
  le: "m",
  mon: "m",
  ton: "m",
  son: "m",
  une: "f",
  la: "f",
  ma: "f",
  ta: "f",
  sa: "f",
  les: "p",
  des: "p",
  mes: "p",
  tes: "p",
  ses: "p",
  "l'": "elide",
};

const DETS = Object.keys(DET_GENDER).sort((a, b) => b.length - a.length);

function splitDet(n) {
  for (const d of DETS) {
    if (d.endsWith("'")) {
      if (n.startsWith(d)) return { det: d, rest: n.slice(d.length) };
    } else if (n === d) {
      return { det: d, rest: "" };
    } else if (n.startsWith(d + " ")) {
      return { det: d, rest: n.slice(d.length + 1) };
    }
  }
  return { det: "", rest: n };
}

function cardGender(card) {
  const note = String(card.note || "").toLowerCase();
  if (note.includes("féminin") || note.includes("feminin")) return "f";
  if (note.includes("masculin")) return "m";
  return "";
}

function detsAgree(expectedDet, gotDet, genderHint) {
  if (!expectedDet) return !gotDet;
  if (!gotDet) return false;
  if (expectedDet === gotDet) return true;
  const eg = DET_GENDER[expectedDet];
  const gg = DET_GENDER[gotDet];
  if (!eg || !gg) return false;
  if (eg === "elide") {
    if (gg === "elide") return true;
    if (genderHint === "m") return gg === "m";
    if (genderHint === "f") return gg === "f";
    return gg === "m" || gg === "f";
  }
  if (gg === "elide") {
    if (genderHint === "m") return eg === "m";
    if (genderHint === "f") return eg === "f";
    return eg === "m" || eg === "f";
  }
  return eg === gg;
}

function checkAnswer(input, card, side = "fr") {
  const n = expandContractions(normalize(input));
  if (!n) return { ok: false };
  const opts = answersFor(card, side).map((o) => expandContractions(normalize(o)));
  if (opts.includes(n)) return { ok: true };
  if (side === "en") {
    const stripped = n.replace(/^(a|an|the)\s+/, "");
    const ok = opts.some((o) => o.replace(/^(a|an|the)\s+/, "") === stripped && stripped.length > 2);
    return { ok };
  }
  const got = splitDet(n);
  const genderHint = cardGender(card);
  let genderMiss = false;
  const ok = opts.some((o) => {
    const exp = splitDet(o);
    if (got.rest !== exp.rest || !got.rest) return false;
    if (detsAgree(exp.det, got.det, genderHint)) return true;
    genderMiss = true;
    return false;
  });
  return { ok, gender: !ok && genderMiss };
}

function isCorrect(input, card, side = "fr") {
  return checkAnswer(input, card, side).ok;
}

function sampleWrong(cards, card, n = 3) {
  const pool = shuffle(cards.filter((c) => c.id !== card.id));
  const unique = [];
  const seen = new Set([normalize(card.fr)]);
  for (const c of pool) {
    const k = normalize(c.fr);
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(c);
    if (unique.length >= n) break;
  }
  return unique;
}

function speak(text, lang = "fr-FR") {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.92;
  const voices = window.speechSynthesis.getVoices();
  const match = voices.find((v) => v.lang.startsWith(lang.slice(0, 2)));
  if (match) u.voice = match;
  window.speechSynthesis.speak(u);
}

const KEY = "french-ib-progress-v1";

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function saveProgress(p) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

function markResult(progress, cardId, ok) {
  const next = { ...progress };
  const cur = next[cardId] || { right: 0, wrong: 0, streak: 0 };
  if (ok) {
    cur.right += 1;
    cur.streak += 1;
  } else {
    cur.wrong += 1;
    cur.streak = 0;
  }
  next[cardId] = cur;
  saveProgress(next);
  return next;
}

function masteredCount(cards, progress) {
  return cards.filter((c) => (progress[c.id]?.streak || 0) >= 2 || (progress[c.id]?.right || 0) >= 3).length;
}

function toggleStar(progress, cardId) {
  const next = { ...progress };
  const cur = next[cardId] || { right: 0, wrong: 0, streak: 0, starred: false };
  cur.starred = !cur.starred;
  next[cardId] = cur;
  saveProgress(next);
  return next;
}

function isStarred(progress, cardId) {
  return Boolean(progress[cardId]?.starred);
}

function starredCount(cards, progress) {
  return cards.filter((c) => isStarred(progress, c.id)).length;
}

function lettersOf(text) {
  return [...String(text)].filter((ch) => /[0-9a-zA-ZàâäéèêëïîôùûüçœæÀÂÄÉÈÊËÏÎÔÙÛÜÇ'’\-]/.test(ch));
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}:${String(r).padStart(2, "0")}` : `${r}s`;
}

window.FrenchUtils = {
  shuffle,
  normalize,
  answersFor,
  checkAnswer,
  isCorrect,
  sampleWrong,
  speak,
  loadProgress,
  saveProgress,
  markResult,
  masteredCount,
  toggleStar,
  isStarred,
  starredCount,
  lettersOf,
  formatTime,
};
})();
