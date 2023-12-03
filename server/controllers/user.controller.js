import bcrypt from "bcrypt";
import User from "../models/user.model.js";
import Token from "../models/token.model.js";
import UserPreference from "../models/preference.model.js";
import Community from "../models/community.model.js";
import Post from "../models/post.model.js";
import { saveLogInfo } from "../middlewares/logger/logInfo.js";
import { verifyContextData, types } from "./auth.controller.js";


import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from 'uuid';
import asyncHandler from 'express-async-handler';
import duration from "dayjs/plugin/duration.js";
import dayjs from "dayjs";

dayjs.extend(duration);

const LOG_TYPE = {
  SIGN_IN: "sign in",
  LOGOUT: "logout",
};

const LEVEL = {
  INFO: "info",
  ERROR: "error",
  WARN: "warn",
};

const MESSAGE = {
  SIGN_IN_ATTEMPT: "User attempting to sign in",
  SIGN_IN_ERROR: "Error occurred while signing in user: ",
  INCORRECT_EMAIL: "Incorrect email",
  INCORRECT_PASSWORD: "Incorrect password",
  DEVICE_BLOCKED: "Sign in attempt from blocked device",
  CONTEXT_DATA_VERIFY_ERROR: "Context data verification failed",
  MULTIPLE_ATTEMPT_WITHOUT_VERIFY:
    "Multiple sign in attempts detected without verifying identity.",
  LOGOUT_SUCCESS: "User has logged out successfully",
};

/**
 * Authenticate and sigin a user and check if context data matches to previous logins. Also log requests to db.
 *
 * @description After signin, provide token to user for using authenticated requests.
 * 
 * @route POST /users/signin
 *
 * @param {Object} req.body - email & password attached to the request object.
 * @param {Function} next - The next middleware function to call if consent is given by the user to enable context based auth.
 */

const signin = async (req, res, next) => {

  await saveLogInfo(
    req,
    "User attempting to sign in",
    LOG_TYPE.SIGN_IN,
    LEVEL.INFO
  );

  try {
    const { email, password } = req.body;
    const existingUser = await User.findOne({
      email: { $eq: email },
    });
    if (!existingUser) {
      await saveLogInfo(
        req,
        MESSAGE.INCORRECT_EMAIL,
        LOG_TYPE.SIGN_IN,
        LEVEL.ERROR
      );

      return res.status(404).json({
        message: "Invalid credentials",
      });
    }

    if (!password){
      await saveLogInfo(
        req,
        MESSAGE.INCORRECT_PASSWORD,
        LOG_TYPE.SIGN_IN,
        LEVEL.ERROR
      );
      
      return res.status(404).json({
        message: "Invalid credentials",
      });
    }
      
    const isPasswordCorrect = await bcrypt.compare(
      password,
      existingUser.password
    );
    
    if (!isPasswordCorrect) {
      await saveLogInfo(
        req,
        MESSAGE.INCORRECT_PASSWORD,
        LOG_TYPE.SIGN_IN,
        LEVEL.ERROR
      );

      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    const isContextAuthEnabled = await UserPreference.findOne({
      user: existingUser._id,
      enableContextBasedAuth: true,
    });

    if (isContextAuthEnabled) {
      const contextDataResult = await verifyContextData(req, existingUser);

      if (contextDataResult === types.BLOCKED) {
        await saveLogInfo(
          req,
          MESSAGE.DEVICE_BLOCKED,
          LOG_TYPE.SIGN_IN,
          LEVEL.WARN
        );

        return res.status(401).json({
          message:
            "You've been blocked due to suspicious login activity. Please contact support for assistance.",
        });
      }

      if (
        contextDataResult === types.NO_CONTEXT_DATA ||
        contextDataResult === types.ERROR
      ) {
        await saveLogInfo(
          req,
          MESSAGE.CONTEXT_DATA_VERIFY_ERROR,
          LOG_TYPE.SIGN_IN,
          LEVEL.ERROR
        );

        return res.status(500).json({
          message: "Error occurred while verifying context data",
        });
      }

      if (contextDataResult === types.SUSPICIOUS) {
        await saveLogInfo(
          req,
          MESSAGE.MULTIPLE_ATTEMPT_WITHOUT_VERIFY,
          LOG_TYPE.SIGN_IN,
          LEVEL.WARN
        );

        return res.status(401).json({
          message: `You've temporarily been blocked due to suspicious login activity. We have already sent a verification email to your registered email address. 
          Please follow the instructions in the email to verify your identity and gain access to your account.

          Please note that repeated attempts to log in without verifying your identity will result in this device being permanently blocked from accessing your account.
          
          Thank you for your cooperation`,
        });
      }

      if (contextDataResult.mismatchedProps) {
        const mismatchedProps = contextDataResult.mismatchedProps;
        const currentContextData = contextDataResult.currentContextData;
        if (
          mismatchedProps.some((prop) =>
            [
              "ip",
              "country",
              "city",
              "device",
              "deviceLOG_TYPE",
              "os",
              "platform",
              "browser",
            ].includes(prop)
          )
        ) {
          req.mismatchedProps = mismatchedProps;
          req.currentContextData = currentContextData;
          req.user = existingUser;
          return next();
        }
      }
    }

    const tokenId = uuidv4();
    const payload = {
      id: existingUser._id,
      email: existingUser.email,
      tokenId
    };

    const accessToken = jwt.sign(payload, process.env.SECRET, {
      expiresIn: "6h",
    });

    const refreshToken = jwt.sign(payload, process.env.REFRESH_SECRET, {
      expiresIn: "7d",
    });

    const newRefreshToken = new Token({
      user: existingUser._id,
      refreshToken,
      accessToken,
      tokenId
    });
    await newRefreshToken.save();

    res.status(200).json({
      accessToken,
      refreshToken,
      accessTokenUpdatedAt: new Date().toLocaleString(),
      user: {
        _id: existingUser._id,
        name: existingUser.name,
        email: existingUser.email,
        role: existingUser.role,
        avatar: existingUser.avatar,
      },
    });
  } catch (err) {
    await saveLogInfo(
      req,
      MESSAGE.SIGN_IN_ERROR + err.message,
      LOG_TYPE.SIGN_IN,
      LEVEL.ERROR
    );

    res.status(500).json({
      message: "Something went wrong",
    });
  }
};


/**
 * Adds a new user to the database with the given name, email, password, and avatar.
 *
 * @description If the email domain of the user's email is "mod.socialecho.com", the user will be
 * assigned the role of "moderator" by default, but not necessarily as a moderator of any community.
 * Otherwise, the user will be assigned the role of "general" user.
 *
 * @route POST /users/signup
 * 
 * @param {Object} req.files - The files attached to the request object (for avatar).
 * @param {string} req.body.isConsentGiven - Indicates whether the user has given consent to enable context based auth.
 * @param {Function} next - The next middleware function to call if consent is given by the user to enable context based auth.
 */

const addUser = asyncHandler(async (req, res, next) => {
  let newUser;

  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  /**
   * @type {boolean} isConsentGiven
   */
  const { isConsentGiven } = req.body;

  const defaultAvatar =
    "https://raw.githubusercontent.com/nz-m/public-files/main/dp.jpg";

  const fileUrl = req.files?.[0]?.filename
    ? `${req.protocol}://${req.get("host")}/assets/userAvatars/${
        req.files[0].filename
      }`
    : defaultAvatar;

  const emailDomain = req.body.email.split("@")[1];
  const role = emailDomain === "mod.socialecho.com" ? "moderator" : "general";

  newUser = new User({
    name: req.body.name,
    email: req.body.email,
    password: hashedPassword,
    role: role,
    avatar: fileUrl,
  });

  try {
    await newUser.save();
    if (newUser.isNew) {
      throw new Error("Failed to add user");
    }

    if (isConsentGiven) {
      next();
    } else {
      res.status(201).json({
        message: "User added successfully",
        fileUrl,
      });
    }
  } catch (err) {
    res.status(400).json({
      message: "Failed to add user",
    });
  }
});


/**
 * Retrieves a user's profile information, including their total number of posts,
 * the number of communities they are in, the number of communities they have posted in,
 * and their duration on the platform.
 
 * @route GET /users/:id

 * @param req - Express request object
 * @param res - Express response object
 * @param {Function} next - Express next function
 */
const getUser = asyncHandler(async (req, res) => {
  
  const user = await User.findById(req.params.id).select("-password").lean();

  const totalPosts = await Post.countDocuments({ user: user._id });

  const communities = await Community.find({ members: user._id });
  const totalCommunities = communities.length;

  const postCommunities = await Post.find({ user: user._id }).distinct(
    "community"
  );
  const totalPostCommunities = postCommunities.length;

  const createdAt = dayjs(user.createdAt);
  const now = dayjs();
  const durationObj = dayjs.duration(now.diff(createdAt));
  const durationMinutes = durationObj.asMinutes();
  const durationHours = durationObj.asHours();
  const durationDays = durationObj.asDays();

  user.totalPosts = totalPosts;
  user.totalCommunities = totalCommunities;
  user.totalPostCommunities = totalPostCommunities;
  user.duration = "";

  if (durationMinutes < 60) {
    user.duration = `${Math.floor(durationMinutes)} minutes`;
  } else if (durationHours < 24) {
    user.duration = `${Math.floor(durationHours)} hours`;
  } else if (durationDays < 365) {
    user.duration = `${Math.floor(durationDays)} days`;
  } else {
    const durationYears = Math.floor(durationDays / 365);
    user.duration = `${durationYears} years`;
  }
  const posts = await Post.find({ user: user._id })
    .populate("community", "name members")
    .limit(20)
    .lean()
    .sort({ createdAt: -1 });

  user.posts = posts.map((post) => ({
    ...post,
    isMember: post.community?.members
      .map((member) => member.toString())
      .includes(user._id.toString()),
    createdAt: formatCreatedAt(post.createdAt),
  }));

  res.status(200).json(user);

});


/**
 * Retrieves a moderators's profile information, 
 * 
 * @route GET /users/moderator
 */
const getModProfile = asyncHandler(async (req, res) => {
  
  const moderator = await User.findById(req.userId);
  if (!moderator) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  const moderatorInfo = {
    ...moderator._doc,
  };
  delete moderatorInfo.password;
  moderatorInfo.createdAt = moderatorInfo.createdAt.toLocaleString();

  res.status(200).json({
    moderatorInfo,
  });

});


/**
 * @route POST /users/logout
 */
const logout = asyncHandler(async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(" ")[1] ?? null;
    if (accessToken) {
      await Token.deleteOne({ accessToken });
      await saveLogInfo(
        null,
        MESSAGE.LOGOUT_SUCCESS,
        LOG_TYPE.LOGOUT,
        LEVEL.INFO
      );
    }
    res.status(200).json({
      message: "Logout successful",
    });
  } catch (err) {
    await saveLogInfo(null, err.message, LOG_TYPE.LOGOUT, LEVEL.ERROR);
    res.status(500).json({
      message: "Internal server error. Please try again later.",
    });
  }
});


/**
 * @route PUT /users/:id
 */
const updateInfo = asyncHandler(async (req, res) => {

  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  const { location, interests, bio } = req.body;

  user.location = location;
  user.interests = interests;
  user.bio = bio;

  await user.save();

  res.status(200).json({
    message: "User info updated successfully",
  });

});

const refreshToken = asyncHandler(async (req, res) => {

  const { refreshToken } = req.body;

  const existingToken = await Token.findOne({
    refreshToken: { $eq: refreshToken },
  });
  if (!existingToken) {
    return res.status(401).json({
      message: "Invalid refresh token",
    });
  }
  const existingUser = await User.findById(existingToken.user);
  if (!existingUser) {
    return res.status(401).json({
      message: "Invalid refresh token",
    });
  }

  const refreshTokenExpiresAt =
    jwt.decode(existingToken.refreshToken).exp * 1000;
  if (Date.now() >= refreshTokenExpiresAt) {
    await existingToken.deleteOne();
    return res.status(401).json({
      message: "Expired refresh token",
    });
  }

  const payload = {
    id: existingUser._id,
    email: existingUser.email,
  };

  const accessToken = jwt.sign(payload, process.env.SECRET, {
    expiresIn: "6h",
  });

  res.status(200).json({
    accessToken,
    refreshToken: existingToken.refreshToken,
    accessTokenUpdatedAt: new Date().toLocaleString(),
  });
  
});


export { signin, addUser, getUser, getModProfile, updateInfo, logout, refreshToken };
