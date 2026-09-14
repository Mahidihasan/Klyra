import React, { useRef } from 'react';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
  invalid?: boolean;
}

const OTP_LENGTH = 6;

/** Accessible six-digit entry control for short-lived verification codes. */
export const OtpInput: React.FC<OtpInputProps> = ({ value, onChange, label, disabled = false, invalid = false }) => {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: OTP_LENGTH }, (_, index) => value[index] || '');

  const setDigits = (start: number, rawValue: string) => {
    const pastedDigits = rawValue.replace(/\D/g, '').slice(0, OTP_LENGTH - start).split('');
    if (!pastedDigits.length && rawValue) return;
    const next = [...digits];
    if (!pastedDigits.length) {
      next[start] = '';
    } else {
      pastedDigits.forEach((digit, offset) => { next[start + offset] = digit; });
    }
    onChange(next.join(''));
    const focusIndex = pastedDigits.length ? Math.min(start + pastedDigits.length, OTP_LENGTH - 1) : start;
    if (pastedDigits.length) requestAnimationFrame(() => inputRefs.current[focusIndex]?.focus());
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = '';
      onChange(next.join(''));
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      event.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  return (
    <div className={`profile-otp-input${invalid ? ' is-invalid' : ''}`} role="group" aria-label={label} aria-invalid={invalid || undefined}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => { inputRefs.current[index] = element; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`${label}, digit ${index + 1} of ${OTP_LENGTH}`}
          value={digit}
          onChange={(event) => setDigits(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => { event.preventDefault(); setDigits(index, event.clipboardData.getData('text')); }}
          onFocus={(event) => event.currentTarget.select()}
          maxLength={OTP_LENGTH}
          disabled={disabled}
        />
      ))}
    </div>
  );
};
