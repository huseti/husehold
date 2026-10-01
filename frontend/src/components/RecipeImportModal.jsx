import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { recipeImportService } from '../services/api';
import { resizeImageFile } from '../utils/imageResize';

const TABS = [
  { key: 'photo', labelKey: 'recipes.importTabPhoto' },
  { key: 'text', labelKey: 'recipes.importTabText' },
  { key: 'url', labelKey: 'recipes.importTabUrl' },
];

// Photo / paste-text / URL recipe import -- all three end up here, and all
// three just return a draft for review (see RecipeImportView on the
// backend); nothing is saved until the resulting RecipeForm is submitted.
export default function RecipeImportModal({ onClose, onExtracted }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('photo');
  const [images, setImages] = useState([]);
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleFiles = async (fileList) => {
    setError('');
    try {
      const resized = await Promise.all(Array.from(fileList).map(async (file) => {
        const { media_type, data } = await resizeImageFile(file);
        return { id: `${file.name}-${Date.now()}-${Math.random()}`, media_type, data };
      }));
      setImages((prev) => [...prev, ...resized]);
    } catch (err) {
      console.error('Error reading image:', err);
      setError(t('recipes.importPhotoReadFailed'));
    }
  };

  const removeImage = (id) => setImages((prev) => prev.filter((img) => img.id !== id));

  const submit = async () => {
    setError('');
    if (tab === 'photo' && images.length === 0) { setError(t('recipes.importNoPhotos')); return; }
    if (tab === 'text' && !text.trim()) { setError(t('recipes.importNoText')); return; }
    if (tab === 'url' && !url.trim()) { setError(t('recipes.importNoUrl')); return; }

    setBusy(true);
    try {
      let response;
      if (tab === 'photo') {
        response = await recipeImportService.fromImages(images.map(({ media_type, data }) => ({ media_type, data })));
      } else if (tab === 'text') {
        response = await recipeImportService.fromText(text);
      } else {
        response = await recipeImportService.fromUrl(url.trim());
      }
      onExtracted(response.data);
    } catch (err) {
      console.error('Error importing recipe:', err);
      setError(err.response?.data?.detail || t('recipes.importFailed'));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-xl mx-auto my-8 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-semibold">{t('recipes.importTitle')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none" aria-label={t('recipes.close')}>✕</button>
        </div>

        <div className="flex gap-4 border-b mb-4">
          {TABS.map(({ key, labelKey }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setTab(key); setError(''); }}
              className={`pb-2 -mb-px border-b-2 text-sm ${tab === key ? 'border-gray-800 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>

        {tab === 'photo' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">{t('recipes.importPhotoHint')}</p>
            <input type="file" accept="image/*" multiple onChange={(e) => handleFiles(e.target.files)} className="block text-sm" />
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((img) => (
                  <div key={img.id} className="relative">
                    <img src={`data:${img.media_type};base64,${img.data}`} alt="" className="w-20 h-20 object-cover rounded border" />
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      className="absolute -top-2 -right-2 bg-white border border-gray-300 rounded-full w-5 h-5 text-xs text-gray-500 hover:text-red-600 leading-none"
                      aria-label={t('recipes.removeLine')}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'text' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">{t('recipes.importTextHint')}</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={t('recipes.importTextPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        )}

        {tab === 'url' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">{t('recipes.importUrlHint')}</p>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {busy ? t('recipes.importExtracting') : t('recipes.importExtractButton')}
          </button>
          <button type="button" onClick={onClose} className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300">
            {t('recipes.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
