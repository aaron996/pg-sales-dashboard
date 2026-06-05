import React, { useState, useEffect } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, handleFirestoreError, OperationType } from '../lib/supabase';
import { LogOut, Users, Shield, Trash2, Check, RefreshCw, User, Loader2 } from 'lucide-react';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: 'dev' | 'admin' | 'user' | 'pending';
  createdAt?: any;
  updatedAt?: any;
}

// 1. LOGIN SCREEN COMPONENT
export const LoginScreen: React.FC<{ onAuthSuccess: (u: SupabaseUser, profile: UserProfile) => void }> = ({ onAuthSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Có lỗi xảy ra khi đăng nhập bằng Google. Vui lòng thử lại.');
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-brand-header">
          <img className="login-logo" src="https://i.ibb.co/DDQVDRbH/image.png" alt="P&G Logo" />
          <h1 className="login-title">P&G Sales Operations</h1>
          <p className="login-subtitle">Hệ thống giám sát và quản lý doanh số BA Việt Nam</p>
        </div>

        <div className="login-body">
          <p className="login-intro">
            Để truy cập danh sách thiết bị và tiến độ doanh số của chiến dịch, vui lòng đăng nhập bằng tài khoản Google của bạn.
          </p>

          {error && (
            <div className="login-error-alert">
              <span className="error-icon">⚠️</span>
              <p className="error-text">{error}</p>
            </div>
          )}

          <button 
            className="btn-google-login" 
            onClick={handleGoogleLogin} 
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="animate-spin mr-2" size={18} />
            ) : (
              <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
            )}
            <span>{loading ? 'Đang xác thực...' : 'Đăng nhập với Google'}</span>
          </button>
        </div>

        <div style={{ height: '24px' }} />
      </div>
    </div>
  );
};


export const PendingApprovalScreen: React.FC<{ user: SupabaseUser, profile: UserProfile, onLogout: () => void }> = ({ user, profile, onLogout }) => {
  return (
    <div className="login-screen-container">
      <div className="login-card" style={{ maxWidth: '440px', textAlign: 'center' }}>
        <div className="login-logo-circle" style={{ background: '#fef3c7', color: '#d97706', margin: '0 auto 16px' }}>
          <Shield size={28} />
        </div>
        <h2 className="login-title" style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Chờ Phê Duyệt</h2>
        <p className="login-subtitle" style={{ fontSize: '0.9rem', marginBottom: '24px' }}>
          Tài khoản <strong>{profile.email}</strong> của bạn vừa được tạo và cần được quản trị viên phê duyệt trước khi có thể truy cập hệ thống.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
          <a
            className="btn btn-primary"
            style={{ display: 'flex', justifyContent: 'center', width: '100%', textDecoration: 'none' }}
            href={`mailto:luongthevinh996@gmail.com?subject=Yêu cầu duyệt tài khoản báo cáo Interdist&body=Chào Vinh,%0A%0AVui lòng duyệt quyền truy cập báo cáo Sales Ops cho tài khoản sau:%0A- Email: ${profile.email}%0A- Tên: ${profile.displayName || ''}%0A%0ACảm ơn.`}
          >
            Gửi Email Yêu Cầu Duyệt
          </a>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => supabase.auth.signOut().then(onLogout)}>
            Đăng xuất / Đổi tài khoản
          </button>
        </div>
      </div>
    </div>
  );
};

// 2. USER PROFILE MENU (FOR SIDEBAR)
export const UserProfileMenu: React.FC<{ 
  profile: UserProfile, 
  onLogout: () => void,
  onOpenUserMgmt?: () => void
}> = ({ profile, onLogout, onOpenUserMgmt }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleClose = () => setOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(!open);
  };

  const handleSwitchAccount = async () => {
    try {
      await supabase.auth.signOut();
      onLogout();
    } catch (err) {
      console.error("Error logging out:", err);
    }
  };

  const displayAvatar = profile.photoURL ? (
    <img src={profile.photoURL} alt={profile.displayName || ''} className="user-avatar" referrerPolicy="no-referrer" />
  ) : (
    <div className="user-avatar-placeholder">
      <User size={14} />
    </div>
  );

  return (
    <div className="user-profile-menu-container">
      <div className="user-profile-summary" onClick={toggleDropdown} style={{ cursor: 'pointer' }}>
        {displayAvatar}
        <div className="user-text-info">
          <div className="user-profile-name">{profile.displayName || 'Thành viên'}</div>
          <div className="user-profile-role-badge">
            <span className={`role-dot ${profile.role}`} />
            <span className="role-text-lbl">
              {profile.role === 'dev' ? 'Developer' : (profile.role === 'admin' ? 'Quản trị viên' : 'Nhân viên')}
            </span>
          </div>
        </div>
      </div>

      {open && (
        <div className="user-profile-dropdown" onClick={e => e.stopPropagation()}>
          <div className="dropdown-user-header">
            <div className="dropdown-email">{profile.email}</div>
          </div>

          <button className="dropdown-action-btn" onClick={(e) => { setOpen(false); onOpenUserMgmt?.(); }}>
            <Users size={14} />
            <span>Quản lý User</span>
          </button>

          <button className="dropdown-action-btn" onClick={handleSwitchAccount}>
            <RefreshCw size={14} />
            <span>Đổi tài khoản</span>
          </button>

          <button className="dropdown-action-btn logout-btn" onClick={onLogout} style={{ borderTop: '1px solid var(--c-border)' }}>
            <LogOut size={14} />
            <span>Đăng xuất</span>
          </button>
        </div>
      )}
    </div>
  );
};


// 3. USER MANAGEMENT PANEL (FOR BOTH ADMINS AND USERS)
export const UserManagementPanel: React.FC<{ 
  currentUserId: string,
  userRole?: 'dev' | 'admin' | 'user',
  onBackToDashboard: () => void 
}> = ({ currentUserId, userRole = 'user', onBackToDashboard }) => {
  const isDev = userRole === 'dev';
  const isAdmin = userRole === 'admin' || userRole === 'dev';
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // States for Manual Add Form
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'dev' | 'admin' | 'user'>('user');

  const fetchUsers = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('createdAt', { ascending: false });
      if (error) throw error;

      const list: UserProfile[] = (data || []).map((row: any) => ({
        uid: row.uid,
        email: row.email || '',
        displayName: row.displayName || null,
        photoURL: row.photoURL || null,
        role: row.role || 'user',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
      setUsersList(list);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Không có quyền tải danh sách User. Chỉ Quản trị viên mới được truy cập.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  const handleUpdateRole = async (userId: string, currentRole: string) => {
    if (userId === currentUserId) {
      setErrorMsg('Bạn không tự hạ quyền hoặc thay đổi vai trò của chính mình!');
      return;
    }

    if (!isDev) {
      setErrorMsg('Chỉ Developer mới có quyền thay đổi vai trò.');
      return;
    }
    
    // Cycle roles: pending -> user -> admin -> dev -> pending
    let nextRole = 'user';
    if (currentRole === 'pending') nextRole = 'user';
    else if (currentRole === 'user') nextRole = 'admin';
    else if (currentRole === 'admin') nextRole = 'dev';
    else if (currentRole === 'dev') nextRole = 'pending';
    
    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          role: nextRole,
          updatedAt: new Date().toISOString()
        })
        .eq('uid', userId);
      if (error) throw error;
      await fetchUsers();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Thay đổi vai trò thất bại: Lỗi bảo mật hoặc quyền hạn.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string, targetRole: string) => {
    if (userId === currentUserId) {
      setErrorMsg('Bạn không thể xóa chính mình khỏi hệ thống!');
      return;
    }

    if (!isDev && !isAdmin) {
      setErrorMsg('Không có quyền!');
      return;
    }

    if (!isDev && (targetRole === 'dev' || targetRole === 'admin')) {
      setErrorMsg('Chỉ Developer mới có quyền xóa tài khoản Quản trị viên hoặc Developer!');
      return;
    }

    setDeleteConfirmId(null);
    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('uid', userId);
      if (error) throw error;
      await fetchUsers();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Xóa tài khoản thất bại: Lỗi bảo mật hoặc quyền hạn.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSeedMockData = async () => {
    setActionLoading('seeding');
    try {
      const seeds = [
        { uid: "chien_pg", displayName: "Nguyễn Văn Chiến (Sup CHIEN)", email: "chien.nv@pg-com", photoURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&auto=format&q=80", role: 'user' },
        { uid: "tung_pg", displayName: "Phạm Thanh Tùng (Sup TUNG)", email: "tung.pt@pg-com", photoURL: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&fit=crop&auto=format&q=80", role: 'user' },
        { uid: "hoa_pg", displayName: "Trần Mai Hoa (Sup HOA)", email: "hoa.tm@pg-com", photoURL: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&fit=crop&auto=format&q=80", role: 'admin' },
        { uid: "kiet_pg", displayName: "Lê Văn Kiệt (Sup KIET)", email: "kiet.lv@pg-com", photoURL: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&fit=crop&auto=format&q=80", role: 'user' },
        { uid: "ba001_pg", displayName: "Nguyễn Thị Thu (BA Master)", email: "ba.thu@pg-com", photoURL: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&fit=crop&auto=format&q=80", role: 'user' },
      ];
      
      for (const item of seeds) {
        const { error } = await supabase
          .from('profiles')
          .upsert({
            uid: item.uid,
            email: item.email,
            displayName: item.displayName,
            photoURL: item.photoURL,
            role: item.role,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }, { onConflict: 'uid' });
        if (error) throw error;
      }
      await fetchUsers();
      setErrorMsg('Đã tải và lưu thành công 5 thành viên mẫu (Supervisors & BAs) vào Supabase database!');
    } catch (errKey: any) {
      console.error(errKey);
      setErrorMsg('Lỗi khi seed dữ liệu: Quyền hạn Supabase hoặc kết nối mạng.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserName.trim()) {
      setErrorMsg('Vui lòng nhập đầy đủ Tên và Email!');
      return;
    }
    if (!isDev && (newUserRole === 'dev' || newUserRole === 'admin')) {
      setErrorMsg('Chỉ Developer mới có quyền thêm tài khoản Quản trị viên (Admin) hoặc Developer!');
      return;
    }
    setActionLoading('creating');
    try {
      const generatedUid = `user_${Date.now()}`;
      const newProfile: UserProfile = {
        uid: generatedUid,
        email: newUserEmail.trim(),
        displayName: newUserName.trim(),
        photoURL: null,
        role: newUserRole,
      };

      const { error } = await supabase
        .from('profiles')
        .insert({
          uid: newProfile.uid,
          email: newProfile.email,
          displayName: newProfile.displayName,
          photoURL: newProfile.photoURL,
          role: newProfile.role,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      if (error) throw error;

      await fetchUsers();
      setErrorMsg(`Đã thêm thành công thành viên: ${newUserName}`);
      // Reset inputs
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRole('user');
      setIsAddFormOpen(false);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Thêm thành viên thất bại: Hệ thống lỗi hoặc phân quyền rules từ chối.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="admin-users-panel">
      <div className="admin-users-header" style={{ marginBottom: '20px' }}>
        <div>
          <h2 className="admin-panel-title">Phân Quyền & Quản Lý Thành Viên</h2>
          <p className="admin-panel-subtitle">Quản lý phân loại tài khoản Admin và tài khoản thường (Standard)</p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {isAdmin && (
            <>
              <button 
                type="button"
                className="btn btn-secondary" 
                onClick={handleSeedMockData} 
                disabled={actionLoading === 'seeding'}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--c-bg-3)', borderColor: 'var(--c-border-strong)' }}
              >
                <RefreshCw className={`w-4 h-4 ${actionLoading === 'seeding' ? 'animate-spin' : ''}`} />
                <span>Nạp 5 thành viên mẫu (Seed)</span>
              </button>

              <button 
                type="button"
                className="btn btn-primary"
                onClick={() => setIsAddFormOpen(!isAddFormOpen)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>{isAddFormOpen ? 'Đóng form thêm' : '+ Thêm thành viên'}</span>
              </button>
            </>
          )}

          <button className="btn btn-secondary" onClick={onBackToDashboard}>
            Quay lại Dashboard
          </button>
        </div>
      </div>

      {!isAdmin && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.15)',
          borderRadius: '10px',
          color: 'var(--c-accent)',
          fontSize: '13.5px',
          fontWeight: '500',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Shield size={16} />
          <span>Chế độ Xem (Read-only) — Chỉ Quản trị viên mới có quyền thêm, sửa, xoá thành viên.</span>
        </div>
      )}

      {/* Manual Creation Form */}
      {isAddFormOpen && (
        <form onSubmit={handleCreateUser} className="login-card" style={{ maxWidth: '100%', margin: '0 0 24px 0', border: '1px solid var(--c-border-strong)', padding: '20px', borderRadius: '8px', background: 'var(--c-bg-2)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '14px', color: 'var(--c-text-1)' }}>THÊM THÀNH VIÊN MỚI THỦ CÔNG</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--c-text-3)' }}>HỌ VÀ TÊN</label>
              <input 
                type="text"
                placeholder="Ví dụ: Nguyễn Văn A"
                value={newUserName}
                aria-label="Full Name"
                onChange={e => setNewUserName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--c-border-strong)',
                  background: 'var(--c-bg-1)',
                  color: 'var(--c-text-1)',
                  fontSize: '13.5px'
                }}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--c-text-3)' }}>TÀI KHOẢN EMAIL</label>
              <input 
                type="email"
                placeholder="Dùng đăng nhập: email@gmail.com"
                value={newUserEmail}
                aria-label="Email"
                onChange={e => setNewUserEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--c-border-strong)',
                  background: 'var(--c-bg-1)',
                  color: 'var(--c-text-1)',
                  fontSize: '13.5px'
                }}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--c-text-3)' }}>VAI TRÒ / QUYỀN TRUY CẬP</label>
              <select 
                value={newUserRole}
                aria-label="Select Role"
                onChange={e => setNewUserRole(e.target.value as 'dev' | 'admin' | 'user')}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--c-border-strong)',
                  background: 'var(--c-bg-1)',
                  color: 'var(--c-text-1)',
                  fontSize: '13.5px'
                }}
              >
                <option value="user">Standard (Nhân viên thường)</option>
                <option value="admin" disabled={!isDev}>Admin (Quản trị viên) {!isDev ? '- Chỉ Dev' : ''}</option>
                <option value="dev" disabled={!isDev}>Developer (Nhà phát triển) {!isDev ? '- Chỉ Dev' : ''}</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => setIsAddFormOpen(false)}
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              Hủy
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={actionLoading === 'creating'}
              style={{ fontSize: '13px', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {actionLoading === 'creating' ? <Loader2 className="animate-spin w-4 h-4" /> : null}
              <span>Xác nhận thêm</span>
            </button>
          </div>
        </form>
      )}

      {errorMsg && (
        <div className="admin-panel-error alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0 }}>{errorMsg}</p>
          <button 
            type="button" 
            onClick={() => setErrorMsg(null)} 
            style={{ background: 'transparent', border: 'none', color: '#b91c1c', cursor: 'pointer', fontWeight: 'bold' }}>
            ×
          </button>
        </div>
      )}

      {loading ? (
        <div className="admin-panel-loading">
          <RefreshCw className="animate-spin mb-2 text-primary" size={24} />
          <span>Đang tải danh sách tài khoản thành viên...</span>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Thành viên</th>
                <th>Email</th>
                <th>Phân loại tài khoản</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {usersList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-muted py-6">
                    Không tìm thấy thành viên nào trong hệ thống.
                  </td>
                </tr>
              ) : (
                usersList.map((usr) => {
                  const isSelf = usr.uid === currentUserId;
                  const isLoading = actionLoading === usr.uid;

                  return (
                    <tr key={usr.uid} className={isSelf ? 'highlight-self-row' : ''}>
                      <td>
                        <div className="admin-user-cell">
                          {usr.photoURL ? (
                            <img src={usr.photoURL} alt="" className="table-user-avatar" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="table-user-avatar-placeholder">
                              <User size={12} />
                            </div>
                          )}
                          <div>
                            <div className="table-user-name">
                              {usr.displayName || 'Ẩn danh'} {isSelf && <span className="self-tag">(Bạn)</span>}
                            </div>
                            <div className="table-user-sub font-mono">{usr.uid.substring(0, 14)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="mono small">{usr.email}</td>
                      <td>
                        <div className="role-selector-wrapper">
                          <button 
                            className={`badge-toggle bg-badge ${usr.role}`}
                            onClick={() => isDev && !isSelf && handleUpdateRole(usr.uid, usr.role)}
                            disabled={!isDev || isSelf || isLoading}
                            title={!isDev ? "Chỉ Developer mới được quyền sửa vai trò" : isSelf ? "Bạn không thể sửa vai trò của chính mình" : "Click để thay đổi vai trò"}
                            style={{ cursor: isDev && !isSelf ? 'pointer' : 'default' }}
                          >
                            <Shield size={12} className="inline mr-1" />
                            <span>{usr.role === 'dev' ? 'Developer' : (usr.role === 'admin' ? 'Admin' : (usr.role === 'pending' ? 'Pending (Chờ duyệt)' : 'Standard'))}</span>
                          </button>
                        </div>
                      </td>
                      <td>
                        <div className="admin-actions-cell">
                          {isAdmin ? (
                            deleteConfirmId === usr.uid ? (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                  className="action-btn"
                                  style={{ backgroundColor: '#ef4444', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '11px' }}
                                  onClick={() => handleDeleteUser(usr.uid, usr.role)}
                                  disabled={isLoading}
                                >
                                  Xóa
                                </button>
                                <button
                                  className="action-btn"
                                  style={{ backgroundColor: '#e5e7eb', color: '#374151', padding: '4px 8px', borderRadius: '4px', fontSize: '11px' }}
                                  onClick={() => setDeleteConfirmId(null)}
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : (
                              <button 
                                className="action-btn delete-btn"
                                onClick={() => setDeleteConfirmId(usr.uid)}
                                disabled={isSelf || isLoading}
                                title={isSelf ? "Không thể xóa chính mình" : "Xóa người dùng"}
                              >
                                <Trash2 size={14} />
                              </button>
                            )
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--c-text-3)', fontStyle: 'italic' }}>Không có quyền</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
