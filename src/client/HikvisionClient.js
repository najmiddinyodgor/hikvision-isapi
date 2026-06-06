import { HttpClient } from './HttpClient.js';
import { DeviceService } from '../services/DeviceService.js';
import { PersonService } from '../services/PersonService.js';
import { DepartmentService } from '../services/DepartmentService.js';
import { CardService } from '../services/CardService.js';
import { FaceService } from '../services/FaceService.js';
import { FingerprintService } from '../services/FingerprintService.js';
import { AccessControlService } from '../services/AccessControlService.js';
import { EventService } from '../services/EventService.js';
import { EventNotificationService } from '../services/EventNotificationService.js';

export class HikvisionClient {
  constructor(config) {
    this.http = new HttpClient(config);
    this.device = new DeviceService(this.http);
    this.person = new PersonService(this.http);
    this.department = new DepartmentService(this.http);
    this.card = new CardService(this.http);
    this.face = new FaceService(this.http);
    this.fingerprint = new FingerprintService(this.http);
    this.accessControl = new AccessControlService(this.http);
    this.event = new EventService(this.http);
    this.eventNotification = new EventNotificationService(this.http);
  }
}
