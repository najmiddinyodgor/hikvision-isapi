export class HikvisionError extends Error {
  constructor(message, opts = {}) {
    super(message);
    this.name = 'HikvisionError';
    Object.assign(this, opts);
  }
}
export class AuthError extends HikvisionError {
  constructor(message, opts) { super(message, opts); this.name = 'AuthError'; }
}
export class RequestError extends HikvisionError {
  constructor(message, opts) { super(message, opts); this.name = 'RequestError'; }
}
export class DeviceError extends HikvisionError {
  constructor(message, opts) { super(message, opts); this.name = 'DeviceError'; }
}
export class TimeoutError extends HikvisionError {
  constructor(message, opts) { super(message, opts); this.name = 'TimeoutError'; }
}
