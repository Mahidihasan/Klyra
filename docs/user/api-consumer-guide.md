# API Consumer Guide

## Overview

This guide provides instructions for using APIs from the API Marketplace platform. Whether you're a developer integrating APIs into your applications, a data analyst using API data, or a business manager evaluating APIs, this guide will help you get started.

## Getting Started

### 1. Create an Account

1. Click "Sign Up" on the homepage
2. Fill in your details (name, email, password)
3. Verify your email address

### 2. Explore the Marketplace

- Browse available APIs
- Use filters (category, price, rating) to find useful APIs
- Read API documentation before subscribing
- Compare pricing plans

### 3. Subscribe to an API

1. Click on an API to view details
2. Choose your subscription plan
3. Complete the subscription (free or paid)
4. Generate your API key

## Using API Keys

### What are API Keys?

API keys are unique identifiers that authenticate your requests to the API.

### Creating an API Key

1. Navigate to "API Keys" in your dashboard
2. Click "Create API Key"
3. Name your key (e.g., "Production App")
4. Set permissions (read, write, admin)
5. Set rate limits (options may vary by plan)
6. Copy and store your key securely

### Using Your API Key

**Header Authentication:**
```
X-API-Key: your_api_key_here
```

**Query Parameter:**
```
https://api.example.com/v1/data?api_key=your_api_key_here
```

**Bearer Token (if supported):**
```
Authorization: Bearer your_api_key_here
```

### Managing API Keys

- **Regenerate** - Create a new key (old key stops working)
- **Revoke** - Immediately disable a key
- **View Usage** - Monitor API calls per key
- **Set Limits** - Control usage per key

## Making API Requests

### Understanding API Endpoints

Most APIs follow this pattern:
```
https://api.example.com/v1/{resource}/{id}
```

### Common HTTP Methods

| Method | Purpose | Example |
|--------|---------|---------|
| GET | Retrieve data | `GET /v1/users` |
| POST | Create new data | `POST /v1/users` |
| PUT | Update existing data | `PUT /v1/users/123` |
| DELETE | Remove data | `DELETE /v1/users/123` |

### Example: Authentication

```bash
# Register a new user
curl -X POST https://api.example.com/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "securepassword"}'

# Log in
curl -X POST https://api.example.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "securepassword"}'
```

### Example: Using an API

```bash
# Get user profile
curl -X GET https://api.example.com/v1/users/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# List APIs
curl -X GET https://api.example.com/v1/apis \
  -H "X-API-Key: YOUR_API_KEY"
```

## Using the Playground

The playground lets you test APIs without writing code.

### Testing an API Request

1. Navigate to the API's playground
2. Select HTTP method (GET, POST, etc.)
3. Enter endpoint and parameters
4. Add headers and body
5. Click "Send Request"
6. View formatted response

### Generating Client Code

The playground can generate code in:
- JavaScript (Fetch API)
- Python (Requests)
- PHP (cURL)
- Java (HTTP Client)
- Go (net/http)
- Curl command

### Saving Collections

- Save frequently used requests
- Organize requests into collections
- Share collections with your team

## Subscription Management

### Understanding Plans

- **Free Plan** - Limited access, basic features
- **Paid Plans** - More features, higher limits
- **Enterprise** - Custom limits, dedicated support

### Checking Subscription Status

View in your dashboard:
- Active subscriptions
- Remaining quota / usage
- Renewal dates
- Billing history

### Upgrading or Downgrading

1. Navigate to "Subscriptions"
2. Select your subscription
3. Click "Change Plan"
4. Choose new plan
5. Review proration (partial refund/charge)

### Cancelling a Subscription

1. Navigate to "Subscriptions"
2. Click "Cancel"
3. Confirm cancellation
4. Subscription ends at period end

## Monitoring Your Usage

### Dashboard Overview

View:
- **Total Requests** - All API calls
- **Daily Usage** - Per-day breakdown
- **Error Rate** - Failed request percentage
- **Response Time** - Average latency

### Rate Limit Monitoring

- Track remaining quota
- Set up alerts for approaching limits
- Upgrade plan for higher limits

## Best Practices

### Security

1. **Never expose API keys** in client-side code
2. **Use environment variables** for keys
3. **Rotate keys** regularly
4. **Use HTTPS** for all requests
5. **Store response data** securely

### Performance

1. **Cache responses** to reduce API calls
2. **Use pagination** for large datasets
3. **Batch operations** when possible
4. **Monitor latency** and optimize
5. **Use webhooks** instead of polling when available

### Error Handling

```javascript
// Example: Handling API errors
try {
  const response = await fetch('https://api.example.com/v1/data', {
    headers: {
      'X-API-Key': process.env.API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error('Request failed:', error.message);
}
```

### Rate Limit Handling

```javascript
// Example: Implementing rate limit delay
async function makeRequest(endpoint) {
  const rateLimitDelay = 1000; // 1 second between requests

  await new Promise(resolve => setTimeout(resolve, rateLimitDelay));

  const response = await fetch(endpoint, {
    headers: {
      'X-API-Key': process.env.API_KEY
    }
  });

  if (response.status === 429) {
    // Rate limited - wait and retry
    console.log('Rate limited, waiting...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    return makeRequest(endpoint);
  }

  return response.json();
}
```

## Troubleshooting

### Common Errors

| Error | Status | Cause | Solution |
|-------|--------|-------|----------|
| Unauthorized | 401 | Invalid/missing API key | Check your API key |
| Forbidden | 403 | Insufficient permissions | Check key permissions |
| Not Found | 404 | Invalid endpoint | Verify endpoint URL |
| Rate Limited | 429 | Too many requests | Wait or upgrade plan |
| Server Error | 500 | API issue | Contact API provider |

### Debugging Tips

1. **Check your API key** - Ensure it's valid and active
2. **Verify the endpoint** - Check for typos
3. **Review the request format** - Ensure correct headers/body
4. **Test in playground** - Verify the API works
5. **Check subscription status** - Ensure access isn't expired

## Support

### Getting Help

- **API Documentation** - Check provider's documentation
- **Playground** - Test the API directly
- **Community** - Ask in community forums
- **Support Ticket** - Contact provider support