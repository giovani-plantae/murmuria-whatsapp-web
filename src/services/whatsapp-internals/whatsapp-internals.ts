/**
 * THE fragile coupling to WhatsApp Web's internals — everything that breaks when
 * WhatsApp ships a new build lives here, and nowhere else. Verified live on the
 * 2026-05-31 build. Only usable from the MAIN world (it reads `window.require`).
 *
 * Recipe (confirmed by pulling a real decrypted OggS ArrayBuffer):
 * - `window.require('WAWebCollections').Msg.getModelsArray()` → all messages.
 * - The DOM bubble's `data-id` equals `msg.id.id` (a bare hash).
 * - Media fields live top-level on the msg.
 * - `WAWebDownloadManager.downloadManager.downloadAndMaybeDecrypt({...})` returns
 *   the decrypted ArrayBuffer; it REQUIRES a `downloadQpl` (logging) object.
 */
const WHATSAPP_MODULES = {
  collections: 'WAWebCollections',
  downloadManager: 'WAWebDownloadManager',
} as const;

const DEFAULT_AUDIO_MIME = 'audio/ogg; codecs=opus';

export interface ExtractedWhatsAppAudio {
  readonly arrayBuffer: ArrayBuffer;
  readonly mimeType: string;
}

/**
 * Resolves a voice message by its DOM data-id and returns its decrypted bytes.
 * Throws a descriptive error at the exact step that broke, so a future WhatsApp
 * change is easy to diagnose.
 */
export async function extractWhatsAppAudio(messageId: string): Promise<ExtractedWhatsAppAudio> {
  const message = findMessageByDomId(messageId);
  const downloadManager = requireModule(WHATSAPP_MODULES.downloadManager)?.downloadManager;

  if (typeof downloadManager?.downloadAndMaybeDecrypt !== 'function') {
    throw new Error('WhatsApp internals changed: downloadAndMaybeDecrypt is unavailable.');
  }

  const arrayBuffer: ArrayBuffer = await downloadManager.downloadAndMaybeDecrypt({
    directPath: message.directPath,
    encFilehash: message.encFilehash,
    filehash: message.filehash,
    mediaKey: message.mediaKey,
    mediaKeyTimestamp: message.mediaKeyTimestamp,
    type: message.type,
    signal: new AbortController().signal,
    downloadQpl: createNoopQpl(),
  });

  return { arrayBuffer, mimeType: message.mimetype || DEFAULT_AUDIO_MIME };
}

function findMessageByDomId(messageId: string): any {
  const messageStore = requireModule(WHATSAPP_MODULES.collections)?.Msg;
  const models: any[] | undefined = messageStore?.getModelsArray?.();

  if (!models) {
    throw new Error('WhatsApp internals changed: message store is unavailable.');
  }

  const message =
    models.find((model) => model?.id?.id === messageId) ??
    models.find(
      (model) =>
        typeof model?.id?._serialized === 'string' &&
        model.id._serialized.endsWith(`_${messageId}`),
    );

  if (!message) {
    throw new Error('Mensagem não encontrada na store (role o áudio até a tela e tente de novo).');
  }
  return message;
}

function requireModule(moduleId: string): any {
  const requireFn = (window as any).require;
  if (typeof requireFn !== 'function') {
    throw new Error('WhatsApp internals changed: window.require is unavailable.');
  }
  return requireFn(moduleId);
}

/**
 * downloadAndMaybeDecrypt logs through a Quick-Performance-Logging object
 * (`downloadQpl.addAnnotations(...)`). We do not want telemetry, so we pass a
 * chainable no-op proxy: any property is a function that returns the proxy.
 */
function createNoopQpl(): unknown {
  let proxy: any;
  const handler: ProxyHandler<() => void> = {
    get: () => () => proxy,
    apply: () => proxy,
  };
  proxy = new Proxy(function () {}, handler);
  return proxy;
}
