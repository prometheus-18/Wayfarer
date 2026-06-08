/**
 * Offline multimodal travel assistant built on QVAC's SmolVLM2-500M model.
 * Handles plain chat plus "look at this photo and tell me…" by attaching the
 * image to the user turn.
 */
import { completion } from '@qvac/sdk';
import { ensureAssistantModel, type ProgressListener } from './ModelManager';
import { toModelPath } from './image';
import { ASSISTANT_SYSTEM_PROMPT, LIMITS, looksLikeInjection, sanitizeText } from './security';
import { logEvent } from './telemetry';

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
    ...opts.history.map(toMessage),
    toMessage({ role: 'user', content: opts.prompt, imageUri: opts.imageUri }),
  ];

  const run = completion({ modelId, history, stream: true });

  let reply = '';
  let stats: CapturedStats | undefined;
  for await (const event of run.events) {
    if (event.type === 'contentDelta') {
      reply += event.text;
      opts.onToken?.(reply);
    } else if (event.type === 'completionStats') {
      stats = event.stats;
    }
  }

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
