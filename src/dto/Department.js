// A department maps to the firmware's integer `groupId` on a person (1..128;
// 0 = unassigned). There is no group-name registry on the device (groupCfg and
// related endpoints 404), so a department's identity is its numeric id plus the
// set of members that carry it.
export function Department(input) {
  if (!input || input.id == null) throw new Error('Department requires id');
  const id = Number(input.id);
  if (Number.isNaN(id)) throw new Error('Department id must be numeric (groupId)');
  const employeeNos = Array.isArray(input.employeeNos) ? input.employeeNos.map(String) : [];
  return {
    id,
    employeeNos,
    count: input.count != null ? Number(input.count) : employeeNos.length,
  };
}

// Read the department id (groupId) off a raw UserInfo record. 0 => no department.
Department.fromUserInfo = function (u) {
  const rec = (u && u.UserInfo) || u || {};
  return rec.groupId ? Number(rec.groupId) : null;
};
