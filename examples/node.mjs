import { HikvisionClient, UserType } from 'hikvision-isapi';

const client = new HikvisionClient({
  host: 'http://192.168.1.64', username: 'admin', password: 'pass',
});

console.log(await client.device.getInfo());
await client.person.add({ employeeNo: 'EMP001', name: 'John', userType: UserType.NORMAL });
await client.face.upload('EMP001', '<base64-jpeg>', '1');
await client.accessControl.remoteControlDoor(1, 'open');
