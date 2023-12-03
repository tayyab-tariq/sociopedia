import mongoose from "mongoose";

const tokenSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  refreshToken: {
    type: String,
    required: true,
  },
  accessToken: {
    type: String,
    required: true,
  },
  tokenId: {
    type:  String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 6 * 60 * 60, // 6 hours
  },
});

const Token = mongoose.model("Token", tokenSchema);

export default Token;