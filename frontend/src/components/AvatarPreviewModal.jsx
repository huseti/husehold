import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import TaskIcon from './icons/taskIcons';
import { memberService } from '../services/api';

// Opened from the account menu's "Edit Image" item -- shows the current
// photo a bit larger, lets you delete it (hover reveals a trash overlay,
// reverting to the initials/color fallback) or upload a new one.
export default function AvatarPreviewModal({ member, onClose, onChanged }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  const handleDelete = async () => {
    const res = await memberService.deleteAvatar(member.id);
    onChanged(res.data);
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await memberService.uploadAvatar(member.id, file);
    onChanged(res.data);
    e.target.value = '';
  };

  const initials = member?.user?.username?.[0]?.toUpperCase() || '?';

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-30"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6 flex flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="group relative h-40 w-40 rounded-full overflow-hidden border-4 border-gray-100">
          {member.avatar ? (
            <>
              <img src={member.avatar} alt={member.user.username} className="h-full w-full object-cover" />
              <button
                onClick={handleDelete}
                title={t('common.removeImage')}
                className="absolute inset-0 flex items-center justify-center bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <TaskIcon icon="trash" className="text-2xl" />
                <span className="sr-only">{t('common.removeImage')}</span>
              </button>
            </>
          ) : (
            <div
              className="h-full w-full flex items-center justify-center text-white text-5xl font-semibold"
              style={{ backgroundColor: member.color_hex }}
            >
              {initials}
            </div>
          )}
        </div>

        <p className="text-sm font-medium text-gray-700">{member.user?.username}</p>

        <div className="flex gap-2">
          <button
            onClick={handleUploadClick}
            className="text-sm px-3 py-1.5 rounded bg-blue-500 text-white hover:bg-blue-600"
          >
            {t('common.uploadNewPhoto')}
          </button>
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300"
          >
            {t('weeklyPlanning.cancel')}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
