import { type IntegrationsModalState } from '../../hooks/useIntegrationsLogic';
import { DataSourceModal } from './Modal/DataSourceModal';
import { BedrockDataSourceModal, type BedrockCredentials } from './Modal/BedrockDataSourceModal';
import { DeleteDataSourceModal } from './Modal/DeleteDataSourceModal';

interface DataSourcesModalsManagerProps {
  readonly modalState: IntegrationsModalState;
  readonly onUpdateInputValue: (value: string) => void;
  readonly onSaveKey: () => Promise<void>;
  readonly onSaveBedrockKey: (credentials: BedrockCredentials) => Promise<void>;
  readonly onConfirmDelete: () => Promise<void>;
  readonly onCloseActiveModal: () => void;
  readonly onCloseBedrockModal: () => void;
  readonly onCancelDelete: () => void;
}

export function DataSourcesModalsManager({
  modalState,
  onUpdateInputValue,
  onSaveKey,
  onSaveBedrockKey,
  onConfirmDelete,
  onCloseActiveModal,
  onCloseBedrockModal,
  onCancelDelete,
}: DataSourcesModalsManagerProps) {
  return (
    <>
      <DataSourceModal
        name={modalState.activeModel?.name || null}
        inputValue={modalState.inputValue}
        onChange={onUpdateInputValue}
        onSave={onSaveKey}
        onClose={onCloseActiveModal}
      />

      <DeleteDataSourceModal
        open={!!modalState.deleteTarget}
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
        description={
          modalState.deleteTarget && (
            <>
              Are you sure you want to remove{' '}
              <span className="font-medium">{modalState.deleteTarget.name}</span>? This action
              cannot be undone.
            </>
          )
        }
      />

      <BedrockDataSourceModal
        isOpen={modalState.showBedrockModal}
        onSave={onSaveBedrockKey}
        onClose={onCloseBedrockModal}
      />
    </>
  );
}
