import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import type { AdminUserRecord } from '../../types';
import { Icon } from '../../components/ui/Icon';

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'restricted'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserRecord | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUserRecord | null>(null);

  // Form states for Add User
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'moderator' | 'user',
    bio: '',
  });

  // Form states for Edit User
  const [editForm, setEditForm] = useState({
    username: '',
    email: '',
    role: 'user' as 'admin' | 'moderator' | 'user',
    bio: '',
  });

  useEffect(() => {
    loadUsers();
  }, [search, statusFilter, roleFilter, page]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params: any = { page, limit: 15 };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'all') params.status = statusFilter;
      if (roleFilter !== 'all') params.role = roleFilter;

      const res = await api.get('/admin/users', { params });
      if (res.data?.data) {
        setUsers(res.data.data.users);
        setTotalUsers(res.data.data.pagination.total);
      }
    } catch (err: any) {
      console.error('Failed to load users:', err);
      setError('Failed to load user ledger');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleRestriction = async (user: AdminUserRecord) => {
    try {
      const nextState = !user.isRestricted;
      await api.patch(`/admin/users/${user.id}/restriction`, { isRestricted: nextState });
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isRestricted: nextState } : u))
      );
      setActionSuccess(
        nextState
          ? `User @${user.username} has been restricted.`
          : `Restriction lifted for @${user.username}.`
      );
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update user restriction');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await api.post('/admin/users', newUser);
      setShowAddModal(false);
      setNewUser({ username: '', email: '', password: '', role: 'user', bio: '' });
      setActionSuccess('New user account provisioned successfully.');
      setTimeout(() => setActionSuccess(null), 3500);
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create user');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      setError(null);
      await api.put(`/admin/users/${editingUser.id}`, editForm);
      setEditingUser(null);
      setActionSuccess(`User @${editForm.username} updated.`);
      setTimeout(() => setActionSuccess(null), 3500);
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update user');
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    try {
      setError(null);
      await api.delete(`/admin/users/${deletingUser.id}`);
      setDeletingUser(null);
      setActionSuccess(`User @${deletingUser.username} deleted permanently.`);
      setTimeout(() => setActionSuccess(null), 3500);
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const openEditModal = (user: AdminUserRecord) => {
    setEditingUser(user);
    setEditForm({
      username: user.username,
      email: user.email,
      role: user.role,
      bio: user.bio || '',
    });
  };

  return (
    <div className="wren-admin-page">
      {/* Page Header */}
      <div className="wren-admin-page-header">
        <div>
          <h1 className="wren-admin-page-title type-display-m">Authors & User Directory</h1>
          <p className="wren-admin-page-desc type-meta">
            Inspect accounts, manage privileges, provision users, or restrict platform access.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="wren-button wren-button--wine"
        >
          <Icon name="plus" size={16} />
          <span>Provision Author</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="wren-admin-alert wren-admin-alert--success" role="status">
          {actionSuccess}
        </div>
      )}

      {error && (
        <div className="wren-admin-alert wren-admin-alert--error" role="alert">
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="wren-admin-filters-bar">
        <div className="wren-admin-search-wrap">
          <Icon name="search" size={16} className="wren-admin-search-icon" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search author handle or email address..."
            className="wren-admin-search-input"
          />
        </div>

        <div className="wren-admin-filter-group">
          {/* Status filter tabs */}
          <div className="wren-admin-tab-pills" role="tablist">
            <button
              type="button"
              className={`wren-admin-tab-pill ${statusFilter === 'all' ? 'wren-admin-tab-pill--active' : ''}`}
              onClick={() => {
                setStatusFilter('all');
                setPage(1);
              }}
            >
              All
            </button>
            <button
              type="button"
              className={`wren-admin-tab-pill ${statusFilter === 'active' ? 'wren-admin-tab-pill--active' : ''}`}
              onClick={() => {
                setStatusFilter('active');
                setPage(1);
              }}
            >
              Active
            </button>
            <button
              type="button"
              className={`wren-admin-tab-pill ${statusFilter === 'restricted' ? 'wren-admin-tab-pill--active' : ''}`}
              onClick={() => {
                setStatusFilter('restricted');
                setPage(1);
              }}
            >
              Restricted
            </button>
          </div>

          {/* Role selector */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="wren-admin-select"
          >
            <option value="all">All Roles</option>
            <option value="admin">Administrators</option>
            <option value="moderator">Moderators</option>
            <option value="user">Standard Authors</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="wren-admin-panel-card">
        <div className="wren-admin-table-container">
          <table className="wren-admin-table">
            <thead>
              <tr>
                <th>Author</th>
                <th>Email Address</th>
                <th>Privilege</th>
                <th>Account Status</th>
                <th>Letters</th>
                <th>Registered</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="type-meta">Consulting user ledger...</div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="type-meta">No accounts found matching your query.</div>
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className={u.isRestricted ? 'wren-admin-tr--restricted' : ''}>
                    {/* Author Cell */}
                    <td>
                      <div className="wren-admin-author-cell">
                        <div className="wren-admin-author-avatar">
                          {u.profilePicture ? (
                            <img src={u.profilePicture} alt={u.username} />
                          ) : (
                            <span>{u.username[0].toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <span className="wren-admin-author-name">@{u.username}</span>
                          {u.bio && (
                            <span className="wren-admin-author-bio type-meta">{u.bio}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="wren-admin-table__email">{u.email}</td>

                    {/* Role */}
                    <td>
                      <span
                        className={`wren-badge ${
                          u.role === 'admin'
                            ? 'wren-badge--wine'
                            : u.role === 'moderator'
                            ? 'wren-badge--ochre'
                            : 'wren-badge--default'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>

                    {/* Status */}
                    <td>
                      {u.isRestricted ? (
                        <span className="wren-badge wren-badge--rust">
                          <Icon name="lock" size={12} /> Restricted
                        </span>
                      ) : (
                        <span className="wren-badge wren-badge--moss">
                          <Icon name="check" size={12} /> Active
                        </span>
                      )}
                    </td>

                    {/* Counts */}
                    <td className="type-meta">{u.postCount ?? 0}</td>

                    {/* Registered Date */}
                    <td className="type-meta">
                      {new Date(u.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <div className="wren-admin-row-actions">
                        {/* Restrict / Enable button */}
                        <button
                          type="button"
                          onClick={() => handleToggleRestriction(u)}
                          className={`wren-admin-icon-btn ${
                            u.isRestricted ? 'wren-admin-icon-btn--restore' : 'wren-admin-icon-btn--restrict'
                          }`}
                          title={u.isRestricted ? 'Lift restriction' : 'Restrict account'}
                        >
                          <Icon name={u.isRestricted ? 'unlock' : 'lock'} size={15} />
                        </button>

                        {/* Edit button */}
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          className="wren-admin-icon-btn"
                          title="Edit user details"
                        >
                          <Icon name="edit" size={15} />
                        </button>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => setDeletingUser(u)}
                          className="wren-admin-icon-btn wren-admin-icon-btn--danger"
                          title="Delete account permanently"
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Total info & Pagination */}
        <div className="wren-admin-table-footer type-meta">
          <span>Showing {users.length} of {totalUsers} total registered authors</span>
          {Math.ceil(totalUsers / 15) > 1 && (
            <div className="wren-admin-pagination">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="wren-button wren-button--ghost wren-button--sm"
              >
                Previous
              </button>
              <span style={{ padding: '0 0.5rem', color: 'var(--ink-900)' }}>
                Page {page} of {Math.ceil(totalUsers / 15)}
              </span>
              <button
                type="button"
                disabled={page >= Math.ceil(totalUsers / 15)}
                onClick={() => setPage((p) => p + 1)}
                className="wren-button wren-button--ghost wren-button--sm"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="wren-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="wren-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wren-modal-header">
              <h2 className="type-ui-l">Provision New Author</h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="wren-admin-icon-btn"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="wren-modal-form">
              <div className="wren-form-group">
                <label className="type-ui-s">Username</label>
                <input
                  type="text"
                  required
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="e.g. virgini Woolf"
                  className="wren-input"
                />
              </div>

              <div className="wren-form-group">
                <label className="type-ui-s">Email Address</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="author@domain.com"
                  className="wren-input"
                />
              </div>

              <div className="wren-form-group">
                <label className="type-ui-s">Temporary Password</label>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Must include uppercase, lowercase, special char"
                  className="wren-input"
                />
              </div>

              <div className="wren-form-group">
                <label className="type-ui-s">Privilege Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) =>
                    setNewUser({ ...newUser, role: e.target.value as any })
                  }
                  className="wren-select"
                >
                  <option value="user">Standard Author</option>
                  <option value="moderator">Content Moderator</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="wren-form-group">
                <label className="type-ui-s">Author Biography</label>
                <textarea
                  rows={2}
                  value={newUser.bio}
                  onChange={(e) => setNewUser({ ...newUser, bio: e.target.value })}
                  placeholder="Brief note or correspondence bio..."
                  className="wren-textarea"
                />
              </div>

              <div className="wren-modal-actions">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="wren-button wren-button--ghost"
                >
                  Cancel
                </button>
                <button type="submit" className="wren-button wren-button--wine">
                  Provision Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="wren-modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="wren-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wren-modal-header">
              <h2 className="type-ui-l">Edit Author @{editingUser.username}</h2>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="wren-admin-icon-btn"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="wren-modal-form">
              <div className="wren-form-group">
                <label className="type-ui-s">Username</label>
                <input
                  type="text"
                  required
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  className="wren-input"
                />
              </div>

              <div className="wren-form-group">
                <label className="type-ui-s">Email Address</label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="wren-input"
                />
              </div>

              <div className="wren-form-group">
                <label className="type-ui-s">Privilege Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm({ ...editForm, role: e.target.value as any })
                  }
                  className="wren-select"
                >
                  <option value="user">Standard Author</option>
                  <option value="moderator">Content Moderator</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="wren-form-group">
                <label className="type-ui-s">Author Biography</label>
                <textarea
                  rows={2}
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className="wren-textarea"
                />
              </div>

              <div className="wren-modal-actions">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="wren-button wren-button--ghost"
                >
                  Cancel
                </button>
                <button type="submit" className="wren-button wren-button--wine">
                  Save Modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div className="wren-modal-overlay" onClick={() => setDeletingUser(null)}>
          <div className="wren-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wren-modal-header">
              <h2 className="type-ui-l" style={{ color: 'var(--rust-alert)' }}>
                Confirm Permanent Account Removal
              </h2>
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="wren-admin-icon-btn"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="wren-modal-body">
              <p className="type-body-serif" style={{ fontSize: '1rem', lineHeight: '1.5' }}>
                Are you certain you wish to permanently delete the author account for{' '}
                <strong>@{deletingUser.username}</strong> ({deletingUser.email})?
              </p>
              <p className="type-meta" style={{ marginTop: '0.75rem', color: 'var(--rust-alert)' }}>
                This action will cascade delete all correspondence, letters, comments, and relationships. It cannot be undone.
              </p>
            </div>

            <div className="wren-modal-actions">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="wren-button wren-button--ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="wren-button wren-button--rust"
              >
                Delete Author Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
