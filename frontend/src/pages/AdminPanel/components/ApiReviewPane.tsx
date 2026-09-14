import React from 'react';
import { X, Check, MailX, Code2, FileJson, Play } from 'lucide-react';

interface ApiReviewPaneProps {
  api: any;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export const ApiReviewPane: React.FC<ApiReviewPaneProps> = ({ api, onClose, onApprove, onReject }) => {
  if (!api) return null;

  return (
    <div className="api-review-overlay">
      <div className="api-review-pane">
        {/* Left Side: Details & Spec */}
        <div className="api-review-left">
          <div className="review-header">
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>{api.name}</h2>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>Submitted by {api.provider} • v{api.version}</p>
            </div>
            <button className="btn-icon" onClick={onClose}><X size={20} /></button>
          </div>

          <div className="review-content">
            <div className="detail-section">
              <h3>Description</h3>
              <p>{api.description || 'No description provided.'}</p>
            </div>

            <div className="detail-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <FileJson size={16} color="var(--text-muted)" />
                <h3 style={{ margin: 0 }}>OpenAPI Spec (Raw)</h3>
              </div>
              <div className="code-block">
                <pre>
{`openapi: 3.0.0
info:
  title: ${api.name}
  version: ${api.version}
paths:
  /v1/predict:
    post:
      summary: Generate prediction
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
      responses:
        '200':
          description: Successful response`}
                </pre>
              </div>
            </div>
          </div>
          
          <div className="review-footer">
            <button className="btn-reject" onClick={() => onReject(api.id)}>
              <MailX size={16} /> Reject & Email
            </button>
            <button className="btn-approve" onClick={() => onApprove(api.id)}>
              <Check size={16} /> Approve API
            </button>
          </div>
        </div>

        {/* Right Side: Simulated Swagger UI */}
        <div className="api-review-right">
          <div className="swagger-header">
            <Code2 size={18} color="#22c55e" />
            Interactive Documentation
          </div>
          <div className="swagger-body">
            <div className="swagger-endpoint">
              <div className="endpoint-method post">POST</div>
              <div className="endpoint-path">/v1/predict</div>
              <div className="endpoint-desc">Generate prediction</div>
            </div>
            
            <div className="swagger-section">
              <h4>Parameters</h4>
              <div className="swagger-param">
                <div className="param-name">api_key <span style={{ color: '#ef4444' }}>*</span></div>
                <div className="param-type">string (header)</div>
                <input type="text" placeholder="sk_test_..." className="swagger-input" />
              </div>
            </div>

            <div className="swagger-section">
              <h4>Request Body</h4>
              <textarea className="swagger-textarea" defaultValue={'{\n  "input": "test data"\n}'}></textarea>
            </div>

            <button className="btn-execute">
              <Play size={14} /> Execute Request
            </button>

            <div className="swagger-response">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Response</span>
                <span style={{ color: '#22c55e', fontSize: 13 }}>200 OK</span>
              </div>
              <pre className="swagger-res-body">
{`{
  "status": "success",
  "data": {
    "prediction": 0.98
  }
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
