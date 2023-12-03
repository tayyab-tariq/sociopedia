import UserContext from "../models/context.model.js";
import SuspiciousLogin from "../models/suspiciousLogin.model.js";
import UserPreference from "../models/preference.model.js";


import { getCurrentContextData, getOldSuspiciousContextData, addNewSuspiciousLogin,
  isTrustedDevice,
  isSuspiciousContextChanged,
  isOldDataMatched } from "../utils/contextData.js";
import asyncHandler from 'express-async-handler';
import geoip from "geoip-lite";
import formatCreatedAt from "../utils/timeConverter.js";


const types = {
  NO_CONTEXT_DATA: "no_context_data",
  MATCH: "match",
  BLOCKED: "blocked",
  SUSPICIOUS: "suspicious",
  ERROR: "error",
};

const verifyContextData = async (req, existingUser) => {
  try {
    const { _id } = existingUser;
    const userContextDataRes = await UserContext.findOne({ user: _id });

    if (!userContextDataRes) {
      return types.NO_CONTEXT_DATA;
    }

    const userContextData = {
      ip: userContextDataRes.ip,
      country: userContextDataRes.country,
      city: userContextDataRes.city,
      browser: userContextDataRes.browser,
      platform: userContextDataRes.platform,
      os: userContextDataRes.os,
      device: userContextDataRes.device,
      deviceType: userContextDataRes.deviceType,
    };

    const currentContextData = getCurrentContextData(req);

    if (isTrustedDevice(currentContextData, userContextData)) {
      return types.MATCH;
    }

    const oldSuspiciousContextData = await getOldSuspiciousContextData(
      _id,
      currentContextData
    );

    if (oldSuspiciousContextData) {
      if (oldSuspiciousContextData.isBlocked) return types.BLOCKED;
      if (oldSuspiciousContextData.isTrusted) return types.MATCH;
    }

    let newSuspiciousData = {};
    if (
      oldSuspiciousContextData &&
      isSuspiciousContextChanged(oldSuspiciousContextData, currentContextData)
    ) {
      const {
        ip: suspiciousIp,
        country: suspiciousCountry,
        city: suspiciousCity,
        browser: suspiciousBrowser,
        platform: suspiciousPlatform,
        os: suspiciousOs,
        device: suspiciousDevice,
        deviceType: suspiciousDeviceType,
      } = oldSuspiciousContextData;

      if (
        suspiciousIp !== currentContextData.ip ||
        suspiciousCountry !== currentContextData.country ||
        suspiciousCity !== currentContextData.city ||
        suspiciousBrowser !== currentContextData.browser ||
        suspiciousDevice !== currentContextData.device ||
        suspiciousDeviceType !== currentContextData.deviceType ||
        suspiciousPlatform !== currentContextData.platform ||
        suspiciousOs !== currentContextData.os
      ) {
        //  Suspicious login data found, but it doesn't match the current context data, so we add new suspicious login data
        const res = await addNewSuspiciousLogin(
          _id,
          existingUser,
          currentContextData
        );

        newSuspiciousData = {
          time: formatCreatedAt(res.createdAt),
          ip: res.ip,
          country: res.country,
          city: res.city,
          browser: res.browser,
          platform: res.platform,
          os: res.os,
          device: res.device,
          deviceType: res.deviceType,
        };
      } else {
        // increase the unverifiedAttempts count by 1
        await SuspiciousLogin.findByIdAndUpdate(
          oldSuspiciousContextData._id,
          {
            $inc: { unverifiedAttempts: 1 },
          },
          { new: true }
        );
        //  If the unverifiedAttempts count is greater than or equal to 3, then we block the user
        if (oldSuspiciousContextData.unverifiedAttempts >= 3) {
          await SuspiciousLogin.findByIdAndUpdate(
            oldSuspiciousContextData._id,
            {
              isBlocked: true,
              isTrusted: false,
            },
            { new: true }
          );

          await saveLogInfo(
            req,
            "Device blocked due to too many unverified login attempts",
            "sign in",
            "warn"
          );

          return types.BLOCKED;
        }

        // Suspicious login data found, and it matches the current context data, so we return "already_exists"
        return types.SUSPICIOUS;
      }
    } else if (
      oldSuspiciousContextData &&
      isOldDataMatched(oldSuspiciousContextData, currentContextData)
    ) {
      return types.MATCH;
    } else {
      //  No previous suspicious login data found, so we create a new one
      const res = await addNewSuspiciousLogin(
        _id,
        existingUser,
        currentContextData
      );

      newSuspiciousData = {
        time: formatCreatedAt(res.createdAt),
        id: res._id,
        ip: res.ip,
        country: res.country,
        city: res.city,
        browser: res.browser,
        platform: res.platform,
        os: res.os,
        device: res.device,
        deviceType: res.deviceType,
      };
    }

    const mismatchedProps = [];

    if (userContextData.ip !== newSuspiciousData.ip) {
      mismatchedProps.push("ip");
    }
    if (userContextData.browser !== newSuspiciousData.browser) {
      mismatchedProps.push("browser");
    }
    if (userContextData.device !== newSuspiciousData.device) {
      mismatchedProps.push("device");
    }
    if (userContextData.deviceType !== newSuspiciousData.deviceType) {
      mismatchedProps.push("deviceType");
    }
    if (userContextData.country !== newSuspiciousData.country) {
      mismatchedProps.push("country");
    }
    if (userContextData.city !== newSuspiciousData.city) {
      mismatchedProps.push("city");
    }

    if (mismatchedProps.length > 0) {
      return {
        mismatchedProps: mismatchedProps,
        currentContextData: newSuspiciousData,
      };
    }

    return types.MATCH;
  } catch (error) {
    return types.ERROR;
  }
};

const addContextData = asyncHandler(async (req, res) => {
    const userId = req.userId;
    const email = req.email;

    console.log(userId, email);
    
    const ip = req.ip || "unknown";

    const location = geoip.lookup(ip) || "unknown";
    const country = location.country ? location.country.toString() : "unknown";
    const city = location.city ? location.city.toString() : "unknown";
    
    const browser = req.useragent.browser
    ? `${req.useragent.browser} ${req.useragent.version}`
    : "unknown";
    
    const platform = req.useragent.platform
      ? req.useragent.platform.toString()
      : "unknown";
    const os = req.useragent.os ? req.useragent.os.toString() : "unknown";
    const device = req.useragent.device
      ? req.useragent.device.toString()
      : "unknown";
  
    const isMobile = req.useragent.isMobile || false;
    const isDesktop = req.useragent.isDesktop || false;
    const isTablet = req.useragent.isTablet || false;
  
    const deviceType = isMobile
      ? "Mobile"
      : isDesktop
      ? "Desktop"
      : isTablet
      ? "Tablet"
      : "unknown";


    const newUserContext = new UserContext({
      user: userId,
      email,
      ip,
      country,
      city,
      browser,
      platform,
      os,
      device,
      deviceType,
    });
  
    
    await newUserContext.save();
    res.status(200).json({
    message: "Email verification process was successful",
    });
});


/**
 * @route GET /auth/context-data/primary
 */
const getAuthContextData = asyncHandler(async (req, res) => {

  const result = await UserContext.findOne({ user: req.userId });

  if (!result) {
    return res.status(404).json({ message: "Not found" });
  }

  const userContextData = {
    firstAdded: formatCreatedAt(result.createdAt),
    ip: result.ip,
    country: result.country,
    city: result.city,
    browser: result.browser,
    platform: result.platform,
    os: result.os,
    device: result.device,
    deviceType: result.deviceType,
  };

  res.status(200).json(userContextData);
});


/**
 * @route GET /auth/context-data/trusted
 */
const getTrustedAuthContextData = asyncHandler(async (req, res) => {

  const result = await SuspiciousLogin.find({
    user: req.userId,
    isTrusted: true,
    isBlocked: false,
  });

  const trustedAuthContextData = result.map((item) => {
    return {
      _id: item._id,
      time: formatCreatedAt(item.createdAt),
      ip: item.ip,
      country: item.country,
      city: item.city,
      browser: item.browser,
      platform: item.platform,
      os: item.os,
      device: item.device,
      deviceType: item.deviceType,
    };
  });

  res.status(200).json(trustedAuthContextData);

});


/**
 * @route GET /auth/context-data/blocked
 */
const getBlockedAuthContextData = asyncHandler(async (req, res) => {
  
  const result = await SuspiciousLogin.find({
    user: req.userId,
    isBlocked: true,
    isTrusted: false,
  });

  const blockedAuthContextData = result.map((item) => {
    return {
      _id: item._id,
      time: formatCreatedAt(item.createdAt),
      ip: item.ip,
      country: item.country,
      city: item.city,
      browser: item.browser,
      platform: item.platform,
      os: item.os,
      device: item.device,
      deviceType: item.deviceType,
    };
  });

  res.status(200).json(blockedAuthContextData);
});

/**
 * @route GET /auth/user-preferences
 */
const getUserPreferences = asyncHandler(async (req, res) => {
  
  const userPreferences = await UserPreference.findOne({ user: req.userId });

  if (!userPreferences) {
    return res.status(404).json({ message: "Not found" });
  }

  res.status(200).json(userPreferences);

});


/**
 * @route DELETE /auth/context-data/:contextId
 */
const deleteContextAuthData = asyncHandler(async (req, res) => {
  
  const contextId = req.params.contextId;

  await SuspiciousLogin.deleteOne({ _id: contextId });

  res.status(200).json({
    message: "Data deleted successfully",
  });
  
});


/**
 * @route PATCH /auth/context-data/block/:contextId
 */
const blockContextAuthData = asyncHandler(async (req, res) => {
  
  const contextId = req.params.contextId;

  await SuspiciousLogin.findOneAndUpdate(
    { _id: contextId },
    { $set: { isBlocked: true, isTrusted: false } },
    { new: true }
  );

  res.status(200).json({
    message: "Blocked successfully",
  });

});

/**
 * @route PATCH /auth/context-data/unblock/:contextId
 */
const unblockContextAuthData = asyncHandler(async (req, res) => {
  
  const contextId = req.params.contextId;

  await SuspiciousLogin.findOneAndUpdate(
    { _id: contextId },
    { $set: { isBlocked: false, isTrusted: true } },
    { new: true }
  );

  res.status(200).json({
    message: "Unblocked successfully",
  });
  
});
  
export {
    addContextData,
    verifyContextData,
    getAuthContextData,
    getBlockedAuthContextData,
    getTrustedAuthContextData,
    getUserPreferences,
    deleteContextAuthData,
    blockContextAuthData,
    unblockContextAuthData,
    types
}