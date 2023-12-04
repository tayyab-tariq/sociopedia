import { lazy } from "react";
import SignUp from "./pages/SignUp";

const NotFound = lazy(() => import("./pages/NotFound"));

export const publicRoutes = [
    {
      path: "/signup",
      element: <SignUp />
    },
    {
      path: "*",
      element: <NotFound />,
    },
];  