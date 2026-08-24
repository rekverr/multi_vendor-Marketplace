import type { Preview } from "@storybook/react-vite";
import { MemoryRouter } from "react-router-dom";
import "../src/index.css";

const preview: Preview = {
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div style={{ padding: 32, maxWidth: 1200, margin: "0 auto" }}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  parameters: {
    a11y: { test: "error" },
    controls: { expanded: true },
    backgrounds: {
      default: "marketplace",
      values: [{ name: "marketplace", value: "#f2efe5" }],
    },
  },
};

export default preview;
