const express = require('express');
const { list, create, update, remove } = require('../controllers/addresses.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', list);
router.post('/', create);
router.patch('/:id', update);
router.delete('/:id', remove);

module.exports = router;
