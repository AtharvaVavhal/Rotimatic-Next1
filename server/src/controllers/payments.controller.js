const asyncHandler = require('../utils/asyncHandler');
const paymentsService = require('../services/payments.service');
const createHttpError = require('../utils/httpError');
const { isNonEmptyString, isUuid } = require('../utils/validators');

const createOrder = asyncHandler(async (req, res) => {
  if (!isUuid(req.body.orderId)) throw createHttpError(400, 'orderId must be a valid UUID.');
  const payment = await paymentsService.createPaymentOrder(req.user.id, req.body.orderId);
  res.status(201).json({ status: 'ok', data: { payment } });
});

const verify = asyncHandler(async (req, res) => {
  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  if (!isUuid(orderId) || !isNonEmptyString(razorpayOrderId) || !isNonEmptyString(razorpayPaymentId) || !isNonEmptyString(razorpaySignature)) {
    throw createHttpError(400, 'orderId and Razorpay payment identifiers are required.');
  }
  const payment = await paymentsService.verifyPayment(req.user.id, { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature });
  res.status(200).json({ status: 'ok', data: { payment } });
});

const webhook = asyncHandler(async (req, res) => {
  const result = await paymentsService.handleWebhook(req.body, req.get('x-razorpay-signature'));
  res.status(200).json({ status: 'ok', data: result });
});

module.exports = { createOrder, verify, webhook };
