import mongoose from "mongoose";

import fs from "fs";
import path from "path";
import { promisify } from "util";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const postSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      trim: true,
    },
    fileUrl: {
      type: String,
      trim: true,
    },
    fileType: {
      type: String,
    },
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

postSchema.index({ content: "text" });

postSchema.pre("remove", async function (next) {
  try {
    if (this.fileUrl) {
      const filename = path.basename(this.fileUrl);
      const deleteFilePromise = promisify(fs.unlink)(
        path.join(__dirname, "../assets/userFiles", filename)
      );
      await deleteFilePromise;
    }

    await this.model("Comment").deleteMany({ _id: this.comments });

    await this.model("Report").deleteOne({
      post: this._id,
    });

    await this.model("User").updateMany(
      {
        savedPosts: this._id,
      },
      {
        $pull: {
          savedPosts: this._id,
        },
      }
    );
    next();
  } catch (err) {
    next(err);
  }
});

const Post =  mongoose.model("Post", postSchema);

export default Post;