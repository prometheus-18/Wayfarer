/**
 * Offline multimodal travel assistant built on QVAC's SmolVLM2-500M model.
 * Handles plain chat plus "look at this photo and tell me…" by attaching the
 * image to the user turn.
 */
import { completion } from '@qvac/sdk';
import { ensureAssistantModel, type ProgressListener } from './ModelManager';
import { toModelPath } from './image';
import { enqueue } from './queue';
import { ASSISTANT_SYSTEM_PROMPT, LIMITS, looksLikeInjection, sanitizeText } from './security';
import { logEvent } from './telemetry';

/**
 * The full transcript is replayed each turn against a 4096-token context;
 * long demo conversations would overflow it, so only the most recent turns
 * are sent (the system prompt is always included).
 */
const MAX_HISTORY_TURNS = 10;

export type ChatRole = 'user' | 'assistant';

export interface ChatTurn {
  role: ChatRole;
  content: string;
  /** Optional image attached to a user turn (file:// URI). */
  imageUri?: string;
}

export interface AskOptions {
  /** Prior conversation turns (most recent last), excluding the new prompt. */
  history: ChatTurn[];
  /** The new user message. */
  prompt: string;
  /** Optional image for the new user turn. */
  imageUri?: string;
  /** Model download progress. */
  onProgress?: ProgressListener;
  /** Streaming partial reply. */
  onToken?: (partial: string) => void;
}

interface HistoryMessage {
  role: string;
  content: string;
  attachments?: { path: string }[];
}

function toMessage(turn: ChatTurn): HistoryMessage {
  // Sanitize untrusted user content; assistant turns are our own model output.
  const content =
    turn.role === 'user' ? sanitizeText(turn.content, LIMITS.assistantChars) : turn.content;
  const message: HistoryMessage = { role: turn.role, content };
  if (turn.imageUri) {
    message.attachments = [{ path: toModelPath(turn.imageUri) }];
  }
  return message;
}

interface CapturedStats {
  generatedTokens?: number;
  timeToFirstToken?: number;
  tokensPerSecond?: number;
  promptTokens?: number;
}

export async function askAssistant(opts: AskOptions): Promise<string> {
  const modelId = await ensureAssistantModel(opts.onProgress);
  const injectionFlagged = looksLikeInjection(opts.prompt);

  const history: HistoryMessage[] = [
    { role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
    ...opts.history.slice(-MAX_HISTORY_TURNS).map(toMessage),
    toMessage({ role: 'user', content: opts.prompt, imageUri: opts.imageUri }),
  ];

  let reply = '';
  let stats: CapturedStats | undefined;
  // Serialized: a second completion on the same engine would replace this one.
  await enqueue('assistant', async () => {
    const run = completion({ modelId, history, stream: true });
    for await (const event of run.events) {
      if (event.type === 'contentDelta') {
        reply += event.text;
        opts.onToken?.(reply);
      } else if (event.type === 'completionStats') {
        stats = event.stats;
      } else if (event.type === 'completionDone' && event.stopReason === 'error') {
        // Worker-side failures arrive as a terminal event, not a rejection.
        throw new Error(event.error.message);
      }
    }
  });

  logEvent({
    kind: 'assistant',
    model: 'vlm:smolvlm2-500m',
    prompt: opts.prompt,
    tokens: stats?.generatedTokens,
    ttftMs: stats?.timeToFirstToken,
    tokensPerSec: stats?.tokensPerSecond,
    extra: {
      promptTokens: stats?.promptTokens,
      hasImage: Boolean(opts.imageUri),
      injectionFlagged,
    },
  });

  return reply.trim();
}
