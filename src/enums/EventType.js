const LABELS = {
  authentication: 'Authentication event',
  faceMatch: 'Face match',
  doorOpen: 'Door opened',
};
export const EventType = Object.freeze({
  AUTHENTICATION: 'authentication',
  FACE_MATCH: 'faceMatch',
  DOOR_OPEN: 'doorOpen',
  label(code) { return LABELS[code] || code; },
});
