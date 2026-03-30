import { useEffect, useState } from 'react';
import { FormDialog } from '../../Modals';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface BedrockCredentials {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly region: string;
}

interface BedrockDataSourceModalProps {
  readonly isOpen: boolean;
  readonly onSave: (credentials: BedrockCredentials) => Promise<void>;
  readonly onClose: () => void;
}

const DEFAULT_REGION = 'us-east-1';

export function BedrockDataSourceModal({ isOpen, onSave, onClose }: BedrockDataSourceModalProps) {
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setAccessKeyId('');
      setSecretAccessKey('');
      setRegion(DEFAULT_REGION);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({ accessKeyId, secretAccessKey, region });
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormDialog
      isOpen={isOpen}
      title="Configure AWS Bedrock"
      description="Enter your AWS IAM credentials for Bedrock access"
      submitText="Save"
      cancelText="Cancel"
      loading={loading}
      onSubmit={handleSubmit}
      onCancel={onClose}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="access-key-id">Access Key ID</Label>
          <Input
            id="access-key-id"
            type="text"
            placeholder="AKIA..."
            value={accessKeyId}
            onChange={(e) => setAccessKeyId(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="secret-access-key">Secret Access Key</Label>
          <Input
            id="secret-access-key"
            type="password"
            placeholder="Secret access key..."
            value={secretAccessKey}
            onChange={(e) => setSecretAccessKey(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="region">Region</Label>
          <Input
            id="region"
            type="text"
            placeholder={DEFAULT_REGION}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            disabled={loading}
            required
          />
        </div>
      </div>
    </FormDialog>
  );
}
