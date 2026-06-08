/**
 * Offline multimodal travel assistant built on QVAC's SmolVLM2-500M model.
 * Handles plain chat plus "look at this photo and tell me…" by attaching the
 * image to the user turn.
 */
import { completion } from '@qvac/sdk';
import { ensureAssistantModel, type ProgressListener } from './ModelManager';
import { toModelPath } from './image';

export type ChatRole = 'user' | 'assistant';

export interface ChatTurn {
  role: ChatRole;
  content: string;
  /** Optional image attached to a user turn (file:// URI). */
  imageUri?: string;
}

const SYSTEM_PROMPT =
  'You are Wayfarer, a warm and practical travel companion that runs entirely ' +
  'offline on the traveler\'s phone. Give concise, friendly, actionable answers ' +
  'about directions, food, customs, safety and language. When the user shares a ' +
  'photo, describe what is relevant for a traveler and translate any text you see. ' +
  'Keep replies short unless asked for detail.';

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
  const message: HistoryMessage = { role: turn.role, content: turn.content };
  if (turn.imageUri) {
    message.attachments = [{ path: toModelPath(turn.imageUri) }];
  }
  return message;
}

export async function askAssistant(opts: AskOptions): Promise<string> {
  const modelId = await ensureAssistantModel(opts.onProgress);

  const history: HistoryMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...opts.history.map(toMessage),
    toMessage({ role: 'user', content: opts.prompt, imageUri: opts.imageUri }),
  ];

  const run = completion({ modelId, history, stream: true });

  let reply = '';
  for await (const event of run.events) {
    if (event.type === 'contentDelta') {
      reply += event.text;
      opts.onToken?.(reply);
    }
  }

  return reply.trim();
}
