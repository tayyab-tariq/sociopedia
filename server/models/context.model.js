import mongoose from "mongoose";

import { encryptField, decryptField } from "../utils/encryption.js";

const contextSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    ip: {
      type: String,
      required: true,
      set: encryptField,
      get: decryptField,
    },
    country: {
      type: String,
      required: true,
      set: encryptField,
      get: decryptField,
    },
    city: {
      type: String,
      required: true,
      set: encryptField,
      get: decryptField,
    },
    browser: {
      type: String,
      required: true,
      set: encryptField,
      get: decryptField,
    },
    platform: {
      type: String,
      required: true,
      set: encryptField,
      get: decryptField,
    },
    os: {
      type: String,
      required: true,
      set: encryptField,
      get: decryptField,
    },
    device: {
      type: String,
      required: true,
      set: encryptField,
      get: decryptField,
    },
    deviceType: {
      type: String,
      required: true,
      set: encryptField,
      get: decryptField,
    },
    isTrusted: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Context = mongoose.model("Context", contextSchema);
export default Context;