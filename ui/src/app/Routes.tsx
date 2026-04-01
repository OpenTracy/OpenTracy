import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from '@/app/AppLayout';
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner';

const Observability = lazy(() => import('@/features/observability'));
const Traces = lazy(() => import('@/views/Traces'));
const DataSources = lazy(() => import('@/views/DataSources'));
const DistillDatasets = lazy(() => import('@/features/distill-dataset'));
const DatasetDetail = lazy(
  () => import('@/features/distill-dataset/components/DatasetDetail/DatasetDetailPage')
);
const Evaluations = lazy(() => import('@/features/evaluations'));
export function AppRoutes() {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <Routes>
        <Route index element={<Navigate to="traces" replace />} />

        <Route element={<AppLayout />}>
          <Route path="traces" element={<Traces />} />
          <Route path="observability" element={<Observability />} />
          <Route path="data-sources" element={<DataSources />} />
          <Route path="distill-datasets" element={<DistillDatasets />} />
          <Route path="distill-datasets/:datasetId" element={<DatasetDetail />} />
          <Route path="distill-datasets/:datasetId/:tab" element={<DatasetDetail />} />
          <Route path="evaluations" element={<Evaluations />} />
        </Route>

        <Route path="*" element={<Navigate to="traces" replace />} />
      </Routes>
    </Suspense>
  );
}
