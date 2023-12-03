import geoip from "geoip-lite";
import SuspiciousLogin from "../models/suspiciousLogin.model.js";

/**
 * Get Context Data of request for verification purposes and logging
 * @param req - request object
 */

const getCurrentContextData = (req) => {
  const ip = req.clientIp || "unknown";
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
  return { ip, country, city, browser, platform, os, device, deviceType };
};


/**
 * Get Suspicious Context Data against userid for verification purposes and logging
 * @param _id - userId
 * @param currentContextData - current IP data details
*/

const getOldSuspiciousContextData = (_id, currentContextData) =>
  SuspiciousLogin.findOne({
    user: _id,
    ip: currentContextData.ip,
    country: currentContextData.country,
    city: currentContextData.city,
    browser: currentContextData.browser,
    platform: currentContextData.platform,
    os: currentContextData.os,
    device: currentContextData.device,
    deviceType: currentContextData.deviceType,
});

/**
 * Add Suspicious Context Data against userid in db
 * @param _id - userId against which data is to be saved
 */

const addNewSuspiciousLogin = async (_id, existingUser, currentContextData) => {
  const newSuspiciousLogin = new SuspiciousLogin({
    user: _id,
    email: existingUser.email,
    ip: currentContextData.ip,
    country: currentContextData.country,
    city: currentContextData.city,
    browser: currentContextData.browser,
    platform: currentContextData.platform,
    os: currentContextData.os,
    device: currentContextData.device,
    deviceType: currentContextData.deviceType,
  });

  return await newSuspiciousLogin.save();
};

const isTrustedDevice = (currentContextData, userContextData) =>
  Object.keys(userContextData).every(
    (key) => userContextData[key] === currentContextData[key]
  );

const isSuspiciousContextChanged = (oldContextData, newContextData) =>
  Object.keys(oldContextData).some(
    (key) => oldContextData[key] !== newContextData[key]
  );

const isOldDataMatched = (oldSuspiciousContextData, userContextData) =>
  Object.keys(oldSuspiciousContextData).every(
    (key) => oldSuspiciousContextData[key] === userContextData[key]
);

export { 
  getCurrentContextData, 
  getOldSuspiciousContextData,
  addNewSuspiciousLogin,
  isTrustedDevice,
  isSuspiciousContextChanged,
  isOldDataMatched
};