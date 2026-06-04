export function Face(input) {
  if (!input || !input.employeeNo) throw new Error('Face requires employeeNo');
  if (!input.imageBase64 && !input.faceURL) throw new Error('Face requires imageBase64 or faceURL');
  const data = {
    employeeNo: String(input.employeeNo),
    faceLibId: String(input.faceLibId || '1'),
    ...(input.imageBase64 ? { faceData: input.imageBase64 } : {}),
    ...(input.faceURL ? { faceURL: input.faceURL } : {}),
  };
  return { ...data, toISAPI() { return { FaceInfo: data }; } };
}
Face.fromISAPI = function (obj) {
  const f = (obj && obj.FaceInfo) || obj || {};
  return { employeeNo: f.employeeNo, faceLibId: f.faceLibId };
};
