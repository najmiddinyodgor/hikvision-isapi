export function Card(input) {
  if (!input || !input.employeeNo) throw new Error('Card requires employeeNo');
  if (!input.cardNo) throw new Error('Card requires cardNo');
  const data = {
    employeeNo: String(input.employeeNo),
    cardNo: String(input.cardNo),
    cardType: input.cardType || 'normalCard',
  };
  return { ...data, toISAPI() { return { CardInfo: data }; } };
}
Card.fromISAPI = function (obj) {
  const c = (obj && obj.CardInfo) || obj || {};
  return Card({ employeeNo: c.employeeNo, cardNo: c.cardNo, cardType: c.cardType });
};
