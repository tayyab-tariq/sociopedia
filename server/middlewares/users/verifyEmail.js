import { query, validationResult} from "express-validator";
import nodemailer from 'nodemailer';
import EmailVerification from "../../models/email.model.js";
import UserPreference from "../../models/preference.model.js";
import User from "../../models/user.model.js";
import { verifyEmailHTML } from "../../utils/emailTemplates.js";

const verifyEmailValidation = [
  query("email").isEmail().normalizeEmail(),
  query("code").isLength({ min: 5, max: 5 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }
    next();
  },
];


const CLIENT_URL = process.env.CLIENT_URL;
const EMAIL_SERVICE = process.env.EMAIL_SERVICE;

const sendVerificationEmail = async (req, res) => {
    const USER = process.env.EMAIL;
    const PASS = process.env.PASSWORD;
    const { email, name } = req.body;
  
    const verificationCode = Math.floor(10000 + Math.random() * 90000);
    const verificationLink = `${CLIENT_URL}/auth/verify?code=${verificationCode}&email=${email}`;
  
    try {
      let transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE,
        port: 465, 
        secure: true,
        secureConnection: false,
        auth: {
          user: USER,
          pass: PASS,
        },
        tls: {
            rejectUnauthorized: true
        }
      });

      let mailOptions = {
        from: `"SocioPedia" <${USER}>`,
        to: email,
        subject: "Verify your email address",
        html: verifyEmailHTML(name, verificationLink, verificationCode),
      };
      
      let info = await transporter.sendMail(mailOptions);

      const newVerification = new EmailVerification({
        email,
        verificationCode,
        messageId: info.messageId,
        for: "signup",
      });
  
      await newVerification.save();
  
      res.status(200).json({
        message: `Verification email was successfully sent to ${email}`,
      });
    } catch (err) {
      console.log(
        "Could not send verification email. There could be an issue with the provided credentials or the email service."
      );
      res.status(500).json({ message: "Something went wrong" });
    }
}

const verifyEmail = async (req, res, next) => {
  const { code, email } = req.query;
  
  const [isVerified, verification] = await Promise.all([
    User.findOne({ email: { $eq: email }, isEmailVerified: true }),
    EmailVerification.findOne({
      email: { $eq: email },
      verificationCode: { $eq: code },
    }),
  ]);

  if (isVerified) {
    return res.status(400).json({ message: "Email is already verified" });
  }

  if (!verification) {
    return res
      .status(400)
      .json({ message: "Verification code is invalid or has expired" });
  }

  const updatedUser = await User.findOneAndUpdate(
    { email: { $eq: email } },
    { isEmailVerified: true },
    { new: true }
  ).exec();

  await Promise.all([
    EmailVerification.deleteMany({ email: { $eq: email } }).exec(),
    new UserPreference({
      user: updatedUser,
      enableContextBasedAuth: true,
    }).save(),
  ]);

  req.userId = updatedUser._id;
  req.email = updatedUser.email;
  next();
};

export {
    sendVerificationEmail,
    verifyEmailValidation,
    verifyEmail
}