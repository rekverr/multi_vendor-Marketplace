import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";
import { FormField } from "./FormField";

const meta = {
  title: "Foundations/Controls",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Button" },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Buttons: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <Button>Continue</Button>
      <Button variant="secondary">Cancel</Button>
      <Button disabled>Unavailable</Button>
      <Button loading>Submitting</Button>
    </div>
  ),
};
export const FormFields: Story = {
  render: () => (
    <div className="auth-form" style={{ maxWidth: 440 }}>
      <FormField
        label="Email"
        type="email"
        defaultValue="seller@example.com"
        hint="Used for marketplace notifications."
      />
      <FormField
        label="Bid amount"
        inputMode="decimal"
        defaultValue="12.999"
        error="Use no more than two decimal places."
      />
      <FormField
        label="Disabled field"
        disabled
        value="Persisted by backend"
        readOnly
      />
    </div>
  ),
};
