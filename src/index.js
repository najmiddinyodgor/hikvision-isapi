export { HikvisionClient } from './client/HikvisionClient.js';
export { HttpClient } from './client/HttpClient.js';
export { Person } from './dto/Person.js';
export { Department } from './dto/Department.js';
export { Card } from './dto/Card.js';
export { Face } from './dto/Face.js';
export { UserType } from './enums/UserType.js';
export { EventType } from './enums/EventType.js';
export {
  HikvisionError, AuthError, RequestError, DeviceError, TimeoutError,
} from './errors/index.js';
export const VERSION = '0.1.8';
