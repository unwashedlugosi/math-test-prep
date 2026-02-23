import { useState, useEffect, useCallback, useRef } from 'react';
import {
  generateDiagnostic, generateDrill, generateFinalBoss, generateSimilar,
  checkProblemAnswer, calculateMastery, getWeakTopics, isFinalBossReady,
  formatFracObj, TOPICS, TOPIC_GROUPS, parseAnswer,
  // New practice session exports
  LEVELS, getLevelForXP, getXPProgress, calculateXP, getStreakMessage,
  updateTopicHistory, selectSessionTopic, generateSessionProblem,
  checkSlidingMastery, BADGE_DEFS, checkNewBadges, generateSessionFeedback,
} from './engine';
import {
  saveSummary, loadSummary, saveSessionResult,
  loadProfile, saveProfile, createSession, updateSession, saveProblemResult, flushWriteQueue,
  loadActiveSession, saveSessionState,
} from './supabase';
import './App.css';

const STORAGE_KEY = 'math-test-prep-v1';
const PROFILE_KEY = 'math-prep-profile-v1';
const SESSION_LIMIT_PROBLEMS = 20;
const SESSION_LIMIT_MS = 20 * 60 * 1000; // 20 minutes

function loadProgress() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

function saveProgress(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadLocalProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
  } catch { return null; }
}

function saveLocalProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function initResults() {
  const r = {};
  for (const topic of Object.keys(TOPICS)) {
    r[topic] = { correct: 0, total: 0 };
  }
  return r;
}

function defaultProfile() {
  return {
    total_xp: 0, level: 1, streak: 0, best_streak: 0,
    mastery: {}, topic_history: {}, badges: [],
    sessions_completed: 0, problems_solved: 0,
  };
}

// ===== FRACTION DISPLAY =====

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

// ===== FRACTION INPUT =====

function FractionInput({ onSubmit, disabled }) {
  const [whole, setWhole] = useState('');
  const [num, setNum] = useState('');
  const [den, setDen] = useState('');
  const numRef = useRef(null);
  const denRef = useRef(null);
  const wholeRef = useRef(null);

  useEffect(() => {
    setWhole(''); setNum(''); setDen('');
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

// ===== XP FLOAT ANIMATION =====

function XPFloat({ xp, visible }) {
  if (!visible || !xp) return null;
  return (
    <div className="xp-float" key={Date.now()}>
      +{xp} XP
    </div>
  );
}

// ===== LEVEL BAR =====

function LevelBar({ profile }) {
  const { current, next, progress, xpInLevel, xpForLevel } = getXPProgress(profile.total_xp);

  return (
    <div className="level-bar">
      <div className="level-bar-info">
        <span className="level-badge">Lv.{current.level}</span>
        <span className="level-name">{current.name}</span>
        <span className="level-xp">{profile.total_xp} XP</span>
      </div>
      <div className="level-progress">
        <div className="level-progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>
      {next && (
        <div className="level-next">
          {xpInLevel} / {xpForLevel} to {next.name}
        </div>
      )}
    </div>
  );
}

// ===== LEVEL UP OVERLAY =====

function LevelUpOverlay({ level, onDone }) {
  const levelInfo = LEVELS.find(l => l.level === level);

  useEffect(() => {
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="level-up-overlay" onClick={onDone}>
      <div className="level-up-content">
        <div className="level-up-icon">⬆️</div>
        <div className="level-up-text">LEVEL UP!</div>
        <div className="level-up-level">Level {level}</div>
        <div className="level-up-name">{levelInfo?.name}</div>
      </div>
    </div>
  );
}

// ===== STREAK DISPLAY =====

function StreakDisplay({ streak }) {
  if (streak < 2) return null;
  const msg = getStreakMessage(streak);

  return (
    <div className="streak-display">
      <span className="streak-flame">🔥</span>
      <span className="streak-count">{streak}</span>
      {msg && <span className="streak-message">{msg}</span>}
    </div>
  );
}

// ===== SESSION TIMER =====

function SessionTimer({ startTime, limitMs }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const remaining = Math.max(0, limitMs - elapsed);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return (
    <div className="session-timer">
      {minutes}:{seconds.toString().padStart(2, '0')}
    </div>
  );
}

// ===== PROBLEM VIEW =====

function ProblemView({ problem, onResult, showRetry = true, showConfidence = false }) {
  const [state, setState] = useState('answering');
  const [feedback, setFeedback] = useState('');
  const [feedbackExtra, setFeedbackExtra] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [key, setKey] = useState(0);
  const [wasCorrect, setWasCorrect] = useState(false);

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
        setTimeout(() => setState('confidence'), 1000);
      } else {
        setTimeout(() => onResult(true, null, attempts === 0), 1200);
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
    onResult(wasCorrect, confidence, attempts <= 1 && wasCorrect);
  };

  const handleNext = () => {
    if (showConfidence) {
      setState('confidence');
    } else {
      onResult(false, null, false);
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

function WelcomeScreen({ onStart, onResume, onPractice, hasSavedProgress, profile }) {
  return (
    <div className="screen welcome-screen">
      <div className="welcome-content">
        <div className="welcome-icon">🧠</div>
        <h1>World Expert Mode</h1>
        <h2>Chapter 8: Fractions</h2>

        {profile && profile.total_xp > 0 && (
          <LevelBar profile={profile} />
        )}

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

        {hasSavedProgress && (
          <button className="primary-btn session-btn" onClick={onPractice}>
            ⚡ Practice Session
          </button>
        )}

        {!hasSavedProgress && (
          <button className="primary-btn" onClick={onStart}>
            Start Diagnostic
          </button>
        )}

        {hasSavedProgress && (
          <button className="secondary-btn" onClick={onResume}>
            Continue Where I Left Off
          </button>
        )}

        {!hasSavedProgress && null}
      </div>
    </div>
  );
}

// ===== DIAGNOSTIC SCREEN =====

function DiagnosticScreen({ onComplete }) {
  const [problems] = useState(() => generateDiagnostic());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState(initResults);
  const [confidence, setConfidence] = useState({});

  const handleResult = (correct, conf) => {
    const problem = problems[currentIndex];

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

function MasteryMapScreen({ results, mastery, onDrill, onFinalBoss, onPractice, bossReady, profile }) {
  const weakTopics = getWeakTopics(mastery);
  const totalCorrect = Object.values(results).reduce((s, r) => s + r.correct, 0);
  const totalQuestions = Object.values(results).reduce((s, r) => s + r.total, 0);

  return (
    <div className="screen mastery-screen">
      <h2>Your Mastery Map</h2>

      {profile && (
        <LevelBar profile={profile} />
      )}

      <div className="mastery-summary">
        <div className="score-circle">
          <span className="score-number">{totalQuestions > 0 ? Math.round(totalCorrect / totalQuestions * 100) : 0}%</span>
          <span className="score-label">Overall</span>
        </div>
      </div>

      {/* Practice Session CTA */}
      <div className="practice-cta">
        <button className="primary-btn session-btn" onClick={onPractice}>
          ⚡ Practice Session
        </button>
        <p className="practice-cta-sub">20 min of adaptive practice — focuses on your weak spots</p>
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

// ===== PRACTICE SESSION SCREEN =====

function SessionScreen({ profile, mastery, onComplete, resumeSession }) {
  const rs = resumeSession?.session_state || {};
  const [sessionId] = useState(() => resumeSession?.id || crypto.randomUUID());
  const [startTime] = useState(() => resumeSession ? new Date(resumeSession.started_at).getTime() : Date.now());
  const [problemIndex, setProblemIndex] = useState(rs.problemIndex || 0);
  const [currentProblem, setCurrentProblem] = useState(null);
  const [problemStartTime, setProblemStartTime] = useState(Date.now());
  const [streak, setStreak] = useState(rs.streak || 0);
  const [sessionXP, setSessionXP] = useState(rs.sessionXP || 0);
  const [sessionResults, setSessionResults] = useState(rs.sessionResults || []);
  const [topicHistory, setTopicHistory] = useState(rs.topicHistory || profile.topic_history || {});
  const [recentTopics, setRecentTopics] = useState(rs.recentTopics || []);
  const [xpFloat, setXpFloat] = useState({ xp: 0, visible: false });
  const [showLevelUp, setShowLevelUp] = useState(null);
  const [sessionMastery, setSessionMastery] = useState(rs.sessionMastery || { ...mastery });
  const [masteryToast, setMasteryToast] = useState(null);
  const [countdown, setCountdown] = useState(resumeSession ? 0 : 3);
  const [sessionStarted, setSessionStarted] = useState(!!resumeSession);
  const prevLevelRef = useRef(rs.prevLevel || profile.level || 1);
  const hardCorrectStreakRef = useRef(rs.hardCorrectStreak || 0);
  const bestHardStreakRef = useRef(rs.bestHardStreak || 0);
  const hadComebackRef = useRef(rs.hadComeback || false);
  const lastWasWrongRef = useRef(rs.lastWasWrong || false);

  // Register session in Supabase (only for new sessions)
  useEffect(() => {
    if (!resumeSession) {
      // We pass our own sessionId so Supabase session matches local state
      createSession('practice', sessionId).catch(() => {});
    }
  }, []);

  // Countdown
  useEffect(() => {
    if (countdown <= 0) {
      setSessionStarted(true);
      return;
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Generate first problem after countdown
  useEffect(() => {
    if (sessionStarted && !currentProblem) {
      generateNext();
    }
  }, [sessionStarted]);

  // Check timer expiry
  useEffect(() => {
    if (!sessionStarted) return;
    const interval = setInterval(() => {
      if (Date.now() - startTime >= SESSION_LIMIT_MS) {
        finishSession();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStarted, startTime]);

  const generateNext = () => {
    const topic = selectSessionTopic(sessionMastery, topicHistory, recentTopics);
    const problem = generateSessionProblem(topic, topicHistory);
    setCurrentProblem(problem);
    setProblemStartTime(Date.now());
    setRecentTopics(prev => [...prev.slice(-2), topic]);
  };

  const finishSession = () => {
    const totalCorrect = sessionResults.filter(r => r.correct).length;
    const totalAttempted = sessionResults.length;

    // Update session in Supabase
    updateSession(sessionId, {
      ended_at: new Date().toISOString(),
      problems_attempted: totalAttempted,
      problems_correct: totalCorrect,
      xp_earned: sessionXP,
      streak_high: Math.max(streak, ...(sessionResults.map(() => 0))),
      mastery_snapshot: sessionMastery,
      topics_covered: [...new Set(sessionResults.map(r => r.topic))],
    }).catch(() => {});

    onComplete({
      sessionResults,
      sessionXP,
      streak,
      topicHistory,
      sessionMastery,
      totalCorrect,
      totalAttempted,
      elapsed: Date.now() - startTime,
      hardCorrectStreak: bestHardStreakRef.current,
      hadComeback: hadComebackRef.current,
    });
  };

  const handleResult = (correct, _confidence, firstTry) => {
    const timeMs = Date.now() - problemStartTime;
    const newStreak = correct ? streak + 1 : 0;

    // Track comeback
    if (correct && lastWasWrongRef.current) {
      hadComebackRef.current = true;
    }
    lastWasWrongRef.current = !correct;

    // Track hard-problem correct streaks
    if (correct && currentProblem.difficulty >= 2) {
      hardCorrectStreakRef.current++;
      bestHardStreakRef.current = Math.max(bestHardStreakRef.current, hardCorrectStreakRef.current);
    } else if (!correct) {
      hardCorrectStreakRef.current = 0;
    }

    const xp = calculateXP({
      correct,
      difficulty: currentProblem.difficulty,
      firstTry: firstTry !== false,
      timeMs,
      streak: newStreak,
      readExplanation: !correct, // assume they read if wrong
    });

    const newTotalXP = (profile.total_xp || 0) + sessionXP + xp;
    const newLevel = getLevelForXP(newTotalXP);

    // Check for level up
    if (newLevel.level > prevLevelRef.current) {
      prevLevelRef.current = newLevel.level;
      setTimeout(() => setShowLevelUp(newLevel.level), 500);
    }

    // Update topic history
    const newHistory = updateTopicHistory(topicHistory, currentProblem.topic, correct, currentProblem.difficulty);
    setTopicHistory(newHistory);

    // Check sliding mastery
    const masteryChange = checkSlidingMastery(newHistory, currentProblem.topic);
    if (masteryChange) {
      const newMastery = { ...sessionMastery, [currentProblem.topic]: masteryChange };
      setSessionMastery(newMastery);
      if (masteryChange === 'mastered') {
        setMasteryToast(currentProblem.topic);
        setTimeout(() => setMasteryToast(null), 3000);
      }
    }

    // Record result
    const result = {
      topic: currentProblem.topic,
      difficulty: currentProblem.difficulty,
      correct,
      first_try: firstTry !== false,
      time_spent_ms: timeMs,
      xp_awarded: xp,
    };
    const newResults = [...sessionResults, result];
    setSessionResults(newResults);

    // Save problem result to Supabase
    saveProblemResult({ ...result, session_id: sessionId }).catch(() => {});

    // Update state
    setStreak(newStreak);
    setSessionXP(prev => prev + xp);

    // Show XP float
    if (xp > 0) {
      setXpFloat({ xp, visible: true });
      setTimeout(() => setXpFloat({ xp: 0, visible: false }), 1500);
    }

    // Save session state after every answer for crash recovery
    const nextIndex = problemIndex + 1;
    const newSessionXP = sessionXP + xp;
    const bestStrk = Math.max(newStreak, ...(newResults.map(() => 0)));
    const topicsCovered = [...new Set(newResults.map(r => r.topic))];
    const updatedMastery = masteryChange ? { ...sessionMastery, [currentProblem.topic]: masteryChange } : sessionMastery;
    saveSessionState(sessionId, {
      problemIndex: nextIndex,
      correctCount: newResults.filter(r => r.correct).length,
      sessionXP: newSessionXP,
      bestStreak: bestStrk,
      streak: newStreak,
      sessionMastery: updatedMastery,
      topicsCovered,
      sessionResults: newResults,
      topicHistory: newHistory,
      recentTopics: [...recentTopics.slice(-2), currentProblem.topic],
      prevLevel: prevLevelRef.current,
      hardCorrectStreak: hardCorrectStreakRef.current,
      bestHardStreak: bestHardStreakRef.current,
      hadComeback: hadComebackRef.current,
      lastWasWrong: lastWasWrongRef.current,
    }).catch(() => {});

    // Next problem or finish
    if (nextIndex >= SESSION_LIMIT_PROBLEMS || Date.now() - startTime >= SESSION_LIMIT_MS) {
      setTimeout(finishSession, 1000);
    } else {
      setProblemIndex(nextIndex);
      setTimeout(generateNext, 800);
    }
  };

  if (!sessionStarted) {
    return (
      <div className="screen session-countdown">
        <div className="countdown-content">
          <div className="countdown-number">{countdown > 0 ? countdown : 'GO!'}</div>
          <p>Practice Session</p>
        </div>
      </div>
    );
  }

  if (!currentProblem) return null;

  return (
    <div className="screen session-screen">
      <div className="session-header">
        <div className="session-header-top">
          <SessionTimer startTime={startTime} limitMs={SESSION_LIMIT_MS} />
          <StreakDisplay streak={streak} />
          <div className="session-xp-display">+{sessionXP} XP</div>
        </div>
        <div className="progress-bar-container">
          <div className="progress-label">
            Problem {problemIndex + 1} of {SESSION_LIMIT_PROBLEMS}
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(problemIndex / SESSION_LIMIT_PROBLEMS) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="topic-tag">
        {TOPICS[currentProblem.topic]?.icon} {TOPICS[currentProblem.topic]?.name}
        {currentProblem.difficulty >= 2 && <span className="difficulty-badge">HARD</span>}
      </div>

      <ProblemView
        key={currentProblem.id}
        problem={currentProblem}
        onResult={handleResult}
        showRetry={true}
        showConfidence={false}
      />

      <XPFloat xp={xpFloat.xp} visible={xpFloat.visible} />

      {masteryToast && (
        <div className="mastery-toast">
          🏅 You mastered {TOPICS[masteryToast]?.name}!
        </div>
      )}

      {showLevelUp && (
        <LevelUpOverlay level={showLevelUp} onDone={() => setShowLevelUp(null)} />
      )}
    </div>
  );
}

// ===== SESSION SUMMARY SCREEN =====

function SessionSummaryScreen({ data, profile, onBack, onAgain }) {
  const { sessionResults, sessionXP, totalCorrect, totalAttempted, elapsed, topicHistory, sessionMastery } = data;
  const pct = totalAttempted > 0 ? Math.round(totalCorrect / totalAttempted * 100) : 0;
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);
  const feedback = generateSessionFeedback(sessionResults, topicHistory, sessionMastery);

  // Topic breakdown
  const topicStats = {};
  for (const r of sessionResults) {
    if (!topicStats[r.topic]) topicStats[r.topic] = { correct: 0, total: 0 };
    topicStats[r.topic].total++;
    if (r.correct) topicStats[r.topic].correct++;
  }

  return (
    <div className="screen session-summary-screen">
      <div className="session-summary-card">
        <div className="summary-header">
          <div className="summary-icon">{pct >= 80 ? '🏆' : pct >= 60 ? '💪' : '📈'}</div>
          <h2>Session Complete</h2>
        </div>

        <div className="summary-stats">
          <div className="summary-stat">
            <span className="stat-value">{totalCorrect}/{totalAttempted}</span>
            <span className="stat-label">Correct</span>
          </div>
          <div className="summary-stat">
            <span className="stat-value">{pct}%</span>
            <span className="stat-label">Accuracy</span>
          </div>
          <div className="summary-stat">
            <span className="stat-value">+{sessionXP}</span>
            <span className="stat-label">XP Earned</span>
          </div>
          <div className="summary-stat">
            <span className="stat-value">{minutes}:{seconds.toString().padStart(2, '0')}</span>
            <span className="stat-label">Time</span>
          </div>
        </div>

        {profile && <LevelBar profile={profile} />}

        {/* Topic breakdown */}
        <div className="summary-topics">
          <h3>Topic Breakdown</h3>
          {Object.entries(topicStats).map(([topic, stats]) => {
            const topicPct = Math.round(stats.correct / stats.total * 100);
            return (
              <div key={topic} className="summary-topic-row">
                <span className="summary-topic-name">{TOPICS[topic]?.name || topic}</span>
                <span className={`summary-topic-score ${topicPct >= 70 ? 'score-good' : 'score-needs-work'}`}>
                  {stats.correct}/{stats.total}
                </span>
              </div>
            );
          })}
        </div>

        {/* Honest feedback */}
        <div className="summary-feedback">
          <h3>Assessment</h3>
          {feedback.map((line, i) => (
            <p key={i} className="feedback-line">{line}</p>
          ))}
        </div>

        <div className="summary-actions">
          <button className="primary-btn session-btn" onClick={onAgain}>
            Another Session →
          </button>
          <button className="secondary-btn" onClick={onBack}>
            Back to Map
          </button>
        </div>
      </div>
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
  const [profile, setProfile] = useState(defaultProfile);
  const [sessionData, setSessionData] = useState(null);
  const [resumeSession, setResumeSession] = useState(null);

  // Check for saved progress on mount — try Supabase first, then localStorage
  useEffect(() => {
    async function init() {
      // Load profile
      const cloudProfile = await loadProfile();
      if (cloudProfile) {
        setProfile(cloudProfile);
        saveLocalProfile(cloudProfile);

        // If profile has mastery data (seeded from review packet), use it
        if (cloudProfile.mastery && Object.keys(cloudProfile.mastery).length > 0) {
          setMastery(cloudProfile.mastery);
          setHasSaved(true);
        }
      } else {
        const localProfile = loadLocalProfile();
        if (localProfile) {
          setProfile(localProfile);
          if (localProfile.mastery && Object.keys(localProfile.mastery).length > 0) {
            setMastery(localProfile.mastery);
            setHasSaved(true);
          }
        }
      }

      // Try Supabase for diagnostic data (adds cumulative results on top of profile mastery)
      const cloud = await loadSummary();
      if (cloud && cloud.results && Object.values(cloud.results).some(r => r.total > 0)) {
        setResults(cloud.results);
        setMastery(cloud.mastery || calculateMastery(cloud.results));
        setConfidenceData(cloud.confidence || {});
        setHasSaved(true);
        saveProgress({ results: cloud.results, mastery: cloud.mastery, confidence: cloud.confidence });
        return;
      }

      // Fall back to localStorage
      const local = loadProgress();
      if (local && Object.values(local.results || {}).some(r => r.total > 0)) {
        setHasSaved(true);
        const m = local.mastery || calculateMastery(local.results);
        setResults(local.results);
        setMastery(m);
        setConfidenceData(local.confidence || {});
        saveSummary(local.results, m, local.confidence || {});
      }

      // Check for active session to resume (crash recovery)
      try {
        const activeSession = await loadActiveSession();
        if (activeSession && activeSession.session_state) {
          setResumeSession(activeSession);
          setScreen('session');
        }
      } catch {}
    }
    init();
  }, []);

  // Save progress whenever results change
  useEffect(() => {
    if (Object.values(results).some(r => r.total > 0)) {
      saveProgress({ results, mastery, confidence: confidenceData });
      saveSummary(results, mastery, confidenceData);
    }
  }, [results, mastery, confidenceData]);

  // Save profile whenever it changes
  useEffect(() => {
    if (profile.total_xp > 0 || profile.sessions_completed > 0) {
      saveLocalProfile(profile);
      saveProfile(profile);
    }
  }, [profile]);

  const handleDiagnosticComplete = useCallback((diagnosticResults, confData) => {
    setResults(diagnosticResults);
    setConfidenceData(confData);
    const m = calculateMastery(diagnosticResults, confData);
    setMastery(m);
    setHasSaved(true);
    setScreen('mastery');

    // Seed profile with diagnostic mastery
    setProfile(prev => ({
      ...prev,
      mastery: m,
    }));

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
    saveSessionResult('drill', currentTopic, correct, total);

    // Award XP for drill (simpler: 10 per correct)
    const drillXP = correct * 10;

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

    setProfile(prev => {
      const newXP = (prev.total_xp || 0) + drillXP;
      const newLevel = getLevelForXP(newXP);
      return {
        ...prev,
        total_xp: newXP,
        level: newLevel.level,
        problems_solved: (prev.problems_solved || 0) + total,
      };
    });

    setDrillResult({ correct, total });
    setScreen('drill-results');
  }, [currentTopic]);

  const handlePracticeSession = useCallback(() => {
    setResumeSession(null); // clear any stale resume — start fresh
    setScreen('session');
  }, []);

  const handleSessionComplete = useCallback((data) => {
    setResumeSession(null); // session done, no more resume
    const { sessionXP, topicHistory, sessionMastery, totalCorrect, totalAttempted, streak, hardCorrectStreak, hadComeback } = data;

    // Update profile
    setProfile(prev => {
      const newXP = (prev.total_xp || 0) + sessionXP;
      const newLevel = getLevelForXP(newXP);
      const newBestStreak = Math.max(prev.best_streak || 0, streak);
      const newSessionsCompleted = (prev.sessions_completed || 0) + 1;

      // Check for new badges
      const masteredTopics = Object.entries(sessionMastery)
        .filter(([_, s]) => s === 'mastered')
        .map(([t]) => t);
      const newBadges = checkNewBadges(prev.badges || [], {
        streak,
        sessionXP,
        sessionPerfect: totalCorrect === totalAttempted && totalAttempted > 0,
        level: newLevel.level,
        masteredTopics,
        hardCorrectStreak,
        hadComeback,
        sessionsCompleted: newSessionsCompleted,
      });

      return {
        ...prev,
        total_xp: newXP,
        level: newLevel.level,
        streak: 0,
        best_streak: newBestStreak,
        mastery: sessionMastery,
        topic_history: topicHistory,
        badges: [...(prev.badges || []), ...newBadges],
        sessions_completed: newSessionsCompleted,
        problems_solved: (prev.problems_solved || 0) + totalAttempted,
      };
    });

    // Update diagnostic-level mastery
    setMastery(sessionMastery);

    setSessionData(data);
    setScreen('session-summary');

    // Flush any queued writes
    flushWriteQueue().catch(() => {});
  }, []);

  const handleFinalBossComplete = useCallback((correct, total, elapsed) => {
    const bossData = { correct, total, elapsed };
    setBossResult(bossData);
    setScreen('boss-results');
    saveSessionResult('boss', 'all', correct, total);
    saveSummary(results, mastery, confidenceData, bossData);

    // Award XP for boss
    const bossXP = correct * 15;
    setProfile(prev => {
      const newXP = (prev.total_xp || 0) + bossXP;
      const newLevel = getLevelForXP(newXP);
      return {
        ...prev,
        total_xp: newXP,
        level: newLevel.level,
        problems_solved: (prev.problems_solved || 0) + total,
      };
    });
  }, [results, mastery, confidenceData]);

  const handleResume = useCallback(async () => {
    const cloud = await loadSummary();
    if (cloud && cloud.results && Object.values(cloud.results).some(r => r.total > 0)) {
      setResults(cloud.results);
      setMastery(cloud.mastery || calculateMastery(cloud.results));
      setConfidenceData(cloud.confidence || {});
      setScreen('mastery');
      return;
    }
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
    localStorage.removeItem(PROFILE_KEY);
    setResults(initResults());
    setMastery({});
    setProfile(defaultProfile());
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
              if (screen === 'drill-results' || screen === 'boss-results' || screen === 'mastery' || screen === 'session-summary') {
                setScreen('mastery');
              } else if (screen === 'drill' || screen === 'boss' || screen === 'session') {
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
            onPractice={handlePracticeSession}
            hasSavedProgress={hasSaved}
            profile={profile}
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
            onPractice={handlePracticeSession}
            bossReady={bossReady}
            profile={profile}
          />
        )}
        {screen === 'session' && (
          <SessionScreen
            key={resumeSession ? 'resume-' + resumeSession.id : Date.now()}
            profile={profile}
            mastery={mastery}
            onComplete={handleSessionComplete}
            resumeSession={resumeSession}
          />
        )}
        {screen === 'session-summary' && sessionData && (
          <SessionSummaryScreen
            data={sessionData}
            profile={profile}
            onAgain={handlePracticeSession}
            onBack={() => setScreen('mastery')}
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
