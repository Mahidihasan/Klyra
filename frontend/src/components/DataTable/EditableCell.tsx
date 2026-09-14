import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface EditableCellProps {
  value: string | number;
  onSave?: (newValue: string) => void;
  isEditable?: boolean;
}

export const EditableCell: React.FC<EditableCellProps> = ({ 
  value, 
  onSave,
  isEditable = true 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync prop changes
  useEffect(() => {
    setCurrentValue(String(value));
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Move cursor to end
      const length = inputRef.current.value.length;
      inputRef.current.setSelectionRange(length, length);
    }
  }, [isEditing]);

  const handleSave = () => {
    if (currentValue !== String(value) && onSave) {
      onSave(currentValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setCurrentValue(String(value)); // Reset
      setIsEditing(false);
    }
  };

  if (!isEditable) {
    return <div className="cell-content readonly">{value}</div>;
  }

  return (
    <div 
      className="editable-cell-wrapper"
      onClick={() => !isEditing && setIsEditing(true)}
    >
      {!isEditing ? (
        <motion.div 
          className="cell-content interactive"
          whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
        >
          {currentValue}
        </motion.div>
      ) : (
        <input
          ref={inputRef}
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="cell-input"
          autoFocus
        />
      )}

      <style>{`
        .editable-cell-wrapper {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          position: relative;
        }
        .cell-content {
          width: 100%;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: default;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cell-content.interactive {
          cursor: text;
          border: 1px solid transparent;
        }
        .cell-input {
          width: 100%;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid #a78bfa;
          border-radius: 4px;
          color: #fff;
          font-family: inherit;
          font-size: inherit;
          outline: none;
          box-shadow: 0 0 0 2px rgba(167, 139, 250, 0.2);
        }
      `}</style>
    </div>
  );
};
