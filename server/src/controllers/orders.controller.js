const asyncHandler = require('../utils/asyncHandler');
const ordersService = require('../services/orders.service');
const createHttpError = require('../utils/httpError');
const { validateCreateOrderPayload, isUuid } = require('../utils/validators');

const create = asyncHandler(async (req, res) => {
  const errors = validateCreateOrderPayload(req.body);
  if (errors.length) throw createHttpError(400, errors.join(' '));

  const order = await ordersService.createOrder(req.user.id, req.body);
  res.status(201).json({ status: 'ok', data: { order } });
});

const list = asyncHandler(async (req, res) => {
  const orders = await ordersService.listOrders(req.user.id);
  res.status(200).json({ status: 'ok', data: { orders } });
});

const get = asyncHandler(async (req, res) => {
  if (!isUuid(req.params.id)) throw createHttpError(404, 'Order not found.');
  const order = await ordersService.getOrder(req.user.id, req.params.id);
  res.status(200).json({ status: 'ok', data: { order } });
});

module.exports = { create, list, get };
