# Grok (xAI) API Notes

The xAI platform exposes an HTTP API that mirrors the OpenAI Chat Completions shape. Useful reference links:

- Base URL: `https://api.x.ai/v1`
- Chat completions endpoint: `POST /chat/completions`

### Authentication

Provide a bearer token obtained from https://console.x.ai/ in the `Authorization` header:

```
Authorization: Bearer <YOUR_GROK_API_KEY>
```

Requests must include the `Content-Type: application/json` header.

### Sample request

```
curl https://api.x.ai/v1/chat/completions \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "model": "grok-beta",
        "messages": [
          {"role": "system", "content": "Translate user messages to English."},
          {"role": "user", "content": "Bonjour"}
        ],
        "temperature": 0.2
      }'
```

### Connectivity checklist

If the browser console shows `https://api.x.ai/v1/chat/completions ... 404`, verify that the path is reachable outside of the app. A quick `curl -I https://api.x.ai/v1/chat/completions` should return `405 Method Not Allowed`, proving DNS + TLS resolution works and that the endpoint expects `POST`. When testing from browsers, the API replies to `OPTIONS` preflight requests with permissive `Access-Control-Allow-*` headers, so a 404 typically points to a proxy or VPN rewriting the hostname—double-check that your network allows outbound HTTPS to `api.x.ai`.

### Response shape

The response follows the OpenAI Chat Completion format. The translated text can be read from `choices[0].message.content`:

```
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1699895294,
  "model": "grok-beta",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello"
      },
      "finish_reason": "stop"
    }
  ]
}
```

### Usage in this project

- The client stores the API key locally (never on the server) and includes it in translation calls.
- Each translation request sends a system prompt (configurable in Settings) and the message text as the user input.
- Requests use the deterministic `temperature: 0.2` to keep translations stable.
- Successful translations are cached locally so repeated toggles do not trigger additional API calls.
