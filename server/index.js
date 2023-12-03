/**
 * Project Name: SocioPedia
 * Description: A social networking platform with content moderation and context-based authentication system.
 *
 * Author: Tayyab Ashraf
 * Email: tayyabashraf22@gmail.com
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import passport from 'passport';
import Database from './config/db.js';
import path from 'path';
import useragent from 'express-useragent';
import { fileURLToPath } from 'url';
import {notFound, errorHandler} from './middlewares/errors/error.js'

/*    Routes Imports   */
import userRoutes from "./routes/user.route.js";
import contextAuthRoutes from './routes/context-auth.route.js'

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

/*   DB Configuration    */
const db = new Database(process.env.MONGO_URL);
  
await db.connect().catch((err) =>{
    console.error("Error connecting to database:", err);
    process.exit(1);   
});
  
app.use(cors());
app.use(morgan("dev"));
app.use("/assets/userFiles", express.static(__dirname + "/assets/userFiles"));
app.use(
    "/assets/userAvatars",
    express.static(__dirname + "/assets/userAvatars")
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
import './config/passport.js';

// app.use(useragent.express());
// app.set('trust proxy', true)


/*    Routes Configuration    */
app.get("/", (req, res) => {
    res.json({ message: "Server is up and running!" });
});

app.use("/auth", contextAuthRoutes);
app.use('/users', userRoutes);

app.use(errorHandler);
app.use(notFound);

process.on("SIGINT", async () => {
    try {
      await db.disconnect();
      console.log("Disconnected from database.");
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
});
  
app.listen(PORT, () => console.log(`Server up and running on port ${PORT}!`));
