'use strict';

class ApiError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
const fail = (status, code) => { throw new ApiError(status, code); };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuid = value => typeof value === 'string' && uuidPattern.test(value);
function object(body, keys) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !keys.includes(key))) fail(400, 'INVALID_BODY');
}
function text(value, max) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}
function date(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= '1900-01-01' && value <= '9999-12-31' &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
const fields = {
  properties: ['name'], rooms: ['property_id', 'name'],
  reservations: ['property_id', 'room_id', 'guest_name', 'check_in', 'check_out', 'amount_krw', 'status'],
};
function validate(kind, body, partial = false) {
  object(body, fields[kind]);
  if (Object.keys(body).length === 0) fail(400, 'EMPTY_MUTATION');
  const required = kind === 'reservations'
    ? ['property_id', 'room_id', 'guest_name', 'check_in', 'check_out', 'amount_krw']
    : kind === 'rooms' ? ['property_id', 'name'] : ['name'];
  if (!partial && required.some(key => !(key in body))) fail(400, 'MISSING_FIELD');
  for (const [key, value] of Object.entries(body)) {
    if ((key === 'name' || key === 'guest_name') && !text(value, 120)) fail(400, 'INVALID_NAME');
    if (key.endsWith('_id') && !uuid(value)) fail(400, 'INVALID_ID');
    if (['check_in', 'check_out'].includes(key) && !date(value)) fail(400, 'INVALID_DATE');
    if (key === 'amount_krw' && (!Number.isSafeInteger(value) || value < 0)) fail(400, 'INVALID_AMOUNT');
    if (key === 'status' && !['confirmed', 'pending', 'cancelled'].includes(value)) fail(400, 'INVALID_STATUS');
  }
  if (body.check_in && body.check_out && body.check_out <= body.check_in) fail(400, 'INVALID_DATE_RANGE');
  return body;
}
function expectedVersion(header) {
  if (!header) fail(428, 'VERSION_REQUIRED');
  if (!/^"[1-9]\d{0,8}"$/.test(header)) fail(400, 'INVALID_VERSION');
  return Number(header.slice(1, -1));
}
module.exports = { ApiError, fail, uuid, object, text, validate, expectedVersion };
