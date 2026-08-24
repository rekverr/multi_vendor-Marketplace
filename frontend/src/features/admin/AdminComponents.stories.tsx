import type { Meta, StoryObj } from "@storybook/react-vite";
import { AdminTable, type AdminColumn } from "./AdminTable";
import { ConfirmDialog } from "./ConfirmDialog";

interface Row {
  id: string;
  name: string;
  status: string;
  detail: string;
}
const rows: Row[] = [
  {
    id: "1",
    name: "Northern Grain Studio",
    status: "PENDING",
    detail: "A standard review record.",
  },
  {
    id: "2",
    name: "A Seller name long enough to test constrained table layouts",
    status: "REJECTED",
    detail:
      "Long content should remain readable without breaking the responsive table container or hiding the state.",
  },
];
const columns: AdminColumn<Row>[] = [
  { label: "Seller", render: (row) => <strong>{row.name}</strong> },
  {
    label: "Status",
    render: (row) => (
      <span className={`admin-status status-${row.status.toLowerCase()}`}>
        {row.status}
      </span>
    ),
  },
  { label: "Detail", render: (row) => row.detail },
];
function TableExample({ empty = false }: { empty?: boolean }) {
  return empty ? (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <tbody>
          <tr>
            <td>No rows returned.</td>
          </tr>
        </tbody>
      </table>
    </div>
  ) : (
    <AdminTable columns={columns} items={rows} />
  );
}
const meta = {
  title: "Admin/Table and Dialog",
  component: TableExample,
} satisfies Meta<typeof TableExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PopulatedTable: Story = {};
export const EmptyTable: Story = { args: { empty: true } };
export const Confirmation: Story = {
  render: () => (
    <ConfirmDialog
      defaultOpen
      title="Approve Seller application?"
      description="This state-changing action updates the persisted role and Seller profile atomically."
      confirmLabel="Approve Seller"
      onConfirm={async () => undefined}
    >
      <ButtonTrigger />
    </ConfirmDialog>
  ),
};
export const RejectedConfirmation: Story = {
  render: () => (
    <ConfirmDialog
      defaultOpen
      requireText
      title="Reject dispute resolution?"
      description="The simulated backend will reject this action to demonstrate the failure state."
      confirmLabel="Reject"
      onConfirm={() => Promise.reject(new Error("Conflict"))}
    >
      <ButtonTrigger />
    </ConfirmDialog>
  ),
};
function ButtonTrigger() {
  return <button className="button button-primary">Open confirmation</button>;
}
