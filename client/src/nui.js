export function sendNui(action, data) {
  SendNuiMessage(JSON.stringify({ action, data }));
}

/**
 * Registers a NUI callback. The handler returns (or resolves) the response sent back to the page;
 * a thrown error is logged and answered with a generic failure so the UI never hangs.
 */
export function onNui(name, handler) {
  RegisterNuiCallbackType(name);
  on(`__cfx_nui:${name}`, async (data, cb) => {
    try {
      cb(await handler(data ?? {}));
    } catch (error) {
      console.error(`[gtaw-mechanic] NUI callback "${name}" failed:`, error);
      cb({ ok: false, error: 'internal', message: 'Une erreur est survenue, réessayez.' });
    }
  });
}
