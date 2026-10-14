// Not imported by existing HTML. No localStorage reads/writes, login emulation or data fallback.
export function createApiAdapter({ enabled = false, origin, fetchImpl = globalThis.fetch } = {}) {
  async function request(path, { method = 'GET', body, csrf, version } = {}) {
    if (!enabled || origin !== 'http://127.0.0.1:8787' ||
        (globalThis.location && globalThis.location.origin !== origin)) {
      throw Object.assign(new Error('NOT_CONFIGURED'), { status: 501, code: 'NOT_CONFIGURED' });
    }
    if (!/^\/api\/(?!\/)/.test(path) || path.includes('\\')) throw new Error('INVALID_PATH');
    const response = await fetchImpl(`${origin}${path}`, { method, credentials: 'same-origin',
      redirect: 'error', cache: 'no-store', headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(csrf ? { 'x-csrf-token': csrf } : {}), ...(version ? { 'if-match': `"${version}"` } : {}),
      }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    if (!(response.headers.get('content-type') || '').includes('application/json')) throw new Error('INVALID_API_RESPONSE');
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.code || 'API_ERROR'), { status: response.status, code: data.code });
    return data;
  }
  return { request, session: () => request('/api/session'),
    reservations: hostId => request(`/api/hosts/${encodeURIComponent(hostId)}/reservations`) };
}
// Pure display adapter only. UUID is retained; future renderer must use data-id/event delegation.
export function calendarRows(reservations, rooms) {
  return reservations.map(r => {
    const room = rooms.find(room => room.id === r.room_id && room.host_id === r.host_id && room.property_id === r.property_id);
    if (!room) throw new Error('UNMAPPED_ROOM');
    return { id: r.id, roomId: room.id, room: room.name, name: r.guest_name,
      cin: r.check_in, cout: r.check_out, amount: r.amount_krw, status: r.status, version: r.version };
  });
}
