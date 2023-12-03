import mongoose from "mongoose";
import {
  encryptField,
  decryptField,
  decryptData,
} from "../utils/encryption.js";

const LogSchema = new mongoose.Schema({
  email: { type: String },

  context: { type: String, set: encryptField, get: decryptField },

  message: { type: String, required: true },

  type: { type: String, required: true },

  level: { type: String, required: true },

  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    expires: 604800, // 1 week
  },
});

LogSchema.methods.decryptContext = function () {
  return decryptData(this.context);
};

const LogModel = mongoose.model("Log", LogSchema);

export default LogModel;