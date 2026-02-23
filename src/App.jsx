import { useState, useEffect, useCallback, useRef } from 'react';
import {
  generateDiagnostic, generateDrill, generateFinalBoss, generateSimilar,
  checkProblemAnswer, calculateMastery, getWeakTopics, isFinalBossReady,
  formatFracObj, TOPICS, TOPIC_GROUPS, parseAnswer
} from './engine';
import { saveSummary, loadSummary, saveSessionResult } from './supabase';
import './App.css';

const STORAGE_KEY = 'math-test-prep-v1';

function loadProgress() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

function saveProgress(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function initResults() {
  const r = {};
  for (const topic of Object.keys(TOPICS)) {
    r[topic] = { correct: 0, total: 0 };
  }
  return r;
}

// ===== FRACTION DISPLAY =====
// Renders "3/4" and "2 1/3" as stacked visual fractions

function Frac({ num, den }) {
  return (
    <span className="fd">
      <span className="fd-num">{num}</span>
      <span className="fd-den">{den}</span>
    </span>
  );
}

function MixedFrac({ whole, num, den }) {
  return (
    <span className="fd-mixed">
      <span className="fd-whole">{whole}</span>
      <Frac num={num} den={den} />
    </span>
  );
}

function renderText(text) {
  if (!text || typeof text !== 'string') return text;
  // Match mixed numbers first (digit space digit/digit), then simple fractions
  const pattern = /(\d+)\s+(\d+)\/(\d+)|(\d+)\/(\d+)/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      parts.push(<MixedFrac key={key++} whole={match[1]} num={match[2]} den={match[3]} />);
    } else {
      parts.push(<Frac key={key++} num={match[4]} den={match[5]} />);
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : text;
}

function renderFracAnswer(answer) {
  if (typeof answer === 'object' && answer.den) {
    if (answer.num === 0) return answer.whole || '0';
    if ((answer.whole || 0) === 0) return <Frac num={answer.num} den={answer.den} />;
    return <MixedFrac whole={answer.whole} num={answer.num} den={answer.den} />;
  }
  return String(answer);
}

// ===== CONFIDENCE SELECTOR =====

function ConfidenceSelector({ onSelect }) {
  return (
    <div className="confidence-selector">
      <p className="confidence-prompt">How did that feel?</p>
      <div className="confidence-faces">
        <button className="confidence-btn" onClick={() => onSelect('confident')}>
          <span className="confidence-face">😊</span>
          <span className="confidence-label">Got it</span>
        </button>
        <button className="confidence-btn" onClick={() => onSelect('okay')}>
          <span className="confidence-face">😐</span>
          <span className="confidence-label">Meh</span>
        </button>
        <button className="confidence-btn" onClick={() => onSelect('struggling')}>
          <span className="confidence-face">😟</span>
          <span className="confidence-label">Hard</span>
        </button>
      </div>
    </div>
  );
}

// ===== FRACTION INPUT COMPONENT =====

function FractionInput({ onSubmit, disabled }) {
  const [whole, setWhole] = useState('');
  const [num, setNum] = useState('');
  const [den, setDen] = useState('');
  const numRef = useRef(null);
  const denRef = useRef(null);
  const wholeRef = useRef(null);

  useEffect(() => {
    setWhole(''); setNum(''); setDen('');
    // Focus the whole number field
    setTimeout(() => wholeRef.current?.focus(), 100);
  }, [disabled]);

  const handleSubmit = () => {
    const w = parseInt(whole) || 0;
    const n = parseInt(num) || 0;
    const d = parseInt(den) || 1;
    if (n === 0 && w === 0) return;
    if (n > 0 && d === 0) return;
    onSubmit({ whole: w, num: n, den: d });
  };

  const handleKey = (e, next) => {
    if (e.key === 'Enter') {
      if (next) next.current?.focus();
      else handleSubmit();
    }
  };

  return (
    <div className="fraction-input">
      <div className="fraction-fields">
        <input
          ref={wholeRef}
          type="number"
          inputMode="numeric"
          placeholder="0"
          value={whole}
          onChange={e => setWhole(e.target.value)}
          onKeyDown={e => handleKey(e, numRef)}
          disabled={disabled}
          className="frac-whole"
          aria-label="Whole number"
        />
        <div className="frac-separator">
          <input
            ref={numRef}
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={num}
            onChange={e => setNum(e.target.value)}
            onKeyDown={e => handleKey(e, denRef)}
            disabled={disabled}
            className="frac-num"
            aria-label="Numerator"
          />
          <div className="frac-bar" />
          <input
            ref={denRef}
            type="number"
            inputMode="numeric"
            placeholder="1"
            value={den}
            onChange={e => setDen(e.target.value)}
            onKeyDown={e => handleKey(e, null)}
            disabled={disabled}
            className="frac-den"
            aria-label="Denominator"
          />
        </div>
      </div>
      <button onClick={handleSubmit} disabled={disabled} className="submit-btn">
        Check
      </button>
      <div className="input-hint">
        Enter whole number (if any) on the left, fraction on the right
      </div>
    </div>
  );
}

// ===== NUMBER INPUT =====

function NumberInput({ onSubmit, disabled, unit }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    setValue('');
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [disabled]);

  const handleSubmit = () => {
    const cleaned = value.replace(/,/g, '');
    if (cleaned && !isNaN(parseFloat(cleaned))) {
      onSubmit(cleaned);
    }
  };

  return (
    <div className="number-input">
      <div className="number-field-row">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          placeholder="Your answer"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          disabled={disabled}
          className="number-field"
        />
        {unit && <span className="unit-label">{unit}</span>}
      </div>
      <button onClick={handleSubmit} disabled={disabled} className="submit-btn">
        Check
      </button>
    </div>
  );
}

// ===== CHOICE INPUT =====

function ChoiceInput({ choices, onSubmit, disabled }) {
  return (
    <div className="choice-input">
      {choices.map((choice, i) => (
        <button
          key={i}
          onClick={() => onSubmit(choice)}
          disabled={disabled}
          className="choice-btn"
        >
          {renderText(choice)}
        </button>
      ))}
    </div>
  );
}

// ===== PROBLEM VIEW =====

function ProblemView({ problem, onResult, showRetry = true, showConfidence = false }) {
  const [state, setState] = useState('answering'); // answering | retry | correct | wrong | confidence
  const [feedback, setFeedback] = useState('');
  const [feedbackExtra, setFeedbackExtra] = useState(null); // JSX for fraction answer display
  const [attempts, setAttempts] = useState(0);
  const [key, setKey] = useState(0);
  const [wasCorrect, setWasCorrect] = useState(false);

  // Reset when problem changes
  useEffect(() => {
    setState('answering');
    setFeedback('');
    setFeedbackExtra(null);
    setAttempts(0);
    setKey(k => k + 1);
    setWasCorrect(false);
  }, [problem.id]);

  const handleAnswer = (answer) => {
    const result = checkProblemAnswer(problem, answer);
    setAttempts(a => a + 1);

    if (result === true) {
      setState('correct');
      setFeedback(attempts === 0 ? 'Nailed it!' : 'Got it on the retry!');
      setWasCorrect(true);
      if (showConfidence) {
        // Don't auto-advance — wait for confidence selection
        setTimeout(() => setState('confidence'), 1000);
      } else {
        setTimeout(() => onResult(true), 1200);
      }
    } else if (result === 'not-simplified') {
      setFeedback('Right value, but simplify your fraction!');
      setKey(k => k + 1);
    } else if (result === 'not-mixed') {
      setFeedback('Correct! But write it as a mixed number.');
      setKey(k => k + 1);
    } else if (attempts === 0 && showRetry) {
      setState('retry');
      setFeedback('Not quite. Give it one more shot!');
      setKey(k => k + 1);
      setTimeout(() => setState('answering'), 100);
    } else {
      setState('wrong');
      setWasCorrect(false);
      setFeedback('The answer is ');
      setFeedbackExtra(
        problem.inputType === 'fraction'
          ? renderFracAnswer(problem.answer)
          : String(problem.answer)
      );
    }
  };

  const handleConfidence = (confidence) => {
    onResult(wasCorrect, confidence);
  };

  const handleNext = () => {
    if (showConfidence) {
      setState('confidence');
    } else {
      onResult(false);
    }
  };

  const isDisabled = state === 'correct' || state === 'wrong' || state === 'confidence';

  return (
    <div className={`problem-view ${state}`}>
      <div className="problem-question">
        {problem.type === 'word-problem' && <span className="problem-badge">Word Problem</span>}
        <p>{renderText(problem.question)}</p>
      </div>

      {problem.inputType === 'fraction' && (
        <FractionInput key={key} onSubmit={handleAnswer} disabled={isDisabled} />
      )}
      {problem.inputType === 'number' && (
        <NumberInput key={key} onSubmit={handleAnswer} disabled={isDisabled} />
      )}
      {problem.inputType === 'choice' && (
        <ChoiceInput choices={problem.choices} onSubmit={handleAnswer} disabled={isDisabled} />
      )}

      {feedback && (
        <div className={`feedback ${state === 'correct' || state === 'confidence' ? 'feedback-correct' : state === 'wrong' ? 'feedback-wrong' : 'feedback-retry'}`}>
          {(state === 'correct' || (state === 'confidence' && wasCorrect)) && <span className="feedback-icon">✓</span>}
          {state === 'wrong' && <span className="feedback-icon">✗</span>}
          {state === 'retry' || (state === 'answering' && attempts > 0) ? <span className="feedback-icon">↻</span> : null}
          {feedback}{feedbackExtra}
        </div>
      )}

      {state === 'wrong' && (
        <div className="explanation">
          <h4>Here's how to solve it:</h4>
          <ol>
            {problem.explanation.map((step, i) => (
              <li key={i}>{renderText(step)}</li>
            ))}
          </ol>
          <button className="next-btn" onClick={handleNext}>
            Next →
          </button>
        </div>
      )}

      {state === 'confidence' && (
        <ConfidenceSelector onSelect={handleConfidence} />
      )}

      {problem.hint && state === 'answering' && attempts === 0 && (
        <details className="hint">
          <summary>Need a hint?</summary>
          <p>{renderText(problem.hint)}</p>
        </details>
      )}
    </div>
  );
}

// ===== WELCOME SCREEN =====

function WelcomeScreen({ onStart, onResume, hasSavedProgress }) {
  return (
    <div className="screen welcome-screen">
      <div className="welcome-content">
        <div className="welcome-icon">🧠</div>
        <h1>World Expert Mode</h1>
        <h2>Chapter 8: Fractions</h2>
        <p className="welcome-subtitle">
          Don't just pass the test. <em>Own</em> the material.
        </p>

        <div className="welcome-steps">
          <div className="step">
            <span className="step-num">1</span>
            <span>Diagnostic quiz to find your strengths</span>
          </div>
          <div className="step">
            <span className="step-num">2</span>
            <span>Targeted practice on what needs work</span>
          </div>
          <div className="step">
            <span className="step-num">3</span>
            <span>Boss level — harder than the real test</span>
          </div>
        </div>

        <button className="primary-btn" onClick={onStart}>
          Start Diagnostic
        </button>
        {hasSavedProgress && (
          <button className="secondary-btn" onClick={onResume}>
            Continue Where I Left Off
          </button>
        )}
      </div>
    </div>
  );
}

// ===== DIAGNOSTIC SCREEN =====

function DiagnosticScreen({ onComplete }) {
  const [problems] = useState(() => generateDiagnostic());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState(initResults);
  const [confidence, setConfidence] = useState({}); // { [topic]: ['confident', 'struggling', ...] }

  const handleResult = (correct, conf) => {
    const problem = problems[currentIndex];

    // Track confidence per topic (build new object so we can pass it to onComplete)
    const updatedConfidence = { ...confidence };
    if (!updatedConfidence[problem.topic]) updatedConfidence[problem.topic] = [];
    updatedConfidence[problem.topic] = [...updatedConfidence[problem.topic], conf || 'okay'];
    setConfidence(updatedConfidence);

    const newResults = { ...results };
    newResults[problem.topic] = {
      correct: results[problem.topic].correct + (correct ? 1 : 0),
      total: results[problem.topic].total + 1
    };
    setResults(newResults);

    if (currentIndex + 1 < problems.length) {
      setCurrentIndex(i => i + 1);
    } else {
      setTimeout(() => {
        onComplete(newResults, updatedConfidence);
      }, 300);
    }
  };

  return (
    <div className="screen diagnostic-screen">
      <div className="progress-bar-container">
        <div className="progress-label">
          Diagnostic: {currentIndex + 1} of {problems.length}
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${((currentIndex) / problems.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="topic-tag">
        {TOPICS[problems[currentIndex].topic]?.icon} {TOPICS[problems[currentIndex].topic]?.name}
      </div>

      <ProblemView
        key={problems[currentIndex].id}
        problem={problems[currentIndex]}
        onResult={handleResult}
        showRetry={false}
        showConfidence={true}
      />
    </div>
  );
}

// ===== MASTERY MAP SCREEN =====

function MasteryMapScreen({ results, mastery, onDrill, onFinalBoss, bossReady }) {
  const weakTopics = getWeakTopics(mastery);
  const totalCorrect = Object.values(results).reduce((s, r) => s + r.correct, 0);
  const totalQuestions = Object.values(results).reduce((s, r) => s + r.total, 0);

  return (
    <div className="screen mastery-screen">
      <h2>Your Mastery Map</h2>
      <div className="mastery-summary">
        <div className="score-circle">
          <span className="score-number">{totalQuestions > 0 ? Math.round(totalCorrect / totalQuestions * 100) : 0}%</span>
          <span className="score-label">Overall</span>
        </div>
      </div>

      {Object.entries(TOPIC_GROUPS).map(([groupName, topics]) => (
        <div key={groupName} className="mastery-group">
          <h3>{groupName}</h3>
          <div className="mastery-topics">
            {topics.map(topic => {
              const status = mastery[topic] || 'untested';
              const data = results[topic] || { correct: 0, total: 0 };
              return (
                <div key={topic} className={`mastery-topic mastery-${status}`}>
                  <div className="mastery-topic-header">
                    <span className="mastery-icon">
                      {status === 'mastered' ? '◆' : status === 'learning' ? '◇' : status === 'needs-work' ? '▲' : '○'}
                    </span>
                    <span className="mastery-name">{TOPICS[topic].name}</span>
                    {data.total > 0 && (
                      <span className="mastery-score">{data.correct}/{data.total}</span>
                    )}
                  </div>
                  {(status === 'needs-work' || status === 'learning') && (
                    <button className="drill-btn" onClick={() => onDrill(topic)}>
                      Practice This →
                    </button>
                  )}
                  {status === 'mastered' && (
                    <button className="drill-btn drill-btn-review" onClick={() => onDrill(topic)}>
                      Review
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {weakTopics.length > 0 && (
        <div className="suggested-action">
          <p>Suggested: Practice <strong>{TOPICS[weakTopics[0]].name}</strong></p>
          <button className="primary-btn" onClick={() => onDrill(weakTopics[0])}>
            Let's Go →
          </button>
        </div>
      )}

      {bossReady && (
        <div className="boss-ready">
          <div className="boss-icon">⚡</div>
          <h3>Boss Level Unlocked</h3>
          <p>You've shown mastery across the board. Ready for the hard version?</p>
          <button className="boss-btn" onClick={onFinalBoss}>
            Start Boss Level
          </button>
        </div>
      )}

      {!bossReady && weakTopics.length === 0 && (
        <div className="suggested-action">
          <p>Keep practicing to unlock the Boss Level!</p>
        </div>
      )}
    </div>
  );
}

// ===== DRILL SCREEN =====

function DrillScreen({ topic, onComplete }) {
  const [problems] = useState(() => generateDrill(topic, 5));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correct, setCorrect] = useState(0);

  const handleResult = (isCorrect) => {
    if (isCorrect) setCorrect(c => c + 1);

    if (currentIndex + 1 < problems.length) {
      setCurrentIndex(i => i + 1);
    } else {
      const finalCorrect = correct + (isCorrect ? 1 : 0);
      setTimeout(() => onComplete(finalCorrect, problems.length), 800);
    }
  };

  return (
    <div className="screen drill-screen">
      <div className="progress-bar-container">
        <div className="progress-label">
          {TOPICS[topic].icon} {TOPICS[topic].name}: {currentIndex + 1} of {problems.length}
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${((currentIndex) / problems.length) * 100}%` }}
          />
        </div>
      </div>

      <ProblemView
        key={problems[currentIndex].id}
        problem={problems[currentIndex]}
        onResult={handleResult}
        showRetry={true}
      />
    </div>
  );
}

// ===== DRILL RESULTS =====

function DrillResultsScreen({ topic, correct, total, onAgain, onBack }) {
  const pct = Math.round(correct / total * 100);
  const mastered = pct >= 80;

  return (
    <div className="screen drill-results-screen">
      <div className={`drill-result-card ${mastered ? 'result-mastered' : 'result-keep-going'}`}>
        <div className="result-icon">{mastered ? '◆' : '◇'}</div>
        <h2>{TOPICS[topic].name}</h2>
        <div className="result-score">{correct} / {total}</div>
        <p className="result-message">
          {mastered
            ? "You've mastered this! Nice work."
            : pct >= 50
              ? "Getting there! One more round should lock it in."
              : "This one needs some work. Let's practice more."}
        </p>
        <div className="result-actions">
          {!mastered && (
            <button className="primary-btn" onClick={onAgain}>
              Practice Again
            </button>
          )}
          <button className={mastered ? "primary-btn" : "secondary-btn"} onClick={onBack}>
            Back to Map
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== FINAL BOSS SCREEN =====

function FinalBossScreen({ onComplete }) {
  const [problems] = useState(() => generateFinalBoss());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [startTime] = useState(Date.now());

  const handleResult = (isCorrect) => {
    if (isCorrect) setCorrect(c => c + 1);

    if (currentIndex + 1 < problems.length) {
      setCurrentIndex(i => i + 1);
    } else {
      const finalCorrect = correct + (isCorrect ? 1 : 0);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      setTimeout(() => onComplete(finalCorrect, problems.length, elapsed), 800);
    }
  };

  return (
    <div className="screen boss-screen">
      <div className="progress-bar-container boss-progress">
        <div className="progress-label">
          ⚡ Boss Level: {currentIndex + 1} of {problems.length}
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill boss-fill"
            style={{ width: `${((currentIndex) / problems.length) * 100}%` }}
          />
        </div>
      </div>

      <ProblemView
        key={problems[currentIndex].id}
        problem={problems[currentIndex]}
        onResult={handleResult}
        showRetry={true}
      />
    </div>
  );
}

// ===== BOSS RESULTS =====

function BossResultsScreen({ correct, total, elapsed, onRestart, onBack }) {
  const pct = Math.round(correct / total * 100);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="screen boss-results-screen">
      <div className="boss-result-card">
        <div className="boss-result-icon">
          {pct >= 90 ? '🏆' : pct >= 70 ? '⚡' : '💪'}
        </div>
        <h2>Boss Level Complete</h2>
        <div className="boss-score">{correct} / {total}</div>
        <div className="boss-pct">{pct}%</div>
        <div className="boss-time">Time: {minutes}:{seconds.toString().padStart(2, '0')}</div>
        <p className="boss-message">
          {pct >= 93
            ? "World Expert status confirmed. The real test should feel easy."
            : pct >= 80
              ? "Strong showing! A little more practice and you'll crush it."
              : pct >= 60
                ? "Good effort! Review the topics you missed and try again."
                : "The boss level is tough on purpose. Head back and practice the weak spots."}
        </p>
        <div className="boss-actions">
          {pct < 90 && (
            <button className="primary-btn" onClick={onBack}>
              Back to Map
            </button>
          )}
          <button className={pct >= 90 ? "primary-btn" : "secondary-btn"} onClick={onRestart}>
            Try Boss Level Again
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== MAIN APP =====

export default function App() {
  const [screen, setScreen] = useState('welcome');
  const [results, setResults] = useState(initResults);
  const [mastery, setMastery] = useState({});
  const [currentTopic, setCurrentTopic] = useState(null);
  const [drillResult, setDrillResult] = useState(null);
  const [bossResult, setBossResult] = useState(null);
  const [hasSaved, setHasSaved] = useState(false);
  const [confidenceData, setConfidenceData] = useState({});

  // Check for saved progress on mount — try Supabase first, then localStorage
  useEffect(() => {
    async function init() {
      // Try Supabase first
      const cloud = await loadSummary();
      if (cloud && cloud.results && Object.values(cloud.results).some(r => r.total > 0)) {
        setResults(cloud.results);
        setMastery(cloud.mastery || calculateMastery(cloud.results));
        setConfidenceData(cloud.confidence || {});
        setHasSaved(true);
        // Also update localStorage to keep in sync
        saveProgress({ results: cloud.results, mastery: cloud.mastery, confidence: cloud.confidence });
        return;
      }

      // Fall back to localStorage
      const local = loadProgress();
      if (local) {
        setHasSaved(true);
        // If localStorage has data but Supabase doesn't, sync it up
        if (Object.values(local.results || {}).some(r => r.total > 0)) {
          const m = local.mastery || calculateMastery(local.results);
          saveSummary(local.results, m, local.confidence || {});
        }
      }
    }
    init();
  }, []);

  // Save progress whenever results change — to both localStorage AND Supabase
  useEffect(() => {
    if (Object.values(results).some(r => r.total > 0)) {
      saveProgress({ results, mastery, confidence: confidenceData });
      saveSummary(results, mastery, confidenceData);
    }
  }, [results, mastery, confidenceData]);

  const handleDiagnosticComplete = useCallback((diagnosticResults, confData) => {
    setResults(diagnosticResults);
    setConfidenceData(confData);
    const m = calculateMastery(diagnosticResults, confData);
    setMastery(m);
    setScreen('mastery');
    // Save per-topic diagnostic results to Supabase for history
    for (const [topic, data] of Object.entries(diagnosticResults)) {
      if (data.total > 0) {
        saveSessionResult('diagnostic', topic, data.correct, data.total, confData[topic] || []);
      }
    }
  }, []);

  const handleDrill = useCallback((topic) => {
    setCurrentTopic(topic);
    setDrillResult(null);
    setScreen('drill');
  }, []);

  const handleDrillComplete = useCallback((correct, total) => {
    // Save drill session to history
    saveSessionResult('drill', currentTopic, correct, total);
    // Update results
    setResults(prev => {
      const updated = { ...prev };
      updated[currentTopic] = {
        correct: (prev[currentTopic]?.correct || 0) + correct,
        total: (prev[currentTopic]?.total || 0) + total,
      };
      const m = calculateMastery(updated);
      setMastery(m);
      return updated;
    });
    setDrillResult({ correct, total });
    setScreen('drill-results');
  }, [currentTopic]);

  const handleFinalBossComplete = useCallback((correct, total, elapsed) => {
    const bossData = { correct, total, elapsed };
    setBossResult(bossData);
    setScreen('boss-results');
    // Save boss result to Supabase
    saveSessionResult('boss', 'all', correct, total);
    saveSummary(results, mastery, confidenceData, bossData);
  }, [results, mastery, confidenceData]);

  const handleResume = useCallback(async () => {
    // Try Supabase first
    const cloud = await loadSummary();
    if (cloud && cloud.results && Object.values(cloud.results).some(r => r.total > 0)) {
      setResults(cloud.results);
      setMastery(cloud.mastery || calculateMastery(cloud.results));
      setConfidenceData(cloud.confidence || {});
      setScreen('mastery');
      return;
    }
    // Fall back to localStorage
    const saved = loadProgress();
    if (saved) {
      setResults(saved.results);
      setMastery(saved.mastery || calculateMastery(saved.results));
      setConfidenceData(saved.confidence || {});
      setScreen('mastery');
    }
  }, []);

  const handleReset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setResults(initResults());
    setMastery({});
    setScreen('welcome');
    setHasSaved(false);
  }, []);

  const bossReady = isFinalBossReady(mastery);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          {screen !== 'welcome' && (
            <button className="back-btn" onClick={() => {
              if (screen === 'drill-results' || screen === 'boss-results' || screen === 'mastery') {
                setScreen('mastery');
              } else if (screen === 'drill' || screen === 'boss') {
                if (confirm('Are you sure? Your progress on this round will be lost.')) {
                  setScreen('mastery');
                }
              } else {
                setScreen('welcome');
              }
            }}>
              ← Back
            </button>
          )}
        </div>
        <div className="header-center">
          <span className="header-title">World Expert Mode</span>
        </div>
        <div className="header-right">
          {screen !== 'welcome' && (
            <button className="reset-btn" onClick={() => {
              if (confirm('Reset all progress? This cannot be undone.')) handleReset();
            }}>
              Reset
            </button>
          )}
        </div>
      </header>

      <main className="app-main">
        {screen === 'welcome' && (
          <WelcomeScreen
            onStart={() => setScreen('diagnostic')}
            onResume={handleResume}
            hasSavedProgress={hasSaved}
          />
        )}
        {screen === 'diagnostic' && (
          <DiagnosticScreen onComplete={handleDiagnosticComplete} />
        )}
        {screen === 'mastery' && (
          <MasteryMapScreen
            results={results}
            mastery={mastery}
            onDrill={handleDrill}
            onFinalBoss={() => setScreen('boss')}
            bossReady={bossReady}
          />
        )}
        {screen === 'drill' && currentTopic && (
          <DrillScreen
            key={currentTopic + Date.now()}
            topic={currentTopic}
            onComplete={handleDrillComplete}
          />
        )}
        {screen === 'drill-results' && drillResult && (
          <DrillResultsScreen
            topic={currentTopic}
            correct={drillResult.correct}
            total={drillResult.total}
            onAgain={() => handleDrill(currentTopic)}
            onBack={() => setScreen('mastery')}
          />
        )}
        {screen === 'boss' && (
          <FinalBossScreen onComplete={handleFinalBossComplete} />
        )}
        {screen === 'boss-results' && bossResult && (
          <BossResultsScreen
            correct={bossResult.correct}
            total={bossResult.total}
            elapsed={bossResult.elapsed}
            onRestart={() => setScreen('boss')}
            onBack={() => setScreen('mastery')}
          />
        )}
      </main>
    </div>
  );
}
