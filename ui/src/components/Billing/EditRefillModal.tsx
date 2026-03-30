'use client';

import { useEffect, useState } from 'react';
import { FormDialog } from '../Modals';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { centsToCurrency, currencyToCents } from '../../utils/formatCurrency';

interface EditRefillModalProps {
  show: boolean;
  refill: {
    refillAmount: number;
    refillTrigger: number;
  };
  onSave: (refillAmount: number, refillTrigger: number) => Promise<void>;
  onClose: () => void;
}

export function EditRefillModal({ show, refill, onSave, onClose }: EditRefillModalProps) {
  const [tempRefillAmount, setTempRefillAmount] = useState<number>(refill.refillAmount);
  const [tempRefillTrigger, setTempRefillTrigger] = useState<number>(refill.refillTrigger);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    setTempRefillAmount(refill.refillAmount);
    setTempRefillTrigger(refill.refillTrigger);
  }, [refill]);

  function handleInputChange(
    e: React.ChangeEvent<HTMLInputElement>,
    setCents: (val: number) => void
  ) {
    const numeric = currencyToCents(e.target.value);
    setCents(numeric);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await onSave(tempRefillAmount, tempRefillTrigger);
    onClose();
    setLoading(false);
  }

  return (
    <FormDialog
      isOpen={show}
      title="Edit Auto Refill"
      submitText="Save"
      cancelText="Cancel"
      onSubmit={handleSubmit}
      onCancel={onClose}
      loading={loading}
    >
      <div className="space-y-2">
        <Label htmlFor="refillAmount">Refill Amount</Label>
        <Input
          id="refillAmount"
          type="text"
          value={centsToCurrency(tempRefillAmount)}
          onChange={(e) => handleInputChange(e, setTempRefillAmount)}
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="refillTrigger">Auto Refill After</Label>
        <Input
          id="refillTrigger"
          type="text"
          value={centsToCurrency(tempRefillTrigger)}
          onChange={(e) => handleInputChange(e, setTempRefillTrigger)}
          disabled={loading}
        />
      </div>
    </FormDialog>
  );
}
