import User from "../models/user.model.js";
import Token from "../models/token.model.js";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import passport from "passport";
import dotenv from 'dotenv';

import jwt from "jsonwebtoken";
dotenv.config();

const opts = {};
opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
opts.secretOrKey = process.env.SECRET;

passport.use(
  new JwtStrategy(opts, async function (jwt_payload, done) {
    try {
      const user = await User.findOne({ email: jwt_payload.email });

      if (user) {
        const refreshTokenFromDB = await Token.findOne({
          user: user._id,
          tokenId: jwt_payload.tokenId
        });

        if (!refreshTokenFromDB) {
          return done(null, false);
        }

        const refreshPayload = jwt.verify(
          refreshTokenFromDB.refreshToken,
          process.env.REFRESH_SECRET
        );

        if (refreshPayload.email !== jwt_payload.email) {
          return done(null, false);
        }

        const tokenExpiration = new Date(jwt_payload.exp * 1000);
        const now = new Date();
        const timeDifference = tokenExpiration.getTime() - now.getTime();

        if (timeDifference > 0 && timeDifference < 30 * 60 * 1000) {
          const payloadNew = {
            _id: user._id,
            email: user.email,
          };
          const newToken = jwt.sign(payloadNew, process.env.SECRET, {
            expiresIn: "6h",
          });

          return done(null, { user, newToken });
        }
        return done(null, { user });
      } else {
        return done(null, false);
      }
    } catch (err) {
      return done(err, false);
    }
  })
);