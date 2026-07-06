import { useEffect, useState } from 'react';
import api from '../../api/axios';
import AddShopkeeperModal from '../../components/admin/AddShopkeeperModal';
import ShopkeeperBulkUploadModal from '../../components/admin/ShopkeeperBulkUploadModal';

const getRoleBadgeClass = (role) => {
  if (role === 'admin') return 'bg-purple-900 text-purple-300';
  if (role === 'shopkeeper') return 'bg-green-900 text-green-300';
  return 'bg-gray-700 text-gray-300';
};

const emptyEdit = { name: '', email: '', mobile: '', is_active: true };

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState(emptyEdit);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/api/admin/users');
      setUsers(response.data?.users || response.data?.data || []);
    } catch (fetchError) {
      setError(fetchError.response?.data?.error || 'Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
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
    setEditSuccess('');
  };

  const closeEdit = () => {
    setEditUser(null);
    setEditForm(emptyEdit);
    setEditError('');
    setEditSuccess('');
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError('');
    setEditSuccess('');
    setEditSubmitting(true);
    try {
      await api.put(`/api/admin/users/${editUser.id}`, editForm);
      setEditSuccess('User updated successfully.');
      await fetchUsers();
      setTimeout(closeEdit, 1200);
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
      await fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete user.');
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
    const matchesStatus =
      statusFilter === ''
        ? true
        : statusFilter === 'active'
        ? u.is_active
        : !u.is_active;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="p-8 bg-gray-950 min-h-screen text-white">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsBulkUploadOpen(true)}
            className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 text-sm font-medium border border-gray-600 transition"
          >
            ↑ Bulk Upload
          </button>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition"
          >
            + Add Shopkeeper
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, mobile…"
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition w-64"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="shopkeeper">Shopkeeper</option>
          <option value="beneficiary">Beneficiary</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        {(search || roleFilter || statusFilter) && (
          <button
            type="button"
            onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); }}
            className="text-gray-400 hover:text-white text-sm px-3 py-2 rounded-lg border border-gray-700 hover:border-gray-500 transition"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-900/50 border border-red-700 rounded-xl p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400 uppercase tracking-wider text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Mobile</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center py-12 text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-12 text-gray-500">
                  {users.length === 0 ? 'No users found.' : 'No users match the current filters.'}
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="border-t border-gray-800 hover:bg-gray-800/50 transition"
                >
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getRoleBadgeClass(user.role)}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-200">{user.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-200">{user.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-200">{user.mobile || '—'}</td>
                  <td className="px-4 py-3 text-gray-200">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`inline-block w-2 h-2 rounded-full ${user.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => openEdit(user)}
                        className="text-blue-400 hover:text-blue-300 text-xs font-medium transition"
                      >
                        Edit
                      </button>
                      {user.role !== 'admin' && (
                        <button
                          onClick={() => handleDelete(user)}
                          className="text-red-400 hover:text-red-300 text-xs font-medium transition"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddShopkeeperModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchUsers}
      />

      <ShopkeeperBulkUploadModal
        isOpen={isBulkUploadOpen}
        onClose={() => setIsBulkUploadOpen(false)}
        onSuccess={fetchUsers}
      />

      {editUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="absolute inset-0" onClick={closeEdit} aria-hidden="true" />
          <div className="relative w-full max-w-md bg-gray-900 rounded-2xl p-8 border border-gray-800 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-white">Edit User</h2>
              <button type="button" onClick={closeEdit} className="text-gray-400 hover:text-white transition">✕</button>
            </div>

            {editSuccess && (
              <div className="bg-green-900/40 border border-green-700 rounded-xl p-3 text-green-300 text-sm mb-4">
                {editSuccess}
              </div>
            )}
            {editError && (
              <div className="bg-red-900/40 border border-red-700 rounded-xl p-3 text-red-300 text-sm mb-4">
                {editError}
              </div>
            )}

            <div className="mb-4">
              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getRoleBadgeClass(editUser.role)}`}>
                {editUser.role}
              </span>
            </div>

            <form onSubmit={handleEditSubmit}>
              <label className="text-sm text-gray-400 mb-1 block" htmlFor="edit-name">Name</label>
              <input
                id="edit-name"
                name="name"
                value={editForm.name}
                onChange={handleEditChange}
                placeholder="Full name"
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white w-full text-sm focus:outline-none focus:border-blue-500 transition"
              />

              <label className="text-sm text-gray-400 mb-1 block mt-4" htmlFor="edit-email">Email</label>
              <input
                id="edit-email"
                name="email"
                type="email"
                value={editForm.email}
                onChange={handleEditChange}
                placeholder="Email address"
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white w-full text-sm focus:outline-none focus:border-blue-500 transition"
              />

              <label className="text-sm text-gray-400 mb-1 block mt-4" htmlFor="edit-mobile">Mobile</label>
              <input
                id="edit-mobile"
                name="mobile"
                value={editForm.mobile}
                onChange={handleEditChange}
                placeholder="Mobile number"
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white w-full text-sm focus:outline-none focus:border-blue-500 transition"
              />

              <div className="flex items-center gap-3 mt-5">
                <input
                  id="edit-is-active"
                  name="is_active"
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={handleEditChange}
                  className="w-4 h-4 accent-blue-500"
                />
                <label htmlFor="edit-is-active" className="text-sm text-gray-300 select-none cursor-pointer">
                  Active
                </label>
              </div>

              <button
                type="submit"
                disabled={editSubmitting}
                className="bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2 w-full font-medium text-sm transition mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editSubmitting ? 'Saving...' : 'Update User'}
              </button>
              <button
                type="button"
                onClick={closeEdit}
                className="bg-gray-800 hover:bg-gray-700 rounded-lg px-4 py-2 w-full text-sm text-gray-300 transition mt-2"
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
