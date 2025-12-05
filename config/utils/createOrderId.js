
// Generate token
const createOrderId = (id, count) => {
  return `${id}-${count}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
};

const createPayoutOrderId = (id, amount) => {
  return `${id}-${amount}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
};

module.exports = { createOrderId, createPayoutOrderId }