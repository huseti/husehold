import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { memberService } from '../services/api';
import AvatarPreviewModal from './AvatarPreviewModal';

export default function AccountMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [member, setMember] = useState(null);
  const [open, setOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    memberService.getMe().then((res) => setMember(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  };

  const handleEditImageClick = () => {
    setShowPreview(true);
    setOpen(false);
  };

  const initials = member?.user?.username?.[0]?.toUpperCase() || '?';

  return (
    <div className="relative flex-shrink-0" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-10 w-10 rounded-full overflow-hidden border-2 border-gray-200 flex items-center justify-center text-white font-semibold"
        style={{ backgroundColor: member?.color_hex || '#9ca3af' }}
        title={member?.user?.username}
      >
        {member?.avatar ? (
          <img src={member.avatar} alt={member.user.username} className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-20">
          <button
            onClick={handleEditImageClick}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            {t('common.editImage')}
          </button>
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            {t('common.systemSettings')}
          </Link>
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            {t('common.logout')}
          </button>
        </div>
      )}

      {showPreview && member && (
        <AvatarPreviewModal
          member={member}
          onClose={() => setShowPreview(false)}
          onChanged={setMember}
        />
      )}
    </div>
  );
}
