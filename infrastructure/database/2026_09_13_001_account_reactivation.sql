-- Permit a separate, auditable OTP purpose for restoring voluntarily
-- deactivated accounts. It is intentionally distinct from password resets.
ALTER TYPE verification_type ADD VALUE IF NOT EXISTS 'REACTIVATE_ACCOUNT';
