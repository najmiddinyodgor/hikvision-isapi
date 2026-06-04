export function Face(input) {
  if (!input || !input.employeeNo) throw new Error('Face requires employeeNo');
  if (!input.imageBase64 && !input.faceURL) throw new Error('Face requires imageBase64 or faceURL');
  const data = {
    FPID: String(input.employeeNo),
    faceLibType: input.faceLibType || 'blackFD',
    FDID: String(input.faceLibId || '1'),
    ...(input.name ? { name: input.name } : {}),
    ...(input.faceURL ? { faceURL: input.faceURL } : {}),
    ...(input.imageBase64 ? { faceData: input.imageBase64 } : {}),
  };
  return {
    employeeNo: String(input.employeeNo),
    faceLibId: String(input.faceLibId || '1'),
    toISAPI() { return { FaceDataRecord: data }; },
  };
}
Face.fromISAPI = function (obj) {
  const f = (obj && obj.FaceDataRecord) || (obj && obj.FaceInfo) || obj || {};
  return { employeeNo: f.FPID || f.employeeNo, faceLibId: f.FDID || f.faceLibId };
};
