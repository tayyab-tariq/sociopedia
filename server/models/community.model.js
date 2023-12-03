import mongoose from "mongoose";

const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    banner: {
      type: String,
    },

    moderators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: [],
      },
    ],

    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: [],
      },
    ],

    bannedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: [],
      },
    ],

    rules: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Rule",
        default: [],
      },
    ],
  },

  {
    timestamps: true,
  }
);

communitySchema.index({ name: "text" });

const Community = mongoose.model("Community", communitySchema);
export default Community;