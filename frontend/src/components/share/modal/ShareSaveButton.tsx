'use client';

import { Download, LoaderCircle } from 'lucide-react';

import { useI18n } from '@/i18n/I18nProvider';

type ShareSaveButtonProps = {
  isSaving: boolean;
  onSave: () => void;
};

export function ShareSaveButton({ isSaving, onSave }: ShareSaveButtonProps) {
  const { t } = useI18n();

  return (
    <button
      onClick={onSave}
      disabled={isSaving}
      className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition active:scale-[0.98] ${
        isSaving ? 'opacity-60' : ''
      }`}
      style={{ background: isSaving ? '#333' : '#fff', color: isSaving ? '#888' : '#000' }}
    >
      {isSaving ? <LoaderCircle size={18} className="animate-spin" /> : <Download size={18} />}
      {isSaving ? t('share.preparing') : t('share.save')}
    </button>
  );
}
