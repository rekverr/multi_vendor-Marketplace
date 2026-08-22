import { RouterProvider } from "react-router-dom";
import { AppErrorBoundary } from "./app/AppErrorBoundary";
import { router } from "./app/router";

export default function App() {
  return (
    <AppErrorBoundary>
      <RouterProvider router={router} />
    </AppErrorBoundary>
  );
}
