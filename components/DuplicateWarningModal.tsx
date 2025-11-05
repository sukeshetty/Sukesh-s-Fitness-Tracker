import React from 'react';

interface DuplicateWarningModalProps {
  isOpen: boolean;
  duplicateContent: string;
  minutesAgo: number;
  onConfirm: () => void;
  onCancel: () => void;
}

const DuplicateWarningModal: React.FC<DuplicateWarningModalProps> = ({
  isOpen,
  duplicateContent,
  minutesAgo,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div 
        className="bg-black/50 backdrop-blur-xl rounded-2xl ring-1 ring-yellow-500/30 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-yellow-400 mb-2">
                Duplicate Food Entry Detected
              </h3>
              <p className="text-zinc-300 text-sm mb-3">
                You already logged <span className="font-semibold text-white">"{duplicateContent}"</span>
                {minutesAgo === 0 
                  ? ' just a moment ago' 
                  : ` ${minutesAgo} minute${minutesAgo === 1 ? '' : 's'} ago`}.
              </p>
              <p className="text-zinc-400 text-xs">
                Do you want to log this meal again?
              </p>
            </div>
          </div>
          
          <div className="flex gap-3 mt-6">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-semibold transition-colors"
            >
              Log Anyway
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DuplicateWarningModal;