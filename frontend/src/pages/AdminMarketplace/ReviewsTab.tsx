import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Loader2, Star, EyeOff, Eye, Trash2 } from 'lucide-react';
import { adminMarketplaceApi } from '../../services/api/adminMarketplace';
import { AdminReviewRow } from '../../types/adminMarketplace';

export const ReviewsTab: React.FC = () => {
  const [reviews, setReviews] = useState<AdminReviewRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminMarketplaceApi.getReviews();
      setReviews(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggleApproval = async (id: string, isApproved: boolean) => {
    setIsSaving(true);
    setError(null);
    try {
      await adminMarketplaceApi.toggleReviewApproval(id, isApproved);
      setReviews(reviews.map(r => r.id === id ? { ...r, isApproved } : r));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle review visibility');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this review?')) return;
    setIsSaving(true);
    setError(null);
    try {
      await adminMarketplaceApi.deleteReview(id);
      setReviews(reviews.filter(r => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete review');
    } finally {
      setIsSaving(false);
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        size={14}
        color={i < rating ? 'var(--status-beta)' : 'var(--border-subtle)'}
        fill={i < rating ? 'var(--status-beta)' : 'none'}
        style={{ marginRight: 2 }}
      />
    ));
  };

  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}><Loader2 className="au-spin" size={24} /></div>;
  }

  return (
    <div className="au-table-card card-base" style={{ padding: '24px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Reviews & Feedback Moderation</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>
        Monitor marketplace reviews. You can hide abusive reviews to prevent them from showing publicly or delete them completely.
      </p>

      {error && (
        <div className="au-inline-error" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={15} />
          <p>{error}</p>
        </div>
      )}

      <div className="au-table-scroll">
        <table className="au-table" style={{ opacity: isSaving ? 0.6 : 1 }}>
          <thead>
            <tr>
              <th>User</th>
              <th>API</th>
              <th>Rating & Review</th>
              <th>Date</th>
              <th>Status</th>
              <th data-align="end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((review) => (
              <tr key={review.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{review.userName || 'Unnamed'}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{review.userEmail}</div>
                </td>
                <td>
                  <div style={{ fontWeight: 500 }}>{review.apiName}</div>
                </td>
                <td style={{ maxWidth: '300px' }}>
                  <div style={{ display: 'flex', marginBottom: 4 }}>
                    {renderStars(review.rating)}
                  </div>
                  {review.title && <div style={{ fontWeight: 600, fontSize: '12px' }}>{review.title}</div>}
                  {review.content && <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{review.content}</div>}
                </td>
                <td><span style={{ color: 'var(--text-muted)' }}>{new Date(review.createdAt).toLocaleDateString()}</span></td>
                <td>
                  {review.isApproved ? (
                    <span className="au-badge" data-status="active">Visible</span>
                  ) : (
                    <span className="au-badge" data-status="offline">Hidden</span>
                  )}
                </td>
                <td data-align="end">
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                     {review.isApproved ? (
                       <button className="au-ghost-btn" style={{ padding: '4px 8px' }} onClick={() => handleToggleApproval(review.id, false)} title="Hide Review">
                         <EyeOff size={14} style={{ marginRight: 4 }} /> Hide
                       </button>
                     ) : (
                       <button className="au-ghost-btn" style={{ padding: '4px 8px' }} onClick={() => handleToggleApproval(review.id, true)} title="Make Visible">
                         <Eye size={14} style={{ marginRight: 4 }} /> Publish
                       </button>
                     )}
                     <button className="au-ghost-btn" style={{ padding: '4px 8px', color: 'var(--status-error)' }} onClick={() => handleDelete(review.id)} title="Delete Review">
                       <Trash2 size={14} />
                     </button>
                  </div>
                </td>
              </tr>
            ))}
            {reviews.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px' }}>No reviews found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
