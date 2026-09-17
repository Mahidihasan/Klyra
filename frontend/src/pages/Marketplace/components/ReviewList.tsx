import React, { useState } from 'react';
import { Star, ThumbsUp, Shield, Send } from 'lucide-react';
import { ApiReviewsResponse, ApiReviewItem } from '../../../services/api/catalog';

interface ReviewListProps {
  reviewsData: ApiReviewsResponse | null;
  isLoading: boolean;
  onSubmitReview?: (rating: number, title: string, content: string) => void;
  canReview?: boolean;
}

export const ReviewList: React.FC<ReviewListProps> = ({
  reviewsData,
  isLoading,
  onSubmitReview,
  canReview = false,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  const handleSubmit = () => {
    if (newRating < 1 || newRating > 5) return;
    onSubmitReview?.(newRating, newTitle, newContent);
    setShowForm(false);
    setNewTitle('');
    setNewContent('');
    setNewRating(5);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="rl-container">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="rl-review rl-skeleton">
            <div className="rl-skel-avatar" />
            <div className="rl-skel-body">
              <div className="rl-skel-line w40" />
              <div className="rl-skel-line w80" />
              <div className="rl-skel-line w60" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const summary = reviewsData?.summary || {
    averageRating: 0,
    totalReviews: 0,
    ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };
  const reviews = reviewsData?.reviews || [];

  return (
    <div className="rl-container">
      {/* Rating Summary */}
      <div className="rl-summary">
        <div className="rl-avg-block">
          <span className="rl-avg-number">{summary.averageRating.toFixed(1)}</span>
          <div className="rl-avg-stars">
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                size={16}
                fill={i < Math.round(summary.averageRating) ? '#f59e0b' : 'none'}
                stroke={i < Math.round(summary.averageRating) ? '#f59e0b' : '#64748b'}
              />
            ))}
          </div>
          <span className="rl-total-reviews">{summary.totalReviews} reviews</span>
        </div>

        <div className="rl-breakdown">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = summary.ratingBreakdown[star] || 0;
            const pct = summary.totalReviews > 0 ? (count / summary.totalReviews) * 100 : 0;
            return (
              <div key={star} className="rl-bar-row">
                <span className="rl-bar-label">{star}★</span>
                <div className="rl-bar-track">
                  <div className="rl-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="rl-bar-count">{count}</span>
              </div>
            );
          })}
        </div>

        {canReview && (
          <button className="rl-write-btn" onClick={() => setShowForm(!showForm)}>
            <Send size={14} />
            Write a Review
          </button>
        )}
      </div>

      {/* Review Form */}
      {showForm && (
        <div className="rl-form">
          <div className="rl-form-stars">
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                size={24}
                className="rl-form-star"
                fill={i < (hoverRating || newRating) ? '#f59e0b' : 'none'}
                stroke={i < (hoverRating || newRating) ? '#f59e0b' : '#64748b'}
                onMouseEnter={() => setHoverRating(i + 1)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setNewRating(i + 1)}
              />
            ))}
          </div>
          <input
            className="rl-form-input"
            placeholder="Review title (optional)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <textarea
            className="rl-form-textarea"
            placeholder="Share your experience..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={3}
          />
          <div className="rl-form-actions">
            <button className="rl-form-cancel" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="rl-form-submit" onClick={handleSubmit}>Submit Review</button>
          </div>
        </div>
      )}

      {/* Review List */}
      {reviews.length === 0 && !showForm ? (
        <div className="rl-empty">
          <p>No reviews yet. Be the first to share your experience!</p>
        </div>
      ) : (
        <div className="rl-reviews">
          {reviews.map((rev) => (
            <div key={rev.id} className="rl-review">
              <div className="rl-avatar-wrap">
                {rev.userAvatarUrl ? (
                  <img src={rev.userAvatarUrl} alt="" className="rl-avatar" />
                ) : (
                  <div className="rl-avatar-placeholder">{rev.userName.charAt(0)}</div>
                )}
              </div>
              <div className="rl-review-body">
                <div className="rl-review-top">
                  <span className="rl-reviewer-name">
                    {rev.userName}
                    {rev.isVerified && (
                      <Shield size={11} className="rl-verified-badge" />
                    )}
                  </span>
                  <span className="rl-review-date">{formatDate(rev.createdAt)}</span>
                </div>
                <div className="rl-review-stars">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      size={12}
                      fill={i < rev.rating ? '#f59e0b' : 'none'}
                      stroke={i < rev.rating ? '#f59e0b' : '#64748b'}
                    />
                  ))}
                </div>
                {rev.title && <h4 className="rl-review-title">{rev.title}</h4>}
                {rev.content && <p className="rl-review-content">{rev.content}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .rl-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .rl-summary {
          display: flex;
          align-items: center;
          gap: 24px;
          padding: 20px;
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-lg);
          flex-wrap: wrap;
        }

        .rl-avg-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          min-width: 80px;
        }

        .rl-avg-number {
          font-size: 36px;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1;
        }

        .rl-avg-stars { display: flex; gap: 2px; }

        .rl-total-reviews {
          font-size: 11px;
          color: var(--text-muted);
        }

        .rl-breakdown {
          flex: 1;
          min-width: 180px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .rl-bar-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .rl-bar-label {
          font-size: 11px;
          color: var(--text-muted);
          min-width: 24px;
          text-align: right;
        }

        .rl-bar-track {
          flex: 1;
          height: 6px;
          background: var(--bg-pill);
          border-radius: 3px;
          overflow: hidden;
        }

        .rl-bar-fill {
          height: 100%;
          background: var(--accent-gradient);
          border-radius: 3px;
          transition: width 0.4s ease;
        }

        .rl-bar-count {
          font-size: 11px;
          color: var(--text-muted);
          min-width: 20px;
        }

        .rl-write-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: var(--radius-md);
          background: var(--accent-gradient);
          color: #fff;
          font-size: 12.5px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .rl-write-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.1);
        }

        /* Form */
        .rl-form {
          padding: 20px;
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .rl-form-stars {
          display: flex;
          gap: 4px;
        }

        .rl-form-star { cursor: pointer; transition: transform 0.1s; }
        .rl-form-star:hover { transform: scale(1.2); }

        .rl-form-input,
        .rl-form-textarea {
          width: 100%;
          background: var(--bg-input);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          padding: 10px 14px;
          color: var(--text-primary);
          font-size: 13px;
          font-family: var(--font-sans);
          resize: vertical;
        }

        .rl-form-input:focus,
        .rl-form-textarea:focus {
          outline: none;
          border-color: var(--border-focus);
        }

        .rl-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .rl-form-cancel {
          padding: 8px 14px;
          border-radius: var(--radius-md);
          background: transparent;
          border: 1px solid var(--border-card);
          color: var(--text-secondary);
          font-size: 12.5px;
          cursor: pointer;
        }

        .rl-form-submit {
          padding: 8px 16px;
          border-radius: var(--radius-md);
          background: var(--accent-gradient);
          color: #fff;
          border: none;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
        }

        /* Reviews */
        .rl-reviews {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .rl-review {
          display: flex;
          gap: 12px;
          padding: 16px;
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-lg);
        }

        .rl-avatar-wrap { flex-shrink: 0; }

        .rl-avatar,
        .rl-avatar-placeholder {
          width: 36px;
          height: 36px;
          border-radius: 50%;
        }

        .rl-avatar-placeholder {
          background: var(--bg-pill);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
          color: var(--text-muted);
        }

        .rl-review-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .rl-review-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .rl-reviewer-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .rl-verified-badge { color: #22c55e; }

        .rl-review-date {
          font-size: 11px;
          color: var(--text-muted);
        }

        .rl-review-stars { display: flex; gap: 2px; }

        .rl-review-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          margin-top: 4px;
        }

        .rl-review-content {
          font-size: 12.5px;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        .rl-empty {
          text-align: center;
          padding: 40px 24px;
          color: var(--text-muted);
          font-size: 13px;
        }

        /* Skeleton */
        .rl-skeleton { pointer-events: none; }
        .rl-skel-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: var(--bg-card-hover); animation: shimmer 1.5s infinite;
        }
        .rl-skel-body { flex: 1; display: flex; flex-direction: column; gap: 6px; }
        .rl-skel-line {
          height: 10px; border-radius: 5px;
          background: var(--bg-card-hover); animation: shimmer 1.5s infinite;
        }
        .rl-skel-line.w40 { width: 40%; }
        .rl-skel-line.w80 { width: 80%; }
        .rl-skel-line.w60 { width: 60%; }
      `}</style>
    </div>
  );
};
