# Authentication API

## Overview

Base URL: `/api/v1/auth`

## Endpoints

### Register User

Creates a new user account.

**POST `/register`**

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "5f8c9d3e4b4b4b4b4b4b4b4b",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "USER"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
  },
  "message": "User registered successfully"
}
```

**Error Responses:**
- 400: VALIDATION_ERROR - Invalid input
- 409: CONFLICT - Email already exists

---

### Login

Authenticates a user and returns JWT tokens.

**POST `/login`**

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "5f8c9d3e4b4b4b4b4b4b4b4b",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "USER"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
  },
  "message": "Login successful"
}
```

**Error Responses:**
- 400: VALIDATION_ERROR - Invalid input
- 401: UNAUTHORIZED - Invalid credentials

---

### Refresh Token

Refreshes the access token using a valid refresh token.

**POST `/refresh-token`**

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "new_access_token_here",
    "refreshToken": "new_refresh_token_here"
  },
  "message": "Token refreshed successfully"
}
```

**Error Responses:**
- 401: UNAUTHORIZED - Invalid refresh token

---

### Forgot Password

Sends a password reset email to the user.

**POST `/forgot-password`**

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset link sent to email"
}
```

**Error Responses:**
- 404: NOT_FOUND - Email not found

---

### Reset Password

Resets the user's password using the reset token.

**POST `/reset-password`**

**Request:**
```json
{
  "token": "password_reset_token",
  "password": "newpassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Error Responses:**
- 400: VALIDATION_ERROR - Invalid token
- 404: NOT_FOUND - Token not found

---

### Logout

Logs out the user and invalidates the access token.

**POST `/logout`**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Error Responses:**
- 401: UNAUTHORIZED - Invalid token

---

### Verify Email

Verifies the user's email address using the verification token.

**POST `/verify-email`**

**Request:**
```json
{
  "token": "verification_token"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

**Error Responses:**
- 400: VALIDATION_ERROR - Invalid token
- 404: NOT_FOUND - Token not found

## Error Codes

| Code | Description |
|------|-------------|
| EMAIL_EXISTS | Email already registered |
| INVALID_CREDENTIALS | Wrong email or password |
| INVALID_TOKEN | Invalid or expired token |
| EMAIL_NOT_VERIFIED | Email not verified |

## Rate Limits

- Login/Register: 10 attempts per hour per IP
- Forgot Password: 5 requests per hour per IP
- Refresh Token: 30 requests per minute per user