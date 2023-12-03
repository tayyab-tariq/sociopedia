import mongoose from "mongoose";

const preferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    enableContextBasedAuth: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Preference = mongoose.model("Preference", preferenceSchema);
export default Preference;