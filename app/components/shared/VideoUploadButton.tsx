import { useRef, useState } from 'react';
import { Button, Icon } from 'konsta/react';
import { CloudUpload } from 'framework7-icons/react';
import { MdUpload } from 'react-icons/md';
import { MAX_ROLL_VIDEO_BYTES, SUPPORT_EMAIL } from '../../config/app.config';
import { buildManualVideoUploadMailto } from '../../domain/rolls';
import { useAppStore } from '../../store';
import { uploadRollVideo } from '../../services/supabase/storage';
import { AnimatedPanelOverlay } from './AnimatedPanelOverlay';

export function VideoUploadButton() {
  const rollActive = useAppStore((s) => s.rollActive);
  const activeRollDbId = useAppStore((s) => s.activeRollDbId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showNoRollModal, setShowNoRollModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleButtonClick = () => {
    setErrorMsg(null);
    if (!rollActive || !activeRollDbId) {
      setShowNoRollModal(true);
      return;
    }
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!rollActive || !activeRollDbId) {
      setShowNoRollModal(true);
      return;
    }

    if (!file.type.startsWith('video/')) {
      setErrorMsg('Please select a video file.');
      return;
    }
    if (file.size > MAX_ROLL_VIDEO_BYTES) {
      setErrorMsg('Video must be under 20 MB.');
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    try {
      await uploadRollVideo(activeRollDbId, file);
      setUploadedName(file.name);
    } catch (err) {
      console.error('Video upload failed:', err);
      setErrorMsg('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        aria-hidden
        onChange={(e) => void handleFileChange(e)}
      />

      <AnimatedPanelOverlay
        open={showNoRollModal}
        onClose={() => setShowNoRollModal(false)}
        origin="top"
        title="No active roll"
        footer={
          <Button large href={buildManualVideoUploadMailto(SUPPORT_EMAIL)} className="w-full">
            Email SRS Data Team
          </Button>
        }
      >
        <p className="text-sm leading-relaxed text-center">
          There is no current roll to upload your video to now. You can email it to the SRS Data
          Team to manually upload it.
        </p>
      </AnimatedPanelOverlay>

      <Button large tonal className="w-full" onClick={handleButtonClick} disabled={uploading}>
        <Icon
          ios={<CloudUpload className="w-5 h-5 mr-2" />}
          material={<MdUpload className="w-5 h-5 mr-2" />}
        />
        {uploading ? 'Uploading...' : uploadedName ? `Uploaded: ${uploadedName}` : 'Upload a video'}
      </Button>

      {errorMsg && (
        <p className="mt-2 text-xs text-red-400 text-center font-medium">{errorMsg}</p>
      )}
    </>
  );
}
