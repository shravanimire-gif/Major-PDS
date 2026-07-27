import { useEffect, useState } from 'react';
import { Plus, Upload, UserCog } from 'lucide-react';
import api from '../../api/axios';
import AddShopkeeperModal from '../../components/admin/AddShopkeeperModal';
import ShopkeeperBulkUploadModal from '../../components/admin/ShopkeeperBulkUploadModal';
import PanelHeader from '../../design/primitives/PanelHeader';
import useToast from '../../components/ui/useToast';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';

const getRoleBadgeStatus = (role) => {
  if (role === 'admin') return 'info';
  if (role === 'shopkeeper') return 'success';
  return 'neutral';
};

const COLUMNS = ['Role', 'Name', 'Email', 'Mobile', 'Status', 'Actions'];

const emptyEdit = { name: '', email: '', mobile: '', is_active: true };

const Users = () => {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState(emptyEdit);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    document.title = 'Users & Roles — PDS Supervision';
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/admin/users');
      setUsers(response.data?.users || response.data?.data || []);
    } catch (fetchError) {
      toast.danger(fetchError.response?.data?.error || 'Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEdit = (user) => {
    setEditUser(user);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      mobile: user.mobile || '',
      is_active: user.is_active,
    });
    setEditError('');
  };

  const closeEdit = () => {
    setEditUser(null);
    setEditForm(emptyEdit);
    setEditError('');
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError('');
    setEditSubmitting(true);
    try {
      await api.put(`/api/admin/users/${editUser.id}`, editForm);
      toast.success('User updated successfully.');
      await fetchUsers();
      closeEdit();
    } catch (err) {
      const data = err.response?.data;
      setEditError(data?.details?.join(', ') || data?.error || 'Failed to update user.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete user "${user.name || user.email}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/admin/users/${user.id}`);
      toast.success('User deleted successfully.');
      await fetchUsers();
    } catch (err) {
      toast.danger(err.response?.data?.error || 'Failed to delete user.');
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.mobile || '').includes(q);
    const matchesRole = !roleFilter || u.role === roleFilter;
    const matchesStatus = statusFilter === '' ? true : statusFilter === 'active' ? u.is_active : !u.is_active;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <>
      <PanelHeader
        title="Users & Roles"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setIsBulkUploadOpen(true)}>
              <Upload size={16} />
              Bulk Upload
            </Button>
            <Button variant="primary" onClick={() => setIsAddModalOpen(true)}>
              <Plus size={16} />
              Add Shopkeeper
            </Button>
          </div>
        }
      />
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, mobile…"
          className="w-64"
        />
        <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-40">
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="shopkeeper">Shopkeeper</option>
          <option value="beneficiary">Beneficiary</option>
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
        {(search || roleFilter || statusFilter) && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('');
              setRoleFilter('');
              setStatusFilter('');
            }}
          >
            Clear
          </Button>
        )}
      </div>

      <Table>
        <Table.Head>
          <tr>
            {COLUMNS.map((col) => (
              <Table.Cell header key={col}>
                {col}
              </Table.Cell>
            ))}
          </tr>
        </Table.Head>
        <Table.Body>
          {loading ? (
            <Table.LoadingRows rows={6} columns={COLUMNS.length} />
          ) : filteredUsers.length === 0 ? (
            <Table.Empty colSpan={COLUMNS.length}>
              <EmptyState
                icon={<UserCog size={20} />}
                title={users.length === 0 ? 'No users found' : 'No users match the current filters'}
              />
            </Table.Empty>
          ) : (
            filteredUsers.map((user) => (
              <Table.Row key={user.id}>
                <Table.Cell>
                  <Badge status={getRoleBadgeStatus(user.role)}>{user.role}</Badge>
                </Table.Cell>
                <Table.Cell>{user.name || '—'}</Table.Cell>
                <Table.Cell>{user.email || '—'}</Table.Cell>
                <Table.Cell>{user.mobile || '—'}</Table.Cell>
                <Table.Cell>
                  <Badge status={user.is_active ? 'success' : 'danger'} dot>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openEdit(user)}
                      className="rounded-sm text-xs font-medium text-brand-500 transition hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      Edit
                    </button>
                    {user.role !== 'admin' && (
                      <button
                        onClick={() => handleDelete(user)}
                        className="rounded-sm text-xs font-medium text-danger-text transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table>

      <AddShopkeeperModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSuccess={fetchUsers} />
      <ShopkeeperBulkUploadModal isOpen={isBulkUploadOpen} onClose={() => setIsBulkUploadOpen(false)} onSuccess={fetchUsers} />

      <Modal
        isOpen={Boolean(editUser)}
        onClose={closeEdit}
        title="Edit User"
        footer={
          <>
            <Button variant="secondary" onClick={closeEdit}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="edit-user-form" disabled={editSubmitting}>
              {editSubmitting ? 'Saving…' : 'Update User'}
            </Button>
          </>
        }
      >
        {editUser && (
          <form id="edit-user-form" onSubmit={handleEditSubmit} className="space-y-4">
            <Badge status={getRoleBadgeStatus(editUser.role)}>{editUser.role}</Badge>

            {editError && (
              <div className="rounded-sm border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-text">
                {editError}
              </div>
            )}

            <Input label="Name" name="name" value={editForm.name} onChange={handleEditChange} placeholder="Full name" />
            <Input
              label="Email"
              name="email"
              type="email"
              value={editForm.email}
              onChange={handleEditChange}
              placeholder="Email address"
            />
            <Input
              label="Mobile"
              name="mobile"
              value={editForm.mobile}
              onChange={handleEditChange}
              placeholder="Mobile number"
            />

            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input
                name="is_active"
                type="checkbox"
                checked={editForm.is_active}
                onChange={handleEditChange}
                className="h-4 w-4 accent-brand-500"
              />
              Active
            </label>
          </form>
        )}
      </Modal>
    </div>
    </>
  );
};

export default Users;
