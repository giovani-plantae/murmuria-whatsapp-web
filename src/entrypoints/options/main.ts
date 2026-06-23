import { describeError } from '@/shared/errors';

/**
 * Standalone page whose only job is to obtain the microphone permission. A
 * browser extension popup cannot surface the getUserMedia prompt (it loses focus
 * and the request is denied), so the grant has to happen on a real page; once
 * granted it persists for the extension origin, and the popup can record. On
 * failure it prints diagnostics, since a "not supported" / "device not found"
 * error usually means the machine or browser — not the extension — lacks a
 * working microphone.
 */
function requireElement<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Options page is missing required element: #${id}`);
  }
  return node as T;
}

const allowButton = requireElement<HTMLButtonElement>('allow');
const status = requireElement<HTMLElement>('status');
const diag = requireElement<HTMLElement>('diag');

function setStatus(state: 'ok' | 'bad' | '', message: string): void {
  status.dataset.state = state;
  status.textContent = message;
}

async function showDiagnostics(): Promise<void> {
  const parts = [`secure context: ${window.isSecureContext}`, `origin: ${location.protocol}`];
  try {
    const devices = (await navigator.mediaDevices?.enumerateDevices()) ?? [];
    parts.push(`microphones detected: ${devices.filter((d) => d.kind === 'audioinput').length}`);
  } catch {
    parts.push('microphones detected: unknown');
  }
  diag.textContent = parts.join(' · ');
}

async function requestMicrophone(): Promise<void> {
  setStatus('', 'Requesting access…');
  diag.textContent = '';

  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('bad', 'This browser does not expose microphone capture on this page.');
    await showDiagnostics();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    setStatus('ok', 'Microphone enabled. You can close this tab and record from the popup.');
    allowButton.disabled = true;
  } catch (error) {
    const name = error instanceof DOMException ? error.name : 'Error';
    setStatus('bad', `Could not enable the microphone — ${name}: ${describeError(error)}`);
    await showDiagnostics();
  }
}

allowButton.addEventListener('click', () => void requestMicrophone());
