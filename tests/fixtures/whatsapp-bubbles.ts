// Trimmed from a real WhatsApp Web voice-message bubble (2026-05), keeping only
// the structure the scanner relies on: the [data-id] container, the in/out
// class, and the voice signals (ptt-status icon, slider canvas, aria-labels).

export const INCOMING_VOICE = `
  <div role="row">
    <div data-id="ACDD1C9AABBF0BC8B356255C0A118FE2" data-testid="conv-msg-ACDD1C9AABBF0BC8B356255C0A118FE2">
      <div>
        <div class="message-in focusable-list-item">
          <div data-testid="msg-container">
            <button aria-label="Play voice message" type="button"></button>
            <span aria-label="Voice message"></span>
            <div role="slider" aria-label="Voice note progress slider">
              <canvas width="192" height="24"></canvas>
            </div>
            <span data-testid="ptt-status" data-icon="ptt-status"></span>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

export const OUTGOING_VOICE = `
  <div role="row">
    <div data-id="BBExuoutgoing0000000000000000000">
      <div>
        <div class="message-out focusable-list-item">
          <div data-testid="msg-container">
            <span data-icon="ptt-status"></span>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

export const TEXT_MESSAGE = `
  <div role="row">
    <div data-id="TEXT0000000000000000000000000001">
      <div>
        <div class="message-in focusable-list-item">
          <div data-testid="msg-container"><span>olá mundo</span></div>
        </div>
      </div>
    </div>
  </div>
`;
