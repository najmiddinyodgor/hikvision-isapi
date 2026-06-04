export function Person(input) {
  if (!input || !input.employeeNo) throw new Error('Person requires employeeNo');
  if (!input.name) throw new Error('Person requires name');
  const data = {
    employeeNo: String(input.employeeNo),
    name: input.name,
    userType: input.userType || 'normal',
    ...(input.validBegin || input.validEnd
      ? { Valid: { enable: 'true', beginTime: input.validBegin, endTime: input.validEnd } }
      : {}),
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
