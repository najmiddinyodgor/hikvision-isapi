const LABELS = {
  authentication: 'Authentication event',
  faceMatch: 'Face match',
  doorOpen: 'Door opened',
  AccessControllerEvent: 'Access controller event',
};
export const EventType = Object.freeze({
  AUTHENTICATION: 'authentication',
  FACE_MATCH: 'faceMatch',
  DOOR_OPEN: 'doorOpen',
  ACCESS: 'AccessControllerEvent',
  label(code) { return LABELS[code] || code; },
});
