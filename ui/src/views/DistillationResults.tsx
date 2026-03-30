import { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function DistillationResults() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const params = searchParams.toString();
    navigate(`/distill-job/${jobId}${params ? `?${params}` : ''}`, { replace: true });
  }, [jobId, navigate, searchParams]);

  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}
