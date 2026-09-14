const asyncHandler = require('../utils/asyncHandler');
const createHttpError = require('../utils/httpError');
const manualPaymentsService = require('../services/manualPayments.service');
const { validateManualPaymentPayload, validateRejectPaymentPayload, isUuid } = require('../utils/validators');

const config = asyncHandler(async (req, res) => {
  const data = await manualPaymentsService.getManualPaymentConfig();
  res.status(200).json({ status: 'ok', data: { config: data } });
});

const submit = asyncHandler(async (req, res) => {
  const errors = validateManualPaymentPayload(req.body);
  if (errors.length) throw createHttpError(400, errors.join(' '));
  const payment = await manualPaymentsService.submitManualPayment(req.user.id, {
    orderId: req.body.orderId,
    referenceId: req.body.referenceId,
  });
  res.status(201).json({ status: 'ok', data: { payment } });
});

const confirm = asyncHandler(async (req, res) => {
  if (!isUuid(req.params.id)) throw createHttpError(404, 'Payment not found.');
  const payment = await manualPaymentsService.confirmManualPayment(req.user.id, req.params.id);
  res.status(200).json({ status: 'ok', data: { payment } });
});

const reject = asyncHandler(async (req, res) => {
  if (!isUuid(req.params.id)) throw createHttpError(404, 'Payment not found.');
  const errors = validateRejectPaymentPayload(req.body);
  if (errors.length) throw createHttpError(400, errors.join(' '));
  const payment = await manualPaymentsService.rejectManualPayment(req.user.id, req.params.id, req.body.reason);
  res.status(200).json({ status: 'ok', data: { payment } });
});

module.exports = { config, submit, confirm, reject };
