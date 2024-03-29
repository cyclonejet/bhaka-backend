const express = require('express');
const { check } = require('express-validator');

const router = express.Router();

const adminsControllers = require('../controllers/admins');

router.post(
  '/signup',
  [
    check('username').isLength({ min: 6, max: 20 }),
    check('email').not().isEmpty().normalizeEmail().isEmail(),
    check('password').isLength({ min: 8, max: 64 }),
  ],
  adminsControllers.signup
);

router.post(
  '/signin',
  [check('username').not().isEmail(), check('password').not().isEmpty()],
  adminsControllers.signin
);

module.exports = router;
