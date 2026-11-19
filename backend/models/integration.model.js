import mongoose from "mongoose";

const integrationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    provider: {
      type: String,
      required: true,
      enum: ["google", "instagram"],
    },
    services: [
      {
        type: String,
        enum: ["gmail", "google_calender", "instagram"],
      },
    ],
    providerAccountId: {
      type: String,
      required: true,
    },
    account: {
      email: {
        type: String,
        lowercase: true,
        trim: true,
      },
      username: {
        type: String,
        lowercase: true,
        trim: true,
      },
      displayName: {
        type: String,
        trim: true,
      },
    },
    tokens: {
      accessToken: {
        type: String,
        select: false,
      },
      refreshToken: {
        type: String,
        select: false,
      },
      expiresAt: {
        type: Date,
      },
    },
    scopes: [
      {
        type: String,
      },
    ],
    status: {
      type: String,
      enum: ["connected", "expired", "revoked", "error"],
      default: "connected",
    },
    connectedAt: {
      type: Date,
      default: Date.now,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

const Integration = mongoose.model("Integration", integrationSchema);

export default Integration;