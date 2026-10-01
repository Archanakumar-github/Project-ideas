import type Anthropic from '@anthropic-ai/sdk'
import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'

/**
 * Optional cloud coach (off by default). When enabled in Settings with the user's own
 * Anthropic API key, questions go straight from this device to the Claude API, together
 * with a compact summary of the local context. Nothing is proxied or stored elsewhere.
 *
 * The SDK is loaded on demand, so people who never enable it never download it.
 *
 * Conversation handling: the top-level system prompt never changes, and each turn's
 * context snapshot is appended as a mid-conversation system message right after the
 * user's question. History is append-only, which keeps the prompt cache warm and replayed
 * thinking blocks valid.
 */

const SYSTEM_PROMPT = `You are AuraFit Coach, a friendly, expert personal fitness and nutrition coach inside a private mobile app.

The app gives you a snapshot of the user's profile (imported from their user_profile.md), today's targets, meals, logs, training plan and recent journal notes. Use it to personalise every answer.

How to respond:
- This is a phone chat. Begin your visible answer immediately. Keep replies short: 2–6 sentences or a tight bullet list, in Markdown.
- Be specific: name actual meals, foods, exercises, sets and numbers from their plan and data.
- Respect their diet style, allergies, intolerances and dislikes without exception, and work around injuries and available equipment.
- When they report fatigue, soreness or poor sleep, scale training down (fewer sets, lighter loads, or active recovery) rather than pushing harder.
- Stay within general fitness and nutrition coaching. For pain, dizziness, chest symptoms, medical conditions, medication, pregnancy or disordered-eating signs, advise seeing a qualified professional, and never suggest extreme restriction or calorie intakes below the app's safe floor.
- If the context doesn't contain something, say so briefly rather than guessing.`

/** Mid-conversation system messages are supported on these model families. */
function supportsSystemMessages(model: string) {
  return /opus-5|opus-4-8|fable|mythos|sonnet-5-5/.test(model)
}
/** Server-side refusal fallback ("default" routing) is offered on these. */
function supportsFallbacks(model: string) {
  return /opus-5|fable-5-1|sonnet-5-5/.test(model)
}
function supportsEffort(model: string) {
  return /opus-(4-[5-8]|5)|sonnet-(4-6|5)|fable|mythos/.test(model)
}

/** Keep the cloud conversation bounded: start a fresh thread after this many messages. */
const MAX_HISTORY = 40

export interface CloudResult {
  text: string
  history: BetaMessageParam[]
  refused?: boolean
  reset?: boolean
}

export class CloudCoachError extends Error {
  constructor(
    message: string,
    public kind: 'auth' | 'rate' | 'network' | 'bad_request' | 'server' | 'aborted',
  ) {
    super(message)
  }
}

export async function askCloud(opts: {
  apiKey: string
  model: string
  history: BetaMessageParam[]
  question: string
  context: string
  onText: (delta: string) => void
  signal?: AbortSignal
}): Promise<CloudResult> {
  const { default: AnthropicSDK } = await import('@anthropic-ai/sdk')
  const client: Anthropic = new AnthropicSDK({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 })

  const reset = opts.history.length >= MAX_HISTORY
  const history = reset ? [] : opts.history
  const turn: BetaMessageParam[] = supportsSystemMessages(opts.model)
    ? [
        { role: 'user', content: opts.question },
        { role: 'system', content: opts.context },
      ]
    : [{ role: 'user', content: `<app_context>\n${opts.context}\n</app_context>\n\n${opts.question}` }]
  const messages = [...history, ...turn]

  try {
    const stream = client.beta.messages.stream(
      {
        model: opts.model,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages,
        cache_control: { type: 'ephemeral' },
        ...(supportsEffort(opts.model) ? { output_config: { effort: 'low' as const } } : {}),
        ...(supportsFallbacks(opts.model) ? { fallbacks: 'default' as const, betas: ['server-side-fallback-2026-07-01'] } : {}),
      },
      { signal: opts.signal },
    )
    stream.on('text', (delta) => opts.onText(delta))
    const final = await stream.finalMessage()

    if (final.stop_reason === 'refusal') {
      // Drop the refused turn (truncating from the end keeps earlier history valid).
      return { text: "I can't help with that one. Try rephrasing, or ask me something else about your training or nutrition.", history, refused: true, reset }
    }
    const text = final.content
      .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()
    // Store the assistant content unchanged (thinking blocks included) for the next turn.
    return { text: text || '…', history: [...messages, { role: 'assistant', content: final.content as BetaMessageParam['content'] }], reset }
  } catch (err) {
    if (err instanceof AnthropicSDK.APIUserAbortError) throw new CloudCoachError('Stopped.', 'aborted')
    if (err instanceof AnthropicSDK.AuthenticationError) throw new CloudCoachError('Your API key was rejected. Check it in Settings → Cloud coach.', 'auth')
    if (err instanceof AnthropicSDK.PermissionDeniedError) throw new CloudCoachError("This API key doesn't have access to that model.", 'auth')
    if (err instanceof AnthropicSDK.RateLimitError) throw new CloudCoachError('Rate limited by the API. Answering on-device instead.', 'rate')
    if (err instanceof AnthropicSDK.BadRequestError) throw new CloudCoachError(`The API rejected the request: ${err.message}`, 'bad_request')
    if (err instanceof AnthropicSDK.APIConnectionError) throw new CloudCoachError('Could not reach the API. Answering on-device instead.', 'network')
    if (err instanceof AnthropicSDK.APIError) throw new CloudCoachError(`API error ${err.status ?? ''}. Answering on-device instead.`, 'server')
    throw err
  }
}
