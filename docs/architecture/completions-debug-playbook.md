# Completions Reliability & Debug Playbook

## Objetivo

Dejar el pipeline de completions en estado **working-order** con:

- Failover round-robin robusto (OpenRouter, Cerebras, Groq)
- Mensajes de error claros para usuario
- Logs accionables para diagnóstico rápido
- Parser SSE tolerante a variaciones de streaming

## Arquitectura actual

### Provider strategy

`apps/api/src/provider/free-tier.provider.ts`

- Usa **OpenAI SDK** para los 3 providers (OpenAI-compatible endpoints)
- Selecciona providers configurados por API key
- Round-robin por request (rotando punto de inicio)
- Reintenta con siguiente provider según clasificación de error

### Error handling backend

`apps/api/src/completion/completion.service.ts`

- Timeout total con SSE `error` + `code=TIMEOUT`
- Mapeo de errores a `{ code, message }` para frontend
- Logging estructurado con code y stack

### SSE frontend

`apps/web/src/editor/use-completion.ts`

- Extrae mensajes útiles en respuestas non-200 (JSON/string/text)
- Parser SSE robusto para:
  - `\r\n` y `\r`
  - `data:` multiline
  - flush de buffer final al terminar stream
- Evita swallow silencioso de parse failures

---

## Códigos de error esperados

- `TIMEOUT`
- `NO_PROVIDER_AVAILABLE`
- `QUOTA_EXHAUSTED`
- `RATE_LIMITED`
- `PROVIDERS_UNAVAILABLE`
- `AUTH_ERROR`
- `BAD_REQUEST`
- `COMPLETION_FAILED`

Estos códigos permiten al frontend mostrar UX contextual en vez de "HTTP 500" genérico.

---

## Checklist operativo (runtime)

1. Verificar API health

```bash
curl -sS http://localhost:3000/health
```

2. Login dev + cookie

```bash
curl -i -c /tmp/assist.cookies \
  -H 'Content-Type: application/json' \
  -d '{"email":"qa+stream@local.test"}' \
  http://localhost:3000/auth/dev-login
```

3. CSRF token

```bash
CSRF=$(curl -sS -b /tmp/assist.cookies -c /tmp/assist.cookies \
  http://localhost:3000/auth/csrf-token | jq -r '.token')
echo "$CSRF"
```

4. Session creation

```bash
SESSION_ID=$(curl -sS -b /tmp/assist.cookies \
  -H "x-csrf-token: $CSRF" \
  -H 'Content-Type: application/json' \
  -d '{}' \
  http://localhost:3000/completions/session | jq -r '.sessionId')
echo "$SESSION_ID"
```

5. Stream completion

```bash
curl -N -b /tmp/assist.cookies \
  -H "x-csrf-token: $CSRF" \
  -H 'Content-Type: application/json' \
  -d "{\"prefix\":\"Este texto legal es lo suficientemente largo para disparar autocompletado.\",\"sessionId\":\"$SESSION_ID\",\"cursorPosition\":85}" \
  http://localhost:3000/completions/stream
```

Esperado:

- `event: meta`
- uno o más `event: token`
- `event: done` (o `event: error` con code específico)

---

## Qué mirar en logs

- `[Router] ... fallback=free_tier`
- `[FreeTier] attempt=X/Y provider=... model=...`
- `[FreeTier] SUCCESS ...` o `failed: code=... retryable=...`
- `[Completion] Done ...` o `[Completion] Pipeline error: code=...`

### Compatibilidad de esquema DB (importante)

Si aparece warning tipo:

`column ModelEndpoint.error_reason does not exist`

el router ahora hace fallback seguro a FreeTier y **no rompe completions**.

Igualmente, para eliminar el warning, conviene alinear esquema con migraciones más nuevas cuando sea posible.

Si no hay tokens:

1. ¿Llega `meta`? Si no, revisar auth/csrf/session.
2. Si hay `meta` pero no tokens, revisar logs de provider failover.
3. Si hay `error`, usar `code` para triage inmediato.

---

## Nota de compatibilidad SDK

Confirmado: OpenRouter, Cerebras y Groq son OpenAI-compatible, por lo tanto se usa un solo SDK (`openai`) con `baseURL` + `apiKey` por provider.
