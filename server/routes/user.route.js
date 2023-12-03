import express from 'express';
import passport from 'passport';
import requestIp from 'request-ip';
import useragent from 'express-useragent';
import { addUserValidator, addUserValidatorHandler } from '../middlewares/users/usersValidator.js';
import { signUpSignInLimiter, followLimiter } from '../middlewares/limiter/limiter.js';
import avatarUpload from '../middlewares/users/avatarUpload.js'
import { sendVerificationEmail } from '../middlewares/users/verifyEmail.js';
import { sendLoginVerificationEmail } from '../middlewares/users/verifyLogin.js';
import { addUser, signin, getUser, getModProfile, logout, updateInfo, refreshToken } from '../controllers/user.controller.js';
import { getPublicUsers, getPublicUser, getFollowingUsers, followUser, unfollowUser } from '../controllers/profile.controller.js';
import decodeToken from "../middlewares/auth/decodeToken.js";


const router = express.Router();
const requireAuth = passport.authenticate("jwt", { session: false }, null);

router.get("/public-users/:id", requireAuth, decodeToken, getPublicUser);
router.get("/public-users", requireAuth, decodeToken, getPublicUsers);
router.get("/moderator", requireAuth, decodeToken, getModProfile);
router.get("/following", requireAuth, decodeToken, getFollowingUsers);
router.get("/:id", requireAuth, getUser);


router.post(
    "/signup",
    signUpSignInLimiter,
    useragent.express(),
    avatarUpload,
    addUserValidator,
    addUserValidatorHandler,
    addUser,
    sendVerificationEmail
);
router.post("/refresh-token", refreshToken);
router.post(
    "/signin",
    signUpSignInLimiter,
    requestIp.mw(),
    useragent.express(),
    signin,
    sendLoginVerificationEmail
);
router.post("/logout", logout);

router.put("/:id", requireAuth, decodeToken, updateInfo);

router.use(followLimiter);
router.patch("/:id/follow", requireAuth, decodeToken, followUser);
router.patch("/:id/unfollow", requireAuth, decodeToken, unfollowUser);

export default router;