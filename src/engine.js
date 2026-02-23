// Math Test Prep Engine — Chapter 8: Fractions
// Generates problems, checks answers, provides step-by-step explanations

// ===== MATH UTILITIES =====

export function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}

export function lcm(a, b) {
  return Math.abs(a * b) / gcd(a, b);
}

export function simplifyFrac(num, den) {
  if (num === 0) return { num: 0, den: 1 };
  const g = gcd(num, den);
  return { num: num / g, den: den / g };
}

export function toImproper(whole, num, den) {
  return { num: whole * den + num, den };
}

export function toMixed(num, den) {
  const s = simplifyFrac(num, den);
  const whole = Math.floor(s.num / s.den);
  const rem = s.num - whole * s.den;
  if (rem === 0) return { whole, num: 0, den: 1 };
  const rs = simplifyFrac(rem, s.den);
  return { whole, num: rs.num, den: rs.den };
}

export function formatFrac(whole, num, den) {
  if (num === 0 && whole === 0) return '0';
  if (num === 0) return `${whole}`;
  if (whole === 0) return `${num}/${den}`;
  return `${whole} ${num}/${den}`;
}

export function formatFracObj(f) {
  return formatFrac(f.whole || 0, f.num, f.den);
}

function fracEqual(a, b) {
  // a, b are { num, den } (improper form)
  return a.num * b.den === b.num * a.den;
}

function fracGreater(a, b) {
  return a.num * b.den > b.num * a.den;
}

export function parseAnswer(input) {
  if (!input || typeof input !== 'string') return null;
  input = input.trim().replace(/\s+/g, ' ');

  // "whole num/den"
  let m = input.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (m) return { whole: +m[1], num: +m[2], den: +m[3] };

  // "num/den"
  m = input.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) return { whole: 0, num: +m[1], den: +m[2] };

  // whole number
  m = input.match(/^(\d+)$/);
  if (m) return { whole: +m[1], num: 0, den: 1 };

  return null;
}

// ===== RANDOM HELPERS =====

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ===== DENOMINATOR POOLS =====

const EASY_DENS = [2, 3, 4, 5, 6, 8, 10, 12];
const HARD_DENS = [3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 16, 18, 20];

function pickTwoDens(hard = false) {
  const pool = hard ? HARD_DENS : EASY_DENS;
  let d1, d2, tries = 0;
  do {
    d1 = pick(pool);
    d2 = pick(pool);
    tries++;
  } while ((d1 === d2 || d1 % d2 === 0 || d2 % d1 === 0) && tries < 50);
  if (d1 === d2) d2 = d1 === 3 ? 5 : 3; // fallback
  return [d1, d2];
}

function randomProperFrac(den) {
  return { num: randInt(1, den - 1), den };
}

// ===== TOPICS =====

export const TOPICS = {
  'simplify': { name: 'Simplifying Fractions', icon: '✂️' },
  'add-fractions': { name: 'Adding Fractions', icon: '➕' },
  'subtract-fractions': { name: 'Subtracting Fractions', icon: '➖' },
  'add-mixed': { name: 'Adding Mixed Numbers', icon: '➕' },
  'subtract-mixed': { name: 'Subtracting Mixed Numbers', icon: '➖' },
  'estimate': { name: 'Estimating Fractions', icon: '🎯' },
  'equivalent': { name: 'Equivalent Fractions', icon: '⚖️' },
  'word-add': { name: 'Word Problems: Addition', icon: '📝' },
  'word-subtract': { name: 'Word Problems: Subtraction', icon: '📝' },
  'word-multistep': { name: 'Word Problems: Multi-Step', icon: '📝' },
  'word-compare': { name: 'Word Problems: Comparing', icon: '📝' },
  'word-convert': { name: 'Word Problems: Unit Conversion', icon: '📝' },
};

// ===== EXPLANATION BUILDER =====

function explainLCD(d1, d2) {
  const l = lcm(d1, d2);
  if (l === d1) return `${d2} goes into ${d1}, so the common denominator is ${l}.`;
  if (l === d2) return `${d1} goes into ${d2}, so the common denominator is ${l}.`;
  return `The least common denominator of ${d1} and ${d2} is ${l}.`;
}

function explainConvert(num, den, newDen) {
  const mult = newDen / den;
  return `${num}/${den} = ${num * mult}/${newDen}`;
}

function explainSimplify(num, den) {
  const g = gcd(num, den);
  if (g === 1) return `${num}/${den} is already in simplest form.`;
  return `${num}/${den} — both ${num} and ${den} are divisible by ${g}, so ${num}/${den} = ${num / g}/${den / g}.`;
}

// ===== PROBLEM GENERATORS =====

let problemCounter = 0;

function makeId() {
  return `p_${Date.now()}_${problemCounter++}`;
}

// --- Simplify ---
function genSimplify(hard = false) {
  // Only use composite denominators (ones that have factors to simplify with)
  const composites = hard
    ? [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20]
    : [4, 6, 8, 10, 12];
  const den = pick(composites);
  // Pick a numerator that shares a factor with den
  const candidates = [];
  for (let n = 1; n < den; n++) {
    if (gcd(n, den) > 1) candidates.push(n);
  }
  const num = pick(candidates);
  // Multiply both to make it bigger
  const mult = hard ? randInt(2, 4) : randInt(2, 3);
  const bigNum = num * mult;
  const bigDen = den * mult;
  const s = simplifyFrac(bigNum, bigDen);

  return {
    id: makeId(),
    topic: 'simplify',
    type: 'computation',
    difficulty: hard ? 2 : 1,
    question: `Simplify ${bigNum}/${bigDen}`,
    inputType: 'fraction',
    answer: { whole: 0, num: s.num, den: s.den },
    requireSimplified: true,
    explanation: [
      `Find the greatest common factor (GCF) of ${bigNum} and ${bigDen}.`,
      `The GCF of ${bigNum} and ${bigDen} is ${gcd(bigNum, bigDen)}.`,
      `Divide both by ${gcd(bigNum, bigDen)}: ${bigNum} ÷ ${gcd(bigNum, bigDen)} = ${s.num}, ${bigDen} ÷ ${gcd(bigNum, bigDen)} = ${s.den}.`,
      `So ${bigNum}/${bigDen} = ${s.num}/${s.den}.`
    ],
    hint: `What number divides evenly into both ${bigNum} and ${bigDen}?`
  };
}

// --- Add Fractions ---
function genAddFractions(hard = false) {
  const [d1, d2] = pickTwoDens(hard);
  const f1 = randomProperFrac(d1);
  const f2 = randomProperFrac(d2);
  const commonDen = lcm(d1, d2);
  const sumNum = f1.num * (commonDen / d1) + f2.num * (commonDen / d2);
  const result = toMixed(sumNum, commonDen);

  return {
    id: makeId(),
    topic: 'add-fractions',
    type: 'computation',
    difficulty: hard ? 2 : 1,
    question: `${f1.num}/${f1.den} + ${f2.num}/${f2.den} = ?`,
    inputType: 'fraction',
    answer: result,
    requireSimplified: true,
    explanation: [
      `Find a common denominator. ${explainLCD(d1, d2)}`,
      `Convert each fraction: ${explainConvert(f1.num, f1.den, commonDen)} and ${explainConvert(f2.num, f2.den, commonDen)}.`,
      `Add the numerators: ${f1.num * (commonDen / d1)} + ${f2.num * (commonDen / d2)} = ${sumNum}.`,
      `That gives us ${sumNum}/${commonDen}.`,
      sumNum > commonDen ? `Since ${sumNum} > ${commonDen}, convert to a mixed number: ${formatFracObj(result)}.` : '',
      gcd(sumNum, commonDen) > 1 ? explainSimplify(sumNum, commonDen) : `${sumNum}/${commonDen} is already simplified.`
    ].filter(Boolean),
    hint: `What denominator works for both ${d1} and ${d2}?`
  };
}

// --- Subtract Fractions ---
function genSubtractFractions(hard = false) {
  const [d1, d2] = pickTwoDens(hard);
  let f1, f2, tries = 0;
  // Ensure f1 > f2
  do {
    f1 = randomProperFrac(d1);
    f2 = randomProperFrac(d2);
    tries++;
    if (tries > 30) { f1 = { num: d1 - 1, den: d1 }; f2 = { num: 1, den: d2 }; break; }
  } while (!fracGreater(f1, f2));

  const commonDen = lcm(d1, d2);
  const diffNum = f1.num * (commonDen / d1) - f2.num * (commonDen / d2);
  const result = diffNum === 0
    ? { whole: 0, num: 0, den: 1 }
    : { whole: 0, ...simplifyFrac(diffNum, commonDen) };

  return {
    id: makeId(),
    topic: 'subtract-fractions',
    type: 'computation',
    difficulty: hard ? 2 : 1,
    question: `${f1.num}/${f1.den} − ${f2.num}/${f2.den} = ?`,
    inputType: 'fraction',
    answer: result,
    requireSimplified: true,
    explanation: [
      `Find a common denominator. ${explainLCD(d1, d2)}`,
      `Convert each fraction: ${explainConvert(f1.num, f1.den, commonDen)} and ${explainConvert(f2.num, f2.den, commonDen)}.`,
      `Subtract the numerators: ${f1.num * (commonDen / d1)} − ${f2.num * (commonDen / d2)} = ${diffNum}.`,
      `That gives us ${diffNum}/${commonDen}.`,
      gcd(diffNum, commonDen) > 1 && diffNum > 0 ? explainSimplify(diffNum, commonDen) : ''
    ].filter(Boolean),
    hint: `First get a common denominator for ${d1} and ${d2}.`
  };
}

// --- Add Mixed Numbers ---
function genAddMixed(hard = false) {
  const [d1, d2] = pickTwoDens(hard);
  const w1 = randInt(1, hard ? 8 : 5);
  const w2 = randInt(1, hard ? 8 : 5);
  const f1 = randomProperFrac(d1);
  const f2 = randomProperFrac(d2);

  const commonDen = lcm(d1, d2);
  const fracSum = f1.num * (commonDen / d1) + f2.num * (commonDen / d2);
  const extraWhole = Math.floor(fracSum / commonDen);
  const remNum = fracSum - extraWhole * commonDen;
  const totalWhole = w1 + w2 + extraWhole;
  const s = remNum > 0 ? simplifyFrac(remNum, commonDen) : { num: 0, den: 1 };
  const result = { whole: totalWhole, num: s.num, den: s.den };

  return {
    id: makeId(),
    topic: 'add-mixed',
    type: 'computation',
    difficulty: hard ? 2 : 1,
    question: `${formatFrac(w1, f1.num, f1.den)} + ${formatFrac(w2, f2.num, f2.den)} = ?`,
    inputType: 'fraction',
    answer: result,
    requireSimplified: true,
    explanation: [
      `Add the whole numbers: ${w1} + ${w2} = ${w1 + w2}.`,
      `Add the fractions: ${f1.num}/${f1.den} + ${f2.num}/${f2.den}. ${explainLCD(d1, d2)}`,
      `Convert: ${explainConvert(f1.num, f1.den, commonDen)} and ${explainConvert(f2.num, f2.den, commonDen)}.`,
      `${f1.num * (commonDen / d1)}/${commonDen} + ${f2.num * (commonDen / d2)}/${commonDen} = ${fracSum}/${commonDen}.`,
      fracSum >= commonDen
        ? `${fracSum}/${commonDen} is more than 1 whole, so carry: ${extraWhole} whole and ${remNum}/${commonDen} left over.`
        : '',
      remNum > 0 && gcd(remNum, commonDen) > 1 ? explainSimplify(remNum, commonDen) : '',
      `Final answer: ${formatFracObj(result)}.`
    ].filter(Boolean),
    hint: `Add the whole numbers first, then add the fractions separately.`
  };
}

// --- Subtract Mixed Numbers ---
function genSubtractMixed(hard = false) {
  const [d1, d2] = pickTwoDens(hard);
  let w1, w2, f1, f2;
  // Ensure first > second (w1 > w2 guarantees this will resolve quickly)
  let tries = 0;
  while (tries++ < 50) {
    w1 = randInt(3, hard ? 10 : 7);
    w2 = randInt(1, w1 - 1);
    f1 = randomProperFrac(d1);
    f2 = randomProperFrac(d2);
    const imp1check = toImproper(w1, f1.num, f1.den);
    const imp2check = toImproper(w2, f2.num, f2.den);
    if (fracGreater(imp1check, imp2check)) break;
  }

  const imp1 = toImproper(w1, f1.num, f1.den);
  const imp2 = toImproper(w2, f2.num, f2.den);
  const commonDen = lcm(imp1.den, imp2.den);
  const diffNum = imp1.num * (commonDen / imp1.den) - imp2.num * (commonDen / imp2.den);
  const result = toMixed(diffNum, commonDen);

  const needsBorrow = f1.num * (commonDen / d1) < f2.num * (commonDen / d2);

  return {
    id: makeId(),
    topic: 'subtract-mixed',
    type: 'computation',
    difficulty: hard ? 2 : 1,
    question: `${formatFrac(w1, f1.num, f1.den)} − ${formatFrac(w2, f2.num, f2.den)} = ?`,
    inputType: 'fraction',
    answer: result,
    requireSimplified: true,
    explanation: [
      needsBorrow
        ? `The fraction part ${f1.num}/${f1.den} is smaller than ${f2.num}/${f2.den}, so we need to borrow 1 from ${w1}.`
        : `Subtract the whole numbers: ${w1} − ${w2} = ${w1 - w2}.`,
      needsBorrow
        ? `Borrow: ${w1} ${f1.num}/${f1.den} becomes ${w1 - 1} ${f1.num + f1.den}/${f1.den}.`
        : '',
      `Get a common denominator for the fractions. ${explainLCD(d1, d2)}`,
      `Subtract the fractions and whole numbers to get ${formatFracObj(result)}.`
    ].filter(Boolean),
    hint: needsBorrow
      ? `The fraction you're subtracting is bigger — you'll need to borrow from the whole number.`
      : `Subtract whole numbers first, then the fractions.`
  };
}

// --- Estimate Fraction ---
function genEstimate(hard = false) {
  const den = hard ? pick([7, 8, 9, 11, 12, 13, 15, 16]) : pick([3, 4, 5, 6, 7, 8, 10]);
  const num = randInt(1, den - 1);
  const val = num / den;

  let correctAnswer;
  if (val < 0.25) correctAnswer = '0';
  else if (val > 0.75) correctAnswer = '1';
  else correctAnswer = '1/2';

  return {
    id: makeId(),
    topic: 'estimate',
    type: 'computation',
    difficulty: hard ? 2 : 1,
    question: `Is ${num}/${den} closest to 0, 1/2, or 1?`,
    inputType: 'choice',
    choices: ['0', '1/2', '1'],
    answer: correctAnswer,
    requireSimplified: false,
    explanation: [
      `${num}/${den} as a decimal is about ${(val).toFixed(3)}.`,
      val < 0.25
        ? `Since ${(val).toFixed(3)} is less than 0.25 (which is 1/4), it's closest to 0.`
        : val > 0.75
          ? `Since ${(val).toFixed(3)} is more than 0.75 (which is 3/4), it's closest to 1.`
          : `Since ${(val).toFixed(3)} is between 0.25 and 0.75, it's closest to 1/2.`,
      `Quick check: Is the numerator (${num}) less than half the denominator (${Math.floor(den / 2)})? ${num < den / 2 ? 'Yes → closer to 0.' : 'No.'} Is it more than half? ${num > den / 2 ? 'Yes → closer to 1.' : 'No → closer to 1/2.'}`
    ],
    hint: `Compare ${num} to half of ${den} (which is ${den / 2}).`
  };
}

// --- Equivalent Fractions ---
function genEquivalent(hard = false) {
  // Generate a base fraction that CAN be simplified (use composite denominators)
  const composites = hard
    ? [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20]
    : [4, 6, 8, 10, 12];
  const den = pick(composites);
  const candidates = [];
  for (let n = 1; n < den; n++) {
    if (gcd(n, den) > 1) candidates.push(n);
  }
  const num = candidates.length > 0 ? pick(candidates) : 2;
  const s = simplifyFrac(num, den);

  // Make an equivalent pair
  const mult1 = randInt(2, hard ? 5 : 4);
  const mult2 = randInt(mult1 + 1, hard ? 7 : 6);
  const pairA = { num: s.num * mult1, den: s.den * mult1 };
  const pairB = { num: s.num * mult2, den: s.den * mult2 };

  // Make non-equivalent distractors
  const distractors = [];
  for (let i = 0; i < 2; i++) {
    let dn, nn, dTries = 0;
    do {
      dn = pick(hard ? HARD_DENS : EASY_DENS);
      nn = randInt(1, dn - 1);
      dTries++;
    } while (fracEqual({ num: nn, den: dn }, { num: s.num, den: s.den }) && dTries < 20);
    const m = randInt(2, 4);
    distractors.push({
      a: { num: nn, den: dn },
      b: { num: nn * m + 1, den: dn * m } // slightly off
    });
  }

  const options = shuffle([
    { label: `${pairA.num}/${pairA.den} and ${pairB.num}/${pairB.den}`, correct: true },
    { label: `${distractors[0].a.num}/${distractors[0].a.den} and ${distractors[0].b.num}/${distractors[0].b.den}`, correct: false },
    { label: `${distractors[1].a.num}/${distractors[1].a.den} and ${distractors[1].b.num}/${distractors[1].b.den}`, correct: false },
  ]);

  const correctLabel = options.find(o => o.correct).label;
  const labels = ['A', 'B', 'C'];

  return {
    id: makeId(),
    topic: 'equivalent',
    type: 'computation',
    difficulty: hard ? 2 : 1,
    question: `Which pair of fractions is equivalent?`,
    inputType: 'choice',
    choices: options.map((o, i) => `${labels[i]}. ${o.label}`),
    answer: `${labels[options.findIndex(o => o.correct)]}. ${correctLabel}`,
    requireSimplified: false,
    explanation: [
      `Simplify each fraction in the pair to check.`,
      `${pairA.num}/${pairA.den} simplifies to ${s.num}/${s.den}.`,
      `${pairB.num}/${pairB.den} simplifies to ${s.num}/${s.den}.`,
      `They're both equal to ${s.num}/${s.den}, so they're equivalent!`
    ],
    hint: `Try simplifying each fraction to see if any two pairs reduce to the same thing.`
  };
}

// ===== WORD PROBLEM TEMPLATES =====

const NAMES = ['Max', 'Lily', 'Jake', 'Mia', 'Sam', 'Zoe', 'Leo', 'Emma', 'Noah', 'Ava'];

function randomName() { return pick(NAMES); }

// --- Word: Addition ---
function genWordAdd(hard = false) {
  const templates = [
    (n, f1s, f2s, ans) => ({
      question: `${n} spends ${f1s} of the day on homework and ${f2s} of the day on sports practice. What fraction of the day does ${n} spend on these two activities combined?`,
      context: 'fractions of a day'
    }),
    (n, f1s, f2s, ans) => ({
      question: `A recipe calls for ${f1s} cup of sugar and ${f2s} cup of butter. How much sugar and butter is that in total?`,
      context: 'cups'
    }),
    (n, f1s, f2s, ans) => ({
      question: `${n} walks ${f1s} mile to the library and then ${f2s} mile to the park. How far does ${n} walk in total?`,
      context: 'miles'
    }),
    (n, f1s, f2s, ans) => ({
      question: `${n} pours ${f1s} liter of orange juice and ${f2s} liter of lemonade into a pitcher. How much liquid is in the pitcher?`,
      context: 'liters'
    }),
    (n, f1s, f2s, ans) => ({
      question: `${n} reads for ${f1s} hour before school and ${f2s} hour after school. How many hours does ${n} read in total?`,
      context: 'hours'
    }),
    (n, f1s, f2s, ans) => ({
      question: `${n} uses ${f1s} of a roll of ribbon for one present and ${f2s} of the roll for another. How much of the roll did ${n} use?`,
      context: 'of a roll'
    }),
  ];

  const [d1, d2] = pickTwoDens(hard);
  const f1 = randomProperFrac(d1);
  const f2 = randomProperFrac(d2);
  const commonDen = lcm(d1, d2);
  const sumNum = f1.num * (commonDen / d1) + f2.num * (commonDen / d2);
  const result = toMixed(sumNum, commonDen);
  const name = randomName();
  const f1s = `${f1.num}/${f1.den}`;
  const f2s = `${f2.num}/${f2.den}`;
  const t = pick(templates)(name, f1s, f2s, result);

  return {
    id: makeId(),
    topic: 'word-add',
    type: 'word-problem',
    difficulty: hard ? 2 : 1,
    question: t.question,
    inputType: 'fraction',
    answer: result,
    requireSimplified: true,
    explanation: [
      `This is an addition problem: ${f1s} + ${f2s}.`,
      `Find a common denominator. ${explainLCD(d1, d2)}`,
      `Convert: ${explainConvert(f1.num, d1, commonDen)} and ${explainConvert(f2.num, d2, commonDen)}.`,
      `Add: ${f1.num * (commonDen / d1)}/${commonDen} + ${f2.num * (commonDen / d2)}/${commonDen} = ${sumNum}/${commonDen}.`,
      gcd(sumNum, commonDen) > 1 ? `Simplify: ${explainSimplify(sumNum, commonDen)}` : '',
      sumNum > commonDen ? `Convert to mixed number: ${formatFracObj(result)}.` : `Answer: ${formatFracObj(result)}.`
    ].filter(Boolean),
    hint: `Figure out what operation you need (addition or subtraction), then find a common denominator.`
  };
}

// --- Word: Subtraction ---
function genWordSubtract(hard = false) {
  const templates = [
    (n, f1s, f2s) => ({
      question: `${n} has ${f1s} of a pizza left. After eating some, ${n} has ${f2s} of the pizza remaining. How much pizza did ${n} eat?`,
    }),
    (n, f1s, f2s) => ({
      question: `A trail is ${f1s} mile long. ${n} has already walked ${f2s} mile. How much of the trail is left?`,
    }),
    (n, f1s, f2s) => ({
      question: `${n} had ${f1s} gallon of paint. After painting a fence, ${n} has ${f2s} gallon left. How much paint did ${n} use?`,
    }),
    (n, f1s, f2s) => ({
      question: `A water tank is ${f1s} full. After watering the garden, it's ${f2s} full. What fraction of the tank was used?`,
    }),
    (n, f1s, f2s) => ({
      question: `${n} has a rope that is ${f1s} yard long. ${n} cuts off ${f2s} yard. How much rope is left?`,
    }),
  ];

  const [d1, d2] = pickTwoDens(hard);
  let f1, f2, tries = 0;
  do {
    f1 = randomProperFrac(d1);
    f2 = randomProperFrac(d2);
    tries++;
    if (tries > 30) { f1 = { num: d1 - 1, den: d1 }; f2 = { num: 1, den: d2 }; break; }
  } while (!fracGreater(f1, f2));

  const commonDen = lcm(d1, d2);
  const diffNum = f1.num * (commonDen / d1) - f2.num * (commonDen / d2);
  const result = diffNum === 0
    ? { whole: 0, num: 0, den: 1 }
    : { whole: 0, ...simplifyFrac(diffNum, commonDen) };

  const name = randomName();
  const f1s = `${f1.num}/${f1.den}`;
  const f2s = `${f2.num}/${f2.den}`;
  const t = pick(templates)(name, f1s, f2s);

  return {
    id: makeId(),
    topic: 'word-subtract',
    type: 'word-problem',
    difficulty: hard ? 2 : 1,
    question: t.question,
    inputType: 'fraction',
    answer: result,
    requireSimplified: true,
    explanation: [
      `This is a subtraction problem: ${f1s} − ${f2s}.`,
      `Find a common denominator. ${explainLCD(d1, d2)}`,
      `Convert: ${explainConvert(f1.num, d1, commonDen)} and ${explainConvert(f2.num, d2, commonDen)}.`,
      `Subtract: ${f1.num * (commonDen / d1)}/${commonDen} − ${f2.num * (commonDen / d2)}/${commonDen} = ${diffNum}/${commonDen}.`,
      diffNum > 0 && gcd(diffNum, commonDen) > 1 ? `Simplify: ${explainSimplify(diffNum, commonDen)}` : '',
      `Answer: ${formatFracObj(result)}.`
    ].filter(Boolean),
    hint: `What operation does the problem describe? Then find a common denominator.`
  };
}

// --- Word: Multi-step ---
function genWordMultistep(hard = false, _depth = 0) {
  if (_depth > 8) return genWordAdd(hard); // bail to simpler problem
  const type = randInt(0, 3);

  if (type === 0) {
    // Spend fractions of allowance on multiple things
    const [d1, d2] = pickTwoDens(hard);
    const d3 = pick((hard ? HARD_DENS : EASY_DENS).filter(d => d !== d1 && d !== d2));
    const f1 = randomProperFrac(d1);
    const f2 = randomProperFrac(d2);
    // Ensure sum < 1
    const commonDen12 = lcm(d1, d2);
    const sum12 = f1.num * (commonDen12 / d1) + f2.num * (commonDen12 / d2);
    if (sum12 >= commonDen12) return genWordMultistep(hard, _depth + 1); // retry

    const commonAll = lcm(lcm(d1, d2), d3);
    const totalNum = f1.num * (commonAll / d1) + f2.num * (commonAll / d2);
    const result = toMixed(totalNum, commonAll);
    const name = randomName();

    return {
      id: makeId(),
      topic: 'word-multistep',
      type: 'word-problem',
      difficulty: hard ? 3 : 2,
      question: `${name} spends ${f1.num}/${f1.den} of an allowance on food and ${f2.num}/${f2.den} of the allowance on entertainment. How much of the allowance does ${name} spend in total?`,
      inputType: 'fraction',
      answer: result,
      requireSimplified: true,
      explanation: [
        `Add the two fractions: ${f1.num}/${f1.den} + ${f2.num}/${f2.den}.`,
        `Common denominator: ${commonAll}.`,
        `${f1.num * (commonAll / d1)}/${commonAll} + ${f2.num * (commonAll / d2)}/${commonAll} = ${totalNum}/${commonAll}.`,
        gcd(totalNum, commonAll) > 1 ? `Simplify: ${explainSimplify(totalNum, commonAll)}` : '',
        `Answer: ${formatFracObj(result)}.`
      ].filter(Boolean),
      hint: `Identify what fractions you need to add together.`
    };
  }

  if (type === 1) {
    // Walk + run, how far total, then compare
    const [d1, d2] = pickTwoDens(hard);
    const w1 = randInt(1, hard ? 4 : 3);
    const w2 = randInt(1, hard ? 4 : 3);
    const f1 = randomProperFrac(d1);
    const f2 = randomProperFrac(d2);
    const imp1 = toImproper(w1, f1.num, f1.den);
    const imp2 = toImproper(w2, f2.num, f2.den);
    const commonDen = lcm(imp1.den, imp2.den);
    const totalNum = imp1.num * (commonDen / imp1.den) + imp2.num * (commonDen / imp2.den);
    const result = toMixed(totalNum, commonDen);
    const name = randomName();

    return {
      id: makeId(),
      topic: 'word-multistep',
      type: 'word-problem',
      difficulty: hard ? 3 : 2,
      question: `${name} walks ${formatFrac(w1, f1.num, f1.den)} miles to the store and then ${formatFrac(w2, f2.num, f2.den)} miles to the library. How far does ${name} walk in total?`,
      inputType: 'fraction',
      answer: result,
      requireSimplified: true,
      explanation: [
        `Add the mixed numbers: ${formatFrac(w1, f1.num, f1.den)} + ${formatFrac(w2, f2.num, f2.den)}.`,
        `Add whole numbers: ${w1} + ${w2} = ${w1 + w2}.`,
        `Add fractions: ${f1.num}/${f1.den} + ${f2.num}/${f2.den}. Common denominator is ${lcm(d1, d2)}.`,
        `Total: ${formatFracObj(result)}.`
      ],
      hint: `Add the whole numbers first, then add the fractions.`
    };
  }

  if (type === 2) {
    // Enough ingredients?
    const [d1, d2] = pickTwoDens(hard);
    const need = randomProperFrac(d1);
    // Make "have" close to "need"
    const haveDen = d2;
    let haveNum;
    const needDec = need.num / need.den;
    let hTries = 0;
    do {
      haveNum = randInt(1, haveDen - 1);
      hTries++;
    } while (Math.abs(haveNum / haveDen - needDec) < 0.05 && hTries < 20);

    const has = { num: haveNum, den: haveDen };
    const hasEnough = fracGreater(has, need) || fracEqual(has, need);
    const name = randomName();

    const commonDen = lcm(need.den, has.den);
    const diffNum = Math.abs(has.num * (commonDen / has.den) - need.num * (commonDen / need.den));
    const diffSimp = simplifyFrac(diffNum, commonDen);

    return {
      id: makeId(),
      topic: 'word-multistep',
      type: 'word-problem',
      difficulty: hard ? 3 : 2,
      question: `${name} needs ${need.num}/${need.den} cup of flour for a recipe. ${name} has ${has.num}/${has.den} cup. Does ${name} have enough flour?  Answer "Yes" or "No".`,
      inputType: 'choice',
      choices: ['Yes', 'No'],
      answer: hasEnough ? 'Yes' : 'No',
      requireSimplified: false,
      explanation: [
        `Compare ${has.num}/${has.den} to ${need.num}/${need.den}.`,
        `Common denominator: ${commonDen}.`,
        `${has.num}/${has.den} = ${has.num * (commonDen / has.den)}/${commonDen}, and ${need.num}/${need.den} = ${need.num * (commonDen / need.den)}/${commonDen}.`,
        `${has.num * (commonDen / has.den)} ${hasEnough ? '≥' : '<'} ${need.num * (commonDen / need.den)}, so ${hasEnough ? 'yes' : 'no'}, ${name} ${hasEnough ? 'has' : 'does not have'} enough.`,
        diffNum > 0 ? `The difference is ${diffSimp.num}/${diffSimp.den} cup.` : ''
      ].filter(Boolean),
      hint: `Convert both fractions to the same denominator, then compare the numerators.`
    };
  }

  // type === 3: Aquarium / time problem
  {
    const totalHours = pick([{ w: 3, n: 1, d: 2 }, { w: 4, n: 1, d: 2 }, { w: 4, n: 1, d: 4 }, { w: 5, n: 0, d: 1 }, { w: 3, n: 3, d: 4 }]);
    const [d1, d2] = pickTwoDens(false);
    const activity1 = { whole: randInt(1, 2), ...randomProperFrac(d1) };
    const activity2 = { whole: 0, ...randomProperFrac(d2) };
    // Time remaining = total - activity1 - activity2
    const totalImp = toImproper(totalHours.w, totalHours.n, totalHours.d || 1);
    const a1Imp = toImproper(activity1.whole, activity1.num, activity1.den);
    const a2Imp = toImproper(activity2.whole, activity2.num, activity2.den);

    const cd = lcm(lcm(totalImp.den, a1Imp.den), a2Imp.den);
    const remNum = totalImp.num * (cd / totalImp.den) - a1Imp.num * (cd / a1Imp.den) - a2Imp.num * (cd / a2Imp.den);
    if (remNum <= 0) return genWordMultistep(hard, _depth + 1); // retry if negative

    const result = toMixed(remNum, cd);
    const name = randomName();

    return {
      id: makeId(),
      topic: 'word-multistep',
      type: 'word-problem',
      difficulty: hard ? 3 : 2,
      question: `${name} has ${formatFrac(totalHours.w, totalHours.n, totalHours.d || 1)} hours before dinner. ${name} spends ${formatFracObj(activity1)} hours on homework and ${formatFracObj(activity2)} hour on chores. How much free time does ${name} have left?`,
      inputType: 'fraction',
      answer: result,
      requireSimplified: true,
      explanation: [
        `Start with ${formatFrac(totalHours.w, totalHours.n, totalHours.d || 1)} hours total.`,
        `Subtract homework: ${formatFrac(totalHours.w, totalHours.n, totalHours.d || 1)} − ${formatFracObj(activity1)}.`,
        `Then subtract chores: subtract another ${formatFracObj(activity2)} hour.`,
        `Answer: ${formatFracObj(result)} hours of free time.`
      ],
      hint: `Start with the total time and subtract each activity.`
    };
  }
}

// --- Word: Comparing ---
function genWordCompare(hard = false) {
  const [d1, d2] = pickTwoDens(hard);
  const f1 = randomProperFrac(d1);
  const f2 = randomProperFrac(d2);
  const name1 = randomName();
  let name2;
  do { name2 = randomName(); } while (name2 === name1);

  const equal = fracEqual(f1, f2);
  const f1bigger = fracGreater(f1, f2);

  const templates = [
    () => `${name1} walks ${f1.num}/${f1.den} mile. ${name2} walks ${f2.num}/${f2.den} mile. Do they walk the same distance?`,
    () => `${name1} eats ${f1.num}/${f1.den} of a pie. ${name2} eats ${f2.num}/${f2.den} of the same pie. Who eats more?`,
    () => `${name1} fills ${f1.num}/${f1.den} of a jar. ${name2} fills ${f2.num}/${f2.den} of an identical jar. Who fills more?`,
  ];

  // For "who eats/walks more" — answer is a name or "same"
  const isEqualQ = Math.random() < 0.4;
  let question, answer, choices;

  if (isEqualQ) {
    // Force equal fractions — use composite denominators
    const compDens = hard ? [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20] : [4, 6, 8, 10, 12];
    const baseDen = pick(compDens);
    const baseCandidates = [];
    for (let n = 1; n < baseDen; n++) { if (gcd(n, baseDen) > 1) baseCandidates.push(n); }
    const baseNum = pick(baseCandidates);
    const s = simplifyFrac(baseNum, baseDen);
    const m1 = randInt(2, 4);
    let m2;
    do { m2 = randInt(2, 5); } while (m2 === m1);
    const eqF1 = { num: s.num * m1, den: s.den * m1 };
    const eqF2 = { num: s.num * m2, den: s.den * m2 };

    question = `${name1} runs ${eqF1.num}/${eqF1.den} mile. ${name2} runs ${eqF2.num}/${eqF2.den} mile. Do they run the same distance?`;
    answer = 'Yes';
    choices = ['Yes', 'No'];

    return {
      id: makeId(),
      topic: 'word-compare',
      type: 'word-problem',
      difficulty: hard ? 2 : 1,
      question,
      inputType: 'choice',
      choices,
      answer,
      requireSimplified: false,
      explanation: [
        `Simplify both fractions to compare.`,
        `${eqF1.num}/${eqF1.den} = ${s.num}/${s.den} (divide by ${m1}).`,
        `${eqF2.num}/${eqF2.den} = ${s.num}/${s.den} (divide by ${m2}).`,
        `They're equal! Both are ${s.num}/${s.den}.`
      ],
      hint: `Try simplifying both fractions to their simplest form.`
    };
  } else {
    question = `${name1} uses ${f1.num}/${f1.den} gallon of gas. ${name2} uses ${f2.num}/${f2.den} gallon. Who uses more gas?`;
    answer = equal ? 'Same amount' : f1bigger ? name1 : name2;
    choices = [name1, name2, 'Same amount'];

    const commonDen = lcm(d1, d2);
    return {
      id: makeId(),
      topic: 'word-compare',
      type: 'word-problem',
      difficulty: hard ? 2 : 1,
      question,
      inputType: 'choice',
      choices,
      answer,
      requireSimplified: false,
      explanation: [
        `Compare ${f1.num}/${f1.den} and ${f2.num}/${f2.den}.`,
        `Common denominator: ${commonDen}.`,
        `${f1.num}/${f1.den} = ${f1.num * (commonDen / d1)}/${commonDen}, ${f2.num}/${f2.den} = ${f2.num * (commonDen / d2)}/${commonDen}.`,
        equal
          ? `They're equal!`
          : `${f1.num * (commonDen / d1)} ${f1bigger ? '>' : '<'} ${f2.num * (commonDen / d2)}, so ${answer} uses more.`
      ],
      hint: `Convert to a common denominator, then compare the numerators.`
    };
  }
}

// --- Word: Unit Conversion ---
function genWordConvert(hard = false, _depth = 0) {
  if (_depth > 8) {
    // Bail to a guaranteed-clean conversion: miles to yards with denominator 2
    const whole = randInt(1, 3);
    const imp = toImproper(whole, 1, 2);
    const yards = (imp.num * 1760) / imp.den;
    return {
      id: makeId(), topic: 'word-convert', type: 'word-problem', difficulty: 1,
      question: `${randomName()} walks ${formatFrac(whole, 1, 2)} miles. How many yards is that? (1 mile = 1,760 yards)`,
      inputType: 'number', answer: yards, requireSimplified: false,
      explanation: [`${formatFrac(whole, 1, 2)} miles = ${imp.num}/${imp.den} miles.`, `${imp.num}/${imp.den} × 1,760 = ${yards} yards.`],
      hint: 'Convert to an improper fraction, then multiply by 1,760.'
    };
  }
  const type = randInt(0, 2);

  if (type === 0) {
    // Miles to yards (1 mile = 1,760 yards)
    const den = pick([2, 4, 5, 8, 10]);
    const num = randInt(1, den - 1);
    const whole = randInt(1, hard ? 4 : 2);
    const totalMiles = toImproper(whole, num, den);
    const yards = (totalMiles.num * 1760) / totalMiles.den;

    return {
      id: makeId(),
      topic: 'word-convert',
      type: 'word-problem',
      difficulty: hard ? 3 : 2,
      question: `${randomName()} walks ${formatFrac(whole, num, den)} miles. How many yards is that? (1 mile = 1,760 yards)`,
      inputType: 'number',
      answer: yards,
      requireSimplified: false,
      explanation: [
        `Convert ${formatFrac(whole, num, den)} miles to an improper fraction: ${totalMiles.num}/${totalMiles.den} miles.`,
        `Multiply by 1,760 yards per mile: ${totalMiles.num}/${totalMiles.den} × 1,760.`,
        `= ${totalMiles.num} × 1,760 ÷ ${totalMiles.den}`,
        `= ${totalMiles.num * 1760} ÷ ${totalMiles.den}`,
        `= ${yards} yards.`
      ],
      hint: `First convert the mixed number to an improper fraction, then multiply by 1,760.`
    };
  }

  if (type === 1) {
    // Hours to minutes
    const den = pick([2, 3, 4, 6, 12]);
    const num = randInt(1, den - 1);
    const whole = randInt(1, hard ? 5 : 3);
    const totalHrs = toImproper(whole, num, den);
    const minutes = (totalHrs.num * 60) / totalHrs.den;

    if (minutes !== Math.floor(minutes)) return genWordConvert(hard, _depth + 1); // retry for clean answer

    return {
      id: makeId(),
      topic: 'word-convert',
      type: 'word-problem',
      difficulty: hard ? 3 : 2,
      question: `A movie is ${formatFrac(whole, num, den)} hours long. How many minutes is that? (1 hour = 60 minutes)`,
      inputType: 'number',
      answer: minutes,
      requireSimplified: false,
      explanation: [
        `Convert ${formatFrac(whole, num, den)} hours to an improper fraction: ${totalHrs.num}/${totalHrs.den} hours.`,
        `Multiply by 60: ${totalHrs.num}/${totalHrs.den} × 60 = ${totalHrs.num * 60}/${totalHrs.den} = ${minutes} minutes.`
      ],
      hint: `Convert to an improper fraction first, then multiply by 60.`
    };
  }

  // Feet to inches
  {
    const den = pick([2, 3, 4, 6]);
    const num = randInt(1, den - 1);
    const whole = randInt(1, hard ? 6 : 3);
    const totalFt = toImproper(whole, num, den);
    const inches = (totalFt.num * 12) / totalFt.den;

    if (inches !== Math.floor(inches)) return genWordConvert(hard, _depth + 1);

    return {
      id: makeId(),
      topic: 'word-convert',
      type: 'word-problem',
      difficulty: hard ? 3 : 2,
      question: `A board is ${formatFrac(whole, num, den)} feet long. How many inches is that? (1 foot = 12 inches)`,
      inputType: 'number',
      answer: inches,
      requireSimplified: false,
      explanation: [
        `Convert ${formatFrac(whole, num, den)} feet to improper fraction: ${totalFt.num}/${totalFt.den} feet.`,
        `Multiply by 12: ${totalFt.num}/${totalFt.den} × 12 = ${totalFt.num * 12}/${totalFt.den} = ${inches} inches.`
      ],
      hint: `Convert to an improper fraction, then multiply by 12.`
    };
  }
}

// ===== PROBLEM DISPATCH =====

const GENERATORS = {
  'simplify': genSimplify,
  'add-fractions': genAddFractions,
  'subtract-fractions': genSubtractFractions,
  'add-mixed': genAddMixed,
  'subtract-mixed': genSubtractMixed,
  'estimate': genEstimate,
  'equivalent': genEquivalent,
  'word-add': genWordAdd,
  'word-subtract': genWordSubtract,
  'word-multistep': genWordMultistep,
  'word-compare': genWordCompare,
  'word-convert': genWordConvert,
};

function generateProblem(topic, hard = false) {
  // Try the requested topic, falling back to easier version, then to a safe topic
  try {
    return GENERATORS[topic](hard);
  } catch (e) {}
  try {
    return GENERATORS[topic](false); // try easy mode
  } catch (e) {}
  // Fallback to a safe topic
  return genAddFractions(false);
}

// ===== PUBLIC API =====

export function generateDiagnostic() {
  // 2 problems per topic area, 14 total, shuffled
  const topics = [
    'simplify', 'add-fractions', 'subtract-fractions',
    'add-mixed', 'subtract-mixed', 'estimate', 'equivalent',
    'word-add', 'word-subtract', 'word-multistep',
    'word-compare', 'word-convert'
  ];
  const problems = [];
  for (const topic of topics) {
    problems.push(generateProblem(topic, false));
  }
  // Add extra word problems (60% weighting)
  const wordTopics = ['word-add', 'word-subtract', 'word-multistep', 'word-compare'];
  for (let i = 0; i < 4; i++) {
    problems.push(generateProblem(pick(wordTopics), false));
  }
  return shuffle(problems);
}

export function generateDrill(topic, count = 5) {
  const problems = [];
  for (let i = 0; i < count; i++) {
    problems.push(generateProblem(topic, false));
  }
  return problems;
}

export function generateFinalBoss() {
  // 15 problems, all hard, 60% word problems
  const problems = [];

  // 6 computation (hard)
  const compTopics = shuffle(['simplify', 'add-fractions', 'subtract-fractions', 'add-mixed', 'subtract-mixed', 'estimate']);
  for (let i = 0; i < 6; i++) {
    problems.push(generateProblem(compTopics[i], true));
  }

  // 9 word problems (hard)
  const wordTopics = ['word-add', 'word-subtract', 'word-multistep', 'word-multistep', 'word-compare', 'word-convert', 'word-add', 'word-subtract', 'word-multistep'];
  for (const t of wordTopics) {
    problems.push(generateProblem(t, true));
  }

  return shuffle(problems);
}

export function generateSimilar(problem) {
  // Generate a new problem of the same topic/difficulty for "redemption"
  return generateProblem(problem.topic, problem.difficulty >= 2);
}

// ===== ANSWER CHECKING =====

export function checkProblemAnswer(problem, userInput) {
  if (problem.inputType === 'choice') {
    // For choice, compare the selected choice
    const userClean = (userInput || '').trim().toLowerCase();
    const answerClean = problem.answer.toString().toLowerCase();
    // Check if user selected the right option (might be just the letter, or the full text)
    return userClean === answerClean ||
      userClean.startsWith(answerClean.charAt(0).toLowerCase()) && answerClean.startsWith(userClean.charAt(0));
  }

  if (problem.inputType === 'number') {
    const cleaned = (userInput || '').toString().replace(/,/g, '').trim();
    const userNum = parseFloat(cleaned);
    return !isNaN(userNum) && Math.abs(userNum - problem.answer) < 0.001;
  }

  // Fraction input
  const parsed = typeof userInput === 'object' ? userInput : parseAnswer(userInput);
  if (!parsed) return false;

  const userImp = toImproper(parsed.whole || 0, parsed.num, parsed.den);
  const expImp = toImproper(problem.answer.whole || 0, problem.answer.num, problem.answer.den);

  if (!fracEqual(userImp, expImp)) return false;

  // Check if simplified when required
  if (problem.requireSimplified && parsed.num > 0) {
    // Check if the fraction part itself isn't in lowest terms (e.g. 2/16 instead of 1/8)
    if (gcd(parsed.num, parsed.den) !== 1) return 'not-simplified';
    // If they entered an improper fraction (like 9/8 instead of 1 1/8), accept but nudge
    if (parsed.whole === 0 && parsed.num > parsed.den && parsed.den > 1) return 'not-mixed';
  }

  return true;
}

// ===== MASTERY SCORING =====

export function calculateMastery(results, confidence) {
  // results is { [topic]: { correct: number, total: number } }
  // confidence is { [topic]: ['confident', 'okay', 'struggling', ...] } (optional)
  const mastery = {};
  for (const [topic, data] of Object.entries(results)) {
    if (data.total === 0) {
      mastery[topic] = 'untested';
    } else {
      const pct = data.correct / data.total;
      // Check confidence — if student felt struggling on this topic, downgrade mastery
      const topicConf = confidence && confidence[topic];
      const hasStruggling = topicConf && topicConf.some(c => c === 'struggling');
      const allUnsure = topicConf && topicConf.every(c => c !== 'confident');

      if (pct >= 0.85) {
        // Got them right, but felt hard? Downgrade to learning so we practice more
        if (hasStruggling) mastery[topic] = 'learning';
        else mastery[topic] = 'mastered';
      } else if (pct >= 0.5) {
        mastery[topic] = 'learning';
      } else {
        mastery[topic] = 'needs-work';
      }
    }
  }
  return mastery;
}

// Group topics for display
export const TOPIC_GROUPS = {
  'Computation': ['simplify', 'add-fractions', 'subtract-fractions', 'add-mixed', 'subtract-mixed'],
  'Concepts': ['estimate', 'equivalent'],
  'Word Problems': ['word-add', 'word-subtract', 'word-multistep', 'word-compare', 'word-convert'],
};

export function getWeakTopics(mastery) {
  return Object.entries(mastery)
    .filter(([_, status]) => status === 'needs-work' || status === 'learning')
    .map(([topic]) => topic);
}

export function isFinalBossReady(mastery) {
  const tested = Object.values(mastery).filter(v => v !== 'untested');
  if (tested.length < 8) return false; // must have tested most topics
  const mastered = tested.filter(v => v === 'mastered').length;
  return mastered / tested.length >= 0.7; // 70% mastered
}

// ===== XP & LEVELS SYSTEM =====

export const LEVELS = [
  { level: 1, name: 'Rookie',       xpNeeded: 0 },
  { level: 2, name: 'Apprentice',   xpNeeded: 50 },
  { level: 3, name: 'Solver',       xpNeeded: 150 },
  { level: 4, name: 'Pro',          xpNeeded: 300 },
  { level: 5, name: 'Expert',       xpNeeded: 500 },
  { level: 6, name: 'Master',       xpNeeded: 800 },
  { level: 7, name: 'Champion',     xpNeeded: 1200 },
  { level: 8, name: 'Legend',        xpNeeded: 1800 },
  { level: 9, name: 'World Expert', xpNeeded: 2500 },
];

export function getLevelForXP(totalXP) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (totalXP >= l.xpNeeded) current = l;
    else break;
  }
  return current;
}

export function getXPProgress(totalXP) {
  const current = getLevelForXP(totalXP);
  const nextIdx = LEVELS.findIndex(l => l.level === current.level) + 1;
  if (nextIdx >= LEVELS.length) return { current, next: null, progress: 1, xpInLevel: 0, xpForLevel: 0 };
  const next = LEVELS[nextIdx];
  const xpInLevel = totalXP - current.xpNeeded;
  const xpForLevel = next.xpNeeded - current.xpNeeded;
  return { current, next, progress: xpInLevel / xpForLevel, xpInLevel, xpForLevel };
}

export function calculateXP({ correct, difficulty, firstTry, timeMs, streak, readExplanation }) {
  if (!correct) {
    return readExplanation ? 2 : 0;
  }

  let base = 10;

  // Difficulty multiplier
  if (difficulty >= 2) base = Math.round(base * 1.5);

  // First-try bonus
  if (firstTry) base += 5;

  // Streak multiplier
  if (streak >= 5) base = Math.round(base * 2.0);
  else if (streak >= 3) base = Math.round(base * 1.5);
  else if (streak >= 2) base = Math.round(base * 1.2);

  return base;
}

// ===== STREAK MESSAGES =====

export function getStreakMessage(streak) {
  if (streak === 3) return 'Hat trick!';
  if (streak === 5) return 'On fire!';
  if (streak === 8) return 'Unstoppable!';
  if (streak === 10) return 'LEGENDARY!';
  return null;
}

// ===== ADAPTIVE DIFFICULTY =====

// Track rolling window of last N answers per topic
export function updateTopicHistory(topicHistory, topic, correct, difficulty) {
  const h = { ...topicHistory };
  if (!h[topic]) h[topic] = [];
  h[topic] = [...h[topic], { correct, difficulty, t: Date.now() }].slice(-8); // keep last 8
  return h;
}

export function getTopicAccuracy(topicHistory, topic, windowSize = 5) {
  const entries = (topicHistory[topic] || []).slice(-windowSize);
  if (entries.length === 0) return 0.5; // default to middle
  const correct = entries.filter(e => e.correct).length;
  return correct / entries.length;
}

export function shouldBeHard(topicHistory, topic) {
  const acc = getTopicAccuracy(topicHistory, topic, 5);
  if (acc >= 0.8) return true;
  if (acc >= 0.4) return Math.random() < 0.3; // 30% chance of hard
  return false;
}

// Sliding-window mastery check
export function checkSlidingMastery(topicHistory, topic) {
  const entries = (topicHistory[topic] || []);
  if (entries.length < 8) return null; // not enough data
  const last8 = entries.slice(-8);
  const correct = last8.filter(e => e.correct).length;
  const hasHard = last8.some(e => e.difficulty >= 2);
  const acc = correct / last8.length;

  if (acc >= 0.8 && hasHard) return 'mastered';
  if (acc < 0.5) return 'needs-work';
  return null; // no change
}

// ===== WEIGHTED TOPIC SELECTION =====

export function selectSessionTopic(mastery, topicHistory, recentTopics = []) {
  const allTopics = Object.keys(TOPICS);
  const weights = {};

  for (const topic of allTopics) {
    const status = mastery[topic] || 'untested';
    if (status === 'needs-work') weights[topic] = 5;
    else if (status === 'learning') weights[topic] = 3;
    else if (status === 'untested') weights[topic] = 2;
    else weights[topic] = 1; // mastered
  }

  // Prevent same topic 3x in a row
  if (recentTopics.length >= 2) {
    const last2 = recentTopics.slice(-2);
    if (last2[0] === last2[1]) {
      weights[last2[0]] = 0;
    }
  }

  // Weighted random selection
  const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0);
  if (totalWeight === 0) return pick(allTopics);

  let r = Math.random() * totalWeight;
  for (const [topic, w] of Object.entries(weights)) {
    r -= w;
    if (r <= 0) return topic;
  }
  return allTopics[0];
}

// ===== SESSION PROBLEM GENERATOR =====

export function generateSessionProblem(topic, topicHistory) {
  const hard = shouldBeHard(topicHistory, topic);
  return generateProblem(topic, hard);
}

// ===== BADGES =====

export const BADGE_DEFS = {
  'first-steps':      { name: 'First Steps',      icon: '👟', desc: 'Complete your first practice session' },
  'quick-learner':    { name: 'Quick Learner',     icon: '⚡', desc: 'Get 5 correct in a row' },
  'streak-legend':    { name: 'Streak Legend',      icon: '🔥', desc: 'Get 10 correct in a row' },
  'comeback-kid':     { name: 'Comeback Kid',       icon: '💪', desc: 'Get a question right after getting one wrong' },
  'perfect-session':  { name: 'Perfect Session',    icon: '💎', desc: 'Get every question right in a session' },
  'steady-hand':      { name: 'Steady Hand',         icon: '🎯', desc: 'Get 5 correct in a row on hard problems' },
  'level-up':         { name: 'Level Up',            icon: '📈', desc: 'Reach Level 3' },
  'centurion':        { name: 'Centurion',           icon: '💯', desc: 'Earn 100 XP in one session' },
};

// Per-topic mastery badges
for (const [key, info] of Object.entries(TOPICS)) {
  BADGE_DEFS[`master-${key}`] = {
    name: `${info.name} Master`,
    icon: '🏅',
    desc: `Master ${info.name}`,
  };
}

export function checkNewBadges(existingBadges, { streak, sessionXP, sessionPerfect, level, masteredTopics, hardCorrectStreak, hadComeback, sessionsCompleted }) {
  const earned = [];
  const has = new Set(existingBadges || []);

  if (sessionsCompleted >= 1 && !has.has('first-steps')) earned.push('first-steps');
  if (streak >= 5 && !has.has('quick-learner')) earned.push('quick-learner');
  if (streak >= 10 && !has.has('streak-legend')) earned.push('streak-legend');
  if (hadComeback && !has.has('comeback-kid')) earned.push('comeback-kid');
  if (sessionPerfect && !has.has('perfect-session')) earned.push('perfect-session');
  if (hardCorrectStreak >= 5 && !has.has('steady-hand')) earned.push('steady-hand');
  if (level >= 3 && !has.has('level-up')) earned.push('level-up');
  if (sessionXP >= 100 && !has.has('centurion')) earned.push('centurion');

  for (const topic of (masteredTopics || [])) {
    const badgeKey = `master-${topic}`;
    if (!has.has(badgeKey)) earned.push(badgeKey);
  }

  return earned;
}

// ===== SESSION SUMMARY GENERATOR =====

export function generateSessionFeedback(results, topicHistory, mastery) {
  const feedback = [];
  const topicStats = {};

  for (const r of results) {
    if (!topicStats[r.topic]) topicStats[r.topic] = { correct: 0, total: 0 };
    topicStats[r.topic].total++;
    if (r.correct) topicStats[r.topic].correct++;
  }

  // Find improved and struggling topics
  const improved = [];
  const struggling = [];

  for (const [topic, stats] of Object.entries(topicStats)) {
    const pct = stats.correct / stats.total;
    if (pct >= 0.7) improved.push(topic);
    else struggling.push(topic);
  }

  if (improved.length > 0) {
    const names = improved.map(t => TOPICS[t]?.name || t);
    feedback.push(`${names.join(' and ')} looking good!`);
  }

  if (struggling.length > 0) {
    const names = struggling.map(t => TOPICS[t]?.name || t);
    // Add specific tips for common problem areas
    for (const topic of struggling) {
      if (topic === 'add-fractions' || topic === 'subtract-fractions') {
        feedback.push(`${TOPICS[topic].name} still needs work. Focus on finding the LCD before adding/subtracting.`);
      } else if (topic === 'subtract-mixed') {
        feedback.push(`${TOPICS[topic].name} needs more practice. Watch out for borrowing — if the fraction you're subtracting is bigger, borrow 1 from the whole number first.`);
      } else if (topic.startsWith('word-')) {
        feedback.push(`${TOPICS[topic].name}: Read carefully to figure out the operation first, then take it step by step.`);
      } else {
        feedback.push(`${TOPICS[topic].name} could use more reps.`);
      }
    }
  }

  if (feedback.length === 0) {
    feedback.push('Solid session! Keep building those reps.');
  }

  return feedback;
}
