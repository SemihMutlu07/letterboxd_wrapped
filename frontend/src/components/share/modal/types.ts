import type { ShareCardInput } from '@/components/share/types';

export type Orientation = 'horizontal' | 'vertical';

export type ShareModalProps = {
  open: boolean;
  onClose: () => void;
  orientation: Orientation;
  setOrientation: (o: Orientation) => void;
  cardProps: ShareCardInput;
  onDownloadSuccess?: () => void;
};
