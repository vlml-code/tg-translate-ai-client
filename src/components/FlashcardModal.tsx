import React, { useState, useEffect } from 'react';
import { DictionaryEntry } from '../types';
import { localDictionary } from '../services/localDictionary';
import './FlashcardModal.css';

interface FlashcardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FlashcardModal: React.FC<FlashcardModalProps> = ({ isOpen, onClose }) => {
  const [wordsToReview, setWordsToReview] = useState<DictionaryEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [stats, setStats] = useState({ dueNow: 0, dueToday: 0, total: 0 });

  useEffect(() => {
    if (isOpen) {
      loadReviewSession();
    }
  }, [isOpen]);

  const loadReviewSession = () => {
    const words = localDictionary.getWordsForReview();
    // Randomize the order to prevent pattern recognition
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    const stats = localDictionary.getReviewStats();
    setWordsToReview(shuffled);
    setStats(stats);
    setCurrentIndex(0);
    setShowAnswer(false);
  };

  const handleQualityResponse = (quality: number) => {
    const currentWord = wordsToReview[currentIndex];
    if (!currentWord) return;

    // Update SRS
    localDictionary.updateAfterReview(currentWord.word, quality);

    // Move to next card or finish
    if (currentIndex < wordsToReview.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowAnswer(false);
    } else {
      // Session complete
      loadReviewSession(); // Reload to see if more words are due
    }
  };

  const toggleAnswer = () => {
    setShowAnswer(!showAnswer);
  };

  // Calculate interval previews based on current word state
  const getIntervalPreview = (quality: number): string => {
    if (!currentWord) return '';

    const isNew = currentWord.reviewCount === 0;
    const isLearning = currentWord.reviewCount === 1;

    if (quality === 1) {
      return '10 min';
    } else if (quality === 3) {
      if (isNew) return '12 hrs';
      if (isLearning) return '1 day';
      const days = Math.round(currentWord.interval * 1.2);
      return days === 1 ? '1 day' : `${days} days`;
    } else if (quality === 4) {
      if (isNew) return '1 day';
      if (isLearning) return '6 days';
      const days = Math.round(currentWord.interval * currentWord.easeFactor);
      return days === 1 ? '1 day' : `${days} days`;
    } else if (quality === 5) {
      if (isNew) return '4 days';
      if (isLearning) return '10 days';
      const days = Math.round(currentWord.interval * currentWord.easeFactor * 1.3);
      return days === 1 ? '1 day' : `${days} days`;
    }
    return '';
  };

  if (!isOpen) {
    return null;
  }

  const currentWord = wordsToReview[currentIndex];
  const progress = wordsToReview.length > 0
    ? Math.round(((currentIndex + 1) / wordsToReview.length) * 100)
    : 0;

  return (
    <div className="flashcard-modal-overlay" onClick={onClose}>
      <div className="flashcard-modal" onClick={(e) => e.stopPropagation()}>
        <div className="flashcard-header">
          <div className="flashcard-stats">
            <span className="stat-badge due-now">{stats.dueNow} due now</span>
            <span className="stat-badge due-today">{stats.dueToday} due today</span>
            <span className="stat-badge total">{stats.total} total words</span>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {wordsToReview.length === 0 ? (
          <div className="no-reviews">
            <div className="success-icon">✓</div>
            <h2>All caught up!</h2>
            <p>No words due for review right now.</p>
            <p className="tip">Learn new words by using the "Segment" button on messages.</p>
          </div>
        ) : (
          <>
            <div className="flashcard-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <span className="progress-text">
                {currentIndex + 1} / {wordsToReview.length}
              </span>
            </div>

            <div className={`flashcard ${showAnswer ? 'flipped' : ''}`}>
              <div className="flashcard-front">
                <div className="card-label">Chinese</div>
                <div className="card-word">{currentWord?.word}</div>
                <div className="card-label">Pinyin</div>
                <div className="card-pinyin">{currentWord?.pinyin}</div>
                {showAnswer && (
                  <>
                    <div className="card-divider"></div>
                    <div className="card-label">Meaning</div>
                    <div className="card-meaning">
                      {currentWord?.meanings.join('; ')}
                    </div>
                  </>
                )}
              </div>
            </div>

            {!showAnswer ? (
              <div className="flashcard-actions">
                <button className="show-answer-btn" onClick={toggleAnswer}>
                  Show Answer
                </button>
              </div>
            ) : (
              <div className="flashcard-actions">
                <div className="quality-label">How well did you know this?</div>
                <div className="quality-buttons">
                  <button
                    className="quality-btn again"
                    onClick={() => handleQualityResponse(1)}
                  >
                    <span className="btn-label">Again</span>
                    <span className="btn-interval">{getIntervalPreview(1)}</span>
                  </button>
                  <button
                    className="quality-btn hard"
                    onClick={() => handleQualityResponse(3)}
                  >
                    <span className="btn-label">Hard</span>
                    <span className="btn-interval">{getIntervalPreview(3)}</span>
                  </button>
                  <button
                    className="quality-btn good"
                    onClick={() => handleQualityResponse(4)}
                  >
                    <span className="btn-label">Good</span>
                    <span className="btn-interval">{getIntervalPreview(4)}</span>
                  </button>
                  <button
                    className="quality-btn easy"
                    onClick={() => handleQualityResponse(5)}
                  >
                    <span className="btn-label">Easy</span>
                    <span className="btn-interval">{getIntervalPreview(5)}</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
