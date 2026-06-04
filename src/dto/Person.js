export function Person(input) {
  if (!input || !input.employeeNo) throw new Error('Person requires employeeNo');
  if (!input.name) throw new Error('Person requires name');
  // Most access-control firmwares (e.g. DS-K1T343M) reject a UserInfo/Record POST
  // with HTTP 400 unless a Valid block is present, so always emit one. Callers may
  // override the window via validBegin/validEnd or pass a full Valid object.
  const valid = input.Valid || {
    enable: true,
    beginTime: input.validBegin || '2024-01-01T00:00:00',
    endTime: input.validEnd || '2037-12-31T23:59:59',
    timeType: 'local',
  };
  const data = {
    employeeNo: String(input.employeeNo),
    name: input.name,
    userType: input.userType || 'normal',
    Valid: valid,
    ...(input.gender ? { gender: input.gender } : {}),
  };
  return {
    ...data,
    toISAPI() { return { UserInfo: data }; },
  };
}
Person.fromISAPI = function (obj) {
  const u = (obj && obj.UserInfo) || obj || {};
  return Person({ employeeNo: u.employeeNo, name: u.name, userType: u.userType });
};
