import express  from "express";
import passport from "passport";
import useragent from "express-useragent";

import { verifyEmail, verifyEmailValidation } from "../middlewares/users/verifyEmail.js";
import { verifyLogin, verifyLoginValidation, blockLogin } from "../middlewares/users/verifyLogin.js";
import { addContextData, getAuthContextData, getBlockedAuthContextData, getTrustedAuthContextData, getUserPreferences, deleteContextAuthData, blockContextAuthData, unblockContextAuthData } from "../controllers/auth.controller.js";
import decodeToken from "../middlewares/auth/decodeToken.js";

const router = express.Router();

const requireAuth = passport.authenticate("jwt", { session: false }, null);

router.get(
    "/context-data/primary",
    requireAuth,
    decodeToken,
    getAuthContextData
);

router.get(
    "/context-data/trusted",
    requireAuth,
    decodeToken,
    getTrustedAuthContextData
);

router.get(
    "/context-data/blocked",
    requireAuth,
    decodeToken,
    getBlockedAuthContextData
);

router.get("/user-preferences", requireAuth, decodeToken, getUserPreferences);

router.delete("/context-data/:contextId", requireAuth, deleteContextAuthData);

router.patch(
  "/context-data/block/:contextId",
  requireAuth,
  blockContextAuthData
);
router.patch(
  "/context-data/unblock/:contextId",
  requireAuth,
  unblockContextAuthData
);

router.use(useragent.express());
router.get("/verify", verifyEmailValidation, verifyEmail, addContextData);
router.get("/verify-login", verifyLoginValidation, verifyLogin);
router.get("/block-login", verifyLoginValidation, blockLogin);

export default router;