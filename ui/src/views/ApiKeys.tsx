import { useState, useEffect } from 'react';
import { Plus, Key } from 'lucide-react';

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageHeader } from '../components/shared/PageHeader';

import { useApiKeys } from '../hooks/useApiKeys';
import { useRouterKeyStorage } from '../hooks/useRouterKeyStorage';
import { CreateApiKeyFormModal } from '../components/AccessKeys/CreateApiKeyFormModal';
import { AccessKeysCreatedModal } from '../components/AccessKeys/AccessKeysCreatedModal';
import { ConfirmDeleteModal } from '../components/AccessKeys/ConfirmDeleteModal';
import ApiKeyItem from '../components/AccessKeys/ApiKeyItem';
import { Skeleton } from '@/components/ui/skeleton';

export default function ApiKeys() {
  const {
    apiKeys,
    loading,
    creating,
    deleting,
    error,
    createApiKey,
    deleteApiKey,
    getApiKeyByUuid,
    clearError,
    clearLastCreatedKey,
    lastCreatedKey,
  } = useApiKeys();

  const { saveRouterKey } = useRouterKeyStorage();

  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!lastCreatedKey) return;
    const secret = lastCreatedKey.key;
    if (typeof secret === 'string' && (secret.startsWith('sk-') || secret.startsWith('pk_live_'))) {
      setNewKey(secret);
      saveRouterKey(secret);
      console.log('[ApiKeys] API key saved to localStorage for playground use');
    } else {
      console.warn('[ApiKeys] lastCreatedKey.key missing or unexpected:', lastCreatedKey);
    }
  }, [lastCreatedKey, saveRouterKey]);

  const handleCreateKey = async (name: string) => {
    const created = await createApiKey({ name });

    if (created) {
      toast.success('API key created successfully!');
    } else if (error) {
      toast.error(error);
      clearError();
    }
  };

  const confirmDeleteKey = (uuid: string) => {
    const apiKey = getApiKeyByUuid(uuid);
    if (apiKey) {
      setKeyToDelete(apiKey.id);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!keyToDelete) return;
    const success = await deleteApiKey(keyToDelete);

    if (success) {
      toast.success('API key deleted successfully!');
    } else {
      toast.error(error || 'Failed to delete API key. Please try again.');
      clearError();
    }
    setKeyToDelete(null);
  };

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="API Keys"
        action={
          <CreateApiKeyFormModal
            trigger={
              <Button loading={creating}>
                <Plus className="w-4 h-4" />
                Create API Key
              </Button>
            }
            loading={creating}
            onCreate={handleCreateKey}
          />
        }
      />

      <main className="max-w-6xl mx-auto px-6 py-10">
        {loading ? (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-background-secondary border border-border rounded-xl px-4 py-4"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                  </div>
                </div>
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            ))}
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="p-12 text-center">
              <div className="w-14 h-14 bg-brand/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Key className="w-7 h-7 text-brand" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No API Keys Yet</h3>
              <p className="text-sm text-foreground-muted max-w-md mx-auto">
                Create an API key to start accessing your distilled models and integrated teacher
                APIs.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-track-background-secondary scrollbar-thumb-foreground-muted hover:scrollbar-thumb-foreground-secondary">
            {apiKeys.map((key) => (
              <ApiKeyItem
                key={key.uuid}
                keyData={key}
                onDelete={() => confirmDeleteKey(key.uuid)}
              />
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-sm text-foreground-secondary">
          <span>
            {apiKeys.length} API key{apiKeys.length !== 1 ? 's' : ''}
          </span>
        </div>
      </main>

      <AccessKeysCreatedModal
        newKey={newKey}
        onClose={() => {
          setNewKey(null);
          clearLastCreatedKey();
        }}
      />

      <ConfirmDeleteModal
        isOpen={!!keyToDelete}
        onClose={() => setKeyToDelete(null)}
        onConfirm={handleDeleteConfirmed}
        loading={deleting}
      />
    </div>
  );
}
