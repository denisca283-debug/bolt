import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { IconButton } from './ui';

type MobileNavProps = {
  open: boolean;
  onClose: () => void;
};

export function MobileNav({ open, onClose }: MobileNavProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        className="absolute inset-0 bg-base-950/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-base-850 border-r border-line-soft shadow-soft-lg animate-slide-in-left">
        <div className="flex items-center justify-end px-3 h-16 border-b border-line-soft">
          <IconButton label="Закрыть" onClick={onClose}>
            <X className="h-5 w-5" />
          </IconButton>
        </div>
        <div className="h-[calc(100%-4rem)]">
          <Sidebar onNavigate={onClose} />
        </div>
      </div>
    </div>
  );
}
