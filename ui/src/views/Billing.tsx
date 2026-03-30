import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

import { useCredits } from '../hooks/useCredits';

import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';

import { EditRefillModal } from '../components/Billing/EditRefillModal';
import { CreditsRemaining } from '../components/Billing/CreditsRemaining';
import { AutoRefillCard } from '../components/Billing/AutoRefillCard';
import { RefillCard } from '../components/Billing/RefillCard';
import { CouponCard } from '../components/Billing/CouponCard';
import { BillingSkeleton } from '../components/Billing/BillingSkeleton';
import { BillingSection } from '../components/Billing/BillingSection';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

export default function Billing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const {
    credits,
    loading,
    error: creditsError,
    toggleAutoRefill,
    updateRefillSettings,
    clearError,
    refreshCredits,
  } = useCredits();

  useEffect(() => {
    const success = searchParams.get('success') === 'true';
    const canceled = searchParams.get('canceled') === 'true';
    const creditsParam = searchParams.get('credits');

    if (success && creditsParam) {
      toast.success(`Payment successful! ${creditsParam} credits have been added.`);
    } else if (canceled) {
      toast.warning('Payment canceled. No charges were made.');
    }

    if (success || canceled) setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const openEditModal = () => {
    if (creditsError) clearError();
    setEditModalOpen(true);
  };
  const closeEditModal = () => {
    if (creditsError) clearError();
    setEditModalOpen(false);
  };

  const handleUpdateRefillSettings = async (refillAmount: number, refillTrigger: number) => {
    const success = await updateRefillSettings(refillAmount, refillTrigger);
    if (success) closeEditModal();
  };

  const handleCouponSuccess = async (creditsAdded: number, newBalance: number) => {
    toast.success(
      `Coupon applied! ${creditsAdded} credits added.\n New balance: $${newBalance.toFixed(2)}`
    );
    await refreshCredits();
  };

  const handleCouponError = (message: string) => toast.error(message);

  const autoRefillEnabled = credits?.autoRefill ?? false;
  const refillAmount = credits?.autoRefillAmount ?? 0;
  const refillTrigger = credits?.autoRefillTrigger ?? 0;

  if (loading) return <BillingSkeleton />;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Billing" />

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {creditsError && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Unable to load billing details</AlertTitle>
            <AlertDescription>{creditsError}</AlertDescription>
          </Alert>
        )}

        <CreditsRemaining />

        <Separator />

        <BillingSection
          title="Auto-Refill"
          description="Automatically add credits when your balance is low"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AutoRefillCard enabled={autoRefillEnabled} toggle={toggleAutoRefill} />
            <RefillCard
              refillAmount={refillAmount}
              refillTrigger={refillTrigger}
              onEdit={openEditModal}
            />
          </div>
        </BillingSection>

        <BillingSection
          title="Redeem Coupon"
          description="Apply a promotional code to add credits to your account"
        >
          <CouponCard onSuccess={handleCouponSuccess} onError={handleCouponError} />
        </BillingSection>
      </div>

      <EditRefillModal
        show={editModalOpen}
        refill={{
          refillAmount,
          refillTrigger,
        }}
        onSave={handleUpdateRefillSettings}
        onClose={closeEditModal}
      />
    </div>
  );
}
