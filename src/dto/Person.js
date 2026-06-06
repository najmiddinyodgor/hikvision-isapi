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
  // Department maps to the firmware's integer `groupId` (1..128; 0 = none).
  // Accept it via `department` or `groupId`; both are coerced to an integer.
  const rawGroup = input.groupId != null ? input.groupId : input.department;
  const groupId = rawGroup != null && rawGroup !== '' && !Number.isNaN(Number(rawGroup))
    ? Number(rawGroup) : undefined;

  // Door access rights. Without these the person is enrolled but has no
  // permission to open any door, so every verification at the terminal is
  // denied — what looks like "authentication failure". These mirror what the
  // Hikvision web UI sends; all are overridable.
  const doorRight = input.doorRight != null ? String(input.doorRight) : '1';
  const rightPlan = input.RightPlan || [{ doorNo: 1, planTemplateNo: '1' }];

  const data = {
    employeeNo: String(input.employeeNo),
    name: input.name,
    userType: input.userType || 'normal',
    Valid: valid,
    doorRight,
    RightPlan: rightPlan,
    ...(input.gender ? { gender: input.gender } : {}),
    ...(groupId !== undefined ? { groupId } : {}),
    localUIRight: input.localUIRight != null ? input.localUIRight : false,
    userVerifyMode: input.userVerifyMode != null ? input.userVerifyMode : '',
    password: input.password != null ? String(input.password) : '',
    closeDelayEnabled: input.closeDelayEnabled != null ? input.closeDelayEnabled : false,
    onlyVerify: input.onlyVerify != null ? input.onlyVerify : false,
  };
  return {
    ...data,
    ...(groupId !== undefined ? { department: groupId } : {}),
    toISAPI() { return { UserInfo: data }; },
  };
}
Person.fromISAPI = function (obj) {
  const u = (obj && obj.UserInfo) || obj || {};
  // groupId 0 means "no department"; surface it as undefined.
  const groupId = u.groupId ? Number(u.groupId) : undefined;
  return Person({
    employeeNo: u.employeeNo,
    name: u.name,
    userType: u.userType,
    ...(u.gender ? { gender: u.gender } : {}),
    ...(groupId !== undefined ? { groupId } : {}),
  });
};
